import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
/** 拿掉註解再比對：禁用字串的檢查看的是程式碼，而說明為什麼禁用它往往得寫出那個字串本身。 */
const withoutComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const requireText = (path, needles) => {
  const value = read(path);
  for (const needle of needles) {
    if (!value.includes(needle)) throw new Error(`${path} is missing: ${needle}`);
  }
};

requireText('src/router.tsx', [
  "path: 'tasks'", "path: 'inbox'", "path: 'people'", "path: 'registrations'",
  "path: 'cases'", "path: 'activities'", "path: 'team'", "path: 'integrations'", "path: 'audit'",
  '<RequireAdmin>',
]);
requireText('supabase/migrations/20260723000001_admin_operations_hub.sql', [
  'create table public.contacts', 'create table public.internal_notes', 'create table public.follow_up_tasks',
  'create table public.email_drafts', 'create table public.gmail_sync_state', 'create table public.case_transfers',
  'admin_move_registration_sessions', 'admin_transition_registration', 'consume_registration_rate_limit',
  'alter table public.registration_rate_limits enable row level security',
]);
// 後台報名工作台（03_v4）：表格內要真的能改，而不是只把欄位畫出來。三個行政欄位
// 各自的寫入呼叫、以及狀態下拉，都直接列為斷言——少掉任何一個就代表那一格變成裝飾品。
requireText('src/admin/operations/RegistrationTable.tsx', [
  'reminderSentAt:', 'counselorConfirmed:', 'finalSlotAt:', 'row.setStatus(', 'row.setSessions(', 'row.patch({ email:',
]);
// 三個分頁各有自己的表頭；少掉任何一組就代表某一案的報名又退回共通欄位。
requireText('src/admin/operations/RegistrationTable.tsx', ['NAVIGATOR_COLUMNS', 'PARENT_COLUMNS', 'PEER_COLUMNS']);
// 現有親職報名全是 Notion 匯入的舊平面 key（`children` 群組零使用）。少了這幾個 fallback，
// 表格對真實資料會整欄顯示「—」，而用新格式的假資料測起來卻是綠的——這正是本次踩到的。
requireText('src/admin/operations/RegistrationTable.tsx', ["'childName'", "'childAge'", "'reminderSent'", "'finalSlot'"]);
requireText('src/admin/pages/RegistrationsOperationsPage.tsx', ['columns: PARENT_COLUMNS', 'columns: PEER_COLUMNS']);
requireText('src/admin/pages/RegistrationsOperationsPage.tsx', ['<RegistrationTable', 'ops-drawer']);
// 狀態標籤是使用者拍板的對應表，改字等於改語意，因此連舊用語一起列為禁用。
requireText('src/admin/operations/RegistrationTable.tsx', [
  "reviewing: '回信確認中'", "confirmed: '報名成功'", "rejected: '退回'", "reschedule: '待改訂時間'",
]);
for (const stale of ["reviewing: '審核中'", "confirmed: '已確認'", "rejected: '不符合'"]) {
  if (read('src/admin/operations/RegistrationTable.tsx').includes(stale)) {
    throw new Error(`RegistrationTable.tsx still uses the pre-03_v4 status label: ${stale}`);
  }
}
requireText('supabase/migrations/20260804000012_registration_admin_fields.sql', [
  'add column reminder_sent_at', 'add column counselor_confirmed', 'add column final_slot_at',
]);
requireText('supabase/migrations/20260804000013_registration_admin_audit.sql', [
  'trg_registrations_admin_audit', 'log_registration_admin_edit',
]);
// 信箱是名冊比對鍵，格內可改就必須留歷程。
requireText('supabase/migrations/20260804000014_audit_registration_email.sql', ["jsonb_build_object('email'"]);
// 場次管理（03_v4）：名額／截止格內可改、上下架 toggle、主題與客座可編輯。
// topic/guest 是「公布神秘驚喜」的唯一入口，adminSaveSession 少存一個欄位就等於公布不了。
requireText('src/admin/operations/SessionTable.tsx', ['onCapacity(', 'onDeadline(', 'onPublish(', 'ops-switch']);
// 同月同標題的多時段場次（親職 9:00／10:00／11:00）只靠淡色的時間欄分辨，改名額就會改到別列——
// 已經發生過一次，還連帶把一筆真實報名指定到錯的場次。時間必須跟標題同排且不是淡色。
requireText('src/admin/operations/SessionTable.tsx', ['<strong>{sessionTimeText(session.startsAt)}</strong>']);
if (read('src/admin/operations/SessionTable.tsx').includes('ops-cell-muted">{sessionTimeText')) {
  throw new Error('SessionTable.tsx greys out the time again; it is the only thing telling same-titled rows apart.');
}
requireText('src/admin/pages/SessionsPage.tsx', ['<SessionTable', 'topic:', 'guest:', '神秘驚喜']);
requireText('src/lib/api.ts', ['topic: session.topic', 'guest: session.guest', 'registration_deadline: session.registrationDeadline', 'slot_options: session.slotOptions']);
// 新增場次的 payload 不得把 `not null default` 欄位送成 null。明確的 NULL 不會讓 DB 預設值
// 生效，只會踩 not-null constraint——而既有場次讀回來就是 `[]`，所以更新看起來一直是好的。
requireText('src/lib/api.ts', [
  'export function sessionRowFor',
  'slot_options: session.slotOptions ?? []',
  'instructor_ids: session.instructorIds ?? []',
]);
for (const bad of ['slot_options: session.slotOptions ?? null', 'instructor_ids: session.instructorIds ?? null']) {
  if (read('src/lib/api.ts').includes(bad)) {
    throw new Error(`api.ts sends an explicit NULL to a not-null default column (${bad}); send [] or omit the key.`);
  }
}
// 場次的名額、上下架、主題與客座都可直接改，同樣必須留歷程。
requireText('supabase/migrations/20260804000016_session_admin_audit.sql', ['trg_sessions_admin_audit', 'log_session_admin_edit']);
// 名額被格子端擋下時必須說明理由，否則數字無聲跳回、使用者只會以為壞了。
requireText('src/admin/operations/SessionTable.tsx', ['onReject(']);
// 設定・聯絡人（03_v4）：聯絡人與類群可直接編輯，且兩條防假原則要留在畫面上——
// 逾期門檻在 Phase 4 前只存值、Claude API 在 Phase 6 前不做輸入框。拿掉說明就等於假生效。
requireText('src/admin/operations/SettingsTables.tsx', ['onPatch(', 'onToggleMember(', 'ops-member-chip']);
requireText('src/admin/pages/SettingsPage.tsx', ['<ContactTable', '<GroupEditor', 'Phase 4', 'Phase 6', '待審閱']);
requireText('src/router.tsx', ["path: 'settings'", "path: 'documents'"]);
// 文件產生中心在 Phase 6 前是佔位頁：產出鈕必須是停用的，且必須說明何時啟用。
// 一顆看起來能按、按了沒反應的產出鈕，正是這個專案最初四大重症裡的「死按鈕」。
requireText('src/admin/pages/DocumentsPage.tsx', ['<WarmButton disabled', 'Phase 6']);

// Phase 4 信件系統。
// 信中確認按鈕是「對方點開信件」偵測不可靠之後的替代方案（裁決 12），端點必須公開才點得到。
requireText('supabase/config.toml', ['[functions.confirm-attendance]', 'verify_jwt = false']);
// 這支不得再自己回 HTML。Supabase Functions 的閘道會把回應強制成 text/plain（無 charset）並加上
// nosniff，家長點進去看到的是一整片原始碼加中文亂碼——資料明明都記錄成功了。一律 302 回站內結果頁。
requireText('supabase/functions/confirm-attendance/index.ts', ['status: 302', 'confirm-result/?r=']);
// 只看程式碼，不看註解——這一段的註解本來就得寫出 text/html 才講得清楚為什麼不能用它。
if (withoutComments(read('supabase/functions/confirm-attendance/index.ts')).includes('text/html')) {
  throw new Error('confirm-attendance builds HTML again; the gateway forces text/plain + nosniff and the parent sees source code.');
}
requireText('src/router.tsx', ["path: '/confirm-result'"]);
// 七種分支都要有落點，少一種就是一頁空白卡片。
requireText('src/pages/public/ConfirmResultPage.tsx', [
  'attend:', 'reschedule:', 'duplicate:', 'expired:', 'invalid:', 'closed:', 'error:',
]);
// 兩道守門都是「不改狀態」的保證，拿掉任何一道都看不出來：白名單擋掉已結案的報名，
// `.select('id')` 讓函式知道自己有沒有真的搶到那一列（兩個請求可能都讀到 responded_at 是 null）。
requireText('supabase/functions/confirm-attendance/index.ts', [
  'attendance_confirmations', 'attend_confirmed', 'reschedule_requested',
  '.is(\'responded_at\', null)', 'ACTIVE_STATUSES', '.select(\'id\')',
]);
// 寄出這個動作本身要推進狀態機並勾起已寄信提醒，不能再靠人手動記得。
requireText('supabase/functions/send-email-v2/index.ts', ['reminder_sent_at', 'follow_up_due_at', 'attendance_confirmations', 'gmail_bulk_send']);
// 收到回信＝待處理；這是紅點與催覆判斷的來源。
requireText('supabase/functions/gmail-sync/index.ts', ["mail_state: outbound ? 'waiting_reply' : 'replied_pending'"]);
// 變數必須在後台載入範本時就替換完，使用者審閱到的才會是實際寄出的字。
requireText('src/admin/operations/emailCompose.ts', ['applyTemplate', 'missing', 'resolveBulkRecipients']);
// 群發一定要先看到最終名單才寄得出去；寄不到的人要單獨列出，不能混進「已寄出 N 封」。
requireText('src/admin/pages/DocumentsPage.tsx', ['範本群發', '最終名單', 'setConfirming(true)']);
// 群發只有一次機會——按下去就同時寄給所有人，沒有「寄出前逐封補」那一步。所以載入範本時要帶入
// 非個人變數，而任何殘留的 {{...}} 必須把寄出鈕擋掉。月度宣傳信整封都靠那三個變數撐起來。
requireText('src/admin/pages/DocumentsPage.tsx', ['buildBulkContext', 'residualVariables', 'residual.length > 0']);
if (read('src/admin/pages/DocumentsPage.tsx').includes('body: template?.body')) {
  throw new Error('DocumentsPage.tsx drops the raw template body into the box again; run it through applyTemplate.');
}
requireText('src/admin/operations/emailCompose.ts', ['buildBulkContext', 'residualVariables', 'BLANK_IS_VALID']);
// 催覆信的回覆期限要跟著設定走。寫死的天數與設定不符時畫面上看不出來——信寄出去才知道。
requireText('src/admin/pages/RegistrationsOperationsPage.tsx', ['loadTemplate(', 'attachConfirmButtons', 'isFollowUp', 'followUpDays']);
// 寄信行為由 letter_kind 決定，不由範本名稱決定：範本改名不該改變信怎麼寄。名稱判斷只留在
// emailCompose.letterKindOf 這一個退路裡，撰寫面板不得自己再猜一次。
requireText('src/admin/pages/RegistrationsOperationsPage.tsx', ['letterKindOf(', 'TEMPLATE_VARIABLES']);
if (read('src/admin/pages/RegistrationsOperationsPage.tsx').includes('template.name.includes')) {
  throw new Error('RegistrationsOperationsPage.tsx still decides send behaviour from the template name; use letterKindOf().');
}
requireText('src/admin/operations/emailCompose.ts', ['letterKindOf', 'letterKind', '團隊署名', '報名連結', '場次清單']);
requireText('supabase/migrations/20260805000018_email_template_letter_kind.sql', ['add column if not exists letter_kind']);
// 範本是會原封不動寄給真人的文字，改動必須留歷程；只記名稱與變動欄位，不記全文。
requireText('supabase/migrations/20260805000019_email_template_audit.sql', [
  'trg_email_templates_audit', 'log_email_template_edit', 'trg_email_templates_life',
]);
// 直接從 Gmail 寄出的信重設等待計時，催覆期限要一起重算，否則舊期限已過會立刻顯示逾期。
requireText('supabase/functions/gmail-sync/index.ts', ['follow_up_due_at', 'follow_up_days']);
// 收信範圍：不得有無條件儲存的路徑。先取信頭比對三條規則（報名／聯絡人信箱、已知 threadId、
// 指定標籤），不符合的信連內文都不讀。先前沒有任何過濾，使用者的私人信件被連內文存進資料庫，
// 而 25 封的窗口還會讓家長的回信被廣告信擠掉。
requireText('supabase/functions/gmail-sync/index.ts', [
  'format=metadata', 'knownAddresses', 'knownThreads', 'syncLabelId', 'if (!entry.inScope)', 'nextPageToken',
]);
{
  const source = withoutComments(read('supabase/functions/gmail-sync/index.ts'));
  // 唯一一次抓完整內文必須排在範圍守門之後。
  if (source.indexOf('format=full') < source.indexOf('if (!entry.inScope)')) {
    throw new Error('gmail-sync fetches the full message before the scope gate; unmatched mail must never be read.');
  }
  if (source.includes("maxResults', '25'")) {
    throw new Error('gmail-sync is back to a fixed 25-message window; a reply can be pushed out of it by newer mail.');
  }
  if (source.includes('needs_reply: !outbound,')) {
    throw new Error('gmail-sync marks needs_reply without checking the thread is linked to a registration or contact.');
  }
}
// 第三條規則（人工救援管道）的三個必要條件，少一個它就等於不存在：
//   a. 存 label id 不存名稱——改名時 id 不變，比對名稱會在改名當下安靜失效
//   b. 設定頁用選的，不讓人打字（所以要有唯讀的列標籤端點）
//   c. 貼標籤的那封信早就同步過並被前兩條篩掉了，所以增量要看 labelAdded，
//      而且要能直接把「帶著這個標籤的信」撈回來——history 撈不到兩個月前的舊信
requireText('supabase/migrations/20260805000022_app_settings_sync_label_id.sql', ['add column if not exists sync_label_id']);
requireText('supabase/functions/gmail-sync/index.ts', ['sync_label_id', 'historyTypes=labelAdded', "searchParams.set('labelIds'"]);
if (withoutComments(read('supabase/functions/gmail-sync/index.ts')).includes('sync_label ?')) {
  throw new Error('gmail-sync matches the sync label by name again; renaming the label in Gmail would silently disable rule 3.');
}
requireText('supabase/functions/gmail-labels/index.ts', ['users/me/labels', 'is_system_owner', 'FORBIDDEN']);
if (withoutComments(read('supabase/functions/gmail-labels/index.ts')).match(/from\('[a-z_]+'\)\.(insert|update|delete|upsert)/)) {
  throw new Error('gmail-labels writes to the database; it is meant to be read-only.');
}
// 標籤可複選：三條規則本來就是聯集，標籤那條沒有理由是單選——名字很像的標籤只能挑一個時，
// 挑錯就是一整輪驗收白跑（ADHD相關資訊／ADHD重要訊息，已經發生過一次）。
requireText('src/admin/pages/SettingsPage.tsx', ['saveSyncLabels', 'listGmailLabels', 'selectedLabelIds', 'marketing', 'saveKeywords']);
// 收信範圍是「主動搜尋」不是「篩子」：規則只能在候選名單裡放行，而候選名單原本只有
// history／最新幾百封／標籤三個來源——四到七月與家長的往來早被廣告推出窗口，從來沒成為候選，
// 56 個已知信箱裡有 46 個一封都沒收到。所以要對每個已知信箱主動下 Gmail 搜尋。
requireText('supabase/functions/gmail-sync/index.ts', [
  'ADDRESS_QUERY_CHUNK', 'from:${addr} OR to:${addr}', 'subject:(${subjectKeywords.join', 'metadataHeaders=Subject',
  'subjectKeywords.some((word) => metaSubject.includes(word.toLowerCase()))',
]);
// 搜尋名單不得包含信箱自己。信箱本人是聯絡人之一，不排除的話 from:me OR to:me 命中整個信箱，
// 每一封都要取一次信頭而其中約 95% 註定被丟棄——閘門擋得住，但那是純白工。
// 只排除完全相同的位址：+alias 的報名信箱是測試錨點，必須留著。
requireText('supabase/functions/gmail-sync/index.ts', ['const mailboxAddress', "addr !== mailboxAddress"]);
requireText('supabase/migrations/20260805000027_app_settings_subject_keywords.sql', ['add column if not exists sync_subject_keywords']);
// 收信範圍的第二個維度：時間。自動發現受起始日限制，人工指定不受限制——
// 沒有這條的話，規則一開就把每個人從古至今的往來全部拉進來（量體 444 封）。
requireText('supabase/migrations/20260805000028_app_settings_sync_since.sql', ['add column if not exists sync_since']);
requireText('supabase/functions/gmail-sync/index.ts', ['const withAfter', 'withAfter(`(${chunk.map', 'withAfter(`subject:(', 'importHistoryFor', 'queue-cleared', 'gmail_import_history']);
{
  const source = withoutComments(read('supabase/functions/gmail-sync/index.ts'));
  // 標籤查詢刻意不帶 after:：貼標籤就是「我要這封」，加時間條件會廢掉它補收舊信的用途。
  if (/search\(\{ labelId: withAfter/.test(source) || /labelId \}\s*\)[^\n]*withAfter/.test(source)) {
    throw new Error('the label query is time-limited; labelling old mail is how the user asks for it explicitly.');
  }
  // 匯入某個人的歷史同樣不受起始日限制。
  if (/importHistoryFor[\s\S]{0,1200}withAfter/.test(source)) {
    throw new Error('importing one person history applies the since date; that rule governs what the system looks for, not what the user may fetch.');
  }
}
requireText('src/admin/pages/PeoplePage.tsx', ['handleImportHistory', '匯入這個人的歷史往來']);
requireText('src/admin/pages/RegistrationsOperationsPage.tsx', ['importGmailHistory', '匯入這個人的歷史往來']);
requireText('src/admin/pages/IntegrationsPage.tsx', ['clearGmailQueue', 'confirmingClear']);
// 破壞性動作要確認，但確認不能用 window.confirm：原生對話框在自動化瀏覽器裡會被自動取消，
// 等於把所有代驗擋在門外。這三處都是這一輪新增的動作，一律做成站內確認。
for (const page of ['IntegrationsPage', 'PeoplePage', 'RegistrationsOperationsPage']) {
  if (withoutComments(read(`src/admin/pages/${page}.tsx`)).includes('window.confirm')) {
    throw new Error(`${page}.tsx uses window.confirm; an automated browser cancels it, so the action can never be verified.`);
  }
}
// 同步鈕有兩顆——收件匣一顆、整合設定一顆。分批上線時迴圈只加在其中一顆，於是另一顆
// 每按一次只前進 5 封，佇列 113 封要按 23 次。兩顆走同一段程式，不要再各寫一套。
requireText('src/admin/operations/gmailSync.ts', ['syncGmailUntilDone', 'MAX_BATCHES', 'shouldStop']);
for (const page of ['InboxPage', 'IntegrationsPage']) {
  requireText(`src/admin/pages/${page}.tsx`, ['syncGmailUntilDone']);
  if (withoutComments(read(`src/admin/pages/${page}.tsx`)).includes('await triggerGmailSync(full)')) {
    throw new Error(`${page}.tsx fires a single sync request again; one press must drain the queue, not advance one batch.`);
  }
}
requireText('src/admin/pages/SettingsPage.tsx', ['saveSince', 'sinceDraft']);
if (read('supabase/migrations/20260805000027_app_settings_subject_keywords.sql').includes('"add"')) {
  throw new Error('the default subject keywords include "add"; Gmail search is case-insensitive so it matches Add/Added/Address.');
}
requireText('supabase/migrations/20260805000026_app_settings_sync_label_ids.sql', ['add column if not exists sync_label_ids']);
// ⚠ messages.list 的 labelIds 是 AND（同時具備），不是 OR。要「任一符合」就必須每個標籤各查一次；
// 塞多個進同一次查詢會變成「同時貼了這幾個標籤的信」，幾乎永遠是空的。
requireText('supabase/functions/gmail-sync/index.ts', [
  'sync_label_ids', 'for (const labelId of syncLabelIds)', 'syncLabelIds.some((labelId) => metaLabels.includes(labelId))',
]);
{
  const source = withoutComments(read('supabase/functions/gmail-sync/index.ts'));
  if (/labelIds',\s*syncLabelIds/.test(source) || source.includes("labelIds', syncLabelIds.join")) {
    throw new Error('gmail-sync passes several labels to one messages.list call; labelIds is AND, so that asks for mail carrying all of them.');
  }
  // 舊欄位是「還沒重新勾選時的退路」，被覆寫掉的話那條退路會在使用者沒察覺時消失。
  if (withoutComments(read('src/admin/operations/api.ts')).includes('sync_label_id:')) {
    throw new Error('updateAppSettings writes the legacy single-label column; it is the fallback for settings not yet re-picked.');
  }
}
// 部署後仍開著的分頁：hashed chunk 消失，lazy import 404，畫面空白且沒有任何訊息。
// 這個站一天部署數次，後台會被開著好幾天——已經害監督視窗把它誤判成「函式壞了」一次。
requireText('src/router.tsx', ['StaleChunkBoundary', 'watchForStaleChunks', 'clearStaleChunkFlag']);
requireText('src/lib/staleChunk.ts', ['vite:preloadError', 'RELOAD_FLAG', 'sessionStorage']);
// 同步跑不完時必須留下紀錄：被執行環境掐掉的話 catch 不會執行，完成時那一筆稽核就不會寫。
// 單次工作量必須有上限：16 封一次做完（format=full＋解析＋附件下載上傳）會把 worker 撐爆，
// 回 "not having enough compute resources"。每批固定筆數、剩下的寫回佇列續傳，
// 每批各自寫稽核——中途死掉才知道死在第幾批。附件是最耗資源的一段，過大就不下載。
requireText('supabase/functions/gmail-sync/index.ts', [
  'TIME_BUDGET_MS', 'META_CONCURRENCY', 'BATCH_SIZE', 'ATTACHMENT_MAX_BYTES',
  'pending_message_ids', 'start batch queued:', 'remaining',
]);
requireText('supabase/migrations/20260805000025_gmail_sync_pending_queue.sql', ['add column if not exists pending_message_ids']);
// 意願記在人身上，不從報名狀態推導——狀態一變，推導出來的意願就失效，然後信就寄出去了。
requireText('src/admin/operations/emailCompose.ts', ['noBulkEmail', '不接收群發']);
requireText('supabase/migrations/20260805000024_contacts_no_bulk.sql', ['add column if not exists no_bulk_email']);
// F17：主旨在建串時決定後不再覆寫，否則轉寄一次整條串就改名成「Fwd: …」。
requireText('supabase/functions/gmail-sync/index.ts', ['thread.subject ? {} : { subject:']);
// F14：導航場次的起迄是「該月候選時段最早起到最晚迄」，會跨日。只印時鐘時間會變成
// 「20:00–10:00」，看起來像結束早於開始——資料是對的，顯示是錯的。
requireText('src/admin/operations/SessionTable.tsx', ['sessionSpanText', 'sameDay(startsAt, endsAt)']);
if (withoutComments(read('src/admin/operations/SessionTable.tsx')).includes('{sessionTimeText(session.startsAt)}–{sessionTimeText(session.endsAt)}')) {
  throw new Error('SessionTable.tsx prints a bare clock range again; a cross-day session reads as ending before it starts.');
}
requireText('supabase/migrations/20260804000017_settings_and_contact_audit.sql', [
  'create table if not exists public.app_settings', 'trg_contacts_admin_audit',
  'trg_contact_group_members_audit', 'review_status',
]);
requireText('src/routes/RegisterPage.tsx', ['報名只接受資料庫正式場次']);
if (read('src/routes/RegisterPage.tsx').includes('if (sessions.length === 0)')) throw new Error('Static registration slot fallback still exists.');
for (const slug of ['submit-registration', 'send-email-v2', 'gmail-sync', 'team-invite']) {
  requireText(`supabase/functions/${slug}/index.ts`, ['Deno.serve', 'SUPABASE_SERVICE_ROLE_KEY']);
}
requireText('supabase/functions/gmail-sync/index.ts', [
  'GMAIL_SCOPE_MISSING',
  'gmail.readonly',
  'function htmlToText',
  'body: parsed.text || htmlToText(parsed.html)',
]);
requireText('DEPLOY.md', ['https://www.googleapis.com/auth/gmail.readonly']);
requireText('src/admin/pages/IntegrationsPage.tsx', ['尚未建置 users.watch／Pub/Sub；目前由管理員手動同步']);
requireText('src/admin/operations/api.ts', ['function cleanEmailBody', 'htmlToPlainText(bodyHtml)']);
// F13：「已確認出席／請假改期」是對方按下按鈕的決定，不得被後續信件往來覆寫。工作台的信件狀態
// 因此從 attendance_confirmations 推導，不從 mail_state 讀——gmail-sync 同步任何一封後續信件都會
// 把 mail_state 寫回 waiting_reply，後台就會對早就答應要來的人再催一次。
requireText('src/admin/operations/api.ts', [
  'function confirmedState', 'attendance_confirmations(action, responded_at)',
  'mapMailStatus(row.email_threads ?? [], row.attendance_confirmations ?? [])',
]);
if (read('src/admin/operations/api.ts').includes('mapMailStatus(row.email_threads ?? [])')) {
  throw new Error('mapMailStatus reads the thread state alone again; the attendance decision would be overwritten by the next letter.');
}
requireText('src/admin/AdminShell.tsx', ['applyPageMetadata(location.pathname)']);
requireText('src/routes/PublicLayout.tsx', ['overflow-x-hidden']);
// 四個公開頁的場次一律讀 sessions_public：即將場次走 UpcomingSessions，
// 歷史場次走 SessionHistory（status='done'）。手寫場次卡與寫死的 Meet 連結
// 已全數下架，頁尾聯繫區統一為 LineContact（內嵌 QR＋可用的複製鈕）。
for (const page of ['HomePage', 'PeerGroupPage', 'ParentConsultPage', 'NavigatorConsultPage']) {
  const path = `src/pages/public/${page}.tsx`;
  requireText(path, ['<SessionHistory', '<LineContact />']);
  const source = read(path);
  if (source.includes('meet.google.com')) throw new Error(`${path} still hard-codes Meet links.`);
  if (source.includes('id="copyButton"')) throw new Error(`${path} still uses the handler-less copy button.`);
}

// 寫死的場次表會悄悄過期，而且同一份常被複製到多個頁面（首頁就曾留著 /parent 已經
// 清掉的那份，四月到六月的日期與截止日照樣掛在站上）。上面的檢查看的是「元件在不在」，
// 抓不到這種內容腐爛，所以直接把這些字樣列為禁用——場次一律從 sessions_public 來。
// 時段規則（「第二週 週一…」）算同一種腐爛：規則本身沒錯，但它不會跟著後台改的候選時段走，
// 站上因此可以同時掛著兩份互相矛盾的時間。一律改用 NavigatorSlotSummary 讀 slot_options。
const STALE_SCHEDULE = ['上半年度開放場次', '【四月場次】', '【五月場次】', '【六月場次】', '截止日：', '第二週 週一'];
// src/content 也要掃：那裡放的是同一份文案的另一版，先前不在檢查範圍內，
// 於是 4／5／6 月那張過期場次表就一直留在 parent-consult-intro.tsx 裡沒被抓到。
const CONTENT_DIRS = ['src/pages/public', 'src/content/services'];
for (const dir of CONTENT_DIRS) {
  for (const page of readdirSync(resolve(root, dir))) {
    if (!page.endsWith('.tsx')) continue;
    const source = read(`${dir}/${page}`);
    const found = STALE_SCHEDULE.filter((needle) => source.includes(needle));
    if (found.length) {
      throw new Error(`${dir}/${page} hard-codes a session schedule (${found.join(', ')}); read sessions_public instead.`);
    }
  }
}
console.log('Admin operations structural checks passed.');
