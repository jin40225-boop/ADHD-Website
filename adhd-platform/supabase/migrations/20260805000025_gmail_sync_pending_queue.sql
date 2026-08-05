-- 同步的續傳游標。
--
-- 一次執行把 16 封信整套做完（逐封抓 format=full、解析、附件下載再上傳）就把 worker 撐爆了：
--   Function failed due to not having enough compute resources
-- 背景執行只解決「客戶端等不了」，沒有解決「單次工作量太大」。兩件事要分開處理：
-- 工作量靠這個佇列切小，每次只做固定筆數，剩下的留在這裡等下一批。
--
-- 存的是 Gmail message id（Gmail 自己的識別碼），不是信件內容——這張表本來就只存同步狀態。
--
-- 純新增：一個 not null default '[]' 的欄位，既有那一列自動得到空佇列，不改任何資料。
alter table public.gmail_sync_state
  add column if not exists pending_message_ids jsonb not null default '[]'::jsonb;

comment on column public.gmail_sync_state.pending_message_ids is
  '已通過收信範圍比對、但還沒抓完整內容的 Gmail message id 佇列。每批處理固定筆數，剩下的留在這裡續傳。';
