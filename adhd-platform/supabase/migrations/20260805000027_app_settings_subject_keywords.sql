-- 第四條收信規則：主旨關鍵字。
--
-- 前三條是「篩子」——它們只能在候選名單裡放行，而候選名單只有三個來源（history 的新活動、
-- 最新幾百封、指定標籤）。使用者四到七月與家長的往來早被幾千封廣告推到窗口之外，
-- 從來沒成為候選，規則連放行的機會都沒有：56 個已知信箱裡有 46 個一封往來都沒收到。
-- 垃圾進得來是因為它新，真信進不來是因為它舊。
--
-- 所以除了改成主動搜尋（見 gmail-sync），再加一條可設定的主旨關鍵字規則。
--
-- 預設不含 add／ADD：Gmail 搜尋不分大小寫，`subject:add` 會命中 Add／Added／Address，
-- 廣告信大量中獎，等於把剛趕走的雜訊請回來。要加的話從設定頁自己加。
--
-- 純新增：一個 jsonb 欄位，不動任何既有資料列。
alter table public.app_settings
  add column if not exists sync_subject_keywords jsonb not null default '["ADHD", "過動", "大A彥宇"]'::jsonb;

comment on column public.app_settings.sync_subject_keywords is
  'gmail-sync 第四條收信規則：主旨含其中任一關鍵字就收（Gmail 搜尋不分大小寫）。空陣列＝不啟用。';
