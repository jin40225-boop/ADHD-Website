-- 裁決 11「修改需記錄歷程」目前只涵蓋 registrations。場次的名額、上下架、報名截止、
-- 主題與客座、導航候選時段全都可以在後台直接改，卻一行稽核都沒有——上下架尤其該留，
-- 那是前台看得見的變動。比照 20260804000013 的做法補上。
--
-- booked_count 不記：它由 enforce_session_capacity 與 admin_move_registration_sessions
-- 自動維護，每一筆報名動作都會動到它，而那些動作在報名端已經各自留了稽核。記了只會
-- 把場次的歷程洗成一堆與人工編輯無關的雜訊。
--
-- status 只在「booked_count 沒有同時變動」時才記。這是區分人工與自動的可靠判準：
-- 自動轉 full／open 一定與 booked_count 在同一個 UPDATE 內發生，而後台的上下架
-- （adminSaveSession）payload 不含 booked_count。少了這個條件，每一筆讓場次額滿的
-- 報名都會多寫一列場次稽核。

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

drop trigger if exists trg_sessions_admin_audit on public.sessions;
create trigger trg_sessions_admin_audit
  after update on public.sessions
  for each row execute function public.log_session_admin_edit();
