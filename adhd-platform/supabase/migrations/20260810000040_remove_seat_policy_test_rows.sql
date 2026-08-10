-- ============================================================================
-- 清掉名額政策驗證留下的兩筆測試報名（2026-08-10）
--
-- 背景：為了實測「申請制送出不佔名額」，我用匿名權限對導航計畫 9/12 場次送了兩筆
--       申請。那個驗證有結果（booked_count 維持 0、場次維持 open、第二個人也報得
--       進來），但**我當時要求使用者自己到後台刪掉，那是錯的——後台根本沒有刪除
--       報名的功能**。全庫只有信件範本、活動回饋、聯絡人類群與信件串有刪除路徑，
--       報名一律走狀態流（withdrawn／cancelled），不提供刪除。
--
--       那個設計本身是合理的：報名是真實個人的紀錄，不該有一顆隨手可按的刪除鍵。
--       所以這裡不加刪除按鈕，只用一支一次性 migration 精準移除我自己造成的殘留。
--
-- 安全性：`where email in (...)` 只鎖定那兩個 `.invalid` 結尾的測試信箱
--         （.invalid 是 RFC 2606 保留的頂級域名，不可能是真人信箱）。
--         `release_capacity_on_delete` 會在刪除時處理名額——這兩筆的
--         `capacity_released_at` 有值（申請制寫入時蓋的），所以它會正確地不扣名額。
--
-- 冪等：可重複執行。
-- ============================================================================

delete from public.registrations
where email in (
  'zz-policy-test-20260810@example.invalid',
  'zz-policy-test2-20260810@example.invalid'
);

-- 這兩筆報名寫入時，`trg_registration_contact` 會順手建立同名聯絡人。
-- 只刪「沒有其他報名掛著」的，避免誤傷任何真實聯絡人。
delete from public.contacts c
where c.primary_email in (
  'zz-policy-test-20260810@example.invalid',
  'zz-policy-test2-20260810@example.invalid'
)
  and not exists (select 1 from public.registrations r where r.contact_id = c.id);

-- ----------------------------------------------------------------------------
-- 防呆：確認清乾淨，而且沒有波及別人
-- ----------------------------------------------------------------------------
do $$
declare
  left_regs integer;
  left_contacts integer;
begin
  select count(*) into left_regs from public.registrations
   where email like 'zz-policy-test%@example.invalid';
  select count(*) into left_contacts from public.contacts
   where primary_email like 'zz-policy-test%@example.invalid';
  if left_regs <> 0 or left_contacts <> 0 then
    raise exception '測試資料沒有清乾淨：報名 % 筆、聯絡人 % 筆——全數回滾。', left_regs, left_contacts;
  end if;
end $$;
