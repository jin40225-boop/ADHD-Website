-- 同步標籤改成可複選。
--
-- 三條收信規則本來就是聯集（符合任一條就收），標籤那條沒有理由是單選。使用者的信箱有 52 個
-- 標籤，光名字含 ADHD 的就有三個——今天已經因為「兩個名字很像的標籤選錯一個」白跑一輪驗收：
-- 設定選了「ADHD重要訊息」，測試信貼的是「ADHD相關資訊」，於是被正確地略過。程式沒錯，是只能選一個。
--
-- 純新增，且**不動也不刪** `sync_label_id`：新欄位為空時讀取邏輯會退回舊欄位，
-- 所以套用這支之後、使用者重新勾選之前，行為與現在完全相同。
alter table public.app_settings
  add column if not exists sync_label_ids jsonb not null default '[]'::jsonb;

comment on column public.app_settings.sync_label_ids is
  'gmail-sync 第三條收信規則的 Gmail 標籤 id 清單（任一符合就收）。空陣列時退回舊的單選欄位 sync_label_id。';
