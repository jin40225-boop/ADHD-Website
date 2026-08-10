-- ============================================================================
-- 成人職場及生活適應專業諮詢（2026-08-10）
--
-- 依據：新增第四項自辦服務。每兩個月一場（雙月），每場開放數個 1 小時時段、
--       每時段 1 位，Google Meet 多對一。首場 115/8/29（六）10–11、11–12。
--       團隊：大A社工督導 彥宇 × 諮商心理師 宋致靜（鏡子） × 職能治療師 況況。
--
-- 使用者裁決（2026-08-10）：
--   場次做法沿用親職諮詢（同一天多個時段、各自名額，報名者直接勾時段）；
--   報名表沿用導航計畫（**成人自己填，不問孩子資料**）。
--
-- 場次刻意不在這裡 seed：親職模式的場次後台按「＋新增場次」就能建，種進
-- migration 反而讓日期成為要改程式才能改的東西。首場由使用者於後台建立。
--
-- 冪等：可重複執行。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. 專案
--
-- type 只能是 'course' | 'appointment'（core_schema.sql:133）。這是預約制的
-- 一對多諮詢，沿用 'appointment'，與導航計畫／親職諮詢同類。
-- ----------------------------------------------------------------------------
insert into public.projects (id, name, type, slug, description, is_public) values
  ('a1000000-0000-4000-8000-000000000005',
   '成人職場及生活適應專業諮詢', 'appointment', 'career',
   '免費公益線上諮詢。每兩個月一場，每場開放數個 1 小時時段、每時段 1 位，Google Meet 多對一。聚焦單次性討論當前職場或生活適應困擾，一起建立結構化策略。', true)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 2. 狀態流
--
-- 後台的狀態下拉其實寫死在前端（RegistrationTable.tsx:9-13），不讀這張表；
-- 這一筆是為了資料一致——三個既有專案都有，少一筆會讓日後查表的人以為漏了。
-- 內容逐字沿用 20260712000002 的預設值。
-- ----------------------------------------------------------------------------
insert into public.status_flows (project_id, nodes, transitions)
select p.id,
  '[
    {"key":"pending","label":"待審核","tone":"yellow","order":1},
    {"key":"confirming","label":"確認中","tone":"orange","order":2},
    {"key":"success","label":"報名成功","tone":"green","order":3},
    {"key":"waitlist","label":"候補","tone":"blue","order":4},
    {"key":"rejected","label":"退回","tone":"red","order":5,"isTerminal":true}
  ]'::jsonb,
  '{
    "pending":["confirming","success","waitlist","rejected"],
    "confirming":["success","waitlist","rejected"],
    "waitlist":["success","rejected"]
  }'::jsonb
from public.projects p
where p.slug = 'career'
on conflict (project_id) do nothing;

-- ----------------------------------------------------------------------------
-- 3. 報名表
--
-- 以導航計畫那份為底改寫成職場版。三點差異：
--   a. 拿掉 registerMonth（導航要跨月媒合才需要；這裡場次日期是確定的，
--      報名頁會自動注入真實場次讓人勾選）。
--   b. 拿掉 preferredSlots（同上；RegisterPage 找不到這個 key 時，會把場次
--      選擇欄放到最前面，正好是定稿要的「先挑時段、再填資料」）。
--   c. 困擾題改成情境導向，並新增「試過什麼」與「想帶走什麼」兩題——這項
--      服務的目標是單次建立結構化策略，這兩題不先問，一小時會花在重頭盤問。
--
-- key 刻意沿用導航版的 name/email/phone/gender/age/occupation/adhdHistory/
-- issueDesc，讓後台既有的欄位元件（姓名、年齡等）不必為此新增。
-- ----------------------------------------------------------------------------
insert into public.form_schemas (project_id, fields)
select p.id, '[
  {"key":"name","label":"姓名","type":"text","required":true},
  {"key":"email","label":"電子信箱","type":"email","required":true,"helpText":"將用於寄送審核結果通知信，請務必填寫正確。"},
  {"key":"phone","label":"聯繫電話","type":"phone","required":true},
  {"key":"gender","label":"性別","type":"select","required":true,"options":["男","女","多元性別","不願透露"]},
  {"key":"age","label":"年齡","type":"select","required":true,"options":["未滿18","18–24","25–34","35–44","45–54","55–64","65以上","不願透露"]},
  {"key":"occupation","label":"目前職業與工作型態","type":"text","required":true,"helpText":"正職、接案、輪班、待業、學生都可以填，寫下你目前的狀態即可。"},
  {"key":"adhdHistory","label":"ADHD 確診史","type":"select","required":true,"options":["有確診","無確診","疑似/未就醫"]},
  {"key":"issueDesc","label":"目前在職場或生活上卡關的地方","type":"textarea","required":true,"helpText":"愈具體愈好。例如：行政表單總是拖到最後一刻、下班後無法從工作狀態切換回來、房間永遠整理不完。"},
  {"key":"triedBefore","label":"曾經試過什麼方法、結果如何","type":"textarea","required":false,"helpText":"選填。試過但沒用的方法也很有價值——可以避免我們再給你一次同樣的建議。"},
  {"key":"expectation","label":"希望這一小時結束時能帶走什麼","type":"textarea","required":true,"helpText":"這是單次性的討論，先對齊期待，才不會談完覺得落空。"}
]'::jsonb
from public.projects p where p.slug = 'career'
on conflict (project_id) do nothing;

-- ----------------------------------------------------------------------------
-- 4. 報名者類群
--
-- 自動歸群的函式在找不到對應類群時是**靜默 return、不報錯**
-- （20260804000002 的 sync_registration_contact_group）。少了這一列，職場諮詢
-- 的報名者永遠不會進聯絡人類群，日後群發信會漏掉他們而且完全沒有提示。
--
-- is_system = true：比照其他三個報名者類群，讓 protect_system_contact_group
-- 護住它，避免日後誤刪或改 key 造成自動歸群靜默失效。
-- （該保護 trigger 是 before update or delete，不影響這裡的 insert。）
-- ----------------------------------------------------------------------------
insert into public.contact_groups (key, name, description, project_id, auto_rule, is_system)
select 'registrants_career', '報名者・職場諮詢',
       '成人職場及生活適應專業諮詢報名成功者，報名時自動歸群。',
       (select id from public.projects p where p.slug = 'career'),
       'registration', true
where not exists (select 1 from public.contact_groups g where g.key = 'registrants_career');

-- ----------------------------------------------------------------------------
-- 5. 防呆：確認四項都到位
--
-- 這四筆是連動的——少了表單，報名頁開不起來；少了類群，歸群靜默失效。
-- 比照 20260805000021 的批次數量斷言，不符就整支回滾，不留半套。
-- ----------------------------------------------------------------------------
do $$
declare
  missing text := '';
begin
  if not exists (select 1 from public.projects where slug = 'career') then
    missing := missing || ' projects';
  end if;
  if not exists (select 1 from public.form_schemas fs
                 join public.projects p on p.id = fs.project_id where p.slug = 'career') then
    missing := missing || ' form_schemas';
  end if;
  if not exists (select 1 from public.status_flows sf
                 join public.projects p on p.id = sf.project_id where p.slug = 'career') then
    missing := missing || ' status_flows';
  end if;
  if not exists (select 1 from public.contact_groups where key = 'registrants_career') then
    missing := missing || ' contact_groups';
  end if;
  if missing <> '' then
    raise exception 'career 專案缺少：% ——全數回滾，不留半套設定。', missing;
  end if;
end $$;
