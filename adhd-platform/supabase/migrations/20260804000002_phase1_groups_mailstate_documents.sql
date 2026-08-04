-- ============================================================================
-- 全面重構 Phase 1 主體（2026-08-04）
--
-- 依據：重構建構計畫_2026-08-04.md 第四節（資料模型變更）、第七節（信件狀態機）、
--       第八節（聯絡人類群）。
--
-- 本檔內容：
--   1. 共用：ops admin 判定 helper、sessions 擴充（報名截止、候選時段、名額群組）
--   2. 同儕聚會下半年 5 場（8/9 月開放；10–12 月建立但未上架）
--   3. 導航計畫 9–12 月（**每月 1 位**，5 個候選時段共用當月名額）
--   4. contact_groups / contact_group_members ＋ 自動歸群
--   5. attendance_confirmations（信中「確認出席／請假改期」一次性 token）
--   6. generated_documents（文件生成紀錄）
--   7. email_threads 信件狀態機欄位
--   8. email_templates 8 範本種子（既有列一律不動）
--
-- 個資邊界：本檔不含任何真實個人資料。常用聯絡人（鏡子／Lisa／張正怡）只加旗標
--   欄位，**不在 Git migration 內寫入其信箱**；實際建檔由後台操作或受控私密流程處理。
--
-- 冪等：可重複執行。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. 共用 helper 與 sessions 擴充
-- ---------------------------------------------------------------------------

-- 行政操作者判定：系統擁有者，或任一專案的 owner／admin_collab
create or replace function public.is_ops_admin(uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_system_owner(uid) or exists (
    select 1 from public.project_members pm
    where pm.user_id = uid and pm.role in ('owner', 'admin_collab')
  );
$$;

alter table public.sessions
  add column if not exists registration_deadline timestamptz,
  add column if not exists slot_options jsonb not null default '[]'::jsonb,
  add column if not exists quota_group text,
  add column if not exists admin_note text;

comment on column public.sessions.registration_deadline is
  '報名截止時間。親職＝場次前一週 23:59；導航＝前一個月 20 日 23:59。可由後台手動覆寫。';
comment on column public.sessions.slot_options is
  '候選時段清單（導航計畫用）。每筆 {label, startsAt, endsAt, note}；由規則自動產生，後台可逐一手動調整。';
comment on column public.sessions.quota_group is
  '名額群組鍵。同群組共用一份名額（導航計畫＝每月 1 位）。空值代表名額只算本場次。';

create index if not exists sessions_quota_group_idx on public.sessions (quota_group)
  where quota_group is not null;

-- 既有親職場次（20260804000001 建立）補上報名截止＝場次前一週 23:59（Asia/Taipei）
update public.sessions s
set registration_deadline = (
  (s.starts_at at time zone 'Asia/Taipei')::date - interval '7 days' + interval '23 hours 59 minutes'
) at time zone 'Asia/Taipei'
from public.projects p
where p.id = s.project_id and p.slug = 'parent' and s.registration_deadline is null;

-- ---------------------------------------------------------------------------
-- 2. 同儕聚會下半年 5 場（裁決 3：同 5 日 14:00–16:00）
--    8 月、9 月開放報名；10–12 月建立但未上架（status='closed'）。
--    'closed' 不會出現在 getUpcomingSessions（僅取 open/full），符合「即將開放」語意。
-- ---------------------------------------------------------------------------
insert into public.sessions (project_id, title, starts_at, ends_at, capacity, booked_count, status, registration_deadline, admin_note)
select p.id, v.title, v.starts_at, v.ends_at, 100, 0, v.status, v.deadline, v.note
from public.projects p
cross join (values
  ('【8月場】ADHD 線上互助聚會',  timestamptz '2026-08-16 14:00+08', timestamptz '2026-08-16 16:00+08', 'open',
   timestamptz '2026-08-15 23:59+08', null),
  ('【9月場】ADHD 線上互助聚會',  timestamptz '2026-09-06 14:00+08', timestamptz '2026-09-06 16:00+08', 'open',
   timestamptz '2026-09-05 23:59+08', null),
  ('【10月場】ADHD 線上互助聚會', timestamptz '2026-10-11 14:00+08', timestamptz '2026-10-11 16:00+08', 'closed',
   timestamptz '2026-10-10 23:59+08', '未上架：主題與來賓未定，前台顯示「神秘驚喜！」。確定後改為 open。'),
  ('【11月場】ADHD 線上互助聚會', timestamptz '2026-11-08 14:00+08', timestamptz '2026-11-08 16:00+08', 'closed',
   timestamptz '2026-11-07 23:59+08', '未上架：主題與來賓未定，前台顯示「神秘驚喜！」。確定後改為 open。'),
  ('【12月場】ADHD 線上互助聚會', timestamptz '2026-12-20 14:00+08', timestamptz '2026-12-20 16:00+08', 'closed',
   timestamptz '2026-12-19 23:59+08', '未上架：主題與來賓未定，前台顯示「神秘驚喜！」。確定後改為 open。')
) as v(title, starts_at, ends_at, status, deadline, note)
where p.slug = 'peer-group'
  and not exists (
    select 1 from public.sessions s
    where s.project_id = p.id and s.starts_at = v.starts_at and s.ends_at = v.ends_at
  );

-- ---------------------------------------------------------------------------
-- 3. 導航計畫 9–12 月
--    ⚠ 名額模型：**每月 1 位**，不是每時段 1 位。
--    現行 enforce_session_capacity() 是逐 session 扣名額，因此每月建 1 筆 session
--    （capacity=1）代表該月名額；5 個確切候選時段存於 slot_options，供前台顯示與
--    後台逐一調整。starts_at／ends_at 取該月候選時段的最早起與最晚迄，讓整個月的
--    候選窗口都在 getUpcomingSessions（ends_at >= now）的範圍內。
--    報名截止＝前一個月 20 日 23:59（04_v4）。四個月全部開放。
-- ---------------------------------------------------------------------------
insert into public.sessions (project_id, title, starts_at, ends_at, capacity, booked_count, status, registration_deadline, quota_group, slot_options, admin_note)
select p.id, v.title, v.starts_at, v.ends_at, 1, 0, 'open', v.deadline, v.quota_group, v.slots::jsonb,
       '每月僅 1 位名額，5 個候選時段共用。確切時段由團隊與報名者確認後填回。'
from public.projects p
cross join (values
  ('【9月場】ADHD 導航計畫',  timestamptz '2026-09-12 20:00+08', timestamptz '2026-09-20 10:00+08',
   timestamptz '2026-08-20 23:59+08', 'navigator-2026-09', '[
     {"label":"9/14（一）20:00–21:00","note":"平日晚間","startsAt":"2026-09-14T20:00:00+08:00","endsAt":"2026-09-14T21:00:00+08:00"},
     {"label":"9/12（六）20:00–21:00","note":"週末晚間","startsAt":"2026-09-12T20:00:00+08:00","endsAt":"2026-09-12T21:00:00+08:00"},
     {"label":"9/19（六）20:00–21:00","note":"週末晚間","startsAt":"2026-09-19T20:00:00+08:00","endsAt":"2026-09-19T21:00:00+08:00"},
     {"label":"9/13（日）09:00–10:00","note":"週末早晨","startsAt":"2026-09-13T09:00:00+08:00","endsAt":"2026-09-13T10:00:00+08:00"},
     {"label":"9/20（日）09:00–10:00","note":"週末早晨","startsAt":"2026-09-20T09:00:00+08:00","endsAt":"2026-09-20T10:00:00+08:00"}
   ]'),
  ('【10月場】ADHD 導航計畫', timestamptz '2026-10-10 20:00+08', timestamptz '2026-10-18 10:00+08',
   timestamptz '2026-09-20 23:59+08', 'navigator-2026-10', '[
     {"label":"10/12（一）20:00–21:00","note":"平日晚間","startsAt":"2026-10-12T20:00:00+08:00","endsAt":"2026-10-12T21:00:00+08:00"},
     {"label":"10/10（六）20:00–21:00","note":"週末晚間","startsAt":"2026-10-10T20:00:00+08:00","endsAt":"2026-10-10T21:00:00+08:00"},
     {"label":"10/17（六）20:00–21:00","note":"週末晚間","startsAt":"2026-10-17T20:00:00+08:00","endsAt":"2026-10-17T21:00:00+08:00"},
     {"label":"10/11（日）09:00–10:00","note":"週末早晨","startsAt":"2026-10-11T09:00:00+08:00","endsAt":"2026-10-11T10:00:00+08:00"},
     {"label":"10/18（日）09:00–10:00","note":"週末早晨","startsAt":"2026-10-18T09:00:00+08:00","endsAt":"2026-10-18T10:00:00+08:00"}
   ]'),
  ('【11月場】ADHD 導航計畫', timestamptz '2026-11-08 09:00+08', timestamptz '2026-11-21 21:00+08',
   timestamptz '2026-10-20 23:59+08', 'navigator-2026-11', '[
     {"label":"11/9（一）20:00–21:00","note":"平日晚間","startsAt":"2026-11-09T20:00:00+08:00","endsAt":"2026-11-09T21:00:00+08:00"},
     {"label":"11/14（六）20:00–21:00","note":"週末晚間","startsAt":"2026-11-14T20:00:00+08:00","endsAt":"2026-11-14T21:00:00+08:00"},
     {"label":"11/21（六）20:00–21:00","note":"週末晚間","startsAt":"2026-11-21T20:00:00+08:00","endsAt":"2026-11-21T21:00:00+08:00"},
     {"label":"11/8（日）09:00–10:00","note":"週末早晨","startsAt":"2026-11-08T09:00:00+08:00","endsAt":"2026-11-08T10:00:00+08:00"},
     {"label":"11/15（日）09:00–10:00","note":"週末早晨","startsAt":"2026-11-15T09:00:00+08:00","endsAt":"2026-11-15T10:00:00+08:00"}
   ]'),
  ('【12月場】ADHD 導航計畫', timestamptz '2026-12-12 20:00+08', timestamptz '2026-12-20 10:00+08',
   timestamptz '2026-11-20 23:59+08', 'navigator-2026-12', '[
     {"label":"12/14（一）20:00–21:00","note":"平日晚間","startsAt":"2026-12-14T20:00:00+08:00","endsAt":"2026-12-14T21:00:00+08:00"},
     {"label":"12/12（六）20:00–21:00","note":"週末晚間","startsAt":"2026-12-12T20:00:00+08:00","endsAt":"2026-12-12T21:00:00+08:00"},
     {"label":"12/19（六）20:00–21:00","note":"週末晚間","startsAt":"2026-12-19T20:00:00+08:00","endsAt":"2026-12-19T21:00:00+08:00"},
     {"label":"12/13（日）09:00–10:00","note":"週末早晨","startsAt":"2026-12-13T09:00:00+08:00","endsAt":"2026-12-13T10:00:00+08:00"},
     {"label":"12/20（日）09:00–10:00","note":"週末早晨","startsAt":"2026-12-20T09:00:00+08:00","endsAt":"2026-12-20T10:00:00+08:00"}
   ]')
) as v(title, starts_at, ends_at, deadline, quota_group, slots)
where p.slug = 'navigator'
  and not exists (
    select 1 from public.sessions s
    where s.project_id = p.id and s.quota_group = v.quota_group
  );

-- 導航報名表：加入 20 個確切候選時段的複選欄位（現行表單引擎支援 multiselect）
update public.form_schemas fs
set fields = fs.fields || '[
  {"key":"preferredExactSlots","label":"可配合的確切時段（可跨月複選）","type":"multiselect","required":true,
   "helpText":"每月僅 1 位名額。最終將由團隊與您確認其中一個時段。",
   "options":[
    "9月｜9/12（六）20:00–21:00","9月｜9/13（日）09:00–10:00","9月｜9/14（一）20:00–21:00","9月｜9/19（六）20:00–21:00","9月｜9/20（日）09:00–10:00",
    "10月｜10/10（六）20:00–21:00","10月｜10/11（日）09:00–10:00","10月｜10/12（一）20:00–21:00","10月｜10/17（六）20:00–21:00","10月｜10/18（日）09:00–10:00",
    "11月｜11/8（日）09:00–10:00","11月｜11/9（一）20:00–21:00","11月｜11/14（六）20:00–21:00","11月｜11/15（日）09:00–10:00","11月｜11/21（六）20:00–21:00",
    "12月｜12/12（六）20:00–21:00","12月｜12/13（日）09:00–10:00","12月｜12/14（一）20:00–21:00","12月｜12/19（六）20:00–21:00","12月｜12/20（日）09:00–10:00"
   ]}
]'::jsonb,
    updated_at = now()
from public.projects p
where p.slug = 'navigator' and fs.project_id = p.id
  and not (fs.fields @> '[{"key":"preferredExactSlots"}]'::jsonb);

-- ---------------------------------------------------------------------------
-- 4. 聯絡人類群（計畫第八節）
-- ---------------------------------------------------------------------------
create table if not exists public.contact_groups (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  project_id uuid references public.projects (id) on delete set null,
  auto_rule text check (auto_rule in ('registration', 'instructor', 'manual')),
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
alter table public.contact_groups enable row level security;

create table if not exists public.contact_group_members (
  group_id uuid not null references public.contact_groups (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  source text not null default 'manual' check (source in ('manual', 'auto')),
  added_by uuid references public.profiles (id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (group_id, contact_id)
);
alter table public.contact_group_members enable row level security;
create index if not exists contact_group_members_contact_idx on public.contact_group_members (contact_id);

-- 常用聯絡人旗標（實際人員資料由後台建檔，不在 Git migration 內寫入個資）
alter table public.contacts add column if not exists is_favorite boolean not null default false;
create index if not exists contacts_favorite_idx on public.contacts (is_favorite) where is_favorite;

-- 系統預設類群（不含任何個人資料）
insert into public.contact_groups (key, name, description, project_id, auto_rule, is_system)
select v.key, v.name, v.description,
       (select id from public.projects p where p.slug = v.project_slug),
       v.auto_rule, true
from (values
  ('instructors',           '講師群',             '講師、客座來賓、合作專業人員。', null,          'instructor'),
  ('registrants_parent',    '報名者・親職諮詢',   '親職諮詢報名成功者，報名時自動歸群。', 'parent',      'registration'),
  ('registrants_navigator', '報名者・導航計畫',   '導航計畫報名成功者，報名時自動歸群。', 'navigator',   'registration'),
  ('registrants_peer',      '報名者・同儕聚會',   '同儕聚會報名成功者，報名時自動歸群。', 'peer-group',  'registration'),
  ('admin_collab',          '行政協作',           '行政協作夥伴與內部工作人員。',       null,          'manual')
) as v(key, name, description, project_slug, auto_rule)
where not exists (select 1 from public.contact_groups g where g.key = v.key);

-- 自動歸群：registrations 掛上 contact_id 時，把該聯絡人加進對應專案的報名者類群
create or replace function public.sync_registration_contact_group()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare gid uuid;
begin
  if new.contact_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.contact_id is not distinct from new.contact_id then
    return new;
  end if;
  select g.id into gid from public.contact_groups g
  where g.auto_rule = 'registration' and g.project_id = new.project_id
  limit 1;
  if gid is null then
    return new;
  end if;
  insert into public.contact_group_members (group_id, contact_id, source)
  values (gid, new.contact_id, 'auto')
  on conflict (group_id, contact_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_registration_contact_group on public.registrations;
create trigger trg_registration_contact_group
  after insert or update of contact_id on public.registrations
  for each row execute function public.sync_registration_contact_group();

-- ---------------------------------------------------------------------------
-- 5. 出席確認（信中「✅確認出席／🔁請假改期」按鈕的一次性 token）
-- ---------------------------------------------------------------------------
create table if not exists public.attendance_confirmations (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete set null,
  token text not null unique,
  action text check (action in ('attend', 'reschedule')),
  responded_at timestamptz,
  responded_ip text,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);
alter table public.attendance_confirmations enable row level security;
create index if not exists attendance_confirmations_reg_idx
  on public.attendance_confirmations (registration_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 6. 文件生成紀錄（Phase 6 的 generate-document 會寫入；本階段先備妥結構）
-- ---------------------------------------------------------------------------
create table if not exists public.generated_documents (
  id uuid primary key default gen_random_uuid(),
  doc_type text not null,
  scope text not null default 'single' check (scope in ('single', 'batch', 'aggregate')),
  target_type text,
  target_id text,
  title text not null default '',
  content text not null default '',
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'sent', 'discarded')),
  redacted boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
alter table public.generated_documents enable row level security;
create index if not exists generated_documents_type_idx
  on public.generated_documents (doc_type, created_at desc);
drop trigger if exists trg_generated_documents_touch on public.generated_documents;
create trigger trg_generated_documents_touch before update on public.generated_documents
  for each row execute function public.adhd_touch_updated_at();

drop trigger if exists trg_contact_groups_touch on public.contact_groups;
create trigger trg_contact_groups_touch before update on public.contact_groups
  for each row execute function public.adhd_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 7. 信件狀態機（計畫第七節）：自動判定 ＋ 可手動覆寫
-- ---------------------------------------------------------------------------
alter table public.email_threads
  add column if not exists mail_state text not null default 'not_sent'
    check (mail_state in ('not_sent', 'waiting_reply', 'overdue', 'reminded', 'replied_pending', 'handled', 'attend_confirmed', 'reschedule_requested')),
  add column if not exists mail_state_override text
    check (mail_state_override in ('not_sent', 'waiting_reply', 'overdue', 'reminded', 'replied_pending', 'handled', 'attend_confirmed', 'reschedule_requested')),
  add column if not exists mail_state_override_reason text,
  add column if not exists mail_state_override_by uuid references public.profiles (id) on delete set null,
  add column if not exists mail_state_override_at timestamptz,
  add column if not exists last_outbound_at timestamptz,
  add column if not exists last_inbound_at timestamptz,
  add column if not exists follow_up_due_at timestamptz;

comment on column public.email_threads.mail_state is
  '自動判定的信件狀態。手動覆寫請寫 mail_state_override，前台顯示以覆寫值優先。';
comment on column public.email_threads.follow_up_due_at is
  '催覆期限。超過即視為逾期，由 gmail-sync 依門檻（預設 3 天，可調）計算。';

create index if not exists email_threads_mail_state_idx
  on public.email_threads (coalesce(mail_state_override, mail_state), last_message_at desc);

-- ---------------------------------------------------------------------------
-- 8. email_templates 8 範本種子
--    既有列一律不動；以 name 為準，不存在才 INSERT。
--    信件全文以審閱指南 v3 與「信件與文件範例」為準；其餘為草稿，需經使用者審閱。
-- ---------------------------------------------------------------------------
insert into public.email_templates (project_id, name, subject, body)
select null, v.name, v.subject, v.body
from (values
  ('確認信',
   '【ADHD {計畫名}】報名確認通知',
   '{稱呼} 您好：

我們已收到您的報名，感謝您的信任。

目前狀態：已收件，進入評估安排階段。我們會在確認時段後，另外寄出「確認邀約成功通知信」給您——收到那封信才算正式完成預約。

若您的狀況有變動，或需要補充說明，歡迎直接回覆本信。

有任何問題，歡迎來信 jin40225@gmail.com。

大A彥宇 敬上'),

  ('出席確認信（催覆）',
   '【ADHD {計畫名}】請於 {期限} 前確認出席',
   '{稱呼} 您好：

先前寄出的邀約通知尚未收到您的回覆，想再次跟您確認。

預約時段：{日期時間}

為了讓名額能妥善運用，請您於 {期限} 前回覆確認。若逾期未回覆，我們會先將名額釋出給其他等待中的家庭，您隨時可以重新報名之後的場次。

{確認出席按鈕}　{請假改期按鈕}

有任何問題，歡迎來信 jin40225@gmail.com。

大A彥宇 敬上'),

  ('聯繫信',
   '【ADHD {計畫名}】想跟您確認幾件事',
   '{稱呼} 您好：

關於您的報名，有幾個地方想再跟您確認：

{聯繫事項}

方便的話請直接回覆本信，或依您在表單中填寫的偏好聯繫方式與時間，我們再與您聯絡。

有任何問題，歡迎來信 jin40225@gmail.com。

大A彥宇 敬上'),

  ('回絕信（修訂版）',
   '【ADHD 導航計畫】報名結果通知',
   '{稱呼} 您好：

感謝您報名 ADHD 導航計畫公益諮詢，也謝謝您願意與我們分享目前的狀況。

經過本次評估，很抱歉這次未能為您安排諮詢（{原因：本月名額已滿／本次服務形式暫時無法妥善回應您的需求}），不會佔用您的等待。

您隨時可以重新報名之後月份的場次；有任何問題，歡迎來信 jin40225@gmail.com。

再次感謝您的信任，祝平安順心。

大A彥宇、諮商心理師 鏡子 敬上'),

  ('講師行前通知信',
   '【ADHD {計畫名}】{日期} 場次行前資訊',
   '{稱呼} 您好：

提醒您，您協助的場次將於 {日期時間} 進行。

視訊連結：{Meet連結}
本場團隊：{本場團隊成員}

本場對象背景摘要（已去識別化）：
{去識別化摘要}

如需調整或有任何準備上的需要，請隨時與我聯繫。

感謝您的協助！

大A彥宇 敬上'),

  ('家長行前信',
   '【ADHD 親職諮詢】行前通知信',
   '{稱呼} 您好：

提醒您，您預約的親職諮詢將於 {日期時間} 進行。
視訊連結：{Meet連結}

本次陪伴您的團隊：{本場團隊成員}
我們已先了解您在表單中分享的狀況（{議題摘要}），會以此為起點，聚焦「可立即開始嘗試的方向」。

小提醒：
・請於安靜、具隱私的空間上線，網路請先測試。
・可不開鏡頭，用您自在的方式參與即可。
・孩子不需在場，除非您希望孩子一起參與（若您報名時填寫了同行對象，屆時一起上線即可）。
・單次諮詢以釐清與建議為主，若議題需要持續協助，我們會與您討論合適的後續方向。
・若臨時無法出席，請提前來信告知，我們可為您協調改期。

期待與您見面！

大A彥宇 敬上'),

  ('月度宣傳信',
   '【大A彥宇】{月份} 場次開放報名',
   '{稱呼} 您好：

{月份} 的公益服務場次已開放報名：

{場次清單}

名額有限，歡迎依需求選擇合適的服務報名。若這次時間無法配合，之後每個月都會有新的場次。

報名與詳細說明：{報名連結}
有任何問題，歡迎來信 jin40225@gmail.com。

大A彥宇 敬上'),

  ('客座邀請信',
   '【邀請】ADHD 線上互助聚會 {月份} 場次客座分享',
   '{稱呼} 您好：

我是大A彥宇，長期經營 ADHD 成人與家長的支持社群。

我們每月舉辦一次線上互助聚會，想邀請您擔任 {月份} 場次的客座來賓，與參與者分享 {主題方向}。

場次資訊：
・時間：{日期時間}
・形式：Google Meet 線上進行，約 2 小時
・參與者：成人 ADHD 當事人與家長

若您有意願，或想先了解更多，歡迎直接回覆本信討論。

期待有機會合作！

大A彥宇 敬上')
) as v(name, subject, body)
where not exists (select 1 from public.email_templates t where t.name = v.name);

-- ---------------------------------------------------------------------------
-- 9. RLS：新表一律行政人員限定（anon 無任何權限）
-- ---------------------------------------------------------------------------
drop policy if exists contact_groups_admin on public.contact_groups;
create policy contact_groups_admin on public.contact_groups for all to authenticated
  using (public.is_ops_admin((select auth.uid())))
  with check (public.is_ops_admin((select auth.uid())));

drop policy if exists contact_group_members_admin on public.contact_group_members;
create policy contact_group_members_admin on public.contact_group_members for all to authenticated
  using (public.is_ops_admin((select auth.uid())))
  with check (public.is_ops_admin((select auth.uid())));

drop policy if exists attendance_confirmations_admin on public.attendance_confirmations;
create policy attendance_confirmations_admin on public.attendance_confirmations for all to authenticated
  using (public.is_ops_admin((select auth.uid())))
  with check (public.is_ops_admin((select auth.uid())));

drop policy if exists generated_documents_admin on public.generated_documents;
create policy generated_documents_admin on public.generated_documents for all to authenticated
  using (public.is_ops_admin((select auth.uid())))
  with check (public.is_ops_admin((select auth.uid())));

revoke all on public.contact_groups from anon;
revoke all on public.contact_group_members from anon;
revoke all on public.attendance_confirmations from anon;
revoke all on public.generated_documents from anon;

-- sessions_public 不含新欄位以外的敏感資訊；重建 view 以帶出報名截止與候選時段，
-- meet_url／calendar_event_id 仍不外流。
create or replace view public.sessions_public
with (security_barrier) as
  select s.id, s.project_id, s.title, s.starts_at, s.ends_at,
         s.capacity, s.booked_count, s.status,
         s.registration_deadline, s.slot_options, s.quota_group
  from public.sessions s
  where exists (
    select 1 from public.projects p
    where p.id = s.project_id and p.is_public
  );
grant select on public.sessions_public to anon, authenticated;
