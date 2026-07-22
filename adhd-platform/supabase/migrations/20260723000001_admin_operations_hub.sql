-- 行政作業中心：人員主檔、活動、註記版本、追蹤任務、完整信件欄位與個案流程。
-- 所有新增資料表皆啟用 RLS；跨場次移轉與狀態釋放名額由短交易 RPC 原子處理。

-- ---------------------------------------------------------------------------
-- 1. 人員主檔與報名行政欄位
-- ---------------------------------------------------------------------------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  display_name text not null,
  primary_email text,
  phone text,
  status text not null default 'active' check (status in ('active', 'inactive', 'do_not_contact', 'archived')),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  archived_at timestamptz
);
alter table public.contacts enable row level security;
create unique index contacts_primary_email_uidx
  on public.contacts (lower(primary_email)) where primary_email is not null and primary_email <> '';
create index contacts_status_created_idx on public.contacts (status, created_at desc);
create trigger trg_contacts_touch before update on public.contacts
  for each row execute function public.adhd_touch_updated_at();

alter table public.registrations
  add column contact_id uuid references public.contacts (id) on delete set null,
  add column assigned_to uuid references public.profiles (id) on delete set null,
  add column priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  add column next_action_at timestamptz,
  add column capacity_released_at timestamptz,
  add column archived_at timestamptz;
create table public.registration_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0
);
alter table public.registration_rate_limits enable row level security;
create or replace function public.consume_registration_rate_limit(p_bucket_key text, p_limit integer default 5)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare current_count integer;
begin
  insert into public.registration_rate_limits(bucket_key, window_started_at, attempt_count)
  values (p_bucket_key, now(), 1)
  on conflict (bucket_key) do update set
    window_started_at = case when registration_rate_limits.window_started_at < now() - interval '1 hour' then now() else registration_rate_limits.window_started_at end,
    attempt_count = case when registration_rate_limits.window_started_at < now() - interval '1 hour' then 1 else registration_rate_limits.attempt_count + 1 end
  returning attempt_count into current_count;
  return current_count <= greatest(1, p_limit);
end;
$$;
revoke all on function public.consume_registration_rate_limit(text, integer) from public, anon, authenticated;
grant execute on function public.consume_registration_rate_limit(text, integer) to service_role;

create index registrations_contact_idx on public.registrations (contact_id);
create index registrations_assigned_next_idx on public.registrations (assigned_to, next_action_at)
  where archived_at is null;

insert into public.contacts (display_name, primary_email, phone)
select
  coalesce(
    nullif(max(r.answers ->> 'name'), ''),
    nullif(max(r.answers ->> 'nickname'), ''),
    nullif(max(r.answers ->> '姓名'), ''),
    split_part(lower(trim(r.email)), '@', 1)
  ),
  lower(trim(r.email)),
  nullif(max(coalesce(r.answers ->> 'phone', r.answers ->> '聯繫電話')), '')
from public.registrations r
where trim(r.email) <> ''
group by lower(trim(r.email))
on conflict do nothing;

update public.registrations r
set contact_id = c.id
from public.contacts c
where r.contact_id is null and lower(trim(r.email)) = lower(c.primary_email);

create or replace function public.ensure_registration_contact()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  cid uuid;
  cname text;
begin
  if new.contact_id is not null then return new; end if;
  select id into cid from public.contacts
  where lower(primary_email) = lower(trim(new.email)) limit 1;
  if cid is null then
    cname := coalesce(
      nullif(new.answers ->> 'name', ''),
      nullif(new.answers ->> 'nickname', ''),
      nullif(new.answers ->> '姓名', ''),
      split_part(lower(trim(new.email)), '@', 1)
    );
    insert into public.contacts (display_name, primary_email, phone)
    values (cname, lower(trim(new.email)), nullif(coalesce(new.answers ->> 'phone', new.answers ->> '聯繫電話'), ''))
    on conflict do nothing;
    select id into cid from public.contacts
    where lower(primary_email) = lower(trim(new.email)) limit 1;
  end if;
  new.contact_id := cid;
  return new;
end;
$$;
create trigger trg_registration_contact
  before insert on public.registrations
  for each row execute function public.ensure_registration_contact();

with instructors as (
  select distinct p.id, p.email, p.display_name
  from public.profiles p join public.project_members pm on pm.user_id = p.id
  where pm.role in ('instructor_full', 'instructor_slot')
)
update public.contacts c set profile_id = i.id,
  tags = case when '講師' = any(c.tags) then c.tags else array_append(c.tags, '講師') end
from instructors i where lower(c.primary_email) = lower(i.email) and c.profile_id is null;
with instructors as (
  select distinct p.id, p.email, p.display_name
  from public.profiles p join public.project_members pm on pm.user_id = p.id
  where pm.role in ('instructor_full', 'instructor_slot')
)
insert into public.contacts(profile_id, display_name, primary_email, tags)
select i.id, coalesce(nullif(i.display_name, ''), split_part(i.email, '@', 1)), lower(i.email), array['講師']
from instructors i where not exists (select 1 from public.contacts c where c.profile_id = i.id or lower(c.primary_email) = lower(i.email));

create or replace function public.can_access_contact(cid uuid, uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_system_owner(uid) or exists (
    select 1 from public.registrations r
    where r.contact_id = cid
      and public.project_role(r.project_id, uid) in ('owner', 'admin_collab', 'instructor_full')
  ) or exists (
    select 1 from public.contacts c join public.project_members pm on pm.user_id = c.profile_id
    where c.id = cid and public.project_role(pm.project_id, uid) in ('owner', 'admin_collab')
  );
$$;

create policy contacts_select on public.contacts for select to authenticated
  using (public.can_access_contact(id, (select auth.uid())));
create policy contacts_write on public.contacts for all to authenticated
  using (
    public.is_system_owner((select auth.uid())) or exists (
      select 1 from public.registrations r
      where r.contact_id = id
        and public.project_role(r.project_id, (select auth.uid())) in ('owner', 'admin_collab')
    )
  )
  with check (public.is_system_owner((select auth.uid())) or public.can_access_contact(id, (select auth.uid())));

-- ---------------------------------------------------------------------------
-- 2. 活動層：project（服務）→ activity（梯次/活動）→ session（實際時段）
-- ---------------------------------------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'closed', 'completed', 'cancelled')),
  public_summary text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  archived_at timestamptz
);
alter table public.activities enable row level security;
create index activities_project_status_idx on public.activities (project_id, status, starts_at);
create trigger trg_activities_touch before update on public.activities
  for each row execute function public.adhd_touch_updated_at();
create policy activities_select on public.activities for select to authenticated
  using (public.is_project_member(project_id, (select auth.uid())) or public.is_system_owner((select auth.uid())));
create policy activities_write on public.activities for all to authenticated
  using (public.is_system_owner((select auth.uid())) or public.project_role(project_id, (select auth.uid())) in ('owner', 'admin_collab'))
  with check (public.is_system_owner((select auth.uid())) or public.project_role(project_id, (select auth.uid())) in ('owner', 'admin_collab'));

alter table public.sessions add column activity_id uuid references public.activities (id) on delete set null;
create index sessions_activity_idx on public.sessions (activity_id);

-- ---------------------------------------------------------------------------
-- 3. 內部註記（可編輯但保留版本）與追蹤任務
-- ---------------------------------------------------------------------------
create table public.internal_notes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts (id) on delete cascade,
  registration_id uuid references public.registrations (id) on delete cascade,
  case_id uuid references public.cases (id) on delete cascade,
  note_type text not null default 'general' check (note_type in ('general', 'contact', 'eligibility', 'handoff', 'risk')),
  content text not null,
  author_id uuid references public.profiles (id) on delete set null default auth.uid(),
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  archived_at timestamptz,
  constraint internal_notes_one_target check (num_nonnulls(contact_id, registration_id, case_id) = 1)
);
alter table public.internal_notes enable row level security;
create index internal_notes_contact_idx on public.internal_notes (contact_id, created_at desc);
create index internal_notes_registration_idx on public.internal_notes (registration_id, created_at desc);
create index internal_notes_case_idx on public.internal_notes (case_id, created_at desc);

create table public.internal_note_versions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.internal_notes (id) on delete cascade,
  revision integer not null,
  content text not null,
  changed_by uuid references public.profiles (id) on delete set null,
  change_reason text,
  created_at timestamptz not null default now(),
  unique (note_id, revision)
);
alter table public.internal_note_versions enable row level security;
create index internal_note_versions_note_idx on public.internal_note_versions (note_id, revision desc);

create or replace function public.can_access_note(nid uuid, uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.internal_notes n
    left join public.registrations r on r.id = n.registration_id
    left join public.cases c on c.id = n.case_id
    where n.id = nid and (
      public.is_system_owner(uid)
      or (n.contact_id is not null and public.can_access_contact(n.contact_id, uid))
      or (r.id is not null and public.project_role(r.project_id, uid) in ('owner', 'admin_collab'))
      or (c.id is not null and public.member_can_view_cases(c.project_id, uid))
    )
  );
$$;

create or replace function public.archive_note_version()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.content is distinct from old.content then
    insert into public.internal_note_versions (note_id, revision, content, changed_by, change_reason)
    values (old.id, old.revision, old.content, auth.uid(), null);
    new.revision := old.revision + 1;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
create trigger trg_internal_notes_version before update on public.internal_notes
  for each row execute function public.archive_note_version();
create or replace function public.can_access_note_target(cid uuid, rid uuid, csid uuid, uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_system_owner(uid)
    or (cid is not null and public.can_access_contact(cid, uid))
    or exists (select 1 from public.registrations r where r.id = rid and public.project_role(r.project_id, uid) in ('owner', 'admin_collab'))
    or exists (select 1 from public.cases c where c.id = csid and public.member_can_view_cases(c.project_id, uid));
$$;
create policy internal_notes_all on public.internal_notes for all to authenticated
  using (public.can_access_note(id, (select auth.uid())))
  with check (public.can_access_note_target(contact_id, registration_id, case_id, (select auth.uid())));
create policy internal_note_versions_select on public.internal_note_versions for select to authenticated
  using (public.can_access_note(note_id, (select auth.uid())));

create table public.follow_up_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete cascade,
  registration_id uuid references public.registrations (id) on delete cascade,
  case_id uuid references public.cases (id) on delete cascade,
  title text not null,
  description text,
  assigned_to uuid references public.profiles (id) on delete set null,
  due_at timestamptz,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'snoozed', 'done', 'cancelled')),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  completed_at timestamptz,
  constraint follow_up_tasks_target check (num_nonnulls(contact_id, registration_id, case_id) >= 1)
);
alter table public.follow_up_tasks enable row level security;
create index follow_up_tasks_queue_idx on public.follow_up_tasks (assigned_to, status, due_at);
create index follow_up_tasks_project_idx on public.follow_up_tasks (project_id, status, due_at);
create trigger trg_follow_up_tasks_touch before update on public.follow_up_tasks
  for each row execute function public.adhd_touch_updated_at();
create policy follow_up_tasks_all on public.follow_up_tasks for all to authenticated
  using (public.is_system_owner((select auth.uid())) or public.project_role(project_id, (select auth.uid())) in ('owner', 'admin_collab'))
  with check (public.is_system_owner((select auth.uid())) or public.project_role(project_id, (select auth.uid())) in ('owner', 'admin_collab'));

-- ---------------------------------------------------------------------------
-- 4. 信件完整內容、附件、草稿版本與同步狀態
-- ---------------------------------------------------------------------------
alter table public.email_threads
  alter column registration_id drop not null,
  add column contact_id uuid references public.contacts (id) on delete set null,
  add column needs_reply boolean not null default false,
  add column status text not null default 'open' check (status in ('open', 'waiting', 'closed')),
  add column updated_at timestamptz;
create unique index email_threads_gmail_uidx on public.email_threads (gmail_thread_id)
  where gmail_thread_id is not null;
create index email_threads_contact_idx on public.email_threads (contact_id, last_message_at desc);

alter table public.email_messages
  add column body_html text,
  add column snippet text,
  add column cc_email text[] not null default '{}',
  add column bcc_email text[] not null default '{}',
  add column label_ids text[] not null default '{}',
  add column delivery_status text not null default 'received' check (delivery_status in ('draft', 'queued', 'sent', 'received', 'failed')),
  add column raw_headers jsonb not null default '{}';
create unique index email_messages_gmail_uidx on public.email_messages (gmail_message_id)
  where gmail_message_id is not null;

create table public.email_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.email_messages (id) on delete cascade,
  gmail_attachment_id text,
  filename text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  storage_path text,
  created_at timestamptz not null default now()
);
alter table public.email_attachments enable row level security;
create index email_attachments_message_idx on public.email_attachments (message_id);
create unique index email_attachments_gmail_uidx on public.email_attachments (message_id, gmail_attachment_id);
create policy email_attachments_select on public.email_attachments for select to authenticated
  using (exists (
    select 1 from public.email_messages m
    where m.id = message_id and public.can_access_thread(m.thread_id, (select auth.uid()))
  ));
insert into storage.buckets (id, name, public, file_size_limit)
values ('email-attachments', 'email-attachments', false, 26214400)
on conflict (id) do nothing;
create policy email_attachment_objects_select on storage.objects for select to authenticated
  using (
    bucket_id = 'email-attachments'
    and array_length(storage.foldername(name), 1) >= 2
    and public.can_access_thread(((storage.foldername(name))[1])::uuid, (select auth.uid()))
  );

create table public.email_drafts (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id) on delete cascade,
  thread_id uuid references public.email_threads (id) on delete set null,
  gmail_draft_id text,
  to_email text not null,
  cc_email text[] not null default '{}',
  bcc_email text[] not null default '{}',
  subject text not null default '',
  body text not null default '',
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent', 'failed', 'archived')),
  revision integer not null default 1,
  author_id uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
alter table public.email_drafts enable row level security;
create index email_drafts_registration_idx on public.email_drafts (registration_id, updated_at desc);

create table public.email_draft_versions (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.email_drafts (id) on delete cascade,
  revision integer not null,
  subject text not null,
  body text not null,
  cc_email text[] not null default '{}',
  bcc_email text[] not null default '{}',
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (draft_id, revision)
);
alter table public.email_draft_versions enable row level security;

create or replace function public.archive_email_draft_version()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if row(new.subject, new.body, new.cc_email, new.bcc_email) is distinct from row(old.subject, old.body, old.cc_email, old.bcc_email) then
    insert into public.email_draft_versions (draft_id, revision, subject, body, cc_email, bcc_email, changed_by)
    values (old.id, old.revision, old.subject, old.body, old.cc_email, old.bcc_email, auth.uid());
    new.revision := old.revision + 1;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger trg_email_drafts_version before update on public.email_drafts
  for each row execute function public.archive_email_draft_version();

create policy email_drafts_all on public.email_drafts for all to authenticated
  using (exists (
    select 1 from public.registrations r where r.id = registration_id
      and (public.is_system_owner((select auth.uid())) or public.project_role(r.project_id, (select auth.uid())) in ('owner', 'admin_collab'))
  ))
  with check (exists (
    select 1 from public.registrations r where r.id = registration_id
      and (public.is_system_owner((select auth.uid())) or public.project_role(r.project_id, (select auth.uid())) in ('owner', 'admin_collab'))
  ));
create policy email_draft_versions_select on public.email_draft_versions for select to authenticated
  using (exists (
    select 1 from public.email_drafts d join public.registrations r on r.id = d.registration_id
    where d.id = draft_id
      and (public.is_system_owner((select auth.uid())) or public.project_role(r.project_id, (select auth.uid())) in ('owner', 'admin_collab'))
  ));

create table public.gmail_sync_state (
  mailbox_email text primary key,
  history_id text,
  watch_expiration timestamptz,
  last_full_sync_at timestamptz,
  last_incremental_sync_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);
alter table public.gmail_sync_state enable row level security;
create policy gmail_sync_state_admin on public.gmail_sync_state for select to authenticated
  using (public.is_system_owner((select auth.uid())) or exists (
    select 1 from public.project_members pm where pm.user_id = (select auth.uid()) and pm.role in ('owner', 'admin_collab')
  ));

-- Unlinked Gmail threads are visible only to the system owner; linked threads follow registration access.
create or replace function public.can_access_thread(tid uuid, uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.email_threads t
    left join public.registrations r on r.id = t.registration_id
    where t.id = tid and (
      public.is_system_owner(uid)
      or (r.id is not null and public.project_role(r.project_id, uid) in ('owner', 'admin_collab'))
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. 個案完整流程與服務紀錄版本
-- ---------------------------------------------------------------------------
alter table public.cases
  add column contact_id uuid references public.contacts (id) on delete set null,
  add column assigned_to uuid references public.profiles (id) on delete set null,
  add column opened_at timestamptz not null default now(),
  add column closed_at timestamptz,
  add column close_reason text,
  add column archived_at timestamptz;
update public.cases c set contact_id = r.contact_id
from public.registrations r where c.registration_id = r.id and c.contact_id is null;
create unique index cases_registration_uidx on public.cases (registration_id) where registration_id is not null;
create index cases_contact_idx on public.cases (contact_id, status);
create index cases_assigned_idx on public.cases (assigned_to, status);

create table public.case_transfers (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  from_user_id uuid references public.profiles (id) on delete set null,
  to_user_id uuid references public.profiles (id) on delete set null,
  reason text not null,
  transferred_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.case_transfers enable row level security;
create index case_transfers_case_idx on public.case_transfers (case_id, created_at desc);
create policy case_transfers_all on public.case_transfers for all to authenticated
  using (exists (
    select 1 from public.cases c where c.id = case_id
      and public.member_can_view_cases(c.project_id, (select auth.uid()))
  )) with check (exists (
    select 1 from public.cases c where c.id = case_id
      and public.member_can_view_cases(c.project_id, (select auth.uid()))
  ));

alter table public.service_records
  add column revision integer not null default 1,
  add column updated_at timestamptz,
  add column archived_at timestamptz;
create table public.service_record_versions (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.service_records (id) on delete cascade,
  revision integer not null,
  title text not null,
  content text not null,
  changed_by uuid references public.profiles (id) on delete set null,
  change_reason text,
  created_at timestamptz not null default now(),
  unique (record_id, revision)
);
alter table public.service_record_versions enable row level security;
create index service_record_versions_record_idx on public.service_record_versions (record_id, revision desc);
create or replace function public.archive_service_record_version()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if row(new.title, new.content) is distinct from row(old.title, old.content) then
    insert into public.service_record_versions (record_id, revision, title, content, changed_by)
    values (old.id, old.revision, old.title, old.content, auth.uid());
    new.revision := old.revision + 1;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
create trigger trg_service_records_version before update on public.service_records
  for each row execute function public.archive_service_record_version();
create policy service_record_versions_select on public.service_record_versions for select to authenticated
  using (exists (
    select 1 from public.service_records sr join public.cases c on c.id = sr.case_id
    where sr.id = record_id and public.member_can_view_cases(c.project_id, (select auth.uid()))
  ));

-- ---------------------------------------------------------------------------
-- 6. 原子行政 RPC
-- ---------------------------------------------------------------------------
create or replace function public.admin_move_registration_sessions(p_registration_id uuid, p_session_ids uuid[])
returns public.registrations
language plpgsql security definer set search_path = public
as $$
declare
  reg public.registrations;
  sid uuid;
  result public.registrations;
begin
  select * into reg from public.registrations where id = p_registration_id for update;
  if reg.id is null then raise exception 'REGISTRATION_NOT_FOUND'; end if;
  if not (public.is_system_owner(auth.uid()) or public.project_role(reg.project_id, auth.uid()) in ('owner', 'admin_collab')) then
    raise exception 'FORBIDDEN';
  end if;

  perform 1 from public.sessions
  where id = any(coalesce(reg.session_ids, '{}') || coalesce(p_session_ids, '{}'))
  order by id for update;

  foreach sid in array coalesce(reg.session_ids, '{}') loop
    if not (sid = any(coalesce(p_session_ids, '{}'))) then
      update public.sessions set
        booked_count = greatest(0, booked_count - 1),
        status = case when status = 'full' then 'open' else status end
      where id = sid;
    end if;
  end loop;

  foreach sid in array coalesce(p_session_ids, '{}') loop
    if not (sid = any(coalesce(reg.session_ids, '{}'))) then
      update public.sessions set
        booked_count = booked_count + 1,
        status = case when booked_count + 1 >= capacity then 'full' else status end
      where id = sid and project_id = reg.project_id and status = 'open' and booked_count < capacity;
      if not found then raise exception 'SESSION_FULL_OR_CLOSED:%', sid; end if;
    end if;
  end loop;

  update public.registrations set session_ids = coalesce(p_session_ids, '{}'), capacity_released_at = null
  where id = reg.id returning * into result;
  insert into public.audit_log(action, actor_id, target_type, target_id, result, detail)
  values ('registration_session_move', auth.uid(), 'registration', reg.id::text, 'success',
    json_build_object('from', reg.session_ids, 'to', p_session_ids)::text);
  return result;
end;
$$;

create or replace function public.admin_transition_registration(p_registration_id uuid, p_status text)
returns public.registrations
language plpgsql security definer set search_path = public
as $$
declare
  reg public.registrations;
  sid uuid;
  should_release boolean := lower(p_status) = any(array['rejected','cancelled','withdrawn','canceled']);
  result public.registrations;
begin
  select * into reg from public.registrations where id = p_registration_id for update;
  if reg.id is null then raise exception 'REGISTRATION_NOT_FOUND'; end if;
  if not (public.is_system_owner(auth.uid()) or public.project_role(reg.project_id, auth.uid()) in ('owner', 'admin_collab')) then
    raise exception 'FORBIDDEN';
  end if;
  perform 1 from public.sessions where id = any(coalesce(reg.session_ids, '{}')) order by id for update;

  if should_release and reg.capacity_released_at is null then
    foreach sid in array coalesce(reg.session_ids, '{}') loop
      update public.sessions set booked_count = greatest(0, booked_count - 1),
        status = case when status = 'full' then 'open' else status end where id = sid;
    end loop;
    update public.registrations set status = p_status, capacity_released_at = now()
      where id = reg.id returning * into result;
  elsif not should_release and reg.capacity_released_at is not null then
    foreach sid in array coalesce(reg.session_ids, '{}') loop
      update public.sessions set booked_count = booked_count + 1,
        status = case when booked_count + 1 >= capacity then 'full' else status end
      where id = sid and status in ('open','full') and booked_count < capacity;
      if not found then raise exception 'SESSION_FULL_OR_CLOSED:%', sid; end if;
    end loop;
    update public.registrations set status = p_status, capacity_released_at = null
      where id = reg.id returning * into result;
  else
    update public.registrations set status = p_status where id = reg.id returning * into result;
  end if;
  insert into public.audit_log(action, actor_id, target_type, target_id, result, detail)
  values ('registration_status_change', auth.uid(), 'registration', reg.id::text, 'success',
    json_build_object('from', reg.status, 'to', p_status)::text);
  return result;
end;
$$;

create or replace function public.admin_create_case_from_registration(
  p_registration_id uuid, p_service_type text, p_summary text, p_assigned_to uuid default null
)
returns public.cases
language plpgsql security definer set search_path = public
as $$
declare
  reg public.registrations;
  result public.cases;
  cname text;
begin
  select * into reg from public.registrations where id = p_registration_id for update;
  if reg.id is null then raise exception 'REGISTRATION_NOT_FOUND'; end if;
  if not public.member_can_view_cases(reg.project_id, auth.uid()) then raise exception 'FORBIDDEN'; end if;
  select display_name into cname from public.contacts where id = reg.contact_id;
  insert into public.cases(project_id, registration_id, contact_id, display_name, service_type, summary, assigned_to)
  values (reg.project_id, reg.id, reg.contact_id, coalesce(cname, split_part(reg.email, '@', 1)), p_service_type, nullif(trim(p_summary), ''), p_assigned_to)
  on conflict (registration_id) where registration_id is not null do update
    set summary = excluded.summary, assigned_to = coalesce(excluded.assigned_to, public.cases.assigned_to)
  returning * into result;
  insert into public.audit_log(action, actor_id, target_type, target_id, result, detail)
  values ('case_create_from_registration', auth.uid(), 'case', result.id::text, 'success',
    json_build_object('registration_id', reg.id)::text);
  return result;
end;
$$;

grant execute on function public.admin_move_registration_sessions(uuid, uuid[]) to authenticated;
grant execute on function public.admin_transition_registration(uuid, text) to authenticated;
grant execute on function public.admin_create_case_from_registration(uuid, text, text, uuid) to authenticated;







