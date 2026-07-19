-- 場次公開欄位隔離（2026-07-19）
-- 背景：anon 原可直讀 sessions 全欄位（含 meet_url、calendar_event_id）。
-- 目前場次的 Meet 連結本就公開，無實害；但為未來非公開場次預留防線：
--   1. 新增 sessions_public view，只含前台需要的安全欄位、限公開專案；
--      view owner 為 postgres（繞過 RLS），以 security_barrier 防謂詞下推洩漏。
--   2. sessions 本表移除 anon 讀取（policy 重建為 authenticated-only ＋ revoke）。
-- 冪等：可重複執行。

create or replace view public.sessions_public
with (security_barrier) as
  select s.id, s.project_id, s.title, s.starts_at, s.ends_at,
         s.capacity, s.booked_count, s.status
  from public.sessions s
  where exists (
    select 1 from public.projects p
    where p.id = s.project_id and p.is_public
  );

grant select on public.sessions_public to anon, authenticated;

drop policy if exists sessions_select on public.sessions;
create policy sessions_select on public.sessions
  for select to authenticated
  using (
    exists (select 1 from public.projects p where p.id = project_id and p.is_public)
    or public.is_project_member(project_id, auth.uid())
    or public.is_system_owner(auth.uid()));

revoke select on public.sessions from anon;
