-- 範本行為改由欄位決定，不再由名稱猜。
--
-- 撰寫面板原本用 name.includes('催覆'/'出席確認'/'回絕') 決定「這是不是催覆信」與
-- 「要不要附出席確認按鈕」。範本剛改過名（確認時段→確認信・導航版、報名成功通知→
-- 確認信・親職版、確認信→收件通知），名稱判斷因此會判錯——例如「收件通知」在舊規則下
-- 不含「回絕」，就會被附上出席確認按鈕。名稱是給人看的，改名不該改變寄信行為。
--
-- 純新增：只加一個 nullable 欄位，不動任何既有資料列。欄位為 null 時前端退回名稱判斷
-- （見 emailCompose.letterKindOf），所以套用這支之後、標好類型之前，行為與現在相同。
--
-- 六種類型：
--   confirm    確認信——要對方回覆出席與否，附確認按鈕
--   follow_up  催覆信——同上，且寄出後狀態轉「已催覆」、信末帶回覆期限
--   notice     收件通知／聯繫信——單向告知，不需要對方按什麼
--   bulk       群發用（宣傳、月報）——不對單一報名，不動狀態
--   instructor 講師行前、客座邀請——對象不是報名者
--   reject     回絕／婉拒
alter table public.email_templates
  add column if not exists letter_kind text
    check (letter_kind in ('confirm', 'follow_up', 'notice', 'bulk', 'instructor', 'reject'));

comment on column public.email_templates.letter_kind is
  '信件類型，決定撰寫面板的寄信行為；null 時前端退回以範本名稱判斷。';
