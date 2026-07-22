-- 講師邀約正式接線：admin_collab 可讀專案講師，確認邀約時原子建立場次。
begin;

drop policy if exists project_members_select on public.project_members;
create policy project_members_select on public.project_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_system_owner(auth.uid())
    or public.project_role(project_id, auth.uid()) in ('owner', 'admin_collab'));

create or replace function public.confirm_availability_poll(
  p_poll_id uuid,
  p_slot_id text
)
returns public.sessions
language plpgsql
security invoker
set search_path = public
as $$
declare
  selected_poll public.availability_polls%rowtype;
  selected_slot jsonb;
  confirmed_instructors uuid[];
  created_session public.sessions%rowtype;
begin
  select * into selected_poll
  from public.availability_polls
  where id = p_poll_id
  for update;

  if not found then
    raise exception 'POLL_NOT_FOUND' using errcode = 'P0002';
  end if;
  if selected_poll.status <> 'open' then
    raise exception 'POLL_NOT_OPEN' using errcode = 'P0001';
  end if;

  select slot.value into selected_slot
  from jsonb_array_elements(selected_poll.candidate_slots) as slot(value)
  where slot.value->>'id' = p_slot_id
  limit 1;

  if selected_slot is null then
    raise exception 'SLOT_NOT_FOUND' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(ar.instructor_id order by ar.instructor_id), '{}'::uuid[])
  into confirmed_instructors
  from public.availability_replies ar
  where ar.poll_id = selected_poll.id
    and ar.slot_id = p_slot_id
    and ar.answer = 'yes'
    and ar.instructor_id = any(selected_poll.instructor_ids);

  if cardinality(confirmed_instructors) = 0 then
    raise exception 'NO_AVAILABLE_INSTRUCTOR' using errcode = 'P0001';
  end if;

  insert into public.sessions (
    project_id,
    title,
    starts_at,
    ends_at,
    capacity,
    booked_count,
    status,
    instructor_ids
  ) values (
    selected_poll.project_id,
    coalesce(nullif(selected_slot->>'title', ''), '講師協作場次'),
    (selected_slot->>'startsAt')::timestamptz,
    (selected_slot->>'endsAt')::timestamptz,
    greatest(coalesce(nullif(selected_slot->>'capacity', '')::integer, 1), 1),
    0,
    'open',
    confirmed_instructors
  )
  returning * into created_session;

  update public.availability_polls
  set status = 'confirmed'
  where id = selected_poll.id;

  return created_session;
end;
$$;

revoke all on function public.confirm_availability_poll(uuid, text) from public, anon;
grant execute on function public.confirm_availability_poll(uuid, text) to authenticated;

commit;
