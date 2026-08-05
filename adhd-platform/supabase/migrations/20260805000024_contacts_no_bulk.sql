-- 「不接收群發」旗標。
--
-- 報名者類群的成員資格刻意不看報名狀態（見 023）：狀態會變——被退回的人下個月可能再報名——
-- 加上狀態過濾會讓類群成員一直跳動，而「曾經報名過的人」是穩定的定義。
--
-- 但「這個人不想收群發」是完全不同的一件事，而且不該綁在報名狀態上：報名狀態一變，
-- 用它推導出來的意願就跟著失效，然後信就寄出去了。意願要記在人身上。
--
-- 純新增：一個 not null default false 的欄位，既有列全部視為「照常接收」，不改任何資料。
alter table public.contacts
  add column if not exists no_bulk_email boolean not null default false;

comment on column public.contacts.no_bulk_email is
  '這個人不接收群發。一對一往來不受影響——退出群發不等於斷絕聯絡。';
