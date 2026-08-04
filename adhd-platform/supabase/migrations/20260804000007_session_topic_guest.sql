-- ============================================================================
-- 場次主題與客座來賓欄位（2026-08-04 Phase 2）
--
-- 依據：裁決 3——同儕聚會「未公布來賓/主題顯示『神秘驚喜！』」。
-- 作法：把主題與來賓做成真欄位而非以標題文字猜測。後台填了就顯示，
--       留空則前台自動顯示「神秘驚喜！」。這樣「公布主題」是一個真的動作。
--
-- 冪等：可重複執行。
-- ============================================================================

alter table public.sessions
  add column if not exists topic text,
  add column if not exists guest text;

comment on column public.sessions.topic is '本場主題。留空時前台顯示「神秘驚喜！」。';
comment on column public.sessions.guest is '本場客座來賓。留空時前台顯示「神秘驚喜！」。';

-- 回填已完成的同儕聚會歷史場次（公開資訊，非個資）
update public.sessions s
set topic = v.topic, guest = v.guest
from public.projects p, (values
  ('2026-03-14'::date, '聊聊理財這件事：從經驗分享到專業建議',        '博那 Bona'),
  ('2026-04-18'::date, '營養品怎麼選？成為自己的健康管理師',          '食品「魏」管師'),
  ('2026-05-23'::date, '尋找心靈的平靜：多元的調適與自我照顧',        '鏡子（心理自我照顧）'),
  ('2026-06-06'::date, '握緊方向盤的自信：行車安全與駕駛經驗',        '傑夫（私人駕訓教練）'),
  ('2026-07-18'::date, '釋放你的創意靈魂：創作不僅是專業，更是樂趣',  'Vtuber 殷緋')
) as v(day, topic, guest)
where p.id = s.project_id
  and p.slug = 'peer-group'
  and (s.starts_at at time zone 'Asia/Taipei')::date = v.day
  and s.topic is null
  and s.title not like '%測試%';

-- sessions_public 追加兩個欄位（仍不外流 meet_url／calendar_event_id）
create or replace view public.sessions_public
with (security_barrier) as
  select s.id, s.project_id, s.title, s.starts_at, s.ends_at,
         s.capacity, s.booked_count, s.status,
         s.registration_deadline, s.slot_options, s.quota_group,
         s.topic, s.guest
  from public.sessions s
  where exists (
    select 1 from public.projects p
    where p.id = s.project_id and p.is_public
  );
grant select on public.sessions_public to anon, authenticated;
