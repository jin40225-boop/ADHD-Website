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
  'reminderSentAt:', 'counselorConfirmed:', 'finalSlotAt:', 'row.setStatus(',
]);
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
