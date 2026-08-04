-- admin_move_registration_sessions 原本無條件做名額加減，並無條件把
-- capacity_released_at 清成 null。對一筆「已釋額」的報名（退回／取消／中途放棄，
-- admin_transition_registration 已經扣過名額）改場次時，會：
--   1. 對舊場次再扣一次 booked_count——扣掉一個它根本沒佔的位子，等於偷走別人的名額
--   2. 對新場次加 1，並清掉 capacity_released_at——狀態還是「退回」卻又佔了位子
-- 而 enforce_session_capacity 只掛在 before insert，移轉路徑沒有任何補償機制。
--
-- 3-2／3-3 把「確定場次」做成表格裡每一列都能點的下拉，這條路徑從此隨手可及，
-- 且症狀是「別的場次名額悄悄少一個」，不會有錯誤訊息。因此改成看 capacity_released_at：
-- 已釋額的報名只換 session_ids，不動 booked_count，也不得把已釋額狀態清掉。
--
-- 對帳結果（2026-08-04，唯讀查詢）：42 個場次 booked_count 合計 2、實際佔額合計 2，
-- 零偏差，因此本次不需要任何資料校正。
--
-- 同時修掉一筆重複稽核：本函式已寫 registration_session_move，而 20260804000013
-- 的編輯 trigger 看到 session_ids 變動也會再寫一筆 registration_admin_edit。所有
-- session_ids 變更都只經過本函式，那段因此是純重複——與當初排除 status 同一個理由。

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

  if reg.capacity_released_at is null then
    -- 這筆報名確實佔著名額：照原本的邏輯搬移。
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
  else
    -- 已釋額：只換場次，名額與釋額狀態都不動。要重新佔額請改狀態，
    -- 由 admin_transition_registration 負責加回名額（它會檢查場次是否已滿）。
    update public.registrations set session_ids = coalesce(p_session_ids, '{}')
    where id = reg.id returning * into result;
  end if;

  insert into public.audit_log(action, actor_id, target_type, target_id, result, detail)
  values ('registration_session_move', auth.uid(), 'registration', reg.id::text, 'success',
    json_build_object('from', reg.session_ids, 'to', p_session_ids,
      'capacity_held', reg.capacity_released_at is null)::text);
  return result;
end;
$$;

-- 編輯稽核移除 session_ids 段（改由 admin_move_registration_sessions 單獨記錄），
-- 其餘與 20260804000014 相同：status 不記、answers 只記被改的 key。
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
