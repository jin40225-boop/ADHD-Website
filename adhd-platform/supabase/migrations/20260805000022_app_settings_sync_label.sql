-- gmail-sync 收信範圍的第三條規則：指定的 Gmail 標籤。
--
-- 前兩條規則（對方信箱命中報名／聯絡人、threadId 已在 email_threads）涵蓋不到「陌生信箱寄來的
-- 家長信或邀約信」——那種信第一次出現時系統還不認得寄件人。使用者在 Gmail 手動貼上這個標籤，
-- 下次同步就會收進來。標籤名稱存在這裡而不是寫死，因為那是使用者在自己信箱裡取的名字。
--
-- 純新增：一個 nullable 欄位，不動任何既有資料列。null／空字串＝第三條規則不啟用，
-- 只靠前兩條收信（gmail-sync 會照常運作，只是標籤那條不生效）。
alter table public.app_settings
  add column if not exists sync_label text;

comment on column public.app_settings.sync_label is
  'gmail-sync 第三條收信規則：帶有這個 Gmail 標籤的信一律收進來。留空＝不啟用。';
