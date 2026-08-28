import { existsSync, readFileSync, readdirSync } from 'node:fs';
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
// 同一種過期免責聲明，換了個 Phase 號碼：文件生成已於 Phase 6 上線並驗收通過，
// SessionsPage／DocumentsPage 若還說「將於 Phase 6 啟用」就是對已經能用的功能說謊。
for (const page of ['src/admin/pages/SessionsPage.tsx', 'src/admin/pages/DocumentsPage.tsx']) {
  if (read(page).includes('將於 Phase 6 啟用')) {
    throw new Error(`${page} still says document generation is pending Phase 6; it shipped and passed acceptance on 2026-08-06.`);
  }
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
// 孩子姓名同樣要代號化，而且**不還原**。報名表那欄寫的是「孩子姓名或代號」，實務上家長多半填真名，
// 所以它就是兒少的真實姓名；家長姓名還原是因為信裡要有稱呼，孩子沒有這個需要。
requireText('supabase/functions/generate-document/index.ts', ['CHILD_NAME_KEYS', '〔孩子', 'function collectNames', 'childNames']);
{
  const source = withoutComments(read('supabase/functions/generate-document/index.ts'));
  // 孩子姓名進 placeholders 但不得進 restore——兩份對照表的不對稱就是「不還原」這條規則本身。
  if (/children\.forEach\([^)]*\)\s*=>\s*\{[^}]*restore\[/.test(source)) {
    throw new Error('generate-document restores child names; codes are enough in the output, restoring writes a child\'s real name back into it.');
  }
}
// 直接刪報名要回收名額，且不得對已釋額的報名重複扣（會吃掉別人的名額，且沒有錯誤訊息）。
requireText('supabase/migrations/20260806000032_release_capacity_on_delete.sql', [
  'release_capacity_on_delete', 'trg_registration_release_on_delete', 'old.capacity_released_at is not null',
]);
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
  // 同步與非同步兩套都要擋。原本只列 *Sync，於是 `node:fs/promises` 的 writeFile／appendFile
  // 完全不在守門範圍內——而「順手改成 await 版」正是這種腳本最可能被改動的方向。
  if (/writeFileSync|appendFileSync|createWriteStream|fs\/promises|\bwriteFile\b|\bappendFile\b|\bopen\s*\(/.test(source)) {
    throw new Error('get-google-refresh-token.mjs writes to disk (sync or async); the refresh token must only ever reach the terminal.');
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
// WP2：五頁收斂進 ops 外殼。這五頁是第一代後台的殘留（07-14 建、07-23 沒跟著搬），
// 進去看不到頁首、外層也不是 ops 版面，使用者看到的「區塊不對稱」就是這個。
// 斷言外殼與頁首兩件事：少了任何一個就代表這一頁又掉回第一代版型。
for (const page of ['TemplatesPage', 'FormsPage', 'FeedbackPage', 'RecommendationsPage', 'InstructorSchedulingPage']) {
  requireText(`src/admin/pages/${page}.tsx`, ['ops-section', '<PageHeader']);
}
console.log('Admin operations structural checks passed.');

// WP1 —— 共用場次名冊抽屜 ＋ 個人／團體分流 ＋ 匯出 ＋ 封存釋額。
// 這幾條斷言守的都是「文字一旦被刪掉，功能就靜靜變成裝飾品」的地方：分流的兩種說明、
// 已結束場次的關閉說明、彙整可貼進哪裡的提示，全都是使用者唯一看得到的行為說明。
requireText('src/admin/operations/SessionRosterDrawer.tsx', [
  'GROUP_SESSION_SLUGS',
  // 個人場逐人寄／群體場整批寄：兩句說明各自對應一種入口，少一句就有一種場次沒有人知道該怎麼寄。
  '一人一封', '整批寄',
  // 已結束的場次不該再有群發入口，但名冊與匯出要留著（歷史名冊仍要查得到）。
  '場次已結束，群發入口已關閉',
  // 彙整分頁的用途提示；沒有它，那兩顆複製鈕只是兩段沒有去處的文字。
  '可直接貼進',
]);
// 場次詳情的「報名概況」要真的掛上共用面板，而不是又退回只列一行姓名。
requireText('src/admin/pages/SessionsPage.tsx', ['SessionRosterPanel']);
// 封存一個還佔著未來場次名額的人時，必須問過才動名額——這是兩個選項裡會打 RPC 的那一個。
requireText('src/admin/pages/PeoplePage.tsx', ['一併退出並釋放']);
// 群組欄位（親職的 children）的題目住在 subFields；少了這層遞迴，孩子那一段只剩英文 key。
requireText('src/admin/operations/answerLabels.ts', ['subFields']);
// CSV 少了 BOM，Excel 開中文一定亂碼——使用者對匯出的第一印象就是「壞了」。
requireText('src/admin/operations/exportCsv.ts', [String.raw`\uFEFF`]);
// 名冊面板不得自己抓資料：它會被掛到報名審核頁，一旦自己查詢就是每個宿主各多一份請求。
if (withoutComments(read('src/admin/operations/SessionRosterDrawer.tsx')).includes("from '@/lib/api'")) {
  throw new Error('SessionRosterDrawer.tsx queries on its own; all data must arrive as props from the host page.');
}
console.log('WP1 session roster checks passed.');

// WP5：信件範本依服務線分組 ＋ 十封新範本。
//
// 分組不新增欄位，用的是既有的 email_templates.project_id；擋的是「範本又退回一長串平名單」
// 與「十封新範本被改名或漏掉」。名稱是使用者要逐封審的東西，改名等於改掉他要找的那封。
// WP5
const WP5_MIGRATION = 'supabase/migrations/20260827000042_template_groups_and_new_seeds.sql';
requireText(WP5_MIGRATION, [
  '收件通知・職場版', '確認信・職場版', '行前通知・職場版', '改期確認信・職場版',
  '改期確認信・親職版', '改期確認信・導航版', '行前通知・同儕版', '場次異動通知・同儕版',
  '講師確認信', '協辦活動公告信',
  'review_status', "'draft'",
]);
// WP5：新範本一律以草稿種入，審閱後才由使用者改 approved。少了這個條件，十封 AI 起草的信
// 會直接以 approved 出現在清單裡，看不出哪些還沒被人讀過。
if (!/review_status\s*\)\s*[\s\S]*?'draft'/.test(read(WP5_MIGRATION))) {
  throw new Error(`${WP5_MIGRATION} does not seed the new templates as review_status='draft'.`);
}
// WP5：回填段只准碰 project_id。name／subject／body／letter_kind 是使用者定稿的十封，
// 一旦被 update 到就會連稽核紀錄一起改寫，且無從還原。
if (/update\s+public\.email_templates[\s\S]{0,400}?set\s+(name|subject|body|letter_kind)\s*=/.test(read(WP5_MIGRATION))) {
  throw new Error(`${WP5_MIGRATION} rewrites a finalized template field; the backfill may only set project_id.`);
}
// WP5：冪等的兩道保險——回填看「現在對齊幾封」而不是「這次改了幾封」，種入靠同名 not exists。
requireText(WP5_MIGRATION, ['not exists (select 1 from public.email_templates t where t.name = v.name)', 'raise exception']);
// WP5：分組函式與清單頁的接線。groupTemplates 消失＝分組又變回一長串平名單。
requireText('src/admin/operations/templateGroups.ts', ['export function groupTemplates', 'GENERIC_GROUP_LABEL']);
requireText('src/admin/pages/TemplatesPage.tsx', ['groupTemplates(templates, projects)', 'groups={groups}']);
requireText('src/features/email-templates/EmailTemplateManager.tsx', ['EmailTemplateGroup', 'email-template-group__label']);
console.log('WP5 template grouping checks passed.');

// WP4：文件產生中心。六個選項先前壓成三個 docType，三個選項按下去產出同一份東西；
// 預設的「整個下半年」則沒有彙整素材可用，一按必定 NO_MATERIAL。六型與彙整分支
// 因此逐一列為斷言——少掉任何一個，選單就又開始承諾它做不到的事。
requireText('supabase/functions/generate-document/index.ts', [
  'monthly_notice', 'pre_event_reminder', 'event_plan', 'social_post', 'annual_report',
  'INSTRUCTION_REQUIRED',
]);
// 議題欄原本讀的兩個 key 在任何一份 form_schema 裡都不存在，於是永遠印「未填」；
// 孩子欄只讀舊平面 key，用 children[] 報名的人整欄消失。兩個 fallback 都必須在。
requireText('supabase/functions/generate-document/index.ts', ['issueDesc', 'consultTopics', 'children']);
// 落庫的 scope 一律跟著素材走；寫死 'single' 會讓彙整型文件在紀錄裡指向一場查不到的場次。
requireText('supabase/functions/generate-document/index.ts', ["scope: targetSessionId ? 'single' : 'aggregate'"]);
// 停用的理由要寫出來：按鈕灰掉而不說為什麼，跟按下去失敗一樣沒用。
requireText('src/admin/pages/DocumentsPage.tsx', [
  '行前提醒信必須選定單一場次', '到下方範本群發區選名單', 'useSearchParams',
]);
// 「收件對象」下拉從來沒被送進 invokeGenerateDocument，選什麼對產出零影響——
// 假控制項比缺功能更糟，因為它讓人以為自己做了決定。不准回來。
if (withoutComments(read('src/admin/pages/DocumentsPage.tsx')).includes('收件對象')) {
  throw new Error('DocumentsPage.tsx brings back the audience dropdown; it never reaches invokeGenerateDocument.');
}
// 生成紀錄要看得到內容：mapping 少了 content，抽屜就只能開出一片空白。
requireText('src/admin/operations/api.ts', ['content: row.content', 'targetId: row.target_id']);
console.log('WP4 document-centre checks passed.');

// WP3：收尾包——把前四包接起來，並終結後台的英文代碼與 UUID 亂碼。
// WP3
// 「完整表單內容」的標題必須查報名表定義（WP1 的索引），不能再回到只有兩個 key 有中文的
// 寫死對照。ANSWER_LABEL 只准留報名頁注入、schema 裡沒有的那兩個 key，當 fallback 用。
requireText('src/admin/pages/RegistrationsOperationsPage.tsx', [
  'buildAnswerLabelIndex', 'answerLabel(labelIndex,', 'adminListFormSchemas()',
]);
if (withoutComments(read('src/admin/pages/RegistrationsOperationsPage.tsx')).includes('ANSWER_LABEL[key] ??')) {
  throw new Error('RegistrationsOperationsPage.tsx still reads labels straight from ANSWER_LABEL; it must query the form-schema index first.');
}
// 場次欄唯讀 ＋ 指路。兩個編輯入口會互相打架，而只有「場次移轉」會正確結清名額。
requireText('src/admin/pages/RegistrationsOperationsPage.tsx', ['formatAnswerValue(', '要改場次請用下方']);
// 報名審核端的名冊入口：掛的必須是場次管理用的同一顆面板，不是另做一份。
requireText('src/admin/pages/RegistrationsOperationsPage.tsx', ['SessionRosterPanel', '這一場的名冊與寄信']);
// 名冊入口不得自己查資料：roster／project／sessions／schemas 全部來自本頁已載入的 state。
requireText('src/admin/pages/RegistrationsOperationsPage.tsx', ['roster={rosterOf(rosterSession.id)}', 'adminListProjects()']);
// 兩處範本下拉都要分組。分組消失＝四條線的信又混成一長串，最容易拿錯隔壁線的同名信。
requireText('src/admin/pages/RegistrationsOperationsPage.tsx', ['optgroup', 'groupTemplates(templates, projects, current?.registration.projectSlug)']);
requireText('src/admin/pages/DocumentsPage.tsx', ['optgroup', 'groupTemplates(templates, projects)']);
// 文件中心：類型欄與錯誤碼都要中文化；範圍欄早在 WP4 就接上 targetId，裸 scope 不准回來。
requireText('src/admin/pages/DocumentsPage.tsx', [
  'docTypeText(document.docType)', 'docTypeText(viewing.docType)',
  'session_summary:', 'attendance_sheet:', 'followup_notes:', 'monthly_report:',
  'SESSION_REQUIRED:', 'NO_MATERIAL:', 'INSTRUCTION_REQUIRED:', 'MODEL_REFUSED:', 'EMPTY_RESULT:',
  'docErrorText(e.message)',
]);
if (withoutComments(read('src/admin/pages/DocumentsPage.tsx')).includes('{document.scope}')) {
  throw new Error('DocumentsPage.tsx prints the raw scope column again; it must resolve target_id into a session or period.');
}
// 群發時的場次語境：三個變數對同一場的所有收件人是同一個值，補在呼叫端而不是改 buildBulkContext。
requireText('src/admin/pages/DocumentsPage.tsx', ['bulkSession.meetUrl']);
// 新建範本沒有 letter_kind，就只能靠名稱猜；「改期確認信」含「確認信」會被猜成 confirm
// 而掛上出席確認按鈕。三處修補缺一不可：payload 要送、編輯器要選得到、名稱判斷要先看改期。
// review_status 只寫在 insert 分支且寫死 'draft'：新建的範本沒有人審過。刻意不讀
// template.reviewStatus——那既會讓呼叫端能帶 'approved' 繞過人審，也會撞上上面那條
// 「adminSaveEmailTemplate 不得寫 review_status（改錯字不該翻掉審閱狀態）」的守門。
requireText('src/lib/api.ts', ['letter_kind: template.letterKind ?? null', "review_status: 'draft'"]);
{
  const save = read('src/lib/api.ts').split('adminSaveEmailTemplate')[1] ?? '';
  const update = save.slice(save.indexOf('.update('));
  if (update.includes('review_status')) {
    throw new Error('adminSaveEmailTemplate now writes review_status on update; editing a template would silently change its review state.');
  }
}
requireText('src/features/email-templates/EmailTemplateManager.tsx', ['LETTER_KINDS', 'letterKind:']);
requireText('src/admin/operations/emailCompose.ts', ["name.includes('改期')"]);
// 改期必須判在「確認信」之前，否則插了等於沒插。
{
  const source = read('src/admin/operations/emailCompose.ts');
  if (source.indexOf("name.includes('改期')") > source.indexOf("name.includes('確認信')")) {
    throw new Error("emailCompose.ts checks 改期 after 確認信; 改期確認信 would still be classified as confirm.");
  }
}
// 分組標題套的是 operations.css 既有的類，不新寫 CSS；全文檢視放開高度只准用新增的 class。
requireText('src/features/email-templates/EmailTemplateManager.tsx', ['ops-nav-label']);
requireText('src/admin/operations/operations.css', ['.ops-willsend--full{max-height:none}']);
if (!/\.ops-willsend\{[^}]*max-height:16rem/.test(read('src/admin/operations/operations.css'))) {
  throw new Error('operations.css changed the existing .ops-willsend rule; WP3 may only append a new class.');
}
console.log('WP3 wrap-up checks passed.');

// WP6：信件往來在地化——寄了信要能在原地看到對方回了什麼，不必整頁跳到收件匣再找回來。
// WP6
// 報名抽屜要有真的訊息面板（不是連結），未讀看過就消——與收件匣同一套規則。
requireText('src/admin/pages/RegistrationsOperationsPage.tsx', ['ops-message-list', 'markThreadRead']);
// 面板排在寄信面板正上方：往來在上、回信在下，這就是原地回信。順序反了等於又要捲上去找。
{
  const source = read('src/admin/pages/RegistrationsOperationsPage.tsx');
  if (source.indexOf('📨 信件往來') > source.indexOf('✍️ 寄信')) {
    throw new Error('RegistrationsOperationsPage.tsx puts the mail thread panel below the compose panel; it must sit directly above it.');
  }
}
// 這半邊零新查詢：訊息只能讀 listContacts() 已攤平好的 messages，不准為了顯示往來再撈一次。
requireText('src/admin/pages/RegistrationsOperationsPage.tsx', ['current?.registration.messages ?? []']);
if (read('src/admin/pages/RegistrationsOperationsPage.tsx').includes('listCaseMail')) {
  throw new Error('RegistrationsOperationsPage.tsx calls listCaseMail; the drawer already has the messages in memory and must not re-query.');
}
// 未讀不得只認 registrations.has_unread_reply——那個欄位全庫沒有寫入者，只認它紅點永遠不亮。
// 兩半邊都要從訊息自己的 is_read（inbound）推導，也就是收件匣清的同一個欄位。
requireText('src/admin/pages/RegistrationsOperationsPage.tsx', ['hasUnreadMail', "message.direction === 'inbound' && !message.isRead"]);
requireText('src/admin/operations/api.ts', ["message.direction === 'inbound' && !message.isRead"]);
// 個案台：目標式撈取＋沒有關聯聯絡人時的明講。
requireText('src/admin/pages/CasesOperationsPage.tsx', ['listCaseMail', '沒有可顯示的信件往來', 'ops-message-list']);
// 唯讀檢視不得動狀態：個案台不准清未讀。
if (read('src/admin/pages/CasesOperationsPage.tsx').includes('markThreadRead')) {
  throw new Error('CasesOperationsPage.tsx clears unread state; the case desk is read-only and must leave markThreadRead to the inbox and the registration drawer.');
}
// 瘦查詢的形狀：用 contact_id（一個人可能有多筆報名），mapping 重用同檔的 mapMessage。
requireText('src/admin/operations/api.ts', ["export async function listCaseMail", ".eq('contact_id'"]);
{
  const source = read('src/admin/operations/api.ts');
  const fn = source.slice(source.indexOf('export async function listCaseMail'));
  const body = fn.slice(0, fn.indexOf('\nexport '));
  if (!body.includes('mapMessage')) {
    throw new Error('listCaseMail does not reuse mapMessage; message mapping must stay single-source.');
  }
  if (body.includes('listContacts')) {
    throw new Error('listCaseMail falls back to listContacts; the case desk must not load every contact to read one person.');
  }
}
console.log('WP6 mail-in-place checks passed.');

// WP8：誠實 CTA——頁底那顆大按鈕讀跟 UpcomingSessions 同一份資料，滿了就說滿了。
// WP8
// 三態判斷必須和「送出會不會被收」同一個來源，不能另發明一套。
//
// 這一條原本比對的是三段字面程式碼。2026-08-28 抽出共用的 seatAvailability() 之後，
// 那三段就不存在了——而守門仍然通過的話，才是真的危險。所以改成守**行為的來源**：
// 判斷必須來自那支共用模組，不得在這裡自己重寫。實作細節可以變，來源唯一不能變。
requireText('src/components/RegisterCta.tsx', [
  'seatAvailability', "a.accepted && !a.viaWaitlist", 'a.accepted && a.viaWaitlist',
]);
// 額滿文案兩款：職場談是申請制（頁面本來就承諾候補），其餘三項是月度場次。
requireText('src/components/RegisterCta.tsx', [
  '目前時段已滿・仍可送出候補申請', '本月已額滿・新場次公布後開放',
]);
// 四頁同一顆、同一色：站內報名橫幅本來就是黃的，「黃＝報名」已是既成語彙。不寫新 CSS。
requireText('src/components/RegisterCta.tsx', ['bg-base-yellow']);
for (const forbidden of ['bg-accent-blue', 'bg-accent-pink', 'bg-accent-orange']) {
  if (read('src/components/RegisterCta.tsx').includes(forbidden)) {
    throw new Error(`RegisterCta.tsx uses ${forbidden}; the four register buttons must share one colour (bg-base-yellow).`);
  }
}
// 最重要的一條：載入中／查詢失敗／沒有場次一律退回静態按鈕（原樣文案、可點）。
// 寧可顯示過時文案，也不能讓想報名的人點不到；額滿時按鈕也仍然可點。
requireText('src/components/RegisterCta.tsx', [
  'sessions.length > 0 && !bookable',
  // 查詢失敗時兩個狀態都要收乾淨：只清 isFull 會讓上一次算出的候補文案殘留，
  // 變成「查不到資料卻說得出這一場收不收候補」。
  'setIsFull(false); setWaitlistOpen(false);',
  // 額滿的說法必須逐場讀 allow_waitlist——與後端 enforce_session_capacity 同一個來源。
  // 寫死成「某條線一律可候補」會在使用者把單場候補關掉時變成謊話。
  // 2026-08-28 起這個讀取搬進 seatAvailability()，所以這裡守的是「有逐場問過它」。
  'sessions.map((session) => seatAvailability(session, project.seatPolicy))',
  'waitlistOpen ? copy.waitlistLabel : copy.fullLabel',
]);
{
  const source = withoutComments(read('src/components/RegisterCta.tsx'));
  if (/disabled|pointer-events-none/.test(source)) {
    throw new Error('RegisterCta.tsx disables the button; a full session list must never block the registration path.');
  }
}
// 四個服務頁都換成同一顆；舊的寫死連結不得殘留（殘留就是又一頁永遠喊可報名）。
const registerCtaPages = [
  ['src/pages/public/CareerConsultPage.tsx', 'career'],
  ['src/pages/public/ParentConsultPage.tsx', 'parent'],
  ['src/pages/public/PeerGroupPage.tsx', 'peer-group'],
  ['src/pages/public/NavigatorConsultPage.tsx', 'navigator'],
];
for (const [page, slug] of registerCtaPages) {
  requireText(page, [`<RegisterCta slug="${slug}" />`]);
  const source = withoutComments(read(page));
  if (source.includes('btn-warm py-5 px-6')) {
    throw new Error(`${page} still hard-codes the old static register button; it must render <RegisterCta />.`);
  }
}
console.log('WP8 honest-CTA checks passed.');

// WP9：首頁收攏＋自介收斂——手機版首頁 17,207px 降到 8,824px（375px 實測），內容零刪除。
// WP9
// 桌機恆展開的機制是「連包裝都不生成」：CollapsibleSection 在桌機直接回傳 children，
// 所以 #groups 的 DOM 與改版前逐位元組相同。少了這一行就會變成 CSS 隱藏，
// 摘要裡的 UpcomingSessions／RegisterCta 會在桌機無聲掛載並各打一輪 Supabase。
requireText('src/components/CollapsibleSection.tsx', [
  'expandedOnDesktop', 'return <>{children}</>', "matchMedia", '(max-width: 767px)',
]);
// 摺疊只准是「收起來」，不准是「拿掉」：內容一律照原樣傳進 children。
if (withoutComments(read('src/components/CollapsibleSection.tsx')).includes('display: none')) {
  throw new Error('CollapsibleSection.tsx hides content with display:none; collapsed content must stay in the DOM and expand verbatim.');
}
// 尊重系統偏好：reduce 時不做展開動畫，但摺疊功能照常（只關 transition，不關功能）。
requireText('src/styles/tokens.css', ['prefers-reduced-motion: reduce', '.collapsible-body', '.collapsible-body-stack']);
{
  const source = read('src/styles/tokens.css');
  const at = source.indexOf('@media (prefers-reduced-motion: reduce)');
  if (at < 0 || !source.slice(at, at + 400).includes('transition: none')) {
    throw new Error('tokens.css has no prefers-reduced-motion rule that disables the collapsible transition.');
  }
}
// 首頁「115年計畫」區收攏；自我介紹在首頁仍是完整版（那裡是第一次見面）。
requireText('src/pages/public/HomePage.tsx', ['<CollapsibleSection', '<ServiceSummary', 'id="groups"']);
if (withoutComments(read('src/pages/public/HomePage.tsx')).includes('<AboutFounder')) {
  throw new Error('HomePage.tsx now renders <AboutFounder />; the home page must keep its own full-length introduction.');
}
// 一個字都不准刪：卡內原文必須還在檔案裡，只是被收進摺疊。
requireText('src/pages/public/HomePage.tsx', [
  '各位大A夥伴大家好，我是彥宇！',
  '如果你覺得生活有些卡關，想釐清自己目前的心理狀態',
  '在陪伴 ADHD 孩子的路上，您是否時常感到心力交瘁',
  '⚠️ 【重要提醒：這樣才算報名成功！】',
]);
// 同一段自我介紹原本在首頁與四個服務頁各出現一次全文；服務頁改成兩行引言＋展開全文。
for (const page of [
  'src/pages/public/CareerConsultPage.tsx',
  'src/pages/public/ParentConsultPage.tsx',
  'src/pages/public/PeerGroupPage.tsx',
  'src/pages/public/NavigatorConsultPage.tsx',
]) {
  requireText(page, ['<AboutFounder variant="collapsed" />']);
}
// 預設仍是完整版：既有呼叫端（協辦活動頁）不改也不會變。
requireText('src/components/AboutFounder.tsx', ["variant = 'full'", "variant === 'collapsed'"]);
console.log('WP9 home-page consolidation checks passed.');

// WP10：場次內容補齊 ＋ 延伸連結機制。
// WP10
// 前台：延伸連結真的讀 guest_url／attachments，而且外部連結一定切斷 opener。
// 這個站踩過「十個連結開新分頁沒有切斷 opener」，新加的連結不重演。
requireText('src/components/UpcomingSessions.tsx', ['guestUrl', 'rel="noopener noreferrer"']);
{
  const source = withoutComments(read('src/components/UpcomingSessions.tsx'));
  // 沒有 guest_url 也沒有 attachments 時整塊不出現——不留一個空標題。
  if (!source.includes('first.guestUrl || attachments.length ?')) {
    throw new Error('UpcomingSessions.tsx renders the links block unconditionally; a session with no guest_url and no attachments must show nothing at all.');
  }
  // target="_blank" 的數量必須等於 rel="noopener noreferrer" 的數量。少一個就是漏一個。
  const blanks = (source.match(/target="_blank"/g) ?? []).length;
  const rels = (source.match(/rel="noopener noreferrer"/g) ?? []).length;
  if (blanks !== rels) {
    throw new Error(`UpcomingSessions.tsx opens ${blanks} new tabs but only ${rels} carry rel="noopener noreferrer".`);
  }
}
// 後台：附件要編得到，而且走既有的 adminSaveSession（不另開寫入路徑）。
requireText('src/admin/pages/SessionsPage.tsx', ['attachments', 'parseAttachments(attachmentsText)', 'draft.guestUrl']);
// 檔案上傳不在本包：Storage bucket 與權限設計還沒做，先讓連結型能用。
{
  const source = withoutComments(read('src/admin/pages/SessionsPage.tsx'));
  if (/type="file"|storage\.from\(/.test(source)) {
    throw new Error('SessionsPage.tsx wires a file upload; WP10 ships link-type attachments only (Storage bucket and its permissions are out of scope).');
  }
}
// 候補開關（2026-08-27 裁決）：額滿後還收不收，改成每個場次自己決定。
// 停用的控制項必須配一句說得出原因的文字——停用而不說原因，下一個人只會以為是壞掉了。
requireText('src/admin/pages/SessionsPage.tsx', [
  '額滿後仍接受候補報名',
  '先到先得的服務線暫不支援候補',
  "seatPolicy === 'on_confirm'",
  'disabled: !waitlistSupported',
]);
// 資料層：view 與 payload 兩邊都要有這幾欄，否則後台存得進去、前台讀不到。
requireText('src/lib/api.ts', [
  'guest_url, attachments, allow_waitlist', 'guest_url: session.guestUrl',
  'attachments: session.attachments ?? []', 'allow_waitlist: session.allowWaitlist ?? false',
]);
// migration：四場的主題逐字存在——這支的價值就是那四段文字，改字等於改內容。
{
  const migration = 'supabase/migrations/20260827000045_seed_peer_group_h2_content.sql';
  requireText(migration, [
    '我獨自工作：一人工作室的經營分享',
    '從興趣走向事業：科學教育與公司經營經驗',
    '握緊方向盤的自信：行車安全與駕駛經驗',
    '聊聊理財這件事：從經驗分享到專業建議',
  ]);
  const source = read(migration);
  // sessions_public 只在尾端追加這三欄；meet_url 至今刻意不在這個 view 裡，匿名前台拿不到。
  // allow_waitlist 的欄位在 20260827000044 建立，但 view 的改動集中在這一支——同一支 view
  // 只能在一個地方 create or replace，兩支各改一次會互相把對方的欄位蓋掉。
  if (!source.includes('s.guest_url, s.attachments, s.allow_waitlist')) {
    throw new Error(`${migration} does not expose guest_url/attachments/allow_waitlist through sessions_public; the public page reads that view.`);
  }
  if (/select[\s\S]*s\.meet_url/.test(source)) {
    throw new Error(`${migration} adds meet_url to a public view; the Meet link is deliberately never exposed to anonymous readers.`);
  }
  // 重跑不得覆蓋使用者事後在後台手改的內容：三欄都還是空的才寫。
  if (!source.includes("coalesce(btrim(s.topic), '') = ''")) {
    throw new Error(`${migration} overwrites session content unconditionally; re-running it must skip rows an admin has already edited.`);
  }
  // 台北時區換算：DB 存 UTC，直接比日期會差一天。
  if (!source.includes("at time zone 'Asia/Taipei')::date")) {
    throw new Error(`${migration} matches sessions by raw UTC date; the four dates must be compared in Asia/Taipei.`);
  }
}
console.log('WP10 session-content checks passed.');

// ── 事故守門：報名錯誤訊息不得被 String() 抹平 ─────────────────────────
//
// 2026-08-27 現場事故：報名者重複報名同一場，DB 依 20260811000040 丟出
// `DUPLICATE_REGISTRATION:<場次>`，但 Edge Function 的 catch 寫成
// `err instanceof Error ? err.message : String(err)`。Supabase 的 error 是
// **純物件、不是 Error 實例**，於是整段原因變成字面上的 "[object Object]"
// 送回前端；api.ts 裡那句寫好的「您先前已報名過這些場次…」比對不到關鍵字，
// 永遠不會出現。報名者只看到一個看不懂的錯誤框，也不知道自己其實早就報名成功。
//
// 這裡守的不是某一行寫法，是那個**類別**：守門例外必須能原文抵達前端。
{
  const fn = 'supabase/functions/submit-registration/index.ts';
  const source = read(fn);
  // 直接禁掉出事的那個寫法本身，而不是檢查"有沒有替代品"——
  // 第一版寫成 !includes('function errText')，結果把函式改名成 errTextX 就繞過去了。
  if (/instanceof Error \?[\s\S]{0,60}String\(/.test(source)) {
    throw new Error(`${fn} falls back to String() on a thrown value; Supabase errors are plain objects and become "[object Object]", swallowing the real cause.`);
  }
  if (!/function errText\(/.test(source) || !source.includes("typeof err === 'object'")) {
    throw new Error(`${fn} has no helper that unpacks a plain-object error (message/details/hint); without it the real cause never reaches the registrant.`);
  }
  // 額滿與重複報名都是使用者看得懂的守門情況，兩種都要放行回前端。
  for (const guard of ['SESSION_FULL_OR_CLOSED', 'DUPLICATE_REGISTRATION']) {
    if (!source.includes(guard)) {
      throw new Error(`${fn} no longer forwards ${guard} to the client; api.ts turns it into the Chinese explanation the registrant needs.`);
    }
  }
  // 反向守門：非預期錯誤的資料庫原文不得直接顯示在公開報名頁上。
  const api = read('src/lib/api.ts');
  if (!/console\.error\('\[submitRegistration\]/.test(api)) {
    throw new Error('src/lib/api.ts no longer logs the raw detail for unexpected errors; without it an outage leaves nothing to diagnose from.');
  }
  // 已結束的場次不收公開報名。這一條刻意只在 Edge Function，不在資料庫觸發器：
  // 同儕聚會允許當天直接參加，管理者事後要在後台補登，那條路不經過這裡。
  // 擋在觸發器會連補登一起擋掉。
  if (!source.includes("s.ends_at && new Date(s.ends_at) < new Date()")) {
    throw new Error(`${fn} no longer rejects sessions that have already ended; session status is maintained by hand and does go stale (two past sessions were still 'open' on 2026-08-28).`);
  }
  if (read('supabase/migrations/20260827000044_allow_applications_when_full.sql').includes('ends_at <')) {
    throw new Error('The ended-session check moved into enforce_session_capacity; that also blocks admins back-filling walk-in attendees after a session. Keep it in the Edge Function.');
  }
}
console.log('報名錯誤訊息守門 checks passed.');

// ── 海報輪播：手動維護的清單最容易出的錯 ────────────────────────────
//
// `src/content/posters.ts` 是刻意用手維護的（負責人選了「跟我說一聲、我改檔案重新部署」，
// 不做後台上傳）。這個決定的代價就是：**沒有任何機制保證編號和圖檔對得起來**。
// 打錯一個字不會有任何錯誤訊息，只會在頁面上出現一張破圖。這裡把那個代價補起來。
{
  const src = read('src/content/posters.ts');
  // 逐行解析，不用跨欄位的正則。
  // 第一版用一條橫跨多個欄位的正則，遇到「這一筆沒有 anchor」時會抓到下一筆的 anchor，
  // 把好資料判成壞的——守門自己有 bug 比沒有守門更糟，所以這裡用最笨但不會錯的寫法。
  const items = [];
  for (const raw of src.split(String.fromCharCode(10))) {
    const pair = raw.trim().match(/^(id|kind|service|date|endsAt|anchor): *'([^']*)'/);
    if (!pair) continue;
    const [, name, value] = pair;
    if (name === 'id') {
      items.push({ id: value, kind: null, service: null, date: null, endsAt: null, anchor: null });
    } else if (items.length) {
      items[items.length - 1][name] = value;
    }
  }
  if (items.length < 13) {
    throw new Error(`src/content/posters.ts: parsed only ${items.length} poster entries; the checks below would silently pass on an incomplete list.`);
  }
  for (const item of items) {
    const file = `public/assets/posters/${item.id}.webp`;
    if (!existsSync(resolve(root, file))) {
      throw new Error(`${file} is missing but src/content/posters.ts references id '${item.id}'; the carousel would render a broken image.`);
    }
  }
  // 協辦場次連的是 `/co-host#event-MMDD`，而那個 id 在 CoHostActivities 是從資料庫的
  // 日期算出來的。兩邊是各自獨立的真相，對不起來就是「點了沒反應」。
  for (const item of items) {
    if (item.service !== 'co-host' || item.kind !== 'session') continue;
    if (!item.anchor) {
      throw new Error(`src/content/posters.ts: co-host session '${item.id}' has no anchor; the carousel would link to /co-host with no target.`);
    }
    const expected = `event-${item.date.slice(5, 7)}${item.date.slice(8, 10)}`;
    if (item.anchor !== expected) {
      throw new Error(`src/content/posters.ts: '${item.id}' has anchor '${item.anchor}' but its date ${item.date} yields '${expected}'; CoHostActivities derives the DOM id from the date, so the link would scroll nowhere.`);
    }
  }
  // endsAt 的日期部分必須和 date 一致：兩邊各寫一次，打錯就會讓「結束了沒」整個算錯。
  for (const item of items) {
    if (item.kind !== 'session') continue;
    if (!item.endsAt) {
      throw new Error(`src/content/posters.ts: session '${item.id}' has no endsAt; the carousel would keep saying 前往報名 for hours after the event ends.`);
    }
    if (item.endsAt.slice(0, 10) !== item.date) {
      throw new Error(`src/content/posters.ts: '${item.id}' has date ${item.date} but endsAt ${item.endsAt}; those must describe the same day.`);
    }
  }
  const used = items.map((item) => item.anchor).filter(Boolean);
  const dupes = used.filter((a, i) => used.indexOf(a) !== i);
  if (dupes.length) {
    throw new Error(`src/content/posters.ts: duplicate anchor(s) ${[...new Set(dupes)].join(', ')}; two events on the same Taipei date would produce duplicate DOM ids.`);
  }
}
console.log('海報輪播資料守門 checks passed.');

// ── 「能不能報名」只能有一個判斷來源 ──────────────────────────────
//
// 2026-08-28 的事故：職場諮詢的按鈕寫著「目前時段已滿・仍可送出候補申請」，
// 點進報名頁卻是「目前場次皆已額滿」、連表單都不給。
// 原因是同一個決策被寫了兩次——RegisterCta 看了 allowWaitlist，
// RegisterPage 只寫 `status !== 'open' || remaining === 0`。候補功能上線當天就分岔了。
// 這道守門不是檢查某一行寫法，是守住「只能有一份真相」。
{
  const shared = read('src/lib/seatAvailability.ts');
  if (!shared.includes('enforce_session_capacity')) {
    throw new Error('src/lib/seatAvailability.ts must name the SQL gate it mirrors (enforce_session_capacity); without that pointer the next person changes one side only.');
  }
  for (const file of ['src/routes/RegisterPage.tsx', 'src/components/RegisterCta.tsx']) {
    const source = read(file);
    if (!source.includes('seatAvailability')) {
      throw new Error(`${file} no longer uses seatAvailability(); the CTA and the form must answer "can I register" from one place.`);
    }
    const body = withoutComments(source);
    if (body.includes("status !== 'open'") || body.includes('isSessionBookable')) {
      throw new Error(`${file} re-implements the availability rule inline; use seatAvailability() so the button and the form cannot contradict each other.`);
    }
  }
  // 申請制的規則在 SQL 那邊，這裡確認那支 migration 仍然是這樣寫的。
  const sql = read('supabase/migrations/20260827000044_allow_applications_when_full.sql');
  if (!sql.includes("sess.status not in ('open', 'full')") || !sql.includes('not sess.allow_waitlist')) {
    throw new Error('20260827000044 no longer expresses "open or (full and allow_waitlist)"; src/lib/seatAvailability.ts mirrors it and must be updated together.');
  }
}
console.log('報名可用性單一來源 checks passed.');
