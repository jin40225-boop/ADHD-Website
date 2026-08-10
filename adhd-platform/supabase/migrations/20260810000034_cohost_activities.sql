-- ============================================================================
-- 協辦活動綜合專欄的基礎建設（2026-08-10）
--
-- 依據：新增「協辦活動」板塊——收錄大A彥宇個人與大A團隊和各單位合作的場次。
--       報名一律在主辦單位的表單完成，本站不受理報名、不保留名額。
--
-- 為什麼是 activity 而不是 project：這個專欄會一直長大（第三、第四個合作案），
--       而後台**沒有新增 project 的介面**（RLS 只開給系統擁有者），卻**有**
--       「＋新增活動」。把每個合作案做成一筆 activity，使用者才能自己新增，
--       不必每次都寫一支 migration。
--
-- 為什麼合作資訊放 activity 層而不是 session 層：赤子心是「一張報名表單涵蓋
--       三場」（可單堂報名、表單內勾選場次），父親權益協會是一張表單一場。
--       放 activity 層，同一個合作案日後再加場次會自動繼承，不必重貼。
--
-- 冪等：可重複執行。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. 合作資訊欄位
--
-- 單一 jsonb 而非五個 text 欄：這五樣是同一件事的五個面向，一起被填、一起被
-- 改、一起顯示；拆成五欄要寫五條稽核枚舉，而它們永遠一起變動，分開記沒有資訊量。
-- ----------------------------------------------------------------------------
alter table public.activities
  add column if not exists cohost_info jsonb;

comment on column public.activities.cohost_info is
  '協辦活動的合作資訊。鍵：partner（主辦單位）、myRole（我方角色）、formUrl（對方報名表單網址）、infoUrl（對方活動介紹頁，選填）、note（對方公布的報名資訊自由文字，選填）。留空＝非協辦活動，前台不顯示外部報名。';

-- ----------------------------------------------------------------------------
-- 2. activities 的匿名公開面
--
-- activities 原本只有 authenticated 的 select policy（20260723000001:175-176），
-- 匿名前台讀不到。比照 sessions_public 開一個只含安全欄位的 view。
--
-- status 過濾刻意**不是**只留 published：活動辦完後會被改成 completed，若 view
-- 只放 published，活動軌跡上掛的合作單位資訊會在改狀態的那一刻無聲消失。
-- 要擋的只有 draft（還沒寫完）與 cancelled（已取消）。
--
-- 不使用 security_invoker：activities 對 anon 沒有任何 policy，這個 view 必須以
-- owner 權限執行（與 sessions_public 同款），**下面的 where 子句就是唯一的門**。
-- ----------------------------------------------------------------------------
create or replace view public.activities_public
with (security_barrier) as
  select a.id, a.project_id, a.name, a.status, a.public_summary,
         a.starts_at, a.ends_at, a.cohost_info
  from public.activities a
  where a.status in ('published', 'closed', 'completed')
    and a.archived_at is null
    and exists (
      select 1 from public.projects p
      where p.id = a.project_id and p.is_public
    );
grant select on public.activities_public to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. sessions_public 追加 activity_id
--
-- 前台要能把場次掛回它所屬的合作案。欄位清單逐字照抄 20260810000033 版本，
-- 只在尾端追加，不更動既有欄位名稱／型別／順序（create or replace view 不允許
-- 刪欄或改型，尾端追加是唯一安全的演進方式）。
-- ----------------------------------------------------------------------------
create or replace view public.sessions_public
with (security_barrier) as
  select s.id, s.project_id, s.title, s.starts_at, s.ends_at,
         s.capacity, s.booked_count, s.status,
         s.registration_deadline, s.slot_options, s.quota_group,
         s.topic, s.guest, s.description, s.activity_id
  from public.sessions s
  where exists (
    select 1 from public.projects p
    where p.id = s.project_id and p.is_public
  );
grant select on public.sessions_public to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. activities 稽核
--
-- activities 至今只有 adhd_touch_updated_at，沒有任何軌跡（20260723000001:173）。
-- 現在它多了一個「後台可自由輸入、匿名前台看得見」的欄位，依專案既有紀律
-- （20260810000033 對 description 的論證）必須補上，且與欄位同一支 migration，
-- 讓稽核早於會寫入的 UI 上線。
--
-- cohost_info 記完整舊值與新值：這一欄的內容本來就會公開顯示、不是機密，而軌跡
-- 的價值正在於看得出「被改掉的那個報名表單網址，原本指到哪裡」——表單連結被誤改
-- 或被惡意改成別的表單，是這個板塊最實際的風險，沒有舊值的稽核等於沒有稽核。
-- jsonb 整包記即可，不必逐 key 拆：這五個鍵本來就一起被編輯、一起送出。
--
-- 只做 update 稽核，與 sessions 對齊（新建活動本身不含公開文字風險，
-- 而刪除走 archived_at 軟刪除，會被 archived_at 那一條記到）。
-- ----------------------------------------------------------------------------
create or replace function public.log_activity_admin_edit()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  changed jsonb := '{}'::jsonb;
begin
  if new.name is distinct from old.name then
    changed := changed || jsonb_build_object('name', jsonb_build_array(old.name, new.name));
  end if;
  if new.status is distinct from old.status then
    changed := changed || jsonb_build_object('status', jsonb_build_array(old.status, new.status));
  end if;
  if new.public_summary is distinct from old.public_summary then
    changed := changed || jsonb_build_object('public_summary', jsonb_build_array(old.public_summary, new.public_summary));
  end if;
  if new.starts_at is distinct from old.starts_at then
    changed := changed || jsonb_build_object('starts_at', jsonb_build_array(old.starts_at, new.starts_at));
  end if;
  if new.ends_at is distinct from old.ends_at then
    changed := changed || jsonb_build_object('ends_at', jsonb_build_array(old.ends_at, new.ends_at));
  end if;
  if new.cohost_info is distinct from old.cohost_info then
    changed := changed || jsonb_build_object('cohost_info', jsonb_build_array(old.cohost_info, new.cohost_info));
  end if;
  if new.archived_at is distinct from old.archived_at then
    changed := changed || jsonb_build_object('archived_at', jsonb_build_array(old.archived_at, new.archived_at));
  end if;

  if changed = '{}'::jsonb then return new; end if;

  insert into public.audit_log (action, actor_id, target_type, target_id, result, detail)
  values ('activity_admin_edit', auth.uid(), 'activity', new.id::text, 'success', changed::text);
  return new;
end;
$$;

drop trigger if exists trg_activities_admin_audit on public.activities;
create trigger trg_activities_admin_audit
  after update on public.activities
  for each row execute function public.log_activity_admin_edit();

-- ----------------------------------------------------------------------------
-- 5. 協辦活動專案
--
-- type 只能是 'course' | 'appointment'（core_schema.sql:133 的 check），沿用
-- 'course'，不新增類型——全站沒有任何邏輯用 type 分支，改約束換不到任何行為。
--
-- description 刻意寫明「報名由主辦單位受理」：MCP Edge Function 的 list_services
-- 會自動列出所有 is_public 專案（mcp/index.ts:183），接了 gpt-tools 的 AI 會讀到
-- 這一句。沒有它，AI 會拿 capacity 0 算出「已額滿」並對外這樣說。
--
-- 固定 UUID 沿用 20260712000002 的慣例（尾碼流水號），方便腳本引用。
-- ----------------------------------------------------------------------------
insert into public.projects (id, name, type, slug, description, is_public) values
  ('a1000000-0000-4000-8000-000000000004',
   '協辦活動', 'course', 'co-host',
   '大A彥宇個人與大A團隊和各單位合作的講座、座談與活動。報名一律由主辦單位受理，本站不受理報名、不保留名額，名額與細節以主辦單位公告為準。', true)
on conflict (id) do nothing;
