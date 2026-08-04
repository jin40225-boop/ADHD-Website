-- ============================================================================
-- 導航計畫報名頁改讀 slot_options（2026-08-04 Phase 2）
--
-- 依據：重構審閱稿 04_前台_導航計畫報名頁_v4.html
--   「所有候選時段都顯示確切日期」＋「5–8 月收合為已完成軌跡」。
--
-- 前台已改為直接讀 sessions.slot_options 逐一顯示 5 個確切時段（依月份分組、
-- 標示開放狀態與報名截止），因此本檔清掉三個已被取代的資料層補丁，並把
-- 5–8 月的既有場次補進資料庫，讓「已完成月份」是真資料而不是寫死的文字。
--
-- 不刪除任何報名資料；只改 sessions.title 與 form_schemas.fields。
-- 冪等：可重複執行。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. 移除 20260804000003 的標題補述
--    當時是為了讓「2026/09/12 20:00–10:00」這種時間窗顯示不被誤解而加的說明。
--    現在前台顯示的是確切時段，補述已無必要。
-- ---------------------------------------------------------------------------
update public.sessions s
set title = replace(s.title, '（每月 1 位・確切時段另行確認）', '')
from public.projects p
where p.id = s.project_id
  and p.slug = 'navigator'
  and s.title like '%（每月 1 位・確切時段另行確認）%';

-- ---------------------------------------------------------------------------
-- 2. 清掉三個已被 slot_options 取代的表單欄位
--
--    preferredExactSlots：20260804000002 加的 20 個「寫死字串」候選時段。真實
--      時段現在存在 sessions.slot_options，後台改時段後前台會自動跟上；留著這份
--      靜態複本只會兩邊不同步。（送出時仍以同名 key 記錄使用者勾選的可讀標籤。）
--    preferredSlots：更早的靜態時段欄位，前台一直被真場次欄位取代，形同死欄位。
--    registerMonth：選 5–8 月的下拉。月份現在由勾選的確切時段本身決定，而且
--      5–8 月已經是過去式，留著會讓人選到不存在的月份。
-- ---------------------------------------------------------------------------
update public.form_schemas fs
set fields = (
      select coalesce(jsonb_agg(field order by ordinality), '[]'::jsonb)
      from jsonb_array_elements(fs.fields) with ordinality as t(field, ordinality)
      where field ->> 'key' not in ('preferredExactSlots', 'preferredSlots', 'registerMonth')
    ),
    updated_at = now()
from public.projects p
where p.slug = 'navigator'
  and fs.project_id = p.id
  and fs.fields @> '[{"key":"registerMonth"}]'::jsonb;

-- ---------------------------------------------------------------------------
-- 3. 5–8 月既有場次補進資料庫（狀態 done）
--
--    這四場實際上已經辦過，但從來只存在於前台手寫的活動卡裡，資料庫沒有對應
--    的列，所以「已完成月份」查不到任何東西。日期與時間取自站上原本公開的
--    場次卡內容。booked_count 一律填 0：這是補建的歷史紀錄，不是報名資料。
-- ---------------------------------------------------------------------------
insert into public.sessions (project_id, title, starts_at, ends_at, capacity, booked_count, status, quota_group, admin_note)
select p.id, v.title, v.starts_at, v.ends_at, 1, 0, 'done', v.quota_group,
       '2026-08-04 補建：本場實際已辦理，原本只存在於前台手寫場次卡，補進資料庫供活動軌跡顯示。'
from public.projects p
cross join (values
  ('【5月場】ADHD 導航計畫', timestamptz '2026-05-09 20:00+08', timestamptz '2026-05-09 21:00+08', 'navigator-2026-05'),
  ('【6月場】ADHD 導航計畫', timestamptz '2026-06-08 20:00+08', timestamptz '2026-06-08 21:00+08', 'navigator-2026-06'),
  ('【7月場】ADHD 導航計畫', timestamptz '2026-07-11 20:00+08', timestamptz '2026-07-11 21:00+08', 'navigator-2026-07'),
  ('【8月場】ADHD 導航計畫', timestamptz '2026-08-03 20:00+08', timestamptz '2026-08-03 21:00+08', 'navigator-2026-08')
) as v(title, starts_at, ends_at, quota_group)
where p.slug = 'navigator'
  and not exists (
    select 1 from public.sessions s
    where s.project_id = p.id and s.quota_group = v.quota_group
  );
