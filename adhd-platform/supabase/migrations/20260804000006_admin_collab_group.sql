-- ============================================================================
-- 常用聯絡人的類群歸屬（2026-08-04）
--
-- 使用者指定：團隊成員中的行政夥伴入「行政協作」群；系統擁有者（預設寄件人）
-- 不入任何群——群發名單裡不需要有自己。
--
-- ⚠ 本檔刻意**不寫入任何姓名或信箱**：改以私密種子（20260804000004，gitignored）
--    已設定的 tags 精準定位，讓這段歸屬邏輯可以安全進 Git。
--      tags 含「團隊」且不含「負責人」＝行政夥伴
--      tags 含「負責人」＝系統擁有者，不歸群
--
-- 冪等：可重複執行。
-- ============================================================================

insert into public.contact_group_members (group_id, contact_id, source)
select g.id, c.id, 'manual'
from public.contact_groups g
join public.contacts c
  on c.is_favorite
 and c.tags @> array['團隊']::text[]
 and not (c.tags @> array['負責人']::text[])
where g.key = 'admin_collab'
on conflict (group_id, contact_id) do nothing;
