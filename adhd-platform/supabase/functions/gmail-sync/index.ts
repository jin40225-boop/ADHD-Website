import { createClient } from 'npm:@supabase/supabase-js@2';
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function jsonResponse(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
async function getGoogleAccessToken() { const clientId = Deno.env.get('GOOGLE_CLIENT_ID'); const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET'); const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN'); if (!clientId || !clientSecret || !refreshToken) throw new Error('GOOGLE_SECRETS_MISSING'); const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }) }); const data = await res.json(); if (!res.ok || !data.access_token) throw new Error(`GOOGLE_TOKEN_ERROR:${data.error_description ?? data.error ?? res.status}`); return data.access_token as string; }
const gmailScopeMessage = 'Google 授權缺少 Gmail 讀取權限。請以 gmail.readonly、gmail.send 與 calendar.events 重新授權，並更新 GOOGLE_REFRESH_TOKEN。';
function isMissingGmailScope(message: string) { return /insufficient authentication scopes|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(message); }
function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const detail = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [detail.message, detail.details, detail.hint, detail.code]
      .filter((value) => typeof value === 'string' && value.length > 0);
    if (parts.length) return parts.join(' | ');
    try { return JSON.stringify(error); } catch { return 'UNKNOWN_OBJECT_ERROR'; }
  }
  return String(error);
}

type Part = { mimeType?: string; filename?: string; body?: { data?: string; attachmentId?: string; size?: number }; parts?: Part[] };
function decode(value?: string) { if (!value) return ''; const normalized = value.replaceAll('-', '+').replaceAll('_', '/'); const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')); return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0))); }
function collect(part: Part, result = { text: '', html: '', attachments: [] as { id?: string; filename: string; mimeType: string; size: number }[] }) { if (part.filename) result.attachments.push({ id: part.body?.attachmentId, filename: part.filename, mimeType: part.mimeType ?? 'application/octet-stream', size: part.body?.size ?? 0 }); else if (part.mimeType === 'text/plain' && part.body?.data) result.text += decode(part.body.data); else if (part.mimeType === 'text/html' && part.body?.data) result.html += decode(part.body.data); for (const child of part.parts ?? []) collect(child, result); return result; }
function address(value = '') { const match = value.match(/<([^>]+)>/); return (match?.[1] ?? value.split(',')[0] ?? '').trim().toLowerCase(); }
function listAddresses(value = '') { return value.split(',').map(address).filter(Boolean); }
function safeName(value: string) { return value.replace(/[\\/:*?"<>|]/g, '_').slice(0, 180) || 'attachment'; }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, ''); const { data: auth } = await admin.auth.getUser(jwt); if (!auth.user) return jsonResponse({ error: 'UNAUTHORIZED' }, 401);
    const [{ data: profile }, { data: member }] = await Promise.all([admin.from('profiles').select('is_system_owner').eq('id', auth.user.id).maybeSingle(), admin.from('project_members').select('id').eq('user_id', auth.user.id).in('role', ['owner', 'admin_collab']).limit(1)]); if (!profile?.is_system_owner && !member?.length) return jsonResponse({ error: 'FORBIDDEN' }, 403);
    const { full = false } = await req.json().catch(() => ({ full: false })); const accessToken = await getGoogleAccessToken(); const headers = { Authorization: `Bearer ${accessToken}` };
    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers }); const mailbox = await profileRes.json(); if (!profileRes.ok) { const detail = String(mailbox.error?.message ?? 'Gmail profile 讀取失敗'); throw new Error(isMissingGmailScope(detail) ? gmailScopeMessage : detail); }
    const { data: state } = await admin.from('gmail_sync_state').select('*').eq('mailbox_email', mailbox.emailAddress).maybeSingle();
    let messageIds: string[] = []; let historyId = String(mailbox.historyId ?? state?.history_id ?? ''); let useFull = Boolean(full || !state?.history_id);
    if (!useFull) { const historyRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${encodeURIComponent(state.history_id)}&historyTypes=messageAdded&maxResults=500`, { headers }); if (historyRes.status === 404) useFull = true; else { const history = await historyRes.json(); if (!historyRes.ok) throw new Error(history.error?.message ?? 'Gmail history 讀取失敗'); const additions = (history.history ?? []) as { messagesAdded?: { message: { id: string } }[] }[]; messageIds = [...new Set<string>(additions.flatMap((item) => (item.messagesAdded ?? []).map((entry) => entry.message.id)))]; historyId = String(history.historyId ?? historyId); } }
    if (useFull) { const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages'); url.searchParams.set('maxResults', '25'); const response = await fetch(url, { headers }); const list = await response.json(); if (!response.ok) throw new Error(list.error?.message ?? 'Gmail message list 讀取失敗'); messageIds.push(...(list.messages ?? []).map((item: { id: string }) => item.id)); }
    let synced = 0;
    for (const id of [...new Set(messageIds)]) { const { data: existing } = await admin.from('email_messages').select('id').eq('gmail_message_id', id).maybeSingle(); if (existing) continue; const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, { headers }); const message = await response.json(); if (!response.ok) continue; const h = Object.fromEntries((message.payload?.headers ?? []).map((item: { name: string; value: string }) => [item.name.toLowerCase(), item.value])); const parsed = collect(message.payload ?? {}); const from = address(h.from); const to = address(h.to); const outbound = from === String(mailbox.emailAddress).toLowerCase() || (message.labelIds ?? []).includes('SENT'); const counterpart = outbound ? to : from; if (!counterpart) continue;
      let { data: thread } = await admin.from('email_threads').select('id,registration_id,contact_id').eq('gmail_thread_id', message.threadId).maybeSingle();
      if (!thread) { const { data: registration } = await admin.from('registrations').select('id,contact_id').ilike('email', counterpart).order('created_at', { ascending: false }).limit(1).maybeSingle(); const { data: created, error } = await admin.from('email_threads').insert({ registration_id: registration?.id ?? null, contact_id: registration?.contact_id ?? null, gmail_thread_id: message.threadId, subject: h.subject ?? '', counterpart_email: counterpart, has_unread: !outbound && !(message.labelIds ?? []).includes('READ'), needs_reply: !outbound, status: outbound ? 'waiting' : 'open', last_message_at: new Date(Number(message.internalDate)).toISOString() }).select('id,registration_id,contact_id').single(); if (error) throw error; thread = created; if (registration?.id) await admin.from('registrations').update({ thread_id: created.id, has_unread_reply: !outbound }).eq('id', registration.id); }
      const { data: saved, error } = await admin.from('email_messages').upsert({ thread_id: thread.id, direction: outbound ? 'outbound' : 'inbound', from_email: from || h.from || '', to_email: to || h.to || '', cc_email: listAddresses(h.cc), bcc_email: listAddresses(h.bcc), subject: h.subject ?? '', body: parsed.text || parsed.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(), body_html: parsed.html || null, snippet: message.snippet ?? null, gmail_message_id: message.id, is_read: outbound || !(message.labelIds ?? []).includes('UNREAD'), label_ids: message.labelIds ?? [], delivery_status: outbound ? 'sent' : 'received', raw_headers: h, sent_at: new Date(Number(message.internalDate)).toISOString() }, { onConflict: 'gmail_message_id' }).select('id').single(); if (error) throw error;
      for (const item of parsed.attachments) {
        let storagePath: string | null = null;
        if (item.id) {
          const attachmentRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}/attachments/${item.id}`, { headers });
          const attachment = await attachmentRes.json();
          if (attachmentRes.ok && attachment.data) {
            const normalized = String(attachment.data).replaceAll('-', '+').replaceAll('_', '/');
            const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
            const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
            storagePath = `${thread.id}/${message.id}/${safeName(item.filename)}`;
            const { error: uploadError } = await admin.storage.from('email-attachments').upload(storagePath, bytes, { contentType: item.mimeType, upsert: true });
            if (uploadError) storagePath = null;
          }
        }
        await admin.from('email_attachments').upsert({ message_id: saved.id, gmail_attachment_id: item.id ?? null, filename: item.filename, mime_type: item.mimeType, size_bytes: item.size, storage_path: storagePath }, { onConflict: 'message_id,gmail_attachment_id' });
      }
      await admin.from('email_threads').update({ subject: h.subject ?? '', counterpart_email: counterpart, has_unread: !outbound && (message.labelIds ?? []).includes('UNREAD'), needs_reply: !outbound, status: outbound ? 'waiting' : 'open', last_message_at: new Date(Number(message.internalDate)).toISOString(), updated_at: new Date().toISOString() }).eq('id', thread.id); synced += 1;
    }
    await admin.from('gmail_sync_state').upsert({ mailbox_email: mailbox.emailAddress, history_id: historyId, last_full_sync_at: useFull ? new Date().toISOString() : state?.last_full_sync_at ?? null, last_incremental_sync_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }, { onConflict: 'mailbox_email' });
    await admin.from('audit_log').insert({ action: 'gmail_sync', actor_id: auth.user.id, result: 'success', detail: `${useFull ? 'full' : 'incremental'}:${synced}` }); return jsonResponse({ ok: true, synced, mailboxEmail: mailbox.emailAddress });
  } catch (err) { const detail = errorMessage(err); const missingScope = isMissingGmailScope(detail) || detail === gmailScopeMessage; const message = missingScope ? gmailScopeMessage : detail; await admin.from('audit_log').insert({ action: 'gmail_sync', result: 'error', detail: message }); return jsonResponse({ error: message, code: missingScope ? 'GMAIL_SCOPE_MISSING' : 'GMAIL_SYNC_FAILED' }, 500); }
});



