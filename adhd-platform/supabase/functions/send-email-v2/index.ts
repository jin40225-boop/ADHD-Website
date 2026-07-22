import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function jsonResponse(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
function b64(input: string) { const bytes = new TextEncoder().encode(input); let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary); }
function b64url(input: string) { return b64(input).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, ''); }
async function getGoogleAccessToken() { const clientId = Deno.env.get('GOOGLE_CLIENT_ID'); const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET'); const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN'); if (!clientId || !clientSecret || !refreshToken) throw new Error('GOOGLE_SECRETS_MISSING'); const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }) }); const data = await res.json(); if (!res.ok || !data.access_token) throw new Error(`GOOGLE_TOKEN_ERROR:${data.error_description ?? data.error ?? res.status}`); return data.access_token as string; }
async function requireProjectAdmin(req: Request, admin: SupabaseClient, projectId: string) { const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, ''); const { data: { user } } = await admin.auth.getUser(jwt); if (!user) return null; const { data: profile } = await admin.from('profiles').select('is_system_owner').eq('id', user.id).maybeSingle(); if (profile?.is_system_owner) return { userId: user.id }; const { data: member } = await admin.from('project_members').select('role').eq('project_id', projectId).eq('user_id', user.id).maybeSingle(); return member && ['owner', 'admin_collab'].includes(member.role) ? { userId: user.id } : null; }

function cleanAddresses(value: unknown): string[] { return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : []; }
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let actorId: string | undefined;
  try {
    const input = await req.json();
    const registrationId = String(input.registrationId ?? ''); const subject = String(input.subject ?? '').trim(); const body = String(input.body ?? '');
    const cc = cleanAddresses(input.cc); const bcc = cleanAddresses(input.bcc); const localThreadId = input.threadId ? String(input.threadId) : undefined;
    if (!registrationId || !subject || !body.trim()) return jsonResponse({ error: 'registrationId、subject、body 必填' }, 400);
    const { data: registration } = await admin.from('registrations').select('id,project_id,email,contact_id,thread_id').eq('id', registrationId).maybeSingle();
    if (!registration) return jsonResponse({ error: '找不到報名紀錄' }, 404);
    const caller = await requireProjectAdmin(req, admin, registration.project_id); if (!caller) return jsonResponse({ error: 'FORBIDDEN' }, 403); actorId = caller.userId;
    let threadId = localThreadId || registration.thread_id || undefined; let gmailThreadId: string | undefined;
    if (threadId) { const { data: existing } = await admin.from('email_threads').select('gmail_thread_id').eq('id', threadId).maybeSingle(); gmailThreadId = existing?.gmail_thread_id ?? undefined; }
    const headers = [`To: ${registration.email}`, ...(cc.length ? [`Cc: ${cc.join(', ')}`] : []), ...(bcc.length ? [`Bcc: ${bcc.join(', ')}`] : []), `Subject: =?UTF-8?B?${b64(subject)}?=`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', b64(body)];
    const accessToken = await getGoogleAccessToken();
    const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ raw: b64url(headers.join('\r\n')), ...(gmailThreadId ? { threadId: gmailThreadId } : {}) }) });
    const gmailData = await gmailRes.json(); if (!gmailRes.ok) throw new Error(`GMAIL_SEND_ERROR：${gmailData.error?.message ?? gmailRes.status}`);
    if (!threadId) { const { data: created, error } = await admin.from('email_threads').insert({ registration_id: registration.id, contact_id: registration.contact_id, gmail_thread_id: gmailData.threadId ?? null, subject, counterpart_email: registration.email, last_message_at: new Date().toISOString(), needs_reply: false, status: 'waiting' }).select('id').single(); if (error) throw error; threadId = created.id; await admin.from('registrations').update({ thread_id: threadId }).eq('id', registration.id); }
    else await admin.from('email_threads').update({ gmail_thread_id: gmailData.threadId ?? gmailThreadId ?? null, subject, last_message_at: new Date().toISOString(), has_unread: false, needs_reply: false, status: 'waiting' }).eq('id', threadId);
    const { error: messageError } = await admin.from('email_messages').upsert({ thread_id: threadId, direction: 'outbound', from_email: 'me', to_email: registration.email, cc_email: cc, bcc_email: bcc, subject, body, snippet: body.slice(0, 240), gmail_message_id: gmailData.id ?? null, label_ids: gmailData.labelIds ?? ['SENT'], delivery_status: 'sent', is_read: true, sent_at: new Date().toISOString() }, { onConflict: 'gmail_message_id' }); if (messageError) throw messageError;
    await admin.from('email_drafts').update({ status: 'sent' }).eq('registration_id', registrationId).eq('thread_id', threadId).eq('status', 'draft');
    await admin.from('audit_log').insert({ action: 'gmail_send', actor_id: actorId, target_type: 'registration', target_id: registration.id, result: 'success', detail: `thread:${threadId}` });
    return jsonResponse({ ok: true, threadId, gmailMessageId: gmailData.id });
  } catch (err) { const message = err instanceof Error ? err.message : String(err); await admin.from('audit_log').insert({ action: 'gmail_send', actor_id: actorId ?? null, result: 'error', detail: message }); return jsonResponse({ error: message }, 500); }
});


