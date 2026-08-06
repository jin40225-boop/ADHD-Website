-- ============================================================================
-- 補 030 的漏洞：`is_system` 旗標的檢查改為無條件（2026-08-06）
--
-- 030 把整段 is_system 檢查包在 `if old.is_system then` 裡面，於是只擋一個方向：
--
--   系統類群 → 自訂：擋住 ✅
--   自訂類群 → 系統：沒擋 ⚠️
--
-- 後果是死結。某個自訂類群一旦被設成 `is_system = true`，它就受保護了——
-- 之後想改回自訂會被擋（那時 `old.is_system` 已經是 true），想刪也被擋，
-- 永遠卡在那裡，只能再下一支 migration 才解得開。
--
-- 這條路徑需要刻意直接打 PostgREST 才踩得到（前端沒有設定 is_system 的入口），
-- 所以 030 先套用、這支隨後補——完全沒有保護的風險，遠大於這個要刻意繞路才碰得到的漏洞。
--
-- 純修正：只重寫函式本體，trigger 不動（`create or replace` 後既有 trigger 直接套用新版）。
-- 冪等：可重複執行。
-- ============================================================================

create or replace function public.protect_system_contact_group()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_system then
      raise exception '系統類群「%」由報名流程自動維護，不可刪除。', old.name
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  -- 旗標本身無條件受保護：兩個方向都擋。往上（自訂→系統）若不擋，那個類群會把自己
  -- 鎖進一個改不回來也刪不掉的狀態；往下（系統→自訂）不擋，則等於保護可以自己解除。
  if new.is_system is distinct from old.is_system then
    raise exception '不可變更類群的系統旗標。' using errcode = 'check_violation';
  end if;

  -- 改名與換 key 都等於換掉一個自動歸群目標；成員與說明仍可調整。
  if old.is_system then
    if new.name is distinct from old.name then
      raise exception '系統類群「%」不可改名。', old.name using errcode = 'check_violation';
    end if;
    if new.key is distinct from old.key then
      raise exception '系統類群「%」不可變更 key。', old.name using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
