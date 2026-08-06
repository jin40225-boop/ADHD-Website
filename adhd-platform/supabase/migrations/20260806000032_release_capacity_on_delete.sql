-- ============================================================================
-- 直接刪除報名時回收名額（2026-08-06）
--
-- 問題：`enforce_session_capacity` 只在 INSERT 遞增，DELETE 沒有對應的遞減；名額回收
--   綁在狀態轉換函式 `admin_transition_registration` 上。正常流程踩不到（後台都走轉換函式），
--   但任何繞過 UI 的資料清理都會留下錯誤的名額計數——而那個數字直接決定前台顯示的剩餘名額。
--
--   2026-08-06 清測試資料時實證：報名刪掉了、總數正確回到 64，場次 `booked_count` 仍停在 2。
--
-- 處置：補 after delete trigger。
--
-- ⚠ **必須看 `capacity_released_at`，不能無條件遞減。** 一筆已經退回／取消的報名早就在狀態
--   轉換時把名額還回去了（那時會寫上 `capacity_released_at`）；刪除它再扣一次，就會把別人的
--   名額吃掉。這正是 `20260804000015` 修過的同一類錯誤——當時是移轉場次時對已釋額的報名
--   重複扣，症狀是「別的場次名額悄悄少一個」，沒有任何錯誤訊息。
--
-- 額滿狀態一併回復：扣到未滿時把 `full` 轉回 `open`，比照轉換函式的既有寫法。
-- 純新增：不改既有函式與 trigger。冪等：可重複執行。
-- ============================================================================

create or replace function public.release_capacity_on_delete()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  sid uuid;
begin
  -- 已釋額的報名不再扣：名額在狀態轉成退回／取消時就已經還回去了。
  if old.capacity_released_at is not null then
    return old;
  end if;
  if old.session_ids is null or array_length(old.session_ids, 1) is null then
    return old;
  end if;

  foreach sid in array old.session_ids loop
    update public.sessions
       set booked_count = greatest(0, booked_count - 1),
           status = case when status = 'full' then 'open' else status end
     where id = sid;
  end loop;
  return old;
end;
$$;

drop trigger if exists trg_registration_release_on_delete on public.registrations;
create trigger trg_registration_release_on_delete
  after delete on public.registrations
  for each row execute function public.release_capacity_on_delete();
