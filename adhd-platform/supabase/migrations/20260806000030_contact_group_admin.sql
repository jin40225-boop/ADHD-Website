-- ============================================================================
-- 自訂聯絡人類群：建立／刪除的稽核，與系統類群的資料庫層保護（2026-08-06）
--
-- 背景：`contact_groups` 從 Phase 1 就存在且有 `is_system` 欄位，但前端只有讀取。
--   使用者無法自建類群（例如講師群），群發因此只選得到三個系統自動維護的報名者類群——
--   全是真人，既無法安全驗收，也支援不了實際的群發需求。
--
-- 這支補兩件事：
--
--   1. **稽核**：成員增刪早就有 trigger（`trg_contact_group_members_audit`），但「類群本身
--      被建立／改名／刪除」沒有任何紀錄。類群是群發的收件範圍，改一個類群的名字或刪掉它，
--      影響的是「信會寄給誰」，那必須留下是誰在什麼時候做的。
--
--   2. **系統類群保護**：`is_system = true` 的三個類群由 `sync_registration_contact_group`
--      自動維護，改名或刪除會讓自動歸群寫進一個語意已經不同、或根本不存在的類群。
--      **這道保護放在資料庫而不是只放在 UI**：UI 擋得住按鈕，擋不住直接打 PostgREST，
--      而擋不住的那條路正是出事時沒有人看著的那條。
--
-- 純新增：不改既有 policy、不動既有資料，對現行行為零影響。
-- 冪等：可重複執行。
-- ============================================================================

-- 1. 系統類群不得改名、不得刪除 ---------------------------------------------
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

  -- 改名與換 key 都等於換掉一個自動歸群目標；成員與說明仍可調整。
  if old.is_system then
    if new.name is distinct from old.name then
      raise exception '系統類群「%」不可改名。', old.name using errcode = 'check_violation';
    end if;
    if new.key is distinct from old.key then
      raise exception '系統類群「%」不可變更 key。', old.name using errcode = 'check_violation';
    end if;
    if new.is_system is distinct from old.is_system then
      raise exception '不可把系統類群改成自訂類群。' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_contact_groups_protect on public.contact_groups;
create trigger trg_contact_groups_protect
  before update or delete on public.contact_groups
  for each row execute function public.protect_system_contact_group();

-- 2. 建立／改名／刪除入帳 ----------------------------------------------------
-- 只記人工決策：`updated_at` 由 touch trigger 維護，成員增減由成員那支 trigger 記，
-- 這裡只在「類群本身的可辨識欄位」變動時寫一列。
create or replace function public.log_contact_group_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  act text; gid uuid; detail json;
begin
  if tg_op = 'INSERT' then
    act := 'create'; gid := new.id;
    detail := json_build_object('action', act, 'name', new.name, 'key', new.key, 'is_system', new.is_system);
  elsif tg_op = 'DELETE' then
    act := 'delete'; gid := old.id;
    detail := json_build_object('action', act, 'name', old.name, 'key', old.key);
  else
    if new.name is not distinct from old.name and new.description is not distinct from old.description then
      return new;
    end if;
    act := 'update'; gid := new.id;
    detail := json_build_object('action', act, 'name_before', old.name, 'name_after', new.name,
      'description_changed', (new.description is distinct from old.description));
  end if;

  insert into public.audit_log (action, actor_id, target_type, target_id, result, detail)
  values ('contact_group_change', auth.uid(), 'contact_group', gid::text, 'success', detail::text);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_contact_groups_audit on public.contact_groups;
create trigger trg_contact_groups_audit
  after insert or update or delete on public.contact_groups
  for each row execute function public.log_contact_group_change();
