-- ============================================================================
-- 場次介紹欄位（2026-08-10 舊版摺疊場次卡還原）
--
-- 依據：舊版場次卡展開層有「我們聊什麼：」活動介紹段落，但 topic/guest
--       （20260804000007）沒有對應欄位可放。新增 description，純新增、可為
--       null、對現行行為零影響：留空則前台不顯示該段。
--
-- 冪等：可重複執行。
-- ============================================================================

alter table public.sessions
  add column if not exists description text;

comment on column public.sessions.description is
  '場次介紹（前台展開層「我們聊什麼：」段落）。留空則前台不顯示該段。';

-- sessions_public 追加 description（欄位清單逐字照抄 20260804000007 版本，
-- 只在尾端追加，不更動既有欄位名稱／型別／順序）
create or replace view public.sessions_public
with (security_barrier) as
  select s.id, s.project_id, s.title, s.starts_at, s.ends_at,
         s.capacity, s.booked_count, s.status,
         s.registration_deadline, s.slot_options, s.quota_group,
         s.topic, s.guest, s.description
  from public.sessions s
  where exists (
    select 1 from public.projects p
    where p.id = s.project_id and p.is_public
  );
grant select on public.sessions_public to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 稽核：description 必須與 topic／guest 同級
--
-- 20260804000016 逐欄枚舉要記的欄位，新欄位不會自動被涵蓋。description 與
-- topic／guest 同樣是「後台可自由輸入、匿名前台看得見」的文字欄，卻是三者中
-- 唯一沒有軌跡的——行政人員若誤把家長姓名寫進介紹再刪掉，將完全查不到。
-- 依專案既有紀律「稽核 trigger 必須早於會寫入的 UI 上線」，與欄位同一支 migration 補上。
--
-- 記完整舊值與新值（比照 topic／guest）：這一欄的內容本來就會公開顯示，
-- 不是機密，而軌跡的價值正在於看得出「被改掉的那句話原本寫了什麼」。
-- ----------------------------------------------------------------------------
create or replace function public.log_session_admin_edit()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  changed jsonb := '{}'::jsonb;
begin
  if new.capacity is distinct from old.capacity then
    changed := changed || jsonb_build_object('capacity', jsonb_build_array(old.capacity, new.capacity));
  end if;
  if new.status is distinct from old.status and new.booked_count = old.booked_count then
    changed := changed || jsonb_build_object('status', jsonb_build_array(old.status, new.status));
  end if;
  if new.registration_deadline is distinct from old.registration_deadline then
    changed := changed || jsonb_build_object('registration_deadline', jsonb_build_array(old.registration_deadline, new.registration_deadline));
  end if;
  if new.topic is distinct from old.topic then
    changed := changed || jsonb_build_object('topic', jsonb_build_array(old.topic, new.topic));
  end if;
  if new.guest is distinct from old.guest then
    changed := changed || jsonb_build_object('guest', jsonb_build_array(old.guest, new.guest));
  end if;
  if new.description is distinct from old.description then
    changed := changed || jsonb_build_object('description', jsonb_build_array(old.description, new.description));
  end if;
  if new.slot_options is distinct from old.slot_options then
    changed := changed || jsonb_build_object('slot_options', jsonb_build_array(old.slot_options, new.slot_options));
  end if;
  if new.starts_at is distinct from old.starts_at then
    changed := changed || jsonb_build_object('starts_at', jsonb_build_array(old.starts_at, new.starts_at));
  end if;
  if new.ends_at is distinct from old.ends_at then
    changed := changed || jsonb_build_object('ends_at', jsonb_build_array(old.ends_at, new.ends_at));
  end if;

  if changed = '{}'::jsonb then return new; end if;

  insert into public.audit_log (action, actor_id, target_type, target_id, result, detail)
  values ('session_admin_edit', auth.uid(), 'session', new.id::text, 'success', changed::text);
  return new;
end;
$$;
