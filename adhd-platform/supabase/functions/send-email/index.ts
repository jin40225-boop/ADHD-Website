/**
 * send-email：以 Gmail API 寄出報名回覆信，並寫入信件串。【CLAUDE / K2】
 * body: { registrationId: string, subject: string, body: string, templateId?: string }
 * 授權：系統擁有者或該報名所屬專案的 owner / admin_collab。
 * 效果：寄信 → upsert email_threads → insert email_messages(outbound) → 更新
 *        registrations.thread_id → audit_log。
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { b64, b64url, getGoogleAccessToken } from '../_shared/google.ts';
import { requireProjectAdmin } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let actorId: string | undefined;
  try {
    const { registrationId, subject, body } = await req.json();
    if (!registrationId || !subject || !body) {
      return jsonResponse({ error: 'BAD_REQUEST：registrationId/subject/body 必填' }, 400);
    }

    const { data: registration, error: regError } = await admin
      .from('registrations')
      .select('id, project_id, email, thread_id')
      .eq('id', registrationId)
      .maybeSingle();
    if (regError || !registration) return jsonResponse({ error: '找不到報名紀錄' }, 404);

    const caller = await requireProjectAdmin(req, admin, registration.project_id);
    if (!caller) return jsonResponse({ error: 'FORBIDDEN：無此專案的寄信權限' }, 403);
    actorId = caller.userId;

    // Gmail 寄送（From 由 Google 依授權帳號自動填入）
    const accessToken = await getGoogleAccessToken();
    const raw = [
      `To: ${registration.email}`,
      `Subject: =?UTF-8?B?${b64(subject)}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      b64(body),
    ].join('\r\n');
    const gmailRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: b64url(raw) }),
      },
    );
    const gmailData = await gmailRes.json();
    if (!gmailRes.ok) {
      throw new Error(`GMAIL_SEND_ERROR：${gmailData.error?.message ?? gmailRes.status}`);
    }

    // 信件串：沿用既有 thread 或建立
    let threadId = registration.thread_id as string | null;
    if (!threadId) {
      const { data: thread, error: threadError } = await admin
        .from('email_threads')
        .insert({
          registration_id: registration.id,
          gmail_thread_id: gmailData.threadId ?? null,
          subject,
          counterpart_email: registration.email,
          last_message_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (threadError) throw new Error(threadError.message);
      threadId = thread.id;
      await admin.from('registrations').update({ thread_id: threadId }).eq('id', registration.id);
    } else {
      await admin
        .from('email_threads')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', threadId);
    }

    await admin.from('email_messages').insert({
      thread_id: threadId,
      direction: 'outbound',
      from_email: 'me（授權 Gmail 帳號）',
      to_email: registration.email,
      subject,
      body,
      gmail_message_id: gmailData.id ?? null,
      is_read: true,
    });

    await admin.from('audit_log').insert({
      action: 'gmail_send',
      actor_id: actorId,
      target_type: 'registration',
      target_id: registration.id,
      result: 'success',
    });

    return jsonResponse({ ok: true, threadId, gmailMessageId: gmailData.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin.from('audit_log').insert({
      action: 'gmail_send',
      actor_id: actorId ?? null,
      result: 'error',
      detail: message,
    });
    return jsonResponse({ error: message }, 500);
  }
});
