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
function htmlToText(value: string) { return value.replace(/<(style|script|head)[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p\s*>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim(); }
function address(value = '') { const match = value.match(/<([^>]+)>/); return (match?.[1] ?? value.split(',')[0] ?? '').trim().toLowerCase(); }
function listAddresses(value = '') { return value.split(',').map(address).filter(Boolean); }
function safeName(value: string) { return value.replace(/[\\/:*?"<>|]/g, '_').slice(0, 180) || 'attachment'; }
/** 完整同步最多翻幾頁（每頁 100 封）。原本固定只看最新 25 封，回信被廣告信擠出窗口就再也收不到。 */
const FULL_SYNC_PAGES = 3;
/** 信頭比對的平行度。逐封循序取，300 封就是 300 次來回，掃完之前函式就先被掐掉了。 */
const META_CONCURRENCY = 8;
/**
 * 這一輪最多花多久（毫秒）。超過就停下來，把剩幾封一起回報，再按一次接著掃。
 *
 * 平台上限（Supabase 官方文件）：wall clock 免費 150s／付費 400s，request idle timeout 150s
 * 逾時回 504，CPU time 2s（不含 async I/O，我們幾乎全是 I/O 所以不是瓶頸）。
 * 但實測客戶端約 30 秒就放棄了，所以真正的天花板是「使用者看得到結果」的那一段，
 * 不是平台的 150s。抓 20 秒：做得完就做完，做不完也要在使用者還在看的時候把進度講出來。
 *
 * 被執行環境掐掉時 catch 不會執行，連一筆 error 稽核都留不下——那正是監督視窗看到的
 * 「按了同步、email_messages 從 208 變 210、稽核卻什麼都沒有」。
 */
const TIME_BUDGET_MS = 20_000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const deadline = Date.now() + TIME_BUDGET_MS;
  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, ''); const { data: auth } = await admin.auth.getUser(jwt); if (!auth.user) return jsonResponse({ error: 'UNAUTHORIZED' }, 401);
    // 被擋下來也要留痕：不留的話「按了同步卻什麼都沒發生」在稽核上與「函式死掉」長得一模一樣。
    const [{ data: profile }, { data: member }] = await Promise.all([admin.from('profiles').select('is_system_owner').eq('id', auth.user.id).maybeSingle(), admin.from('project_members').select('id').eq('user_id', auth.user.id).in('role', ['owner', 'admin_collab']).limit(1)]);
    if (!profile?.is_system_owner && !member?.length) { await admin.from('audit_log').insert({ action: 'gmail_sync', actor_id: auth.user.id, result: 'error', detail: 'FORBIDDEN' }); return jsonResponse({ error: 'FORBIDDEN' }, 403); }
    const { full = false } = await req.json().catch(() => ({ full: false })); const accessToken = await getGoogleAccessToken(); const headers = { Authorization: `Bearer ${accessToken}` };
    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers }); const mailbox = await profileRes.json(); if (!profileRes.ok) { const detail = String(mailbox.error?.message ?? 'Gmail profile 讀取失敗'); throw new Error(isMissingGmailScope(detail) ? gmailScopeMessage : detail); }
    const { data: state } = await admin.from('gmail_sync_state').select('*').eq('mailbox_email', mailbox.emailAddress).maybeSingle();
    // 直接從 Gmail 寄出的信會把「等待回覆」的計時重新起算，催覆期限就必須跟著重算。
    // 留著上一封信的舊期限，這一封才剛寄出就會被判成「逾期未回覆」——逾期是讀取時比對
    // follow_up_due_at 推導的，期限沒動，狀態就會立刻翻面。
    // select('*')：sync_label 這個欄位可能還沒套用 migration，指名要它會讓整支同步失敗。
    const { data: settings } = await admin.from('app_settings').select('*').maybeSingle();
    const followUpDays = Number(settings?.follow_up_days ?? 3);

    /* ------------------------- 收信範圍（三條規則的聯集） -------------------------
     * 先前這裡沒有任何過濾：完整同步＝「取信箱最新 25 封、不帶條件」，把使用者的私人信件
     * 連內文全文存進資料庫。那不只是雜訊——25 封的窗口會讓家長的回信被廣告信擠掉，是漏信。
     *
     * 任一成立才收：
     *   1. 對方信箱命中 registrations.email ∪ contacts.primary_email（大小寫不敏感）
     *   2. 該封信的 threadId 已經在 email_threads 裡（接住「用別的信箱回同一封信」）
     *   3. 該封信帶有指定的 Gmail 標籤（陌生信箱寄來的信，使用者在 Gmail 手動貼標籤即可收進來）
     *
     * 名單每次同步即時從資料庫撈，不塞進 q=：60+ 報名、50+ 聯絡人會把查詢字串撐爆，
     * 而且每新增一個人就要重組一次。
     */
    const [{ data: regEmails }, { data: contactEmails }, { data: knownThreadRows }] = await Promise.all([
      admin.from('registrations').select('email'),
      admin.from('contacts').select('primary_email'),
      admin.from('email_threads').select('gmail_thread_id').not('gmail_thread_id', 'is', null),
    ]);
    // ⚠ 不正規化 +alias：jin40225+test@ 與 jin40225@ 必須是兩個不同的比對對象，測試錨點靠它區分。
    const knownAddresses = new Set<string>();
    for (const row of regEmails ?? []) if (row.email) knownAddresses.add(String(row.email).trim().toLowerCase());
    for (const row of contactEmails ?? []) if (row.primary_email) knownAddresses.add(String(row.primary_email).trim().toLowerCase());
    const knownThreads = new Set((knownThreadRows ?? []).map((row) => String(row.gmail_thread_id)));

    // 存的是 label id 不是名稱：標籤改名時 id 不變，比對名稱會在使用者改名的那一刻安靜失效。
    const syncLabelId = String(settings?.sync_label_id ?? '').trim();
    let messageIds: string[] = []; let historyId = String(mailbox.historyId ?? state?.history_id ?? ''); let useFull = Boolean(full || !state?.history_id);
    // 增量同步要同時看「新訊息」與「被加上標籤」。使用者貼標籤的那封信早就同步過、也早就被
    // 規則 1、2 篩掉了——只看 messageAdded 的話，貼標籤不會有任何反應。
    if (!useFull) { const historyRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${encodeURIComponent(state.history_id)}&historyTypes=messageAdded&historyTypes=labelAdded&maxResults=500`, { headers }); if (historyRes.status === 404) useFull = true; else { const history = await historyRes.json(); if (!historyRes.ok) throw new Error(history.error?.message ?? 'Gmail history 讀取失敗'); const additions = (history.history ?? []) as { messagesAdded?: { message: { id: string } }[]; labelsAdded?: { message: { id: string } }[] }[]; messageIds = [...new Set<string>(additions.flatMap((item) => [...(item.messagesAdded ?? []), ...(item.labelsAdded ?? [])].map((entry) => entry.message.id)))]; historyId = String(history.historyId ?? historyId); } }

    /* 直接把「帶著同步標籤的信」全部撈進候選名單。
     *
     * history 只回溯到上次同步之後，而且 startHistoryId 太舊時 Gmail 會回 404 直接退回完整同步，
     * 而完整同步只看最新幾頁——使用者要是給一封兩個月前的舊信貼標籤，兩條路都撈不到它。
     * 這個查詢與時間無關，只問「現在有哪些信帶著這個標籤」，所以貼上去就一定收得到。
     * 已經收過的會在下面被 email_messages 的既存檢查擋掉，不會重複。 */
    if (syncLabelId) {
      let labelPage = '';
      for (let page = 0; page < FULL_SYNC_PAGES; page += 1) {
        const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
        url.searchParams.set('maxResults', '100');
        url.searchParams.set('labelIds', syncLabelId);
        if (labelPage) url.searchParams.set('pageToken', labelPage);
        const response = await fetch(url, { headers });
        const list = await response.json();
        if (!response.ok) break;
        messageIds.push(...(list.messages ?? []).map((item: { id: string }) => item.id));
        labelPage = list.nextPageToken ?? '';
        if (!labelPage) break;
      }
    }
    // 完整同步改分頁。原本固定只看最新 25 封：家長昨天的回信只要被今天的幾封廣告信推出窗口，
    // 就永遠不會被收進來，而畫面上看起來一切正常。
    if (useFull) {
      let pageToken = '';
      for (let page = 0; page < FULL_SYNC_PAGES; page += 1) {
        const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
        url.searchParams.set('maxResults', '100');
        if (pageToken) url.searchParams.set('pageToken', pageToken);
        const response = await fetch(url, { headers });
        const list = await response.json();
        if (!response.ok) throw new Error(list.error?.message ?? 'Gmail message list 讀取失敗');
        messageIds.push(...(list.messages ?? []).map((item: { id: string }) => item.id));
        pageToken = list.nextPageToken ?? '';
        if (!pageToken) break;
      }
    }
    let synced = 0; let skipped = 0; let remaining = 0;
    const candidates = [...new Set(messageIds)];

    // 開工前先留一筆。這一段以後的任何一次中斷（時間到、被掐掉、逾時）都不會回到 catch，
    // 所以完成時那一筆不能是唯一的紀錄——否則「跑到一半死掉」在稽核上看起來與「沒有人按過」
    // 完全一樣，而 email_messages 其實已經多了兩筆。
    await admin.from('audit_log').insert({
      action: 'gmail_sync', actor_id: auth.user.id, result: 'success',
      detail: `start ${useFull ? 'full' : 'incremental'} candidates:${candidates.length}`,
    });

    /* 一次問完哪些已經收過。
     * 原本是每封一次 `eq(gmail_message_id)` 查詢——300 封候選就是 300 次資料庫來回，
     * 光是「確認不用做事」就能把整支函式的時間耗光。而函式被執行環境掐掉時 catch 不會跑，
     * 於是連一筆 error 稽核都留不下來，畫面上看起來像什麼都沒發生。 */
    const alreadyStored = new Set<string>();
    for (let i = 0; i < candidates.length; i += 200) {
      const { data: rows } = await admin.from('email_messages').select('gmail_message_id').in('gmail_message_id', candidates.slice(i, i + 200));
      for (const row of rows ?? []) alreadyStored.add(String(row.gmail_message_id));
    }
    const fresh = candidates.filter((id) => !alreadyStored.has(id));

    /* 信頭平行取，一次 META_CONCURRENCY 封；並且設時間預算。
     * 不符合的信**連內文都不讀取**，更不會存進資料庫。掃不完就停下來、把剩幾封回報出去，
     * 下次同步再接著掃——寧可回報「這次只掃了一半」，也不要整支函式無聲死掉。 */
    const inScopeIds: string[] = [];
    for (let i = 0; i < fresh.length; i += META_CONCURRENCY) {
      if (Date.now() > deadline) { remaining = fresh.length - i; break; }
      const metas = await Promise.all(fresh.slice(i, i + META_CONCURRENCY).map(async (id) => {
        const metaUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To`;
        const metaRes = await fetch(metaUrl, { headers });
        const meta = await metaRes.json();
        if (!metaRes.ok) return { id, inScope: false };
        const metaHeaders = Object.fromEntries((meta.payload?.headers ?? []).map((item: { name: string; value: string }) => [item.name.toLowerCase(), item.value]));
        const metaLabels = (meta.labelIds ?? []) as string[];
        const metaOutbound = address(metaHeaders.from) === String(mailbox.emailAddress).toLowerCase() || metaLabels.includes('SENT');
        const metaCounterpart = metaOutbound ? address(metaHeaders.to) : address(metaHeaders.from);
        if (!metaCounterpart) return { id, inScope: false };
        const inScope = knownAddresses.has(metaCounterpart)
          || knownThreads.has(String(meta.threadId))
          || (syncLabelId !== '' && metaLabels.includes(syncLabelId));
        return { id, inScope };
      }));
      for (const entry of metas) {
        if (!entry.inScope) { skipped += 1; continue; }
        inScopeIds.push(entry.id);
      }
    }

    for (const id of inScopeIds) {
      if (Date.now() > deadline) { remaining += 1; continue; }
      const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, { headers }); const message = await response.json(); if (!response.ok) continue; const h = Object.fromEntries((message.payload?.headers ?? []).map((item: { name: string; value: string }) => [item.name.toLowerCase(), item.value])); const parsed = collect(message.payload ?? {}); const from = address(h.from); const to = address(h.to); const outbound = from === String(mailbox.emailAddress).toLowerCase() || (message.labelIds ?? []).includes('SENT'); const counterpart = outbound ? to : from; if (!counterpart) continue;
      let { data: thread } = await admin.from('email_threads').select('id,registration_id,contact_id,subject').eq('gmail_thread_id', message.threadId).maybeSingle();
      if (!thread) {
        const { data: registration } = await admin.from('registrations').select('id,contact_id').ilike('email', counterpart).order('created_at', { ascending: false }).limit(1).maybeSingle();
        // 沒有報名就找聯絡人：靠第 3 條規則（標籤）收進來的信通常屬於這一類，
        // 掛上去之後 needs_reply 才有意義——否則它會是一封「要回覆」但不知道要回給誰的信。
        const { data: contact } = registration?.contact_id
          ? { data: { id: registration.contact_id } }
          : await admin.from('contacts').select('id').ilike('primary_email', counterpart).limit(1).maybeSingle();
        const linked = Boolean(registration?.id || contact?.id);
        const { data: created, error } = await admin.from('email_threads').insert({ registration_id: registration?.id ?? null, contact_id: contact?.id ?? null, gmail_thread_id: message.threadId, subject: h.subject ?? '', counterpart_email: counterpart, has_unread: !outbound && !(message.labelIds ?? []).includes('READ'),
          // 只有掛在報名或聯絡人身上的信件串才可能需要回覆。掛不上的信（例如靠標籤收進來、
          // 但寄件人還不是任何人）不該跑去待辦清單上排隊。
          needs_reply: !outbound && linked, status: outbound ? 'waiting' : 'open', mail_state: outbound ? 'waiting_reply' : 'replied_pending', ...(outbound ? { last_outbound_at: new Date(Number(message.internalDate)).toISOString() } : { last_inbound_at: new Date(Number(message.internalDate)).toISOString() }), last_message_at: new Date(Number(message.internalDate)).toISOString() }).select('id,registration_id,contact_id,subject').single(); if (error) throw error; thread = created; if (registration?.id) await admin.from('registrations').update({ thread_id: created.id, has_unread_reply: !outbound }).eq('id', registration.id); }
      const { data: saved, error } = await admin.from('email_messages').upsert({ thread_id: thread.id, direction: outbound ? 'outbound' : 'inbound', from_email: from || h.from || '', to_email: to || h.to || '', cc_email: listAddresses(h.cc), bcc_email: listAddresses(h.bcc), subject: h.subject ?? '', body: parsed.text || htmlToText(parsed.html), body_html: parsed.html || null, snippet: message.snippet ?? null, gmail_message_id: message.id, is_read: outbound || !(message.labelIds ?? []).includes('UNREAD'), label_ids: message.labelIds ?? [], delivery_status: outbound ? 'sent' : 'received', raw_headers: h, sent_at: new Date(Number(message.internalDate)).toISOString() }, { onConflict: 'gmail_message_id' }).select('id').single(); if (error) throw error;
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
      // 信件狀態機（計畫第七節）：收到回信＝「已回覆・待處理」，需要人看；
      // 直接從 Gmail 寄出（沒走 send-email-v2）的信也要把等待回覆的計時重新起算。
      // 手動覆寫存在 mail_state_override，前台顯示以它優先，所以這裡不必迴避覆寫。
      const messageAt = new Date(Number(message.internalDate)).toISOString();
      await admin.from('email_threads').update({
        // 主旨在建串時就定了，之後不再覆寫：轉寄一次整條串就會改名成「Fwd: …」，
        // 而使用者是靠這個名字在收件匣裡找那條往來的。只有原本是空的才補寫。
        ...(thread.subject ? {} : { subject: h.subject ?? '' }),
        counterpart_email: counterpart,
        has_unread: !outbound && (message.labelIds ?? []).includes('UNREAD'),
        // 同上：掛不到報名或聯絡人的信件串不會被標成「要回覆」。
        needs_reply: !outbound && Boolean(thread.registration_id || thread.contact_id), status: outbound ? 'waiting' : 'open',
        mail_state: outbound ? 'waiting_reply' : 'replied_pending',
        ...(outbound
          ? { last_outbound_at: messageAt, follow_up_due_at: new Date(new Date(messageAt).getTime() + followUpDays * 86400000).toISOString() }
          : { last_inbound_at: messageAt }),
        last_message_at: messageAt, updated_at: new Date().toISOString(),
      }).eq('id', thread.id); synced += 1;
    }
    await admin.from('gmail_sync_state').upsert({ mailbox_email: mailbox.emailAddress, history_id: historyId, last_full_sync_at: useFull ? new Date().toISOString() : state?.last_full_sync_at ?? null, last_incremental_sync_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }, { onConflict: 'mailbox_email' });
    // 略過幾封也記進稽核：這個數字是「過濾有沒有在動」的唯一外顯訊號。
    await admin.from('audit_log').insert({ action: 'gmail_sync', actor_id: auth.user.id, result: 'success', detail: `${useFull ? 'full' : 'incremental'}:${synced} skipped:${skipped}${remaining ? ` remaining:${remaining}` : ''}` });
    // 移除標籤不做回溯刪除：同步端只該有「收進來」這個權限，誤收的清理由人決定。
    return jsonResponse({ ok: true, synced, skipped, remaining, mailboxEmail: mailbox.emailAddress, syncLabelActive: syncLabelId !== '' });
  } catch (err) { const detail = errorMessage(err); const missingScope = isMissingGmailScope(detail) || detail === gmailScopeMessage; const message = missingScope ? gmailScopeMessage : detail; await admin.from('audit_log').insert({ action: 'gmail_sync', result: 'error', detail: message }); return jsonResponse({ error: message, code: missingScope ? 'GMAIL_SCOPE_MISSING' : 'GMAIL_SYNC_FAILED' }, 500); }
});



