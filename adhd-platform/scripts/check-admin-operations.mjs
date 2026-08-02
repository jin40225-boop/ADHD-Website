import { readFileSync } from 'node:fs';
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
requireText('src/routes/RegisterPage.tsx', ['報名只接受資料庫正式場次']);
if (read('src/routes/RegisterPage.tsx').includes('if (sessions.length === 0)')) throw new Error('Static registration slot fallback still exists.');
for (const slug of ['submit-registration', 'send-email-v2', 'gmail-sync', 'team-invite']) {
  requireText(`supabase/functions/${slug}/index.ts`, ['Deno.serve', 'SUPABASE_SERVICE_ROLE_KEY']);
}
requireText('supabase/functions/gmail-sync/index.ts', ['GMAIL_SCOPE_MISSING', 'gmail.readonly']);
requireText('DEPLOY.md', ['https://www.googleapis.com/auth/gmail.readonly']);
requireText('src/admin/pages/IntegrationsPage.tsx', ['尚未建置 users.watch／Pub/Sub；目前由管理員手動同步']);
console.log('Admin operations structural checks passed.');
