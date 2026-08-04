-- 同儕聚會分頁（03_v4）的信箱格可直接改，而 email 是名冊比對鍵——改了卻不留歷程，
-- 就會出現「信件突然掛不上這個人」而查不出是誰改的。補進既有的編輯稽核。
--
-- 只加一段 email 判斷，其餘與 20260804000013 相同（status 仍不記，answers 仍只記 key）。

create or replace function public.log_registration_admin_edit()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  changed jsonb := '{}'::jsonb;
  answer_keys text[];
begin
  if new.email is distinct from old.email then
    changed := changed || jsonb_build_object('email', jsonb_build_array(old.email, new.email));
  end if;
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
