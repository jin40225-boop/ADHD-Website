/**
 * 寄信（Gmail API）＋信件狀態機寫入端（計畫第五、七節）。
 *
 * 兩種模式：
 *   1. 單一報名（registrationId）——建/接信件串、寄出、信末自動附「確認出席／請假改期」按鈕、
 *      勾起「已寄信提醒」、狀態轉「已寄出・等待回覆」並依設定算出催覆期限。
 *   2. 群發（contactIds）——同一封信寄給多個聯絡人，各自建立以聯絡人為主的信件串。
 *      群發是宣傳/通知性質，不附出席確認按鈕，也不動任何報名的狀態。
 *
 * ⚠ 範本變數不在這裡帶入。變數是在後台把範本載入編輯框時就替換好的，使用者審閱到的
 *    就是真正會寄出的字；若在這裡才替換，等於讓人審閱一份和實際寄出不同的內容。
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function jsonResponse(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
function b64(input: string) { const bytes = new TextEncoder().encode(input); let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary); }
function b64url(input: string) { return b64(input).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, ''); }
function cleanAddresses(value: unknown): string[] { return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : []; }

async function getGoogleAccessToken() {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID'); const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET'); const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN');
  if (!clientId || !clientSecret || !refreshToken) throw new Error('GOOGLE_SECRETS_MISSING');
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }) });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(`GOOGLE_TOKEN_ERROR:${data.error_description ?? data.error ?? res.status}`);
  return data.access_token as string;
}

async function requireProjectAdmin(req: Request, admin: SupabaseClient, projectId: string) {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: { user } } = await admin.auth.getUser(jwt); if (!user) return null;
  const { data: profile } = await admin.from('profiles').select('is_system_owner').eq('id', user.id).maybeSingle();
  if (profile?.is_system_owner) return { userId: user.id };
  const { data: member } = await admin.from('project_members').select('role').eq('project_id', projectId).eq('user_id', user.id).maybeSingle();
  return member && ['owner', 'admin_collab'].includes(member.role) ? { userId: user.id } : null;
}

/** 群發沒有單一專案可比對，因此比照 gmail-sync：系統擁有者或任一專案的 owner／admin_collab。 */
async function requireAnyAdmin(req: Request, admin: SupabaseClient) {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: { user } } = await admin.auth.getUser(jwt); if (!user) return null;
  const [{ data: profile }, { data: member }] = await Promise.all([
    admin.from('profiles').select('is_system_owner').eq('id', user.id).maybeSingle(),
    admin.from('project_members').select('id').eq('user_id', user.id).in('role', ['owner', 'admin_collab']).limit(1),
  ]);
  return profile?.is_system_owner || member?.length ? { userId: user.id } : null;
}

function randomToken() {
  const bytes = new Uint8Array(24); crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

async function sendViaGmail(accessToken: string, to: string, cc: string[], bcc: string[], subject: string, body: string, gmailThreadId?: string) {
  const headers = [
    `To: ${to}`, ...(cc.length ? [`Cc: ${cc.join(', ')}`] : []), ...(bcc.length ? [`Bcc: ${bcc.join(', ')}`] : []),
    `Subject: =?UTF-8?B?${b64(subject)}?=`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', b64(body),
  ];
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: b64url(headers.join('\r\n')), ...(gmailThreadId ? { threadId: gmailThreadId } : {}) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`GMAIL_SEND_ERROR：${data.error?.message ?? res.status}`);
  return data as { id?: string; threadId?: string; labelIds?: string[] };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let actorId: string | undefined;
  try {
    const input = await req.json();
    const subject = String(input.subject ?? '').trim();
    const body = String(input.body ?? '');
    const cc = cleanAddresses(input.cc); const bcc = cleanAddresses(input.bcc);
    if (!subject || !body.trim()) return jsonResponse({ error: 'subject、body 必填' }, 400);

    const contactIds: string[] = Array.isArray(input.contactIds) ? input.contactIds.map(String) : [];
    const registrationId = String(input.registrationId ?? '');
    if (!registrationId && !contactIds.length) return jsonResponse({ error: '需要 registrationId 或 contactIds' }, 400);

    const accessToken = await getGoogleAccessToken();

    /* ---------------------------- 群發 ---------------------------- */
    if (!registrationId) {
      const caller = await requireAnyAdmin(req, admin); if (!caller) return jsonResponse({ error: 'FORBIDDEN' }, 403); actorId = caller.userId;
      const { data: contacts } = await admin.from('contacts').select('id, display_name, primary_email').in('id', contactIds);
      const targets = (contacts ?? []).filter((contact) => contact.primary_email);
      if (!targets.length) return jsonResponse({ error: '選取的對象都沒有信箱，沒有寄出任何一封。' }, 400);

      const sent: string[] = []; const failed: { contactId: string; reason: string }[] = [];
      for (const contact of targets) {
        try {
          const gmail = await sendViaGmail(accessToken, contact.primary_email, cc, bcc, subject, body);
          const { data: thread } = await admin.from('email_threads')
            .insert({ contact_id: contact.id, gmail_thread_id: gmail.threadId ?? null, subject, counterpart_email: contact.primary_email, last_message_at: new Date().toISOString(), last_outbound_at: new Date().toISOString(), mail_state: 'waiting_reply', needs_reply: false, status: 'waiting' })
            .select('id').single();
          if (thread) {
            await admin.from('email_messages').upsert({ thread_id: thread.id, direction: 'outbound', from_email: 'me', to_email: contact.primary_email, cc_email: cc, bcc_email: bcc, subject, body, snippet: body.slice(0, 240), gmail_message_id: gmail.id ?? null, label_ids: gmail.labelIds ?? ['SENT'], delivery_status: 'sent', is_read: true, sent_at: new Date().toISOString() }, { onConflict: 'gmail_message_id' });
          }
          sent.push(contact.id);
        } catch (err) {
          failed.push({ contactId: contact.id, reason: err instanceof Error ? err.message : String(err) });
        }
      }
      await admin.from('audit_log').insert({ action: 'gmail_bulk_send', actor_id: actorId, target_type: 'contact_group', target_id: 'bulk', result: failed.length ? 'error' : 'success', detail: JSON.stringify({ subject, sent: sent.length, failed }) });
      return jsonResponse({ ok: true, sent: sent.length, failed });
    }

    /* ------------------------- 單一報名 ------------------------- */
    const { data: registration } = await admin.from('registrations').select('id,project_id,email,contact_id,thread_id,session_ids').eq('id', registrationId).maybeSingle();
    if (!registration) return jsonResponse({ error: '找不到報名紀錄' }, 404);
    const caller = await requireProjectAdmin(req, admin, registration.project_id); if (!caller) return jsonResponse({ error: 'FORBIDDEN' }, 403); actorId = caller.userId;

    // 信末的確認按鈕（裁決 12）。預設附上；婉拒信一類不需要時由後台取消勾選。
    const attachConfirmButtons = input.attachConfirmButtons !== false;
    let finalBody = body;
    let confirmToken: string | undefined;
    if (attachConfirmButtons) {
      confirmToken = randomToken();
      const { error: tokenError } = await admin.from('attendance_confirmations').insert({
        registration_id: registration.id,
        session_id: Array.isArray(registration.session_ids) && registration.session_ids.length ? registration.session_ids[0] : null,
        token: confirmToken,
      });
      if (tokenError) throw tokenError;
      const endpoint = `${Deno.env.get('SUPABASE_URL')}/functions/v1/confirm-attendance?token=${confirmToken}`;
      finalBody = `${body}\n\n─────────────────\n請點選其中一個，我們就會收到（點了就完成，不必回信）：\n\n✅ 我確認出席：\n${endpoint}&action=attend\n\n🔁 我需要請假／改期：\n${endpoint}&action=reschedule\n`;
    }

    let threadId = (input.threadId ? String(input.threadId) : '') || registration.thread_id || undefined;
    let gmailThreadId: string | undefined;
    if (threadId) { const { data: existing } = await admin.from('email_threads').select('gmail_thread_id').eq('id', threadId).maybeSingle(); gmailThreadId = existing?.gmail_thread_id ?? undefined; }

    const gmail = await sendViaGmail(accessToken, registration.email, cc, bcc, subject, finalBody, gmailThreadId);

    // 催覆期限依設定的逾期門檻算；設定讀不到就用計畫的預設 3 天。
    const { data: settings } = await admin.from('app_settings').select('follow_up_days').maybeSingle();
    const followUpDays = Number(settings?.follow_up_days ?? 3);
    const now = new Date();
    const followUpDueAt = new Date(now.getTime() + followUpDays * 86400000).toISOString();
    // 催覆信寄出後狀態是「已催覆」，一般信件是「已寄出・等待回覆」。
    const mailState = input.isFollowUp ? 'reminded' : 'waiting_reply';

    if (!threadId) {
      const { data: created, error } = await admin.from('email_threads').insert({ registration_id: registration.id, contact_id: registration.contact_id, gmail_thread_id: gmail.threadId ?? null, subject, counterpart_email: registration.email, last_message_at: now.toISOString(), last_outbound_at: now.toISOString(), follow_up_due_at: followUpDueAt, mail_state: mailState, needs_reply: false, status: 'waiting' }).select('id').single();
      if (error) throw error;
      threadId = created.id;
      await admin.from('registrations').update({ thread_id: threadId }).eq('id', registration.id);
    } else {
      await admin.from('email_threads').update({ gmail_thread_id: gmail.threadId ?? gmailThreadId ?? null, subject, last_message_at: now.toISOString(), last_outbound_at: now.toISOString(), follow_up_due_at: followUpDueAt, mail_state: mailState, has_unread: false, needs_reply: false, status: 'waiting' }).eq('id', threadId);
    }

    const { error: messageError } = await admin.from('email_messages').upsert({ thread_id: threadId, direction: 'outbound', from_email: 'me', to_email: registration.email, cc_email: cc, bcc_email: bcc, subject, body: finalBody, snippet: finalBody.slice(0, 240), gmail_message_id: gmail.id ?? null, label_ids: gmail.labelIds ?? ['SENT'], delivery_status: 'sent', is_read: true, sent_at: now.toISOString() }, { onConflict: 'gmail_message_id' });
    if (messageError) throw messageError;

    // 「已寄信提醒」由寄出這個動作自己勾起來（計畫第五節），不必再靠人手動記得。
    await admin.from('registrations').update({ reminder_sent_at: now.toISOString() }).eq('id', registration.id);
    await admin.from('email_drafts').update({ status: 'sent' }).eq('registration_id', registrationId).eq('thread_id', threadId).eq('status', 'draft');
    await admin.from('audit_log').insert({ action: 'gmail_send', actor_id: actorId, target_type: 'registration', target_id: registration.id, result: 'success', detail: JSON.stringify({ threadId, mailState, confirmButtons: attachConfirmButtons, followUpDueAt }) });
    return jsonResponse({ ok: true, threadId, gmailMessageId: gmail.id, mailState, followUpDueAt, confirmButtons: attachConfirmButtons });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin.from('audit_log').insert({ action: 'gmail_send', actor_id: actorId ?? null, result: 'error', detail: message });
    return jsonResponse({ error: message }, 500);
  }
});
