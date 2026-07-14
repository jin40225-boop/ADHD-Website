-- ============================================================================
-- ADHD 專管系統 K1：核心 schema＋雙層權限 RLS
-- 對映 contracts/types.ts v1.1 與《系統建置計畫書.md》第五節資料模型。
-- 【CLAUDE 專屬】2026-07-12
--
-- 權限模型：
--   第一層＝project_members 有無該筆（帳號能看到哪些專案）
--   第二層＝role（owner / admin_collab / instructor_full / instructor_slot）
--            ＋ permissions jsonb 覆寫（cases 可見性等細粒度旗標）
--   系統擁有者 profiles.is_system_owner＝跨專案最高權限。
--   公開端（anon）：可讀公開專案/場次/表單定義/推薦資料庫；可投遞報名與投稿；
--   絕無任何個資讀取權。
-- ============================================================================

-- 函式內容於執行期驗證（helper 函式先於資料表定義；表建立後即有效）
set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- 0. 共用函式
-- ---------------------------------------------------------------------------

-- 是否為系統擁有者（security definer 避免 RLS 遞迴）
create or replace function public.is_system_owner(uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select p.is_system_owner from profiles p where p.id = uid), false);
$$;

-- 取得某人於某專案的角色（無成員資格回 null）
create or replace function public.project_role(pid uuid, uid uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select pm.role from project_members pm
  where pm.project_id = pid and pm.user_id = uid
  limit 1;
$$;

-- 是否為專案成員（任一角色）
create or replace function public.is_project_member(pid uuid, uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from project_members pm
    where pm.project_id = pid and pm.user_id = uid);
$$;

-- 個案可見性：owner 恆可；admin_collab 依 permissions.cases（預設 true）；講師不可
create or replace function public.member_can_view_cases(pid uuid, uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select case
    when public.is_system_owner(uid) then true
    else coalesce((
      select case pm.role
        when 'owner' then true
        when 'admin_collab' then coalesce((pm.permissions->>'cases')::boolean, true)
        else false
      end
      from project_members pm
      where pm.project_id = pid and pm.user_id = uid
    ), false)
  end;
$$;

-- updated_at 自動戳記（前綴 adhd_ 避免與同專案內其他系統的同名函式衝突）
create or replace function public.adhd_touch_updated_at()
returns trigger language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. profiles（登入帳號；由 auth.users 觸發器自動建立）
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null,
  avatar_url text,
  is_system_owner boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- 後台各處需要顯示成員名稱 → 已登入者可讀全部 profiles
create policy profiles_select on public.profiles
  for select to authenticated using (true);
-- 僅本人或系統擁有者可更新
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_system_owner(auth.uid()))
  with check (id = auth.uid() or public.is_system_owner(auth.uid()));

-- 新使用者註冊 → 自動建 profile。
-- 系統擁有者 bootstrap：jin40225@gmail.com 首次登入即為 is_system_owner。
create or replace function public.adhd_handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url, is_system_owner)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(coalesce(new.email, '使用者'), '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    lower(coalesce(new.email, '')) = 'jin40225@gmail.com')
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created_adhd
  after insert on auth.users
  for each row execute function public.adhd_handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. projects／project_members（專案與雙層權限）
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('course', 'appointment')),
  slug text not null unique,
  description text,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.projects enable row level security;

-- 公開專案任何人可讀（前台報名頁需要）；非公開限成員
create policy projects_select on public.projects
  for select to anon, authenticated
  using (
    is_public
    or public.is_project_member(id, auth.uid())
    or public.is_system_owner(auth.uid()));
create policy projects_write on public.projects
  for all to authenticated
  using (public.is_system_owner(auth.uid()))
  with check (public.is_system_owner(auth.uid()));

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'admin_collab', 'instructor_full', 'instructor_slot')),
  permissions jsonb,
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);
alter table public.project_members enable row level security;
create index idx_project_members_user on public.project_members (user_id);

create policy project_members_select on public.project_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_system_owner(auth.uid())
    or public.project_role(project_id, auth.uid()) = 'owner');
create policy project_members_write on public.project_members
  for all to authenticated
  using (
    public.is_system_owner(auth.uid())
    or public.project_role(project_id, auth.uid()) = 'owner')
  with check (
    public.is_system_owner(auth.uid())
    or public.project_role(project_id, auth.uid()) = 'owner');

-- ---------------------------------------------------------------------------
-- 3. status_flows／form_schemas（各專案自訂狀態流與報名欄位）
-- ---------------------------------------------------------------------------
create table public.status_flows (
  project_id uuid primary key references public.projects (id) on delete cascade,
  nodes jsonb not null,
  transitions jsonb
);
alter table public.status_flows enable row level security;
create policy status_flows_select on public.status_flows
  for select to authenticated
  using (
    public.is_project_member(project_id, auth.uid())
    or public.is_system_owner(auth.uid()));
create policy status_flows_write on public.status_flows
  for all to authenticated
  using (
    public.is_system_owner(auth.uid())
    or public.project_role(project_id, auth.uid()) in ('owner', 'admin_collab'))
  with check (
    public.is_system_owner(auth.uid())
    or public.project_role(project_id, auth.uid()) in ('owner', 'admin_collab'));

create table public.form_schemas (
  project_id uuid primary key references public.projects (id) on delete cascade,
  fields jsonb not null,
  updated_at timestamptz
);
alter table public.form_schemas enable row level security;
create trigger trg_form_schemas_touch before update on public.form_schemas
  for each row execute function public.adhd_touch_updated_at();

-- 前台報名頁需要讀公開專案的表單定義
create policy form_schemas_select on public.form_schemas
  for select to anon, authenticated
  using (
    exists (select 1 from public.projects p where p.id = project_id and p.is_public)
    or public.is_project_member(project_id, auth.uid())
    or public.is_system_owner(auth.uid()));
create policy form_schemas_write on public.form_schemas
  for all to authenticated
  using (
    public.is_system_owner(auth.uid())
    or public.project_role(project_id, auth.uid()) in ('owner', 'admin_collab'))
  with check (
    public.is_system_owner(auth.uid())
    or public.project_role(project_id, auth.uid()) in ('owner', 'admin_collab'));

-- ---------------------------------------------------------------------------
-- 4. sessions（場次；額滿由觸發器自動控管）
-- ---------------------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null default 1 check (capacity >= 0),
  booked_count integer not null default 0 check (booked_count >= 0),
  status text not null default 'open'
    check (status in ('open', 'full', 'closed', 'done', 'cancelled')),
  meet_url text,
  instructor_ids uuid[] not null default '{}',
  calendar_event_id text,
  created_at timestamptz not null default now()
);
alter table public.sessions enable row level security;
create index idx_sessions_project on public.sessions (project_id);

-- 公開專案場次任何人可讀（前台顯示可報名時段/額滿）
create policy sessions_select on public.sessions
  for select to anon, authenticated
  using (
    exists (select 1 from public.projects p where p.id = project_id and p.is_public)
    or public.is_project_member(project_id, auth.uid())
    or public.is_system_owner(auth.uid()));
-- owner/admin_collab 全權；講師可更新自己的場次（如 Meet 連結確認）
create policy sessions_admin_write on public.sessions
  for all to authenticated
  using (
    public.is_system_owner(auth.uid())
    or public.project_role(project_id, auth.uid()) in ('owner', 'admin_collab'))
  with check (
    public.is_system_owner(auth.uid())
    or public.project_role(project_id, auth.uid()) in ('owner', 'admin_collab'));
create policy sessions_instructor_update on public.sessions
  for update to authenticated
  using (auth.uid() = any (instructor_ids))
  with check (auth.uid() = any (instructor_ids));

-- ---------------------------------------------------------------------------
-- 5. registrations（報名；個資，anon 只能 insert 絕不能 select）
-- ---------------------------------------------------------------------------
create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  session_ids uuid[] not null default '{}',
  answers jsonb not null default '{}',
  status text not null default 'pending',
  email text not null,
  thread_id uuid,
  has_unread_reply boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
alter table public.registrations enable row level security;
create index idx_registrations_project on public.registrations (project_id);
create index idx_registrations_email on public.registrations (lower(email));
create trigger trg_registrations_touch before update on public.registrations
  for each row execute function public.adhd_touch_updated_at();

-- 額滿控管：報名寫入時原子遞增 booked_count；滿了自動把場次轉 full；
-- 已滿/未開放則整筆報名失敗。security definer 讓 anon 報名也能觸發。
create or replace function public.enforce_session_capacity()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  sid uuid;
begin
  if new.session_ids is null or array_length(new.session_ids, 1) is null then
    return new;
  end if;
  foreach sid in array new.session_ids loop
    update public.sessions
      set booked_count = booked_count + 1,
          status = case
            when booked_count + 1 >= capacity then 'full'
            else status
          end
      where id = sid and status = 'open' and booked_count < capacity;
    if not found then
      raise exception 'SESSION_FULL_OR_CLOSED:%', sid using errcode = 'P0001';
    end if;
  end loop;
  return new;
end;
$$;
create trigger trg_registration_capacity
  before insert on public.registrations
  for each row execute function public.enforce_session_capacity();

-- 公開報名：anon 僅能對公開專案 insert，狀態強制 pending
create policy registrations_public_insert on public.registrations
  for insert to anon, authenticated
  with check (
    status = 'pending'
    and exists (select 1 from public.projects p where p.id = project_id and p.is_public));
-- 讀取：owner/admin_collab 全部；instructor_full 僅與自己場次相關的報名
create policy registrations_select on public.registrations
  for select to authenticated
  using (
    public.is_system_owner(auth.uid())
    or public.project_role(project_id, auth.uid()) in ('owner', 'admin_collab')
    or (
      public.project_role(project_id, auth.uid()) = 'instructor_full'
      and exists (
        select 1 from public.sessions s
        where s.project_id = registrations.project_id
          and s.id = any (registrations.session_ids)
          and auth.uid() = any (s.instructor_ids))));
-- 狀態變更等更新：owner/admin_collab
create policy registrations_update on public.registrations
  for update to authenticated
  using (
    public.is_system_owner(auth.uid())
    or public.project_role(project_id, auth.uid()) in ('owner', 'admin_collab'))
  with check (
    public.is_system_owner(auth.uid())
    or public.project_role(project_id, auth.uid()) in ('owner', 'admin_collab'));
create policy registrations_delete on public.registrations
  for delete to authenticated
  using (
    public.is_system_owner(auth.uid())
    or public.project_role(project_id, auth.uid()) = 'owner');

-- ---------------------------------------------------------------------------
-- 6. email_threads／email_messages／email_templates（Gmail 整合）
-- ---------------------------------------------------------------------------
create table public.email_threads (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id) on delete cascade,
  gmail_thread_id text,
  subject text not null default '',
  counterpart_email text not null,
  has_unread boolean not null default false,
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.email_threads enable row level security;
create index idx_email_threads_registration on public.email_threads (registration_id);

create table public.email_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.email_threads (id) on delete cascade,
  direction text not null check (direction in ('outbound', 'inbound')),
  from_email text not null,
  to_email text not null,
  subject text not null default '',
  body text not null default '',
  gmail_message_id text,
  is_read boolean not null default false,
  sent_at timestamptz not null default now()
);
alter table public.email_messages enable row level security;
create index idx_email_messages_thread on public.email_messages (thread_id);

-- 信件可見性跟隨其報名的專案（owner/admin_collab）
create or replace function public.can_access_thread(tid uuid, uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from email_threads t
    join registrations r on r.id = t.registration_id
    where t.id = tid
      and (
        public.is_system_owner(uid)
        or public.project_role(r.project_id, uid) in ('owner', 'admin_collab')));
$$;

create policy email_threads_select on public.email_threads
  for select to authenticated
  using (public.can_access_thread(id, auth.uid()));
create policy email_threads_write on public.email_threads
  for all to authenticated
  using (public.can_access_thread(id, auth.uid()))
  with check (true);
create policy email_messages_select on public.email_messages
  for select to authenticated
  using (public.can_access_thread(thread_id, auth.uid()));
create policy email_messages_write on public.email_messages
  for all to authenticated
  using (public.can_access_thread(thread_id, auth.uid()))
  with check (public.can_access_thread(thread_id, auth.uid()));

create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete cascade,
  name text not null,
  subject text not null default '',
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
alter table public.email_templates enable row level security;
create trigger trg_email_templates_touch before update on public.email_templates
  for each row execute function public.adhd_touch_updated_at();

-- 範本：已登入者可讀（全域＋所屬專案）；寫入限 owner/admin_collab（全域限系統擁有者）
create policy email_templates_select on public.email_templates
  for select to authenticated
  using (
    project_id is null
    or public.is_project_member(project_id, auth.uid())
    or public.is_system_owner(auth.uid()));
create policy email_templates_write on public.email_templates
  for all to authenticated
  using (
    public.is_system_owner(auth.uid())
    or (project_id is not null
        and public.project_role(project_id, auth.uid()) in ('owner', 'admin_collab')))
  with check (
    public.is_system_owner(auth.uid())
    or (project_id is not null
        and public.project_role(project_id, auth.uid()) in ('owner', 'admin_collab')));

-- ---------------------------------------------------------------------------
-- 7. availability_polls／availability_replies（講師時段邀約）
-- ---------------------------------------------------------------------------
create table public.availability_polls (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  candidate_slots jsonb not null default '[]',
  instructor_ids uuid[] not null default '{}',
  status text not null default 'open' check (status in ('open', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);
alter table public.availability_polls enable row level security;
create index idx_availability_polls_project on public.availability_polls (project_id);

create policy availability_polls_select on public.availability_polls
  for select to authenticated
  using (
    public.is_project_member(project_id, auth.uid())
    or public.is_system_owner(auth.uid()));
create policy availability_polls_write on public.availability_polls
  for all to authenticated
  using (
    public.is_system_owner(auth.uid())
    or public.project_role(project_id, auth.uid()) in ('owner', 'admin_collab'))
  with check (
    public.is_system_owner(auth.uid())
    or public.project_role(project_id, auth.uid()) in ('owner', 'admin_collab'));

create table public.availability_replies (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.availability_polls (id) on delete cascade,
  slot_id text not null,
  instructor_id uuid not null references public.profiles (id) on delete cascade,
  answer text not null check (answer in ('yes', 'no', 'pending')),
  replied_at timestamptz not null default now(),
  unique (poll_id, slot_id, instructor_id)
);
alter table public.availability_replies enable row level security;

create policy availability_replies_select on public.availability_replies
  for select to authenticated
  using (
    exists (
      select 1 from public.availability_polls ap
      where ap.id = poll_id
        and (public.is_project_member(ap.project_id, auth.uid())
             or public.is_system_owner(auth.uid()))));
-- 講師只能寫自己的回覆；owner/admin_collab 可代填
create policy availability_replies_write on public.availability_replies
  for all to authenticated
  using (
    instructor_id = auth.uid()
    or public.is_system_owner(auth.uid())
    or exists (
      select 1 from public.availability_polls ap
      where ap.id = poll_id
        and public.project_role(ap.project_id, auth.uid()) in ('owner', 'admin_collab')))
  with check (
    instructor_id = auth.uid()
    or public.is_system_owner(auth.uid())
    or exists (
      select 1 from public.availability_polls ap
      where ap.id = poll_id
        and public.project_role(ap.project_id, auth.uid()) in ('owner', 'admin_collab')));

-- ---------------------------------------------------------------------------
-- 8. cases／service_records（個案管理；最嚴格）
-- ---------------------------------------------------------------------------
create table public.cases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  registration_id uuid references public.registrations (id) on delete set null,
  display_name text not null,
  service_type text not null check (service_type in ('single', 'ongoing')),
  status text not null default 'active' check (status in ('active', 'paused', 'closed')),
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
alter table public.cases enable row level security;
create index idx_cases_project on public.cases (project_id);
create trigger trg_cases_touch before update on public.cases
  for each row execute function public.adhd_touch_updated_at();

create policy cases_all on public.cases
  for all to authenticated
  using (public.member_can_view_cases(project_id, auth.uid()))
  with check (public.member_can_view_cases(project_id, auth.uid()));

create table public.service_records (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  kind text not null check (kind in ('service', 'contact', 'note')),
  occurred_at timestamptz not null,
  title text not null,
  content text not null default '',
  author_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.service_records enable row level security;
create index idx_service_records_case on public.service_records (case_id);

create policy service_records_all on public.service_records
  for all to authenticated
  using (
    exists (
      select 1 from public.cases c
      where c.id = case_id
        and public.member_can_view_cases(c.project_id, auth.uid())))
  with check (
    exists (
      select 1 from public.cases c
      where c.id = case_id
        and public.member_can_view_cases(c.project_id, auth.uid())));

-- ---------------------------------------------------------------------------
-- 9. recommendations／recommendation_submissions（就醫推薦資料庫）
-- ---------------------------------------------------------------------------
-- id 沿用種子語意化編號（rec-001…），故用 text 主鍵
create table public.recommendations (
  id text primary key,
  category text not null check (category in ('doctor', 'assessment', 'therapy', 'community', 'other')),
  audience text not null check (audience in ('child', 'adult', 'all')),
  region text not null check (region in (
    '台北市','新北市','基隆市','桃園市','新竹縣市','苗栗縣市',
    '臺中市','彰化縣市','南投縣','雲林縣','嘉義縣市','臺南市',
    '高雄市','屏東縣','宜蘭縣','花蓮縣','臺東縣','澎湖金馬','線上/其他')),
  hospital text not null default '',
  doctor_or_name text not null default '',
  urls text[] not null default '{}',
  experience text not null default '',
  recommender text,
  verified boolean not null default false,
  verified_note text,
  updated_at date
);
alter table public.recommendations enable row level security;

-- 公開資料庫：任何人可讀（verified 為前台徽章，非讀取門檻——與現行 135 筆行為一致）
create policy recommendations_select on public.recommendations
  for select to anon, authenticated using (true);
-- 上架/更新：系統擁有者（審核台核實後寫入）
create policy recommendations_write on public.recommendations
  for all to authenticated
  using (public.is_system_owner(auth.uid()))
  with check (public.is_system_owner(auth.uid()));

create table public.recommendation_submissions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('doctor', 'assessment', 'therapy', 'doctor_update', 'feature', 'correction', 'other')),
  answers jsonb not null default '{}',
  nickname text,
  email text,
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'published', 'rejected')),
  related_recommendation_id text references public.recommendations (id) on delete set null,
  review_note text,
  created_at timestamptz not null default now()
);
alter table public.recommendation_submissions enable row level security;

-- 公開投稿：anon 可 insert（狀態強制 pending），不可讀
create policy recommendation_submissions_insert on public.recommendation_submissions
  for insert to anon, authenticated
  with check (status = 'pending');
-- 審核：系統擁有者
create policy recommendation_submissions_admin on public.recommendation_submissions
  for select to authenticated using (public.is_system_owner(auth.uid()));
create policy recommendation_submissions_update on public.recommendation_submissions
  for update to authenticated
  using (public.is_system_owner(auth.uid()))
  with check (public.is_system_owner(auth.uid()));
create policy recommendation_submissions_delete on public.recommendation_submissions
  for delete to authenticated using (public.is_system_owner(auth.uid()));

-- ---------------------------------------------------------------------------
-- 10. audit_log（稽核；敏感動作與 Google 整合失敗）
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  actor_id uuid references public.profiles (id) on delete set null,
  target_type text,
  target_id text,
  result text not null check (result in ('success', 'error')),
  detail text,
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create index idx_audit_log_created on public.audit_log (created_at desc);

create policy audit_log_insert on public.audit_log
  for insert to authenticated with check (true);
create policy audit_log_select on public.audit_log
  for select to authenticated using (public.is_system_owner(auth.uid()));
