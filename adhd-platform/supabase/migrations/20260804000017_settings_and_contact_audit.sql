-- 3-5 設定・聯絡人需要的兩件事：
--   1. 信件狀態機的逾期門檻要有地方存（Phase 4 才會真的用它判斷，但值現在就要能改且持久）
--   2. 聯絡人與類群的編輯要留歷程——信箱是 gmail-sync 的名冊比對鍵，改了等於改「這個人的
--      信件掛在誰名下」，與報名信箱同一個道理（見 20260804000014）
--
-- 設定用單列表而非 key/value：目前只有一個設定值，具名欄位讀起來清楚也有型別；
-- 需要第二個設定時再加欄位，不預先蓋一座通用設定框架。

create table if not exists public.app_settings (
  id boolean primary key default true check (id),
  -- 寄出後幾天未回覆算逾期（計畫第七節，預設 3）。Phase 4 的狀態機接線後才會依它判斷。
  follow_up_days integer not null default 3 check (follow_up_days >= 0 and follow_up_days <= 60),
  updated_at timestamptz,
  updated_by uuid references public.profiles (id) on delete set null
);
alter table public.app_settings enable row level security;
insert into public.app_settings (id) values (true) on conflict (id) do nothing;

drop policy if exists app_settings_admin_read on public.app_settings;
create policy app_settings_admin_read on public.app_settings
  for select to authenticated using (public.is_ops_admin(auth.uid()));
drop policy if exists app_settings_admin_write on public.app_settings;
create policy app_settings_admin_write on public.app_settings
  for update to authenticated using (public.is_ops_admin(auth.uid())) with check (public.is_ops_admin(auth.uid()));
revoke all on public.app_settings from anon;

-- ---------------------------------------------------------------------------
-- 稽核：聯絡人欄位、類群成員異動、設定變更
-- ---------------------------------------------------------------------------

create or replace function public.log_contact_admin_edit()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  changed jsonb := '{}'::jsonb;
begin
  -- 信箱是名冊比對鍵，必記前後值。
  if new.primary_email is distinct from old.primary_email then
    changed := changed || jsonb_build_object('primary_email', jsonb_build_array(old.primary_email, new.primary_email));
  end if;
  if new.display_name is distinct from old.display_name then
    changed := changed || jsonb_build_object('display_name', jsonb_build_array(old.display_name, new.display_name));
  end if;
  if new.phone is distinct from old.phone then
    changed := changed || jsonb_build_object('phone', jsonb_build_array(old.phone, new.phone));
  end if;
  if new.status is distinct from old.status then
    changed := changed || jsonb_build_object('status', jsonb_build_array(old.status, new.status));
  end if;
  if new.is_favorite is distinct from old.is_favorite then
    changed := changed || jsonb_build_object('is_favorite', jsonb_build_array(old.is_favorite, new.is_favorite));
  end if;
  if new.tags is distinct from old.tags then
    changed := changed || jsonb_build_object('tags', jsonb_build_array(old.tags, new.tags));
  end if;

  if changed = '{}'::jsonb then return new; end if;

  insert into public.audit_log (action, actor_id, target_type, target_id, result, detail)
  values ('contact_admin_edit', auth.uid(), 'contact', new.id::text, 'success', changed::text);
  return new;
end;
$$;

drop trigger if exists trg_contacts_admin_audit on public.contacts;
create trigger trg_contacts_admin_audit
  after update on public.contacts
  for each row execute function public.log_contact_admin_edit();

-- 類群成員：手動加入與任何移出都記；自動歸群（sync_registration_contact_group）不記，
-- 那是報名成立的附帶結果，報名端已有稽核。自動規則只會加入、不會移出，所以移出一律是人為。
create or replace function public.log_contact_group_member_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  gid uuid; cid uuid; act text; src text;
begin
  if tg_op = 'DELETE' then
    gid := old.group_id; cid := old.contact_id; act := 'remove'; src := old.source;
  else
    if new.source is distinct from 'manual' then return new; end if;
    gid := new.group_id; cid := new.contact_id; act := 'add'; src := new.source;
  end if;

  insert into public.audit_log (action, actor_id, target_type, target_id, result, detail)
  values ('contact_group_member_change', auth.uid(), 'contact_group', gid::text, 'success',
    json_build_object('action', act, 'contact_id', cid, 'source', src)::text);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_contact_group_members_audit on public.contact_group_members;
create trigger trg_contact_group_members_audit
  after insert or delete on public.contact_group_members
  for each row execute function public.log_contact_group_member_change();

create or replace function public.log_app_settings_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.follow_up_days is distinct from old.follow_up_days then
    insert into public.audit_log (action, actor_id, target_type, target_id, result, detail)
    values ('app_settings_change', auth.uid(), 'app_settings', 'global', 'success',
      jsonb_build_object('follow_up_days', jsonb_build_array(old.follow_up_days, new.follow_up_days))::text);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_app_settings_audit on public.app_settings;
create trigger trg_app_settings_audit
  after update on public.app_settings
  for each row execute function public.log_app_settings_change();

-- ---------------------------------------------------------------------------
-- 範本審閱狀態
-- ---------------------------------------------------------------------------
-- 6 封由 20260804000002 起草的範本尚未經使用者審閱，設定頁要標示「待審閱」。用欄位而非
-- 前端寫死名單：審完之後要能真的把狀態清掉，寫死的名單清不掉。
--
-- 回絕信與家長行前信不算草稿——它們的全文取自審閱指南 v3，已是定稿。
-- （03_v4 的範本表把這兩封標成「待你最終核可」，那是設計當時的狀態，之後已在
--   審閱指南 v3 定稿；反而是 AI 起草的其餘 6 封還沒審。以現況為準。）
alter table public.email_templates
  add column if not exists review_status text not null default 'approved'
    check (review_status in ('draft', 'approved'));

update public.email_templates
   set review_status = 'draft'
 where name in ('確認信', '出席確認信（催覆）', '聯繫信', '講師行前通知信', '月度宣傳信', '客座邀請信')
   and review_status <> 'draft';
