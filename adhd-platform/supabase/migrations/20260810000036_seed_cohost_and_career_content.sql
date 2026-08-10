-- ============================================================================
-- 協辦活動兩個合作案與職場諮詢首場的內容（2026-08-10）
--
-- 使用者要求「先幫我填好，我在後台核可放出」。所以這一支把資料填齊，但
-- **兩筆活動都是 draft**——`activities_public` 只放 published／closed／completed，
-- 草稿活動匿名端讀不到，前台整張卡都不會出現。使用者到後台把狀態改成
-- 「已公開」，那一刻才對外。場次先設 open，因為它們是掛在活動底下顯示的，
-- 活動還是草稿時本來就渲染不出來。
--
-- 為什麼場次也一起種：這幾場的日期是對方公告的既成事實（赤子心海報、父親權益
-- 協會貼文），不是我方可調整的排程，一次填完比手打六筆不容易出錯。**但這是
-- 一次性的**——之後的協辦場次與職場諮詢場次一律在後台建，那才是常態路徑。
--
-- 時間一律以 `+08`（Asia/Taipei）明寫，不用裸字串，避免被當成 UTC。
--
-- 冪等：可重複執行（依名稱／起始時間判重）。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. 合作案一：赤子心 ADHD 家長線上支持性團體座談會（3 場，線上）
--    我方角色＝座談會主持人（海報上三場都是同一位主持人）
-- ----------------------------------------------------------------------------
insert into public.activities (id, project_id, name, status, public_summary, starts_at, ends_at, cohost_info)
select 'b1000000-0000-4000-8000-000000000001',
       p.id,
       '家長座談會－與專家線上面對面',
       'draft',
       E'赤子心 ADHD 家長線上支持性團體座談會・115 年度共 3 場\n\n'
       '陪伴 ADHD 孩子成長的過程中，家長常常需要面對醫療、教育、情緒、家庭關係等各種挑戰。\n\n'
       '赤子心過動症協會總會特別規劃於 115 年度舉辦 3 場「ADHD 家長線上支持性團體座談會」，邀請各領域專家，透過淺顯易懂的分享、實務案例解析，以及現場 Q&A 交流，陪伴家長一起找到更適合孩子，也更適合自己的教養方式。\n\n'
       '教養 ADHD 孩子的路上，您是否也曾遇到：\n'
       '🔹 不知道該怎麼回應孩子？\n'
       '🔹 想了解更多實用的方法？\n'
       '🔹 希望有人一起分享、交流經驗？\n\n'
       '本系列採線上支持性團體座談會方式進行，不只是專家單向分享，更重視家長之間的交流與互動。三場講座我都會擔任主持人，協助引導講師與家長進行對談，串連專業知識與實際教養經驗，讓每位家長都能更容易理解內容，也能勇敢提出自己的問題，共同交流學習。\n\n'
       '希望透過彼此的陪伴與分享，讓每位家長都能在支持中找到力量。\n\n'
       '💻 線上參加，在家即可學習（Google Meet）',
       '2026-09-19 14:00+08'::timestamptz,
       '2026-12-26 16:00+08'::timestamptz,
       jsonb_build_object(
         'partner', '社團法人台灣赤子心過動症協會總會',
         'myRole',  '座談會主持人',
         'formUrl', 'https://forms.gle/opafijRUn5PSYAou9',
         'infoUrl', 'https://www.adhd.org.tw/course_view.php?id=247&topage=1',
         'note',    E'講座對象：ADHD 家屬和照顧者，或 ADHD 本人\n報名費：免費。可單堂報名，報名時請勾選要參加的場次。\n進行方式：Google Meet 線上座談會\n\n報名問題請洽主辦單位：\n電話 (02) 2736-1386\n電子信箱 master@adhd.org.tw\nFacebook：赤子心過動症協會總會'
       )
from public.projects p where p.slug = 'co-host'
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 2. 合作案二：臺灣父親權益協會《孩子該跟誰？》（1 場，台北實體）
--    我方角色＝主講講師
-- ----------------------------------------------------------------------------
insert into public.activities (id, project_id, name, status, public_summary, starts_at, ends_at, cohost_info)
select 'b1000000-0000-4000-8000-000000000002',
       p.id,
       '孩子該跟誰？第一線社工，談監護權、家庭訪視與制度現實',
       'draft',
       E'家事庭的司法實務，好複雜喔！非萬不得已，沒人想要走進法庭。但真的要進法院處理事情，尤其還是攸關孩子的監護權，那真的令人心慌，有好多的不確定和擔心。\n\n'
       '會不會是「誰比較有錢就贏」？孩子有沒有可能被壓迫而說謊？法院對於爸爸、媽媽都公平嗎？\n\n'
       '在監護權訴訟案件背後，有一群人會替法院走進家庭、觀察親子互動，寫下影響判決的報告——他們，是社工。\n\n'
       '本場由社團法人臺灣父親權益協會主辦，邀請我以曾任親權訪視調查、兒少保護工作的社工身分主講，從第一線實務的觀察與真實經驗出發，帶你看見制度真正的運作方式。\n\n'
       '這場會談到：\n'
       '・監護權怎麼決定？法院在看什麼？社工在看什麼？「孩子最佳利益」真的能被客觀判斷嗎？\n'
       '・家庭訪視的真相：社工進到你家，其實在觀察哪些細節？為什麼有些看起來「正常」的家庭，反而不適合？\n'
       '・制度與現實的落差：有沒有可能「利用制度」影響親權酌定或改定？社工如何面對資訊不對稱與各種說法？監督會面交往，真的有效嗎？在家事案件中，當事人的性別，有無優劣勢之分？\n'
       '・第一線社工的內心世界：這份工作最無力的時刻是什麼？長期接觸家庭衝突，會如何改變一個人？',
       '2026-09-15 19:00+08'::timestamptz,
       '2026-09-15 21:30+08'::timestamptz,
       jsonb_build_object(
         'partner', '社團法人臺灣父親權益協會',
         'myRole',  '主講講師',
         'formUrl', 'https://forms.gle/57eqQ48N6CatFAmo6',
         'note',    E'本活動適合：對親權或相關家事案件有興趣的大眾／正面臨或關心親權、離婚議題者／社工、心理、法律相關背景學生或專業工作者／想了解制度背後「真實運作方式」的人\n\n地點：臺北市捷運站周遭，活動前由主辦單位通知確切地點。\n\n名額有限，建議提早卡位。'
       )
from public.projects p where p.slug = 'co-host'
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 3. 協辦場次（4 場）
--
-- **名額一律 0**：這不是佔位寫法，是安全控制。`enforce_session_capacity` 在
-- `booked_count < capacity` 不成立時（0 < 0 為假）直接 raise，整筆報名被資料庫
-- 拒絕——就算有人繞過前台直接打 submit-registration，也塞不進來。
-- 「協辦活動不會有報名者個資」是靠這個 0 兌現的。
--
-- 講師放 guest 欄（前台場次列顯示「講師：」），不另建欄位。
-- ----------------------------------------------------------------------------
insert into public.sessions (project_id, activity_id, title, starts_at, ends_at, capacity, status, guest)
select p.id, v.activity_id, v.title, v.starts_at, v.ends_at, 0, 'open', v.guest
from public.projects p,
(values
  ('b1000000-0000-4000-8000-000000000001'::uuid, '第一場：保健食品怎麼吃？ADHD 的營養照護指南',
   '2026-09-19 14:00+08'::timestamptz, '2026-09-19 16:00+08'::timestamptz, '魏欣怡 營養師'),
  ('b1000000-0000-4000-8000-000000000001'::uuid, '第二場：IEP 一百個問題～在校資源取得大哉問',
   '2026-10-24 14:00+08'::timestamptz, '2026-10-24 16:00+08'::timestamptz, '王若權 特教老師'),
  ('b1000000-0000-4000-8000-000000000001'::uuid, '第三場：按下教養的暫停鍵～ADHD 家長自我照顧與情緒照護',
   '2026-12-26 14:00+08'::timestamptz, '2026-12-26 16:00+08'::timestamptz, '宋致靜 諮商心理師'),
  ('b1000000-0000-4000-8000-000000000002'::uuid, '孩子該跟誰？第一線社工，談監護權、家庭訪視與制度現實',
   '2026-09-15 19:00+08'::timestamptz, '2026-09-15 21:30+08'::timestamptz, '林彥宇 社工')
) as v(activity_id, title, starts_at, ends_at, guest)
where p.slug = 'co-host'
  and not exists (
    select 1 from public.sessions s
    where s.project_id = p.id and s.starts_at = v.starts_at and s.title = v.title
  );

-- ----------------------------------------------------------------------------
-- 4. 職場諮詢首場（雙月場次，同日兩個時段各 1 位）
--
-- 場次做法沿用親職諮詢：每個時段各自一筆、各自名額，報名者直接勾時段。
-- 報名截止 8/24 23:59（使用者指定）。
-- ----------------------------------------------------------------------------
insert into public.sessions (project_id, title, starts_at, ends_at, capacity, status, registration_deadline)
select p.id, '【8月場】成人職場及生活適應專業諮詢', v.starts_at, v.ends_at, 1, 'open',
       '2026-08-24 23:59+08'::timestamptz
from public.projects p,
(values
  ('2026-08-29 10:00+08'::timestamptz, '2026-08-29 11:00+08'::timestamptz),
  ('2026-08-29 11:00+08'::timestamptz, '2026-08-29 12:00+08'::timestamptz)
) as v(starts_at, ends_at)
where p.slug = 'career'
  and not exists (
    select 1 from public.sessions s
    where s.project_id = p.id and s.starts_at = v.starts_at
  );

-- ----------------------------------------------------------------------------
-- 5. 防呆：兩筆活動、六個場次，數量不對就整支回滾
--
-- 這些資料彼此相依（場次掛在活動底下），種一半比沒種更難查。
-- ----------------------------------------------------------------------------
do $$
declare
  acts integer;
  cohost_sessions integer;
  career_sessions integer;
begin
  select count(*) into acts from public.activities
   where id in ('b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002');
  select count(*) into cohost_sessions from public.sessions s
    join public.projects p on p.id = s.project_id
   where p.slug = 'co-host' and s.activity_id is not null;
  select count(*) into career_sessions from public.sessions s
    join public.projects p on p.id = s.project_id
   where p.slug = 'career';

  if acts <> 2 or cohost_sessions < 4 or career_sessions < 2 then
    raise exception '種子資料不完整：活動 % 筆（應 2）、協辦場次 % 筆（應 ≥4）、職場諮詢場次 % 筆（應 ≥2）——全數回滾。',
      acts, cohost_sessions, career_sessions;
  end if;
end $$;
