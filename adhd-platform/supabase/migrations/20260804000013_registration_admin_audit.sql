-- 裁決 11「修改需記錄歷程」：後台格內編輯是對 registrations 直接 update，
-- 不經過 admin_transition_registration，所以原本一行稽核都不會留。這支補上。
--
-- status 刻意不在這裡記——它已由 admin_transition_registration 寫過一筆
-- registration_status_change，重複記會讓同一個動作在稽核頁出現兩列。
--
-- answers 只記「哪些欄位被改了」，不記內容：報名答案含個資，稽核表不該成為
-- 第二份個資副本。要看改成什麼，看報名本身。

create or replace function public.log_registration_admin_edit()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  changed jsonb := '{}'::jsonb;
  answer_keys text[];
begin
  if new.reminder_sent_at is distinct from old.reminder_sent_at then
    changed := changed || jsonb_build_object('reminder_sent_at', jsonb_build_array(old.reminder_sent_at, new.reminder_sent_at));
  end if;
  if new.counselor_confirmed is distinct from old.counselor_confirmed then
    changed := changed || jsonb_build_object('counselor_confirmed', jsonb_build_array(old.counselor_confirmed, new.counselor_confirmed));
  end if;
  if new.final_slot_at is distinct from old.final_slot_at then
    changed := changed || jsonb_build_object('final_slot_at', jsonb_build_array(old.final_slot_at, new.final_slot_at));
  end if;
  if new.priority is distinct from old.priority then
    changed := changed || jsonb_build_object('priority', jsonb_build_array(old.priority, new.priority));
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    changed := changed || jsonb_build_object('assigned_to', jsonb_build_array(old.assigned_to, new.assigned_to));
  end if;
  if new.next_action_at is distinct from old.next_action_at then
    changed := changed || jsonb_build_object('next_action_at', jsonb_build_array(old.next_action_at, new.next_action_at));
  end if;
  if new.session_ids is distinct from old.session_ids then
    changed := changed || jsonb_build_object('session_ids', jsonb_build_array(old.session_ids, new.session_ids));
  end if;
  if new.answers is distinct from old.answers then
    select coalesce(array_agg(key order by key), '{}')
      into answer_keys
      from (
        select key from jsonb_each(coalesce(new.answers, '{}'::jsonb))
        union
        select key from jsonb_each(coalesce(old.answers, '{}'::jsonb))
      ) k
      where coalesce(new.answers, '{}'::jsonb) -> k.key is distinct from coalesce(old.answers, '{}'::jsonb) -> k.key;
    changed := changed || jsonb_build_object('answers_changed_keys', to_jsonb(answer_keys));
  end if;

  if changed = '{}'::jsonb then return new; end if;

  insert into public.audit_log (action, actor_id, target_type, target_id, result, detail)
  values ('registration_admin_edit', auth.uid(), 'registration', new.id::text, 'success', changed::text);
  return new;
end;
$$;

drop trigger if exists trg_registrations_admin_audit on public.registrations;
create trigger trg_registrations_admin_audit
  after update on public.registrations
  for each row execute function public.log_registration_admin_edit();
