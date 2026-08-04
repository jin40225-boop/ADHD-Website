-- ============================================================================
-- 親職諮詢：下半年場次建立 ＋ 報名表單新欄位（2026-08-04 全面重構 Phase 1・插隊項）
--
-- 背景：8/16 場次報名截止為 8/9，早於 Phase 2 新版報名頁完成時程。
--       現行 /parent/register 是 schema-driven，且會用 DB 場次取代表單裡的靜態
--       preferredSlots 選項（見 src/routes/RegisterPage.tsx），因此只要建好
--       sessions，現行頁面即可開始收 8/16 報名。
--
-- 裁決依據（重構建構計畫_2026-08-04.md 第二節）：
--   2. 親職＝5 日（8/16、9/6、10/11、11/8、12/20）× 三時段 × 各 1 名額
--  10. 表單新欄位：家庭型態、當天出席方式（＋同行對象）、方便聯繫時間、
--      方便聯繫方式、孩子是否服藥、其他疾病史
--
-- 相容性原則：**只新增，不改名、不刪除**。既有 97 筆 registrations.answers 使用
--   舊 key（parentName／childName／childGender…），改名會讓後台詳情讀不到值。
--   欄位整併留待 Phase 2 連同新版報名頁一起處理。
--
-- 未涵蓋（Phase 2 前端工作）：
--   - 孩子「可增減多筆」需要新的 repeatable renderer，現行 FormFieldType 不支援；
--     本階段僅補上單一孩子的服藥與疾病史欄位。
--   - 三階段表單、珍惜公益資源提醒、身份選「其他」動態展開說明欄。
--
-- 冪等：可重複執行。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. 親職諮詢下半年場次（5 日 × 3 時段 × 各 1 名額，時間為 Asia/Taipei）
-- ---------------------------------------------------------------------------
insert into public.sessions (project_id, title, starts_at, ends_at, capacity, booked_count, status)
select p.id, v.title, v.starts_at, v.ends_at, 1, 0, 'open'
from public.projects p
cross join (values
  ('【8月場】ADHD 家長諮詢',  timestamptz '2026-08-16 09:00+08', timestamptz '2026-08-16 10:00+08'),
  ('【8月場】ADHD 家長諮詢',  timestamptz '2026-08-16 10:00+08', timestamptz '2026-08-16 11:00+08'),
  ('【8月場】ADHD 家長諮詢',  timestamptz '2026-08-16 11:00+08', timestamptz '2026-08-16 12:00+08'),
  ('【9月場】ADHD 家長諮詢',  timestamptz '2026-09-06 09:00+08', timestamptz '2026-09-06 10:00+08'),
  ('【9月場】ADHD 家長諮詢',  timestamptz '2026-09-06 10:00+08', timestamptz '2026-09-06 11:00+08'),
  ('【9月場】ADHD 家長諮詢',  timestamptz '2026-09-06 11:00+08', timestamptz '2026-09-06 12:00+08'),
  ('【10月場】ADHD 家長諮詢', timestamptz '2026-10-11 09:00+08', timestamptz '2026-10-11 10:00+08'),
  ('【10月場】ADHD 家長諮詢', timestamptz '2026-10-11 10:00+08', timestamptz '2026-10-11 11:00+08'),
  ('【10月場】ADHD 家長諮詢', timestamptz '2026-10-11 11:00+08', timestamptz '2026-10-11 12:00+08'),
  ('【11月場】ADHD 家長諮詢', timestamptz '2026-11-08 09:00+08', timestamptz '2026-11-08 10:00+08'),
  ('【11月場】ADHD 家長諮詢', timestamptz '2026-11-08 10:00+08', timestamptz '2026-11-08 11:00+08'),
  ('【11月場】ADHD 家長諮詢', timestamptz '2026-11-08 11:00+08', timestamptz '2026-11-08 12:00+08'),
  ('【12月場】ADHD 家長諮詢', timestamptz '2026-12-20 09:00+08', timestamptz '2026-12-20 10:00+08'),
  ('【12月場】ADHD 家長諮詢', timestamptz '2026-12-20 10:00+08', timestamptz '2026-12-20 11:00+08'),
  ('【12月場】ADHD 家長諮詢', timestamptz '2026-12-20 11:00+08', timestamptz '2026-12-20 12:00+08')
) as v(title, starts_at, ends_at)
where p.slug = 'parent'
  and not exists (
    select 1 from public.sessions s
    where s.project_id = p.id and s.starts_at = v.starts_at and s.ends_at = v.ends_at
  );

-- ---------------------------------------------------------------------------
-- 2. 親職報名表單欄位（純新增；既有 key 一律保留原樣）
--    preferredSlots 的靜態選項改為空陣列：它在前端本來就會被 DB 場次取代，
--    但保留此 key 可讓 RegisterPage 把場次欄插在原本的位置。
-- ---------------------------------------------------------------------------
update public.form_schemas fs
set fields = '[
  {"key":"parentName","label":"報名家長姓名","type":"text","required":true},
  {"key":"preferredName","label":"希望如何被稱呼","type":"text","required":true,"helpText":"例：小安媽媽"},
  {"key":"relationship","label":"與孩子的關係（身份）","type":"select","required":true,"options":["父","母","祖父","祖母","親戚","主要照顧者","其他"]},
  {"key":"relationshipOther","label":"若上題選「其他」，請說明關係","type":"text","required":false,"helpText":"例：安親班老師、家庭朋友"},
  {"key":"familyType","label":"家庭型態","type":"text","required":true,"helpText":"請自行描述，例：雙親家庭／單親（媽媽）／隔代教養"},
  {"key":"familyDesc","label":"家中組成描述","type":"textarea","required":true,"helpText":"請簡要談談家中同住的有誰、孩子有幾個手足、排行第幾等等資訊"},
  {"key":"email","label":"電子信箱","type":"email","required":true,"helpText":"將用於寄送審核結果通知信，請務必填寫正確。"},
  {"key":"phone","label":"聯繫手機號碼","type":"phone","required":true},
  {"key":"attendMode","label":"當天線上諮詢的出席方式","type":"select","required":true,"options":["單獨出席","與他人一同出席"]},
  {"key":"attendWith","label":"若與他人一同出席，同行對象是","type":"text","required":false,"helpText":"例：配偶、孩子本人、祖母"},
  {"key":"contactTimes","label":"方便聯繫時間","type":"multiselect","required":true,"options":["早上","中午","下午","晚間"]},
  {"key":"contactTimeNote","label":"方便聯繫時間（其他，選填）","type":"text","required":false,"helpText":"例：平日 12:00–13:00 午休時間"},
  {"key":"contactMethod","label":"方便聯繫方式","type":"select","required":true,"options":["手機","電子信箱","官方 LINE","不拘"],"helpText":"團隊以電子信箱為主要通知管道，官方 LINE 為宣導用。若您有指定聯繫方式，我們才會更改通知形式。"},
  {"key":"childName","label":"孩子姓名或代號","type":"text","required":true,"helpText":"複數孩子用、填寫，例如：小蘭(姊)、小紅(弟)。以有ADHD的孩子為主要諮詢對象。"},
  {"key":"childGender","label":"孩子性別","type":"select","required":true,"options":["男","女","其他／不便透露"]},
  {"key":"childAge","label":"孩子年齡","type":"text","required":true,"helpText":"複數孩子用、填寫。例如：8歲、11歲。"},
  {"key":"childGrade","label":"孩子年級/就學狀況","type":"text","required":true,"helpText":"幾年級/何種班級/IEP或自學等等均可填寫"},
  {"key":"childStatus","label":"孩子目前狀況","type":"select","required":true,"options":["已確診（ADHD／ASD／其他）","疑似／評估中","尚未就醫","其他"]},
  {"key":"childMedication","label":"孩子是否服藥","type":"select","required":true,"options":["目前服藥中","曾服藥，現已停止","未曾服藥","不確定"]},
  {"key":"childOtherConditions","label":"孩子有無其他疾病史","type":"text","required":false,"helpText":"無則免填。例：妥瑞、癲癇、氣喘"},
  {"key":"issueDesc","label":"欲諮詢的困擾議題簡述","type":"textarea","required":true,"helpText":"如果這一小時的諮詢只能優先處理一件事，您最希望是什麼？描述越具體，我們越能提前準備。"},
  {"key":"consultTopics","label":"主要諮詢議題（可複選）","type":"multiselect","required":false,"options":["學校適應","家庭管教","藥物治療","情緒管理","專注力訓練","行為問題","社交技巧","其他"],"helpText":"選填，幫助我們媒合合適的夥伴。"},
  {"key":"preferredSlots","label":"欲報名場次與時段","type":"multiselect","required":true,"options":[]},
  {"key":"note","label":"留言","type":"textarea","required":false}
]'::jsonb,
    updated_at = now()
from public.projects p
where p.slug = 'parent' and fs.project_id = p.id;
