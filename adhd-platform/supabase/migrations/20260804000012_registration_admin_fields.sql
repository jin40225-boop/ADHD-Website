-- Phase 3-1 資料層：後台報名表格（03_v4）需要、但 registrations 沒有的三個行政欄位。
--
-- 三欄都是「行政端填的」，因此比照 priority／next_action_at 做成獨立欄位，
-- 不塞進 answers——answers 是報名者自己填的內容，兩者混在一起會分不清誰寫的。
--
-- 註：狀態新值 `reschedule`（待改訂時間）不需要 migration。registrations.status
-- 是無 check constraint 的 text，且 admin_transition_registration 的釋額清單是
-- rejected/cancelled/withdrawn/canceled——不含 reschedule，所以「待改訂時間」
-- 會保留名額，正是這個狀態該有的語意。

alter table public.registrations
  -- 03_v4 的「☑ 已寄信提醒」。存時間戳而非布林：有值＝已勾，同時記得是何時寄的。
  -- send-email-v2 寄出時寫入 now()（計畫第五節），後台手動勾／取消勾則寫 now()／null。
  add column reminder_sent_at timestamptz,
  -- 03_v4 的「◉ 諮商師回覆確認」三值：null＝—（未回覆）、true＝yes、false＝no。
  add column counselor_confirmed boolean,
  -- 03_v4 的「✅ 最終確定時段」。導航計畫專用：報名者勾多個候選時段，行政端在詳情
  -- 抽屜挑定一個並微調成確切日期時間。結束時間由建行事曆時以「開始＋60 分」計算
  -- （現有候選時段全為 1 小時），因此這裡只存開始時間。
  add column final_slot_at timestamptz;

comment on column public.registrations.reminder_sent_at is '已寄信提醒的寄出時間；null 表示尚未寄送。';
comment on column public.registrations.counselor_confirmed is '諮商師回覆確認：null 未回覆、true 可、false 不可。';
comment on column public.registrations.final_slot_at is '導航計畫最終確定時段的開始時間（結束＝開始＋60 分）。';
