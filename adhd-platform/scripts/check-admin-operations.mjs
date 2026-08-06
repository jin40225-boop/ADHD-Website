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
// 自訂類群可建立／刪除；系統類群不可，而那道保護必須也在資料庫——UI 擋得住按鈕，
// 擋不住直接打 PostgREST，而擋不住的那條路正是出事時沒有人看著的那條。
requireText('src/admin/operations/api.ts', ['export async function createContactGroup', 'export async function deleteContactGroup']);
requireText('src/admin/operations/SettingsTables.tsx', ['onDelete(', 'group.isSystem', 'confirmingId === group.id']);
requireText('src/admin/pages/SettingsPage.tsx', ['createContactGroup', 'deleteContactGroup', '建立類群']);
requireText('supabase/migrations/20260806000030_contact_group_admin.sql', [
  'protect_system_contact_group', 'trg_contact_groups_protect', 'log_contact_group_change', 'trg_contact_groups_audit',
]);
{
  // 自訂類群的 key 不得寫死：它是 unique 欄位，寫死等於第二個類群建不出來。
  const source = withoutComments(read('src/admin/operations/api.ts'));
  if (!/key: `custom_\$\{crypto\.randomUUID/.test(source)) {
    throw new Error('createContactGroup no longer generates a unique key; contact_groups.key is unique, so a fixed value means the second group cannot be created.');
  }
}
// 逾期門檻原本是「只存值、Phase 4 才生效」，那句話當時是誠實的。Phase 4 接線之後它反過來
// 變成不實敘述——說明文字必須跟著功能走，過期的免責聲明和假生效一樣會誤導人。改成斷言
// 「已生效」的說法在，並禁用舊句子，免得有人把警語又貼回來。
requireText('src/admin/pages/SettingsPage.tsx', ['<ContactTable', '<GroupEditor', 'Phase 6', '待審閱', '已生效']);
// 審閱狀態要有切換入口，否則「六封改 approved」永遠只能下 SQL——一個只能靠 SQL 完成的
// 待辦會一直掛著。狀態改動不走 adminSaveEmailTemplate：審閱是獨立決定，不該因為改錯字就變。
requireText('src/admin/operations/api.ts', ['export async function setTemplateReviewStatus']);
requireText('src/admin/pages/SettingsPage.tsx', ['setTemplateReviewStatus', '標為定稿']);
if (read('src/lib/api.ts').includes('review_status: template.reviewStatus')) {
  throw new Error('adminSaveEmailTemplate writes review_status; editing a typo would silently flip a template back to draft (or to approved).');
}
if (read('src/admin/pages/SettingsPage.tsx').includes('現在只是存起來')) {
  throw new Error('SettingsPage.tsx still says the overdue threshold is not wired up; Phase 4 connected it and the text is now false.');
}
// 「自動＋可覆寫」的表頭必須有對應的入口，而且覆寫要留下原因。
requireText('src/admin/operations/RegistrationTable.tsx', ['export function MailOverrideEditor', 'setMailStateOverride', '覆寫原因（必填）']);
requireText('src/admin/operations/api.ts', ['export async function setMailStateOverride', 'mail_state_override_reason', 'mail_state_override_by']);
requireText('src/admin/pages/RegistrationsOperationsPage.tsx', ['<MailOverrideEditor']);
{
  // 覆寫不得改寫 mail_state：那一欄記的是最後真的發生什麼，蓋掉它就沒有東西可以還原。
  const source = withoutComments(read('src/admin/operations/api.ts'));
  const fn = source.slice(source.indexOf('export async function setMailStateOverride'));
  if (/mail_state:/.test(fn.slice(0, fn.indexOf('\nexport ')))) {
    throw new Error('setMailStateOverride writes mail_state itself; the override must sit beside the automatic value, not replace it.');
  }
}
requireText('src/router.tsx', ["path: 'settings'", "path: 'documents'"]);
// Phase 6：AI 文件生成。金鑰只能從環境變數取，永遠不進資料表、不回前端、不進錯誤訊息。
requireText('supabase/functions/generate-document/index.ts', [
  "Deno.env.get('ANTHROPIC_API_KEY')", 'function scrubSecrets', "model: 'claude-opus-5'", "status: 'draft'",
]);
{
  const source = withoutComments(read('supabase/functions/generate-document/index.ts'));
  // 從資料表讀金鑰＝把它放進一個 RLS 之外還有很多人看得到的地方。
  if (/from\('app_settings'\)[\s\S]{0,200}(api_key|anthropic)/i.test(source)) {
    throw new Error('generate-document reads the API key from a table; it must come from Deno.env only.');
  }
  // 錯誤訊息是最容易把金鑰漏出去的路徑：上游把 header 塞進 message，我們原封不動轉出去。
  if (!/scrubSecrets\(message\)/.test(source)) {
    throw new Error('generate-document returns raw error messages; run them through scrubSecrets first.');
  }
  // 去識別化必須在送出之前。順序反了就是先把真實姓名送出去再說。
  if (source.indexOf('anthropic.messages.create') < source.indexOf('redact(materials.join')) {
    throw new Error('generate-document calls the API before redacting; names would leave the system in the clear.');
  }
  // AI 不寄信：這支只寫草稿，不得呼叫寄信函式。
  if (/send-email-v2|gmail\.googleapis\.com/.test(source)) {
    throw new Error('generate-document can send mail; AI must only produce drafts for a human to send.');
  }
}
// 預覽與實際送出必須是同一份文字：預覽若是另外組的字，使用者審閱的就不是會送出的東西。
requireText('supabase/functions/generate-document/index.ts', ['if (preview)', 'willSend: prompt']);
requireText('src/admin/pages/DocumentsPage.tsx', ['invokeGenerateDocument', 'genPreview', '檢視將送出的資料']);

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
// 收件匣批次管理：勾選＋批次標為已處理／刪除。刪除必須先清掉 storage 的附件檔案再刪列——
// 物件的讀取權限是拿路徑第一段的 thread id 去問 can_access_thread，thread 先被刪掉的話，
// 那些檔案就同時變成讀不到也刪不掉的孤兒，而裡面裝的正是要清掉的個資。
requireText('src/admin/operations/api.ts', ['export async function markThreadsHandled', 'export async function deleteThreads']);
{
  const source = withoutComments(read('src/admin/operations/api.ts'));
  const deleteFn = source.slice(source.indexOf('export async function deleteThreads'));
  const body = deleteFn.slice(0, deleteFn.indexOf('\nexport '));
  if (body.indexOf(".from('email_threads').delete(") < body.indexOf("storage.from('email-attachments').remove")) {
    throw new Error('deleteThreads removes the thread rows before the attachment files; the files become unreadable and undeletable orphans.');
  }
}
// 刪除回 0 列不是成功。RLS 濾掉整批時 PostgREST 不報錯、只回 count 0，於是畫面平靜地印出
// 「已刪除 0 個對話」而信件其實還在——沒有錯誤、沒有紅字，跟成功長得一模一樣。
requireText('src/admin/operations/api.ts', ['if (count === 0)']);
requireText('src/admin/pages/InboxPage.tsx', ['markThreadsHandled', 'deleteThreads', 'confirmingDelete', 'ops-thread-check', '全選這個檢視']);
// Google refresh token 失效會讓四支函式同時全倒，修復腳本與排障步驟必須留在文件裡。
requireText('DEPLOY.md', ['GOOGLE_TOKEN_ERROR', 'get-google-refresh-token.mjs', '已發布（In production）']);
{
  // 取 token 的腳本不得把憑證寫進任何檔案——它只該印在終端機。
  const source = read('scripts/get-google-refresh-token.mjs');
  if (/writeFileSync|appendFileSync|createWriteStream/.test(source)) {
    throw new Error('get-google-refresh-token.mjs writes to disk; the refresh token must only ever reach the terminal.');
  }
  requireText('scripts/get-google-refresh-token.mjs', ["'access_type', 'offline'", "'prompt', 'consent'"]);
}
// 勾選要跟著檢視走：換篩選後留著看不見的勾，按下刪除就會刪到畫面上根本沒有的信。
requireText('src/admin/pages/InboxPage.tsx', ['picked.filter((id) => visibleIds.includes(id))']);

// 破壞性動作要確認，但確認不能用 window.confirm：原生對話框在自動化瀏覽器裡會被自動取消，
// 等於把所有代驗擋在門外。全站一律做成站內確認——這幾頁先前各自留著一個原生對話框。
for (const page of ['FeedbackPage', 'FormsPage', 'TemplatesPage', 'CasesOperationsPage', 'InboxPage']) {
  if (withoutComments(read(`src/admin/pages/${page}.tsx`)).includes('window.confirm')) {
    throw new Error(`${page}.tsx uses window.confirm; an automated browser cancels it, so the action can never be verified.`);
  }
}
if (withoutComments(read('src/features/email-templates/EmailTemplateManager.tsx')).includes('window.confirm')) {
  throw new Error('EmailTemplateManager.tsx uses window.confirm; template deletion would stop being verifiable.');
}
requireText('src/features/email-templates/EmailTemplateManager.tsx', ['confirming===template.id']);
requireText('src/admin/pages/FormsPage.tsx', ['pendingProjectId']);
requireText('src/admin/pages/FeedbackPage.tsx', ['confirmingId === r.id']);
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
// 內部註記只能掛一個對象：internal_notes 有 `num_nonnulls(contact_id, registration_id, case_id) = 1`
// 的約束，同時傳報名與聯絡人會被 DB 以 23514 擋下。這個 bug 上線後完全看不出來——POST 回 400、
// 畫面什麼都沒說、註記就是存不進去，因為處理函式當時沒有 catch。兩個根因各留一條斷言。
requireText('src/admin/pages/RegistrationsOperationsPage.tsx', ['saveNote({ registrationId:']);
if (read('src/admin/pages/RegistrationsOperationsPage.tsx').includes('saveNote({ contactId:')) {
  throw new Error('addNote passes both contactId and registrationId again; internal_notes_one_target rejects that with 23514.');
}
// 寫入失敗必須有人接住並顯示。這裡用 catch 裡的訊息當代理——訊息不見了，catch 也就不在了。
requireText('src/admin/pages/RegistrationsOperationsPage.tsx', ['儲存註記失敗', '建立追蹤待辦失敗']);
requireText('src/admin/pages/CasesOperationsPage.tsx', ['儲存註記失敗', '建立追蹤待辦失敗', '個案轉移失敗', '封存個案失敗', '封存紀錄失敗']);

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
// 掃整個 src/content 而不是列舉子目錄：`services/` 兩檔刪除後該目錄不存在（git 不收空目錄），
// 寫死路徑會讓 clone 出來的 repo 在 readdirSync 就 ENOENT；遞迴也讓日後新增的 content 子目錄
// 自動納入守門，不必記得回來改這一行。
const CONTENT_DIRS = ['src/pages/public', 'src/content'];
const collectTsx = (dir) => readdirSync(resolve(root, dir), { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory() ? collectTsx(`${dir}/${entry.name}`) : entry.name.endsWith('.tsx') ? [`${dir}/${entry.name}`] : [],
);
for (const dir of CONTENT_DIRS) {
  for (const file of collectTsx(dir)) {
    const source = read(file);
    const found = STALE_SCHEDULE.filter((needle) => source.includes(needle));
    if (found.length) {
      throw new Error(`${file} hard-codes a session schedule (${found.join(', ')}); read sessions_public instead.`);
    }
  }
}
console.log('Admin operations structural checks passed.');
