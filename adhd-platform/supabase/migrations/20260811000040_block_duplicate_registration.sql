-- ============================================================================
-- 資料庫層擋下「同人同場次」重複報名（2026-08-11）
--
-- 背景：前台報名表單被同一人連點三次送出，產生三筆一模一樣的報名
--       （同信箱、同話題、同樣佔 2 個時段）。真因有二：
--         1. 確認頁送出鈕的 disabled prop 前端沒接、handleSubmit 也沒有
--            in-flight 防護（見 src/routes/RegisterPage.tsx 的對應修正）。
--         2. registrations 表本身沒有任何重複約束——Edge Function 只有
--            每信箱 5 次的 rate limit，擋不住短時間內的 3 次連點。
--       前端防連點只能防「同一次操作」，防不了使用者隔幾分鐘手動重送；
--       這裡補的是資料庫層最後一道防線。
--
-- 判準：同 project_id ＋ lower(trim(email)) 相同 ＋ session_ids && new.session_ids
--       （陣列有交集）＋ 既有那筆的 status 不在終態 → 拒絕。
--
-- 為什麼用陣列交集，不是「同人同專案就擋」：
--       互助聚會一個人參加很多場是正常行為（MULTI_SESSION_SLUGS 已把這件事
--       寫進系統），同專案內合法的多筆報名很常見。交集語意天然相容：
--       報不同場＝交集空＝放行；同場重報＝被擋。取消後重報也放行（舊筆已終態）。
--
-- 四個實作細節：
--   1. lower(trim()) 兩側都要正規化：Edge Function 的新報名會 trim+lower
--      （見 supabase/functions/submit-registration/index.ts），但歷史匯入
--      腳本只 trim() 沒小寫，不兩側正規化會漏判同一人的大小寫變體。
--   2. 空陣列要短路：new.session_ids 為 null 或 array_length(...,1) is null
--      （例如導航計畫等情況）直接 return new，不去賭 && 對空陣列的行為。
--   3. 錯誤訊息要能自救：同儕報名表的場次欄是匿名的 multiselect、會列出
--      所有 open 場次，老手很可能把已報過的和想加報的一起勾。整筆被擋卻
--      不告訴他是哪幾場重疊，他無從自救——所以把重疊場次的日期標籤
--      （Asia/Taipei、MM/DD，多場以「、」串接）帶進錯誤訊息。
--   4. 命名 trg_registration_block_duplicate：Postgres 同時點的 BEFORE
--      trigger 依名稱字母序執行，這個名字排在
--      trg_registration_block_external < trg_registration_capacity <
--      trg_registration_contact 之前，被擋的插入連名額都還沒扣、
--      聯絡人也還沒建，零殘跡。
--
-- ⚠ 終態清單目前有三處，改一份要同步另外兩份：
--   1. 本觸發器（下方 lower(status) not in (...)）
--   2. admin_transition_registration 的 should_release
--      （supabase/migrations/20260810000039_seat_policy_on_confirm.sql）
--   3. src/admin/operations/emailCompose.ts 的 NON_ATTENDING_STATUS
--
-- 冪等：可重複執行。
-- ============================================================================

create or replace function public.block_duplicate_registration()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_email text;
  v_exists boolean;
  v_labels text;
begin
  if new.session_ids is null or array_length(new.session_ids, 1) is null then
    return new;
  end if;

  v_email := lower(trim(new.email));

  select exists (
    select 1
    from public.registrations r
    where r.project_id = new.project_id
      and lower(trim(r.email)) = v_email
      and lower(r.status) not in ('rejected', 'withdrawn', 'cancelled', 'canceled')
      and r.session_ids && new.session_ids
  ) into v_exists;

  if not v_exists then
    return new;
  end if;

  select string_agg(to_char(s.starts_at at time zone 'Asia/Taipei', 'MM/DD'), '、' order by s.starts_at)
    into v_labels
  from public.sessions s
  where s.id = any(new.session_ids)
    and exists (
      select 1
      from public.registrations r
      where r.project_id = new.project_id
        and lower(trim(r.email)) = v_email
        and lower(r.status) not in ('rejected', 'withdrawn', 'cancelled', 'canceled')
        and s.id = any(r.session_ids)
    );

  raise exception 'DUPLICATE_REGISTRATION:%', v_labels using errcode = 'P0001';
end;
$$;

drop trigger if exists trg_registration_block_duplicate on public.registrations;
create trigger trg_registration_block_duplicate
  before insert on public.registrations
  for each row execute function public.block_duplicate_registration();

comment on function public.block_duplicate_registration is
  '擋下同人（lower(trim(email)) 相同）在同專案對同場次（session_ids && 有交集）的重複報名，
既有那筆非終態才擋。不擋「同人不同場」——互助聚會一人多場是正常行為。錯誤訊息帶出重疊場次的
日期標籤供使用者自救。終態清單另兩處：admin_transition_registration 的 should_release、
src/admin/operations/emailCompose.ts 的 NON_ATTENDING_STATUS，改一處要同步。';
