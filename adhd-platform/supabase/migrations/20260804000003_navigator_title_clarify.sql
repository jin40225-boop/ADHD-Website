-- ============================================================================
-- 導航計畫場次標題補述（2026-08-04）
--
-- 問題：導航每月 1 筆 session 的 starts_at／ends_at 是「該月候選時段窗口」（最早起
--   ~ 最晚迄），跨日。現行 RegisterPage 的 formatSlot 會把它 render 成
--   「2026/09/12 20:00–10:00」，看起來像同一天 20:00 到 10:00，容易誤解。
--
-- 處置：在標題補上說明，讓現行頁面自我解釋；Phase 2 新版導航報名頁會改為直接讀
--   slot_options 逐一顯示確切時段，屆時本補述可移除。
--
-- 冪等：可重複執行。
-- ============================================================================

update public.sessions s
set title = s.title || '（每月 1 位・確切時段另行確認）'
from public.projects p
where p.id = s.project_id
  and p.slug = 'navigator'
  and s.quota_group is not null
  and s.title not like '%確切時段另行確認%';
