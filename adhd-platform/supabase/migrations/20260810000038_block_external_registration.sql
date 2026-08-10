-- ============================================================================
-- 資料庫層拒收「報名不在本站」的場次（2026-08-10）
--
-- 背景：協辦活動的防線原本靠「名額填 0」——`enforce_session_capacity` 在
--       `booked_count < capacity` 不成立時（0 < 0 為假）直接拒絕整筆報名。
--       但那個 0 在後台會顯示成「0/0 已額滿」，看起來像壞掉，於是被改成了
--       50／100，防線就這樣無聲地消失了。
--
-- **靠一個看起來像故障的數字來守安全，本來就會被人「修好」。** 改成用語意判斷：
--
--   條件 A：這個場次所屬的活動填了對方的報名表單網址（cohost_info.formUrl）
--           → 報名在對方那裡，我方不該有任何一筆。
--   條件 B：這個場次的專案**沒有任何報名表定義**（form_schemas 無此列）
--           → 站內報名頁根本開不起來（submit-registration 要有表單才成立），
--             因此任何指向它的報名寫入都不可能是正常流程來的。
--
-- 兩條都是「這個專案本來就不收站內報名」的不同表述，任一成立即拒收。名額因此
-- 回歸單純的顯示用途，後台可以填任何看得順眼的數字，不影響安全。
--
-- 觸發順序：PostgreSQL 的 BEFORE trigger 依名稱字母序執行。
-- `trg_registration_block_external` < `trg_registration_capacity` < `trg_registration_contact`，
-- 所以它會在名額遞增與建立聯絡人**之前**擋下來——被拒絕的報名不會留下任何殘跡。
--
-- 冪等：可重複執行。
-- ============================================================================

create or replace function public.block_external_registration()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  offending uuid;
begin
  if new.session_ids is null or array_length(new.session_ids, 1) is null then
    return new;
  end if;

  -- A：場次掛的活動有對方的報名表單
  select s.id into offending
  from public.sessions s
  join public.activities a on a.id = s.activity_id
  where s.id = any(new.session_ids)
    and nullif(a.cohost_info ->> 'formUrl', '') is not null
  limit 1;

  if offending is not null then
    raise exception 'EXTERNAL_REGISTRATION_ONLY:%', offending using errcode = 'P0001';
  end if;

  -- B：場次所屬專案沒有報名表定義
  select s.id into offending
  from public.sessions s
  where s.id = any(new.session_ids)
    and not exists (
      select 1 from public.form_schemas fs where fs.project_id = s.project_id
    )
  limit 1;

  if offending is not null then
    raise exception 'PROJECT_HAS_NO_FORM:%', offending using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_registration_block_external on public.registrations;
create trigger trg_registration_block_external
  before insert on public.registrations
  for each row execute function public.block_external_registration();

comment on function public.block_external_registration is
  '拒收「報名不在本站」的場次：活動填了對方報名表單網址，或該專案沒有報名表定義。取代原本靠 capacity=0 的脆弱防線（那個 0 會被誤認為故障而被改掉）。';

-- ----------------------------------------------------------------------------
-- 名額回歸顯示用途的註記
--
-- 這些場次的 capacity 現在填幾都不影響安全。前台的協辦活動元件本來就不顯示名額
-- （報名在對方，我方的 booked_count 永遠是 0，顯示出來就是假資料）。
-- ----------------------------------------------------------------------------
comment on column public.sessions.capacity is
  '名額。⚠ 協辦活動（活動填了 cohost_info.formUrl）的場次不靠這個數字防護——防線是 block_external_registration，名額填多少都不會被收到報名。';
