-- 「額滿後還能不能候補報名」改成**每個場次自己決定**。
--
-- ## 起點：一個程式與自己註解打架的洞
--
-- `20260810000039` 引進申請制（`seat_policy='on_confirm'`）時，註解寫著：
--
--     申請制：不扣名額、**不判額滿**。但場次必須是開放中——已結束或未上架的場次
--     收到申請沒有意義。
--
-- 本意是擋掉「已結束／已取消／未上架」，但實作寫成 `status = 'open'`，
-- 連 `full` 也一起擋掉了 → 申請制的場次一旦額滿，送出會拿到
-- `SESSION_FULL_OR_CLOSED`，與「不判額滿」的設計意圖相反。
--
-- ## 但一刀切也不對——使用者 2026-08-27 的裁決
--
--     「我建議是增加一個確認報名截止的按鈕或選項。例如每個場次我可以設定
--       這個是否額滿後還能候補報名，這樣比較有彈性。」
--
-- 他說得對。「申請制一律可候補」只是把硬編碼從一邊搬到另一邊；真正的實務是
-- **同一條服務線，有些場次願意收候補，有些不想再收**（例如講師只能配合固定人數、
-- 或那一場的性質不適合臨時加人）。所以做成場次層級的開關。
--
-- ## 語意
--
--   allow_waitlist = false（預設）：額滿就不再收。
--   allow_waitlist = true          ：額滿仍收得到，但**這筆不佔名額**
--                                    （蓋上 capacity_released_at，沿用既有欄位語意，
--                                      後台的名額對帳與釋額邏輯自然一致，不新增第二套狀態）。
--
-- ⚠ 本輪**只對申請制（on_confirm）生效**，先到先得（on_submit）維持原本的「額滿就擋」。
--
--    原因不是懶，是資料模型表達不了：名額旗標 `capacity_released_at` 是**每筆報名一個**，
--    而先到先得的同儕聚會**允許一人報多場**。若讓它候補，就會出現「A 場佔到位、B 場候補」
--    這種狀態——一個旗標蓋下去，等於連 A 場的位子也一起放掉，名額當場算錯。
--    要支援它得先有「每筆報名 × 每個場次」的狀態（現在沒有），那是另一件事。
--
--    所以先到先得的場次，後台那個開關會是**停用並附說明**的（不做假功能）。
--
-- ## 回填
--
-- 申請制那兩條線的既有場次一律開啟——那是它們原本就該有的行為
-- （`20260810000039` 的註解說「不判額滿」）。先到先得的場次一個都不動。
--
-- 仍然永遠擋下：`done`／`cancelled`／`closed`／未上架。那些收到申請沒有意義。
--
-- ⚠ `sessions_public` 需要一併暴露 `allow_waitlist`，前台的報名按鈕才說得出
--    與該場次設定一致的話。**那件事在 20260827000045 一起做**（同一支 view 只在
--    一個地方 create or replace，避免兩支 migration 互相把對方的欄位蓋掉）。
--
-- 冪等：欄位用 if not exists；函式是 create or replace；回填只動仍為預設值的列。

alter table public.sessions
  add column if not exists allow_waitlist boolean not null default false;

comment on column public.sessions.allow_waitlist is
  '額滿後是否仍接受報名。true＝收得到但不佔名額（候補）；false＝額滿即不再收。'
  '⚠ 目前只對申請制（projects.seat_policy=on_confirm）生效；先到先得線允許一人多場，'
  '而名額旗標是每筆報名一個，表達不了「A 場佔位、B 場候補」，故不支援。'
  '已結束／已取消／未上架的場次一律不收，與本欄無關。';

-- 回填：申請制的既有場次開啟候補（那是它們原本的設計意圖）。
-- 只動「還是預設值 false」的列——之後有人在後台手動關掉，重跑不會被翻回來。
update public.sessions s
   set allow_waitlist = true
  from public.projects p
 where p.id = s.project_id
   and p.seat_policy = 'on_confirm'
   and s.allow_waitlist = false;

create or replace function public.enforce_session_capacity()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  sid uuid;
  policy text;
  sess record;
begin
  if new.session_ids is null or array_length(new.session_ids, 1) is null then
    return new;
  end if;

  select p.seat_policy into policy
  from public.projects p where p.id = new.project_id;

  if coalesce(policy, 'on_submit') = 'on_confirm' then
    -- 申請制：不扣名額。額滿收不收由場次自己的 allow_waitlist 決定。
    foreach sid in array new.session_ids loop
      select status, allow_waitlist into sess from public.sessions where id = sid;
      if not found
         or sess.status not in ('open', 'full')
         or (sess.status = 'full' and not sess.allow_waitlist) then
        raise exception 'SESSION_FULL_OR_CLOSED:%', sid using errcode = 'P0001';
      end if;
    end loop;
    -- 「這筆沒有佔著名額」沿用既有欄位表示。
    new.capacity_released_at := now();
    return new;
  end if;

  -- on_submit：先到先得。有名額就照原本的方式扣掉。
  foreach sid in array new.session_ids loop
    update public.sessions
      set booked_count = booked_count + 1,
          status = case
            when booked_count + 1 >= capacity then 'full'
            else status
          end
      where id = sid and status = 'open' and booked_count < capacity;

    if not found then
      -- ⚠ 這裡刻意**不看 allow_waitlist**。
      -- 先到先得允許一人報多場，而名額旗標是每筆報名一個——放行候補會產生
      -- 「A 場佔位、B 場候補」這種一個旗標表達不了的狀態，名額會算錯。
      -- 要支援得先有「每筆報名 × 每個場次」的狀態，那是另一件事。
      raise exception 'SESSION_FULL_OR_CLOSED:%', sid using errcode = 'P0001';
    end if;
  end loop;
  return new;
end;
$$;
