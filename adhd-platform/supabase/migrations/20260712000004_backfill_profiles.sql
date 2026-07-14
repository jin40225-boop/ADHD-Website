-- ============================================================================
-- ADHD 專管系統 K3 修復：回填既有 auth.users 的 profiles
-- 觸發器 adhd_handle_new_user 只對新註冊生效；本專案為「二手」Supabase，
-- user 的帳號建於 2026-06-01（舊實驗），早於 K1 migration → 無 profile 列。
-- 與觸發器同邏輯回填；jin40225@gmail.com 授予系統擁有者。
-- 【CLAUDE 專屬】2026-07-12
-- ============================================================================

insert into public.profiles (id, email, display_name, avatar_url, is_system_owner)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(coalesce(u.email, '使用者'), '@', 1)),
  u.raw_user_meta_data->>'avatar_url',
  lower(coalesce(u.email, '')) = 'jin40225@gmail.com'
from auth.users u
on conflict (id) do nothing;

-- 保險：若 profile 已存在但旗標未設（不影響本次，防未來重跑情境）
update public.profiles
set is_system_owner = true
where lower(email) = 'jin40225@gmail.com' and not is_system_owner;
