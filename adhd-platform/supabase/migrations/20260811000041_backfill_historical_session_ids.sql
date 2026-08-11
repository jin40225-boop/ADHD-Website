-- ============================================================================
-- 回填歷史報名的 session_ids（2026-08-11）
--
-- 背景：92 筆歷史匯入報名（K4 Notion 25 筆＋互助聚會 Google 表單 67 筆）匯入時
--   session_ids 一律留空 '{}'，只留在 answers 裡的自由文字（finalSlot／
--   preferredSlots／sessionRefs）供事後人工核對。本檔依核准的對照清單機械回填，
--   不改變任何個資內容、不新增報名筆數。
--
-- 範圍（各段 UPDATE 皆帶 session_ids = '{}' or session_ids is null 條件，
--   冪等，已回填或被人工標過的列自動跳過；筆數對不上就整包回滾）：
--   1. 互助聚會 67 筆——answers.sessionRefs 本身就是真實 session UUID 陣列，逐列
--      讀自己的 JSON 直接轉 session_ids（非硬編碼），回填前先驗證每個 id 都存在
--      且 project_id 相符。
--   2. 補建 4/18 特別加開場（12:00–12:30）——原資料庫沒有對應場次，親職 mapping
--      的第 10 筆需要它，先建再回填。
--   3. 親職 10 筆——以 status='done' ＋ starts_at 精確比對（每個時段斷言恰一場）。
--   4. 親職另 2 筆使用者核准的退回件（皆無 finalSlot、preferredSlots 只有單一候選
--      時段）——比照直接採用該候選時段。
--   5. 導航計畫 7 筆——以 status='done' ＋ 台北時區年月比對（該服務每月僅開 1
--      場，斷言恰一場）；finalSlot 記錄的日期是 Notion 原始候選時段，可能與實際
--      開課日不同，這是預期內——年月才是對應依據，不是逐分鐘比對。
--
-- 不動：2025 年那 5 筆（migrationSource 含「2025家長諮詢服務報名表」）——2025 年
--   場次待另案補建後再處理。K4 另有 1 筆（preferredSlots 4 個候選時段、無
--   finalSlot）無法唯一判定目標場次，本輪不動，留待人工決定。
--
-- 名額裁決（使用者已核准）：回填一併蓋 capacity_released_at（用 coalesce，不覆蓋
--   既有時間戳），booked_count 一律不動。理由：這些場次全部 status='done'，後台
--   兩個名額警告（RegistrationsOperationsPage 的 seatAudit.mismatch／overHeld）都只
--   統計 capacity_released_at 為空的列——這些歷史列 session_ids 原本是 '{}'，
--   本來就不會被計入 claimed／held，回填後蓋上 capacity_released_at 讓它們被明確
--   排除在外，數字不變、且如實反映「名額已不佔用」。不可補回 booked_count，否則
--   兩邊都會失衡。
--
-- 稽核：回填會觸發 trg_registrations_admin_audit（after update，20260804000013）
--   逐列寫一筆 actor 為空的 registration_admin_edit，86 筆會洗掉稽核頁第一頁的一半。
--   **trigger 全程保持啟用**（使用者 2026-08-11 裁決）：洗版只是觀感，而為了版面
--   乾淨在真實個資紀錄上關掉軌跡是拿紀律換觀感。另補一筆總結列當作閱讀入口。
--
-- admin_transition_registration 修正（缺這段不准上，見下方第 6 節）：回填後這些
--   列的 session_ids 指向已 done 的場次；on_submit 線（親職／互助聚會）只要目標
--   狀態不是退回類就 should_hold=true，若同時 capacity_released_at 已非空
--   （本檔回填後即是），原本邏輯會落到「重新持有名額」分支，其 where 條件要求
--   session status in ('open','full')——done 場次必然 not found，raise
--   SESSION_FULL_OR_CLOSED，後果是這 86 筆歷史報名除了轉退回類以外全部改不動。
--   修法是在該分支前加一個純歷史列短路：should_hold 且已釋額且所有引用場次皆
--   done／cancelled 時，只改狀態、不碰名額。⚠ 不可改成「done 也清
--   capacity_released_at」，那會讓 seatAudit 的 claimed > booked，紅色橫幅誤報。
--
-- 冪等：可重複執行。
-- ============================================================================

begin;

-- 稽核 trigger 全程保持啟用（使用者 2026-08-11 裁決）。
-- 代價：answers 多了 sessionBackfill 這個 key，會產生 86 筆 actor 空白的
-- registration_admin_edit，稽核頁第一頁（每頁 200 筆）會被洗掉一半。
-- 那只是觀感——全 repo 沒有任何功能拿 audit_log 當判準，它只被 AuditPage 顯示。
-- 反過來，為了版面乾淨而在真實個資紀錄上關掉軌跡，是拿紀律換觀感，這條線不開例外。
-- 下方仍額外寫一筆總結紀錄，讓這批變更在稽核頁上有一個講得清楚的入口。

-- ----------------------------------------------------------------------------
-- 1. 互助聚會 67 筆：answers.sessionRefs 直接轉 session_ids
--    前置驗證：每個 sessionRefs 的 id 都必須存在於 sessions 且 project_id 相符，
--    否則整包回滾——session_ids 是陣列沒有 FK 保護，錯 id 會無聲變成「未指定」。
-- ----------------------------------------------------------------------------
do $$
declare
  v_project_id uuid;
  v_bad_count integer;
  v_updated integer;
begin
  select id into v_project_id from public.projects where slug = 'peer-group';
  if v_project_id is null then
    raise exception '找不到 slug=peer-group 的 project，整包回滾。';
  end if;

  select count(*) into v_bad_count
  from public.registrations r
  cross join lateral jsonb_array_elements_text(r.answers -> 'sessionRefs') as ref(session_id)
  where r.project_id = v_project_id
    and r.answers ->> 'migrationSource' = 'google-form:115年度成人ADHD線上互助聚會'
    and not exists (
      select 1 from public.sessions s
      where s.id = ref.session_id::uuid and s.project_id = v_project_id
    );

  if v_bad_count > 0 then
    raise exception '互助聚會 sessionRefs 有 % 筆對不上 sessions（id 不存在或 project_id 不符），整包回滾。', v_bad_count;
  end if;

  update public.registrations r
  set session_ids = (
        select array_agg(x::uuid) from jsonb_array_elements_text(r.answers -> 'sessionRefs') as x
      ),
      capacity_released_at = coalesce(r.capacity_released_at, now())
  where r.project_id = v_project_id
    and r.answers ->> 'migrationSource' = 'google-form:115年度成人ADHD線上互助聚會'
    and (r.session_ids = '{}'::uuid[] or r.session_ids is null);

  get diagnostics v_updated = row_count;
  if v_updated <> 67 then
    raise exception '互助聚會回填筆數應為 67，實際 %，整包回滾。', v_updated;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2. 補建 4/18 特別加開場（12:00–12:30）：原資料庫沒有對應場次，親職 mapping
--    需要它。冪等：以 project + starts_at 判斷是否已存在。
-- ----------------------------------------------------------------------------
insert into public.sessions (project_id, title, starts_at, ends_at, capacity, booked_count, status, admin_note)
select p.id,
       '【ADHD 家長諮詢服務】免費公益線上諮詢 (四月場三・特別加開)',
       timestamptz '2026-04-18 12:00+08',
       timestamptz '2026-04-18 12:30+08',
       1, 0, 'done',
       '2026-08-11 回填歷史報名時發現：K4 Notion 匯入資料中一筆四月家長諮詢報名的 finalSlot 標示為此特別加開時段，原資料庫未建立對應場次，回填 session_ids 前先行補建，供活動軌跡與名額對帳對齊。'
from public.projects p
where p.slug = 'parent'
  and not exists (
    select 1 from public.sessions s
    where s.project_id = p.id and s.starts_at = timestamptz '2026-04-18 12:00+08'
  );

-- ----------------------------------------------------------------------------
-- 3. 親職 10 筆：以 status='done' ＋ starts_at 精確比對（斷言恰一場）
--    機械防呆：strpos(answers::text, evidence) 確保這個 id 的 answers 真的
--    含有該候選時段原文，防對錯人。
-- ----------------------------------------------------------------------------
do $$
declare
  v_project_id uuid;
  v_session_id uuid;
  v_session_count integer;
  v_updated integer;
  v_total integer := 0;
  rec record;
begin
  select id into v_project_id from public.projects where slug = 'parent';
  if v_project_id is null then
    raise exception '找不到 slug=parent 的 project，整包回滾。';
  end if;

  for rec in
    select * from (values
      ('3698b808-4dad-813f-965f-ff669b29976f'::uuid, timestamptz '2026-06-06 09:00+08', '【六月場】6/6（六）09:00'),
      ('35e8b808-4dad-81d7-90f0-d26c854cbdb2'::uuid, timestamptz '2026-05-23 11:00+08', '【五月場】5/23（六）11:00'),
      ('33e8b808-4dad-812d-b5e6-ca52600b79d7'::uuid, timestamptz '2026-05-23 11:00+08', '【五月場】5/23（六）11:00'),
      ('3358b808-4dad-8155-b338-e33ce95f187c'::uuid, timestamptz '2026-04-18 10:00+08', '【四月場】4/18（六）10:00'),
      ('3338b808-4dad-8102-911e-d6517e5c9d46'::uuid, timestamptz '2026-04-18 11:00+08', '【四月場】4/18（六）11:00'),
      ('3308b808-4dad-81f2-9711-c7797b4cd0c6'::uuid, timestamptz '2026-05-23 09:00+08', '【五月場】5/23（六）09:00'),
      ('3308b808-4dad-8150-b816-e9c7d1714dd8'::uuid, timestamptz '2026-05-23 10:00+08', '【五月場】5/23（六）10:00'),
      ('32f8b808-4dad-8161-a2d5-d8853ba0beb5'::uuid, timestamptz '2026-06-06 10:00+08', '【六月場】6/6（六）10:00'),
      ('32f8b808-4dad-81d2-8213-f5e28113512b'::uuid, timestamptz '2026-06-06 11:00+08', '【六月場】6/6（六）11:00'),
      ('32e8b808-4dad-8163-a386-f5c052690d28'::uuid, timestamptz '2026-04-18 12:00+08', '【四月場】4/18（六）12:00')
    ) as t(reg_id, target_starts_at, evidence)
  loop
    select s.id into v_session_id
    from public.sessions s
    where s.project_id = v_project_id and s.status = 'done' and s.starts_at = rec.target_starts_at;

    select count(*) into v_session_count
    from public.sessions s
    where s.project_id = v_project_id and s.status = 'done' and s.starts_at = rec.target_starts_at;

    if v_session_count is distinct from 1 then
      raise exception '親職 % 應恰有 1 場 done 場次，實際 %，回填 % 失敗，整包回滾。', rec.target_starts_at, coalesce(v_session_count, 0), rec.reg_id;
    end if;

    update public.registrations r
    set session_ids = array[v_session_id],
        capacity_released_at = coalesce(r.capacity_released_at, now())
    where r.id = rec.reg_id
      and (r.session_ids = '{}'::uuid[] or r.session_ids is null)
      and strpos(r.answers::text, rec.evidence) > 0;

    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception '親職回填 % 失敗（找不到符合 evidence 的列，或已被回填/手動標記），整包回滾。', rec.reg_id;
    end if;
    v_total := v_total + v_updated;
  end loop;

  if v_total <> 10 then
    raise exception '親職回填總筆數應為 10，實際 %，整包回滾。', v_total;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 4. 親職另 2 筆使用者核准的退回件：無 finalSlot，preferredSlots
--    僅單一候選時段（4/18（六）11:00–12:00），比照直接採用。
-- ----------------------------------------------------------------------------
do $$
declare
  v_project_id uuid;
  v_session_id uuid;
  v_session_count integer;
  v_updated integer;
  v_total integer := 0;
  rec record;
begin
  select id into v_project_id from public.projects where slug = 'parent';

  select s.id into v_session_id
  from public.sessions s
  where s.project_id = v_project_id and s.status = 'done'
    and s.starts_at = timestamptz '2026-04-18 11:00+08';

  select count(*) into v_session_count
  from public.sessions s
  where s.project_id = v_project_id and s.status = 'done'
    and s.starts_at = timestamptz '2026-04-18 11:00+08';

  if v_session_count is distinct from 1 then
    raise exception '親職 2026-04-18 11:00 應恰有 1 場 done 場次，實際 %，整包回滾。', coalesce(v_session_count, 0);
  end if;

  for rec in
    select * from (values
      ('3368b808-4dad-8106-8f6e-cc0ab079e0ed'::uuid, '【四月場】4/18（六）11:00'),
      ('3308b808-4dad-81f0-8307-e6683d224134'::uuid, '【四月場】4/18（六）11:00')
    ) as t(reg_id, evidence)
  loop
    update public.registrations r
    set session_ids = array[v_session_id],
        capacity_released_at = coalesce(r.capacity_released_at, now())
    where r.id = rec.reg_id
      and (r.session_ids = '{}'::uuid[] or r.session_ids is null)
      and strpos(r.answers::text, rec.evidence) > 0;

    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception '核准退回件回填 % 失敗，整包回滾。', rec.reg_id;
    end if;
    v_total := v_total + v_updated;
  end loop;

  if v_total <> 2 then
    raise exception '核准退回件回填總筆數應為 2，實際 %，整包回滾。', v_total;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 5. 導航計畫 7 筆：以 status='done' ＋ 台北時區年月比對（每月僅 1 場，斷言恰一場）
-- ----------------------------------------------------------------------------
do $$
declare
  v_project_id uuid;
  v_session_id uuid;
  v_session_count integer;
  v_updated integer;
  v_total integer := 0;
  rec record;
begin
  select id into v_project_id from public.projects where slug = 'navigator';
  if v_project_id is null then
    raise exception '找不到 slug=navigator 的 project，整包回滾。';
  end if;

  for rec in
    select * from (values
      ('37e8b808-4dad-8153-904b-d0f756ff3847'::uuid, 6, '2026/06/20（六）20:00'),
      ('3688b808-4dad-819d-a41c-c4299c7576e5'::uuid, 8, '2026/08/03（一）20:00'),
      ('3488b808-4dad-8161-84f8-f197c36d6512'::uuid, 7, '2026/07/11（六）20:00'),
      ('3488b808-4dad-81e6-bf84-d9b285070abf'::uuid, 7, '2026/07/11（六）20:00'),
      ('3468b808-4dad-817e-a2c9-c4d1fe96be76'::uuid, 6, '2026/06/13（六）20:00'),
      ('3358b808-4dad-81cd-878f-c45c729dcc6d'::uuid, 5, '2026/05/17（日）09:00'),
      ('3298b808-4dad-814e-bd9d-da7889ac442d'::uuid, 5, '2026/05/09（六）20:00')
    ) as t(reg_id, target_month, evidence)
  loop
    select s.id into v_session_id
    from public.sessions s
    where s.project_id = v_project_id and s.status = 'done'
      and extract(year from s.starts_at at time zone 'Asia/Taipei') = 2026
      and extract(month from s.starts_at at time zone 'Asia/Taipei') = rec.target_month;

    select count(*) into v_session_count
    from public.sessions s
    where s.project_id = v_project_id and s.status = 'done'
      and extract(year from s.starts_at at time zone 'Asia/Taipei') = 2026
      and extract(month from s.starts_at at time zone 'Asia/Taipei') = rec.target_month;

    if v_session_count is distinct from 1 then
      raise exception '導航計畫 2026-%月 應恰有 1 場 done 場次，實際 %，回填 % 失敗，整包回滾。', rec.target_month, coalesce(v_session_count, 0), rec.reg_id;
    end if;

    update public.registrations r
    set session_ids = array[v_session_id],
        capacity_released_at = coalesce(r.capacity_released_at, now())
    where r.id = rec.reg_id
      and (r.session_ids = '{}'::uuid[] or r.session_ids is null)
      and strpos(r.answers::text, rec.evidence) > 0;

    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception '導航計畫回填 % 失敗（找不到符合 evidence 的列，或已被回填/手動標記），整包回滾。', rec.reg_id;
    end if;
    v_total := v_total + v_updated;
  end loop;

  if v_total <> 7 then
    raise exception '導航計畫回填總筆數應為 7，實際 %，整包回滾。', v_total;
  end if;
end $$;

-- 總結紀錄。逐筆的 registration_admin_edit 由 trigger 照常產生（見檔頭裁決），
-- 這一筆是給讀稽核的人一個入口，說明那批 actor 空白的變更是什麼、依據哪支 migration。
insert into public.audit_log(action, target_type, result, detail)
values ('registration_session_backfill', 'registration', 'success',
  '{"migration":"20260811000041","peer":67,"navigator":7,"parent":10,"approved":2}');

-- ----------------------------------------------------------------------------
-- 6. admin_transition_registration 修正：純歷史列短路，避免 done 場次的重新持有
--    名額分支 raise SESSION_FULL_OR_CLOSED。原函式定義見 20260810000039，這裡只
--    插入一個 elsif 分支，其餘邏輯逐字保留。
-- ----------------------------------------------------------------------------
create or replace function public.admin_transition_registration(p_registration_id uuid, p_status text)
returns public.registrations
language plpgsql security definer set search_path = public
as $$
declare
  reg public.registrations;
  sid uuid;
  should_release boolean := lower(p_status) = any(array['rejected','cancelled','withdrawn','canceled']);
  policy text;
  should_hold boolean;
  result public.registrations;
begin
  select * into reg from public.registrations where id = p_registration_id for update;
  if reg.id is null then raise exception 'REGISTRATION_NOT_FOUND'; end if;
  if not (public.is_system_owner(auth.uid()) or public.project_role(reg.project_id, auth.uid()) in ('owner', 'admin_collab')) then
    raise exception 'FORBIDDEN';
  end if;
  perform 1 from public.sessions where id = any(coalesce(reg.session_ids, '{}')) order by id for update;

  select p.seat_policy into policy from public.projects p where p.id = reg.project_id;
  -- on_submit：只要不是退回類就補回名額（原本的行為，逐字保留）。
  -- on_confirm：只有錄取（confirmed／success）才取得名額——待審核、回信確認中、
  --             候補都不該佔住位子，那正是申請制的重點。
  should_hold := case
    when coalesce(policy, 'on_submit') = 'on_confirm'
      then lower(p_status) = any(array['confirmed','success'])
    else not should_release
  end;

  if should_release and reg.capacity_released_at is null then
    foreach sid in array coalesce(reg.session_ids, '{}') loop
      update public.sessions set booked_count = greatest(0, booked_count - 1),
        status = case when status = 'full' then 'open' else status end where id = sid;
    end loop;
    update public.registrations set status = p_status, capacity_released_at = now()
      where id = reg.id returning * into result;
  elsif should_hold and reg.capacity_released_at is not null
    and not exists (select 1 from public.sessions
                    where id = any(coalesce(reg.session_ids, '{}'))
                      and status not in ('done','cancelled')) then
    -- 純歷史列短路（2026-08-11 回填後補上）：session_ids 回填後場次已是 done，
    -- 原本「重新持有名額」分支的 where 條件要求 session status in
    -- ('open','full')，done 場次必然 not found，raise SESSION_FULL_OR_CLOSED，
    -- 導致 86 筆歷史報名除了轉退回類以外全部改不動。這裡只改狀態、不動名額——
    -- 場次已結束，booked_count 本來就不該再變。⚠ 不可改成「done 也清
    -- capacity_released_at」，那會讓 seatAudit 的 claimed > booked，紅色橫幅誤報。
    update public.registrations set status = p_status where id = reg.id returning * into result;
  elsif should_hold and reg.capacity_released_at is not null then
    foreach sid in array coalesce(reg.session_ids, '{}') loop
      update public.sessions set booked_count = booked_count + 1,
        status = case when booked_count + 1 >= capacity then 'full' else status end
      where id = sid and status in ('open','full') and booked_count < capacity;
      if not found then raise exception 'SESSION_FULL_OR_CLOSED:%', sid; end if;
    end loop;
    update public.registrations set status = p_status, capacity_released_at = null
      where id = reg.id returning * into result;
  elsif (not should_hold) and reg.capacity_released_at is null then
    -- 申請制：從錄取退回到審核中／候補時，名額要還出去讓別人能被選。
    foreach sid in array coalesce(reg.session_ids, '{}') loop
      update public.sessions set booked_count = greatest(0, booked_count - 1),
        status = case when status = 'full' then 'open' else status end where id = sid;
    end loop;
    update public.registrations set status = p_status, capacity_released_at = now()
      where id = reg.id returning * into result;
  else
    update public.registrations set status = p_status where id = reg.id returning * into result;
  end if;

  insert into public.audit_log(action, actor_id, target_type, target_id, result, detail)
  values ('registration_status_change', auth.uid(), 'registration', reg.id::text, 'success',
    json_build_object('from', reg.status, 'to', p_status, 'seat_policy', coalesce(policy, 'on_submit'),
                      'holds_seat', should_hold)::text);
  return result;
end;
$$;

commit;
