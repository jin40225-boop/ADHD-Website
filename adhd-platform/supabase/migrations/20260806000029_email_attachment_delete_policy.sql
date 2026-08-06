-- ============================================================================
-- 收件匣批次刪除：補上附件檔案的 delete 權限（2026-08-06）
--
-- 問題：`email-attachments` 這個 bucket 只有 select policy。刪掉一個信件串時，
--   email_messages／email_attachments 會靠 FK cascade 一起消失，但 storage 裡的
--   實體檔案不會——而且 thread 一旦刪除，物件的讀取條件
--   `can_access_thread(foldername(name)[1])` 就再也不成立，那些檔案同時變成
--   讀不到也刪不掉的孤兒，永遠留在 bucket 裡。裡面裝的正是使用者要清掉的個資
--   （灌進來的私人信件附件）。
--
-- 處置：加一條 delete policy，條件與既有的 select policy 完全相同——能看到那個
--   信件串的人才刪得掉它的附件。前端的 deleteThreads 會先刪檔、再刪列，順序反過來
--   就會製造上述孤兒，該順序已列入 check:operations 守門。
--
-- 這支是純新增：沒有既有 policy 被改寫或移除，對現行行為零影響。
-- 冪等：可重複執行。
-- ============================================================================

drop policy if exists email_attachment_objects_delete on storage.objects;
create policy email_attachment_objects_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'email-attachments'
    and array_length(storage.foldername(name), 1) >= 2
    and public.can_access_thread(((storage.foldername(name))[1])::uuid, (select auth.uid()))
  );
