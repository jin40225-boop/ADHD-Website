import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
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
requireText('src/admin/pages/SessionsPage.tsx', ['<SessionTable', 'topic:', 'guest:', '神秘驚喜']);
requireText('src/lib/api.ts', ['topic: session.topic', 'guest: session.guest', 'registration_deadline: session.registrationDeadline', 'slot_options: session.slotOptions']);
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
// 催覆信的回覆期限要跟著設定走。寫死的天數與設定不符時畫面上看不出來——信寄出去才知道。
requireText('src/admin/pages/RegistrationsOperationsPage.tsx', ['loadTemplate(', 'attachConfirmButtons', 'isFollowUp', 'followUpDays']);
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
const STALE_SCHEDULE = ['上半年度開放場次', '【四月場次】', '【五月場次】', '【六月場次】', '截止日：'];
for (const page of readdirSync(resolve(root, 'src/pages/public'))) {
  if (!page.endsWith('.tsx')) continue;
  const source = read(`src/pages/public/${page}`);
  const found = STALE_SCHEDULE.filter((needle) => source.includes(needle));
  if (found.length) {
    throw new Error(`src/pages/public/${page} hard-codes a session schedule (${found.join(', ')}); read sessions_public instead.`);
  }
}
console.log('Admin operations structural checks passed.');
