-- ============================================================================
-- ADHD 專管系統：推薦資料庫個資清理（user 裁示 2026-07-14：清理後上線）
-- rec-105：urls 欄含個人 email 偽裝的壞網址 → 清空。
-- rec-135：整筆為創業團隊自薦訊息（含聯絡電話/email），非就醫推薦 → 下架刪除，
--          日後如要收錄改走投稿審核流程。
-- 與 src/data/recommendations.json、0003 種子檔（已重新產生為 134 筆）同步。
-- ============================================================================

update public.recommendations set urls = '{}'::text[] where id = 'rec-105';

delete from public.recommendations where id = 'rec-135';
