-- gmail-sync 收信範圍的第三條規則：使用者指定的 Gmail 標籤。
--
-- 前兩條規則（對方信箱命中報名／聯絡人、threadId 已在 email_threads）涵蓋不到「用系統不認得的
-- 信箱寄來的家長信或邀約信」——那種信第一次出現時系統還不認得寄件人。使用者在 Gmail 手動貼上
-- 標籤，系統下次同步就把那封信收進來並可關聯。這是嚴格比對的人工救援管道。
--
-- **存 label id，不存標籤名稱。** Gmail 的標籤改名時 id 不變；比對名稱的話，使用者哪天把
-- 「ADHD」改成「ADHD 專案」，第三條規則就在那一刻安靜失效，而畫面上完全看不出來。
-- 名稱只在設定頁顯示，由 gmail-labels 當場向 Gmail 問，不落地——落地的名稱一樣會過期。
--
-- 純新增：一個 nullable 欄位，不動任何既有資料列。null／空字串＝第三條規則不啟用，
-- 只靠前兩條收信。
alter table public.app_settings
  add column if not exists sync_label_id text;

comment on column public.app_settings.sync_label_id is
  'gmail-sync 第三條收信規則：帶有這個 Gmail 標籤 id 的信一律收進來。留空＝不啟用。存 id 不存名稱，改名不影響。';
