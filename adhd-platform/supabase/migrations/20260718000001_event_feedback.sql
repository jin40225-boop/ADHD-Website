-- ============================================================================
-- 活動回饋單（event_feedback）
-- 民眾活動後留下姓名／信箱／回饋留言；比照 recommendation_submissions 的隱私紀律：
--   公開端（anon）僅能 insert，絕不可 select；讀取／刪除限系統擁有者。
-- 【CLAUDE】2026-07-18
-- ============================================================================

create table public.event_feedback (
  id uuid primary key default gen_random_uuid(),
  -- 選填：對應的活動／場次名稱，讓同一張表單可重複用於不同活動
  event_name text,
  name text not null,
  -- 選填、永不公開；僅供主辦方需要時回覆使用
  email text,
  message text not null,
  created_at timestamptz not null default now()
);
alter table public.event_feedback enable row level security;
create index idx_event_feedback_created on public.event_feedback (created_at desc);

-- 公開投遞：anon 可 insert（基本防呆：姓名與回饋不可為空白），不可回讀
create policy event_feedback_public_insert on public.event_feedback
  for insert to anon, authenticated
  with check (length(btrim(name)) > 0 and length(btrim(message)) > 0);

-- 讀取／刪除：系統擁有者
create policy event_feedback_admin_select on public.event_feedback
  for select to authenticated using (public.is_system_owner(auth.uid()));
create policy event_feedback_admin_delete on public.event_feedback
  for delete to authenticated using (public.is_system_owner(auth.uid()));
