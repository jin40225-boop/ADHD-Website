-- ============================================================================
-- 名額政策：申請制（送出不佔位，錄取才佔位）（2026-08-10）
--
-- 使用者裁決：「職場的活動報名，我希望機制不要是有人報名就額滿。（家長場次可以先
-- 這樣）職場和諮商的部分因為要篩選，所以可以接受同一個時間點有多人報名，但依照
-- 我們最終選擇的人為主。」
--
-- 現況：`enforce_session_capacity` 在**報名寫入的當下**就把名額扣掉、額滿即轉 full。
--       對「先報名、我們再篩選」的服務線這是錯的模型——第一個人送出，後面想申請的
--       人就看到已額滿，而你根本還沒開始挑。
--
-- 做法：在 projects 加一個政策欄，兩種值：
--   on_submit（預設，現況）：送出即佔位。適合先到先得——親職諮詢、互助聚會不變。
--   on_confirm（新）        ：送出＝申請，不佔位；**錄取時才佔位**。職場諮詢、導航計畫。
--
-- 三個連動點：
--   1. `enforce_session_capacity`：on_confirm 不扣名額、也不擋額滿，但仍要求場次
--      是 open（已結束／未上架／已取消的場次不該再收到申請）。
--   2. 申請寫入時把 `capacity_released_at` 蓋上時間戳＝「這筆沒有佔著名額」，
--      沿用既有欄位語意，不新增第二套狀態。
--   3. `admin_transition_registration`：on_confirm 的報名**只有轉成 confirmed／
--      success 才取得名額**。這一條是關鍵——原本的邏輯是「只要不是退回類就補回
--      名額」，套到申請制會變成「改成回信確認中就佔位」，等於換個地方重演同一個
--      問題。on_submit 的行為逐字保留，親職與互助聚會完全不受影響。
--
-- 副作用（正面）：申請制的報名不佔名額，所以「一筆報名勾了多個時段就鎖住多場」
-- 這件事在職場諮詢與導航計畫上不會發生——那正是複選的原意（提供幾個可配合的時間）。
--
-- 冪等：可重複執行。
-- ============================================================================

alter table public.projects
  add column if not exists seat_policy text not null default 'on_submit'
  check (seat_policy in ('on_submit', 'on_confirm'));

comment on column public.projects.seat_policy is
  '名額何時被佔用。on_submit＝送出報名即扣名額（先到先得）；on_confirm＝送出只是申請、不扣名額，錄取（confirmed／success）時才扣。';

update public.projects set seat_policy = 'on_confirm'
where slug in ('career', 'navigator') and seat_policy is distinct from 'on_confirm';

-- ----------------------------------------------------------------------------
-- 1. 報名寫入：申請制不扣名額
-- ----------------------------------------------------------------------------
create or replace function public.enforce_session_capacity()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  sid uuid;
  policy text;
begin
  if new.session_ids is null or array_length(new.session_ids, 1) is null then
    return new;
  end if;

  select p.seat_policy into policy
  from public.projects p where p.id = new.project_id;

  if coalesce(policy, 'on_submit') = 'on_confirm' then
    -- 申請制：不扣名額、不判額滿。但場次必須是開放中——已結束或未上架的場次
    -- 收到申請沒有意義，而且會讓報名者以為報成功了。
    foreach sid in array new.session_ids loop
      perform 1 from public.sessions where id = sid and status = 'open';
      if not found then
        raise exception 'SESSION_FULL_OR_CLOSED:%', sid using errcode = 'P0001';
      end if;
    end loop;
    -- 「這筆沒有佔著名額」沿用既有欄位表示，後台的對帳與釋額邏輯自然一致。
    new.capacity_released_at := now();
    return new;
  end if;

  -- on_submit：逐字沿用原本的行為，先到先得。
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

-- ----------------------------------------------------------------------------
-- 2. 狀態轉換：申請制只有錄取才取得名額
-- ----------------------------------------------------------------------------
create or replace function public.admin_transition_registration(p_registration_id uuid, p_status text)
returns public.registrations
language plpgsql security definer set search_path = public
as $$
declare
  reg public.registrations;
  sid uuid;
  should_release boolean := lower(p_status) = any(array['rejected','cancelled','withdrawn','canceled']);
  policy text;
  should_hold boolean;
  result public.registrations;
begin
  select * into reg from public.registrations where id = p_registration_id for update;
  if reg.id is null then raise exception 'REGISTRATION_NOT_FOUND'; end if;
  if not (public.is_system_owner(auth.uid()) or public.project_role(reg.project_id, auth.uid()) in ('owner', 'admin_collab')) then
    raise exception 'FORBIDDEN';
  end if;
  perform 1 from public.sessions where id = any(coalesce(reg.session_ids, '{}')) order by id for update;

  select p.seat_policy into policy from public.projects p where p.id = reg.project_id;
  -- on_submit：只要不是退回類就補回名額（原本的行為，逐字保留）。
  -- on_confirm：只有錄取（confirmed／success）才取得名額——待審核、回信確認中、
  --             候補都不該佔住位子，那正是申請制的重點。
  should_hold := case
    when coalesce(policy, 'on_submit') = 'on_confirm'
      then lower(p_status) = any(array['confirmed','success'])
    else not should_release
  end;

  if should_release and reg.capacity_released_at is null then
    foreach sid in array coalesce(reg.session_ids, '{}') loop
      update public.sessions set booked_count = greatest(0, booked_count - 1),
        status = case when status = 'full' then 'open' else status end where id = sid;
    end loop;
    update public.registrations set status = p_status, capacity_released_at = now()
      where id = reg.id returning * into result;
  elsif should_hold and reg.capacity_released_at is not null then
    foreach sid in array coalesce(reg.session_ids, '{}') loop
      update public.sessions set booked_count = booked_count + 1,
        status = case when booked_count + 1 >= capacity then 'full' else status end
      where id = sid and status in ('open','full') and booked_count < capacity;
      if not found then raise exception 'SESSION_FULL_OR_CLOSED:%', sid; end if;
    end loop;
    update public.registrations set status = p_status, capacity_released_at = null
      where id = reg.id returning * into result;
  elsif (not should_hold) and reg.capacity_released_at is null then
    -- 申請制：從錄取退回到審核中／候補時，名額要還出去讓別人能被選。
    foreach sid in array coalesce(reg.session_ids, '{}') loop
      update public.sessions set booked_count = greatest(0, booked_count - 1),
        status = case when status = 'full' then 'open' else status end where id = sid;
    end loop;
    update public.registrations set status = p_status, capacity_released_at = now()
      where id = reg.id returning * into result;
  else
    update public.registrations set status = p_status where id = reg.id returning * into result;
  end if;

  insert into public.audit_log(action, actor_id, target_type, target_id, result, detail)
  values ('registration_status_change', auth.uid(), 'registration', reg.id::text, 'success',
    json_build_object('from', reg.status, 'to', p_status, 'seat_policy', coalesce(policy, 'on_submit'),
                      'holds_seat', should_hold)::text);
  return result;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. 防呆：政策必須確實落在該落的兩條服務線上
-- ----------------------------------------------------------------------------
do $$
declare n integer;
begin
  select count(*) into n from public.projects
   where slug in ('career','navigator') and seat_policy = 'on_confirm';
  if n <> 2 then
    raise exception '申請制只套用到 % 條服務線（應為 career 與 navigator 共 2 條）——全數回滾。', n;
  end if;
end $$;
