-- 把 `20260827000044`／`045` 新增的三個場次欄位納入稽核。
--
-- ## 為什麼要有這一支
--
-- `20260810000033` 立下的紀律是：**後台可自由輸入、匿名前台看得見的欄位，
-- 必須與欄位同一支 migration 補上稽核**。`20260810000034` 為協辦活動的表單網址
-- 特別論證過理由——「連結被誤改或惡意改掉，沒有舊值的稽核等於沒有稽核」。
--
-- `guest_url`／`attachments`／`allow_waitlist` 完全符合那個描述，但當初施工的代理
-- 被規則禁止更動 `security definer` 函式，所以**主動回報「這個洞我刻意沒補」**
-- 而不是默默略過。這一支就是補它。
--
-- ## 三個欄位各自的風險
--
--   guest_url    —— 前台「認識來賓」那顆連結。被改成別的網址，訪客會被帶去哪裡
--                   沒有人查得出來，而且它掛在你的名字下面。
--   attachments  —— 同上，而且是一整個陣列，可以一次塞好幾條。
--   allow_waitlist —— 決定「額滿之後還收不收報名」。被關掉時，前台按鈕會跟著改口，
--                   報名量下降卻查不到是誰在什麼時候關的。
--
-- ## 沿用既有語意，不發明新規則
--
--   · 只記人工決策：這三欄沒有任何機器維護路徑（`booked_count` 那種），
--     所以不需要像 `status` 那樣加「機器動作必定伴隨某欄位一起變」的排除條件。
--   · 記錄形狀沿用 `jsonb_build_array(舊值, 新值)`，與既有八個欄位一致。
--   · attachments 是 jsonb，直接記整個陣列的新舊值——它不長，而且部分記錄
--     （例如只記筆數）在事後查證時等於沒記。
--
-- 其餘八個欄位的判斷式**逐字沿用**，一個字沒改。
-- 冪等：create or replace。trigger 本身不必重建（它綁的是函式名）。

create or replace function public.log_session_admin_edit()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  changed jsonb := '{}'::jsonb;
begin
  if new.capacity is distinct from old.capacity then
    changed := changed || jsonb_build_object('capacity', jsonb_build_array(old.capacity, new.capacity));
  end if;
  if new.status is distinct from old.status and new.booked_count = old.booked_count then
    changed := changed || jsonb_build_object('status', jsonb_build_array(old.status, new.status));
  end if;
  if new.registration_deadline is distinct from old.registration_deadline then
    changed := changed || jsonb_build_object('registration_deadline', jsonb_build_array(old.registration_deadline, new.registration_deadline));
  end if;
  if new.topic is distinct from old.topic then
    changed := changed || jsonb_build_object('topic', jsonb_build_array(old.topic, new.topic));
  end if;
  if new.guest is distinct from old.guest then
    changed := changed || jsonb_build_object('guest', jsonb_build_array(old.guest, new.guest));
  end if;
  if new.description is distinct from old.description then
    changed := changed || jsonb_build_object('description', jsonb_build_array(old.description, new.description));
  end if;
  if new.slot_options is distinct from old.slot_options then
    changed := changed || jsonb_build_object('slot_options', jsonb_build_array(old.slot_options, new.slot_options));
  end if;
  if new.starts_at is distinct from old.starts_at then
    changed := changed || jsonb_build_object('starts_at', jsonb_build_array(old.starts_at, new.starts_at));
  end if;
  if new.ends_at is distinct from old.ends_at then
    changed := changed || jsonb_build_object('ends_at', jsonb_build_array(old.ends_at, new.ends_at));
  end if;

  -- ── 20260827 新增的三欄（理由見檔頭）──
  if new.guest_url is distinct from old.guest_url then
    changed := changed || jsonb_build_object('guest_url', jsonb_build_array(old.guest_url, new.guest_url));
  end if;
  if new.attachments is distinct from old.attachments then
    changed := changed || jsonb_build_object('attachments', jsonb_build_array(old.attachments, new.attachments));
  end if;
  if new.allow_waitlist is distinct from old.allow_waitlist then
    changed := changed || jsonb_build_object('allow_waitlist', jsonb_build_array(old.allow_waitlist, new.allow_waitlist));
  end if;

  if changed = '{}'::jsonb then return new; end if;

  insert into public.audit_log (action, actor_id, target_type, target_id, result, detail)
  values ('session_admin_edit', auth.uid(), 'session', new.id::text, 'success', changed::text);
  return new;
end;
$$;
