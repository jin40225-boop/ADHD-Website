-- ============================================================================
-- ADHD 專管系統 K1 種子：三個服務專案＋預設狀態流＋報名表單定義
-- 內容為公開設定資料（非個資）。表單欄位與 src/data/*-form-schema.json 同步。
-- 【CLAUDE 專屬】2026-07-12
-- ============================================================================

-- 三個服務專案（固定 UUID 方便前端/腳本引用）
insert into public.projects (id, name, type, slug, description, is_public) values
  ('a1000000-0000-4000-8000-000000000001',
   '115年度成人ADHD線上互助聚會', 'course', 'peer-group',
   '自辦線上聚會，每月主題場次，Google Meet 進行。', true),
  ('a1000000-0000-4000-8000-000000000002',
   'ADHD 導航計畫（心理師諮詢）', 'appointment', 'navigator',
   '大A彥宇 × 諮商心理師鏡子，免費公益線上諮詢，每月 1 位名額。', true),
  ('a1000000-0000-4000-8000-000000000003',
   'ADHD 家長諮詢服務', 'appointment', 'parent',
   '前兒少社工的免費公益線上諮詢，每月 2 個名額。', true)
on conflict (id) do nothing;

-- 預設狀態流（與後台審核工作台一致；各專案可日後自訂）
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
where p.slug in ('peer-group', 'navigator', 'parent')
on conflict (project_id) do nothing;

-- 家長諮詢報名表（同步 src/data/parent-form-schema.json）
insert into public.form_schemas (project_id, fields)
select p.id, '[
  {"key":"childName","label":"孩子姓名或代號","type":"text","required":true,"helpText":"複數孩子用、填寫，例如：小蘭(姊)、小紅(弟)。以有ADHD的孩子為主要諮詢對象。"},
  {"key":"parentName","label":"報名家長姓名","type":"text","required":true},
  {"key":"relationship","label":"與孩子的關係","type":"select","required":true,"options":["父/母","祖父母／外祖父母","親戚","主要照顧者"]},
  {"key":"email","label":"電子信箱","type":"email","required":true,"helpText":"將用於寄送審核結果通知信，請務必填寫正確。"},
  {"key":"phone","label":"聯繫手機號碼","type":"phone","required":true},
  {"key":"childGender","label":"孩子性別","type":"select","required":true,"options":["男","女"]},
  {"key":"childAge","label":"孩子年齡","type":"text","required":true,"helpText":"複數孩子用、填寫。例如：8歲、11歲。"},
  {"key":"childGrade","label":"孩子年級/就學狀況","type":"text","required":true,"helpText":"幾年級/何種班級/IEP或自學等等均可填寫"},
  {"key":"familyDesc","label":"家中組成描述","type":"textarea","required":true,"helpText":"請簡要談談家中同住的有誰、孩子有幾個手足、排行第幾等等資訊"},
  {"key":"childStatus","label":"孩子目前狀況","type":"select","required":true,"options":["已確診（ADHD／ASD／其他）","疑似／評估中","尚未就醫","其他"]},
  {"key":"issueDesc","label":"欲諮詢的困擾議題簡述","type":"textarea","required":true},
  {"key":"preferredSlots","label":"欲報名場次與時段","type":"multiselect","required":true,"options":[
    {"value":"【四月場】4/18（六）10:00–11:00","label":"【四月場】4/18（六）10:00–11:00","disabled":true,"disabledLabel":"（額滿）"},
    {"value":"【四月場】4/18（六）11:00–12:00","label":"【四月場】4/18（六）11:00–12:00","disabled":true,"disabledLabel":"（額滿）"},
    {"value":"【五月場】5/23（六）10:00–11:00","label":"【五月場】5/23（六）10:00–11:00","disabled":true,"disabledLabel":"（額滿）"},
    {"value":"【五月場】5/23（六）11:00–12:00","label":"【五月場】5/23（六）11:00–12:00","disabled":true,"disabledLabel":"（額滿）"},
    {"value":"【六月場】6/6（六）10:00–11:00","label":"【六月場】6/6（六）10:00–11:00","disabled":true,"disabledLabel":"（額滿）"},
    {"value":"【六月場】6/6（六）11:00–12:00","label":"【六月場】6/6（六）11:00–12:00","disabled":true,"disabledLabel":"（額滿）"}
  ]},
  {"key":"note","label":"留言","type":"textarea","required":false}
]'::jsonb
from public.projects p where p.slug = 'parent'
on conflict (project_id) do nothing;

-- 導航計畫報名表（同步 src/data/navigator-form-schema.json）
insert into public.form_schemas (project_id, fields)
select p.id, '[
  {"key":"name","label":"姓名","type":"text","required":true},
  {"key":"email","label":"電子信箱","type":"email","required":true},
  {"key":"gender","label":"性別","type":"select","required":true,"options":["男","女","多元性別","不願透露"]},
  {"key":"age","label":"年齡","type":"select","required":true,"options":["未滿18","18–24","25–34","35–44","45–54","55–64","65以上","不願透露"]},
  {"key":"occupation","label":"職業","type":"text","required":true},
  {"key":"adhdHistory","label":"ADHD 確診史","type":"select","required":true,"options":["有確診","無確診","疑似/未就醫"]},
  {"key":"issueDesc","label":"欲諮詢的困擾議題簡述","type":"textarea","required":true},
  {"key":"phone","label":"聯繫電話","type":"phone","required":true},
  {"key":"registerMonth","label":"報名月份","type":"select","required":true,"options":["5月","6月","7月","8月","9月","10月","11月","12月"]},
  {"key":"preferredSlots","label":"勾選可配合時段","type":"multiselect","required":true,"options":[
    {"value":"2026/06/08（一）20:00–21:00","label":"2026/06/08（一）20:00–21:00","disabled":true,"disabledLabel":"（額滿）"},
    {"value":"2026/06/13（六）20:00–21:00","label":"2026/06/13（六）20:00–21:00","disabled":true,"disabledLabel":"（額滿）"},
    {"value":"2026/06/14（日）09:00–10:00","label":"2026/06/14（日）09:00–10:00","disabled":true,"disabledLabel":"（額滿）"},
    {"value":"2026/06/20（六）20:00–21:00","label":"2026/06/20（六）20:00–21:00","disabled":true,"disabledLabel":"（額滿）"},
    {"value":"2026/07/06（一）20:00–21:00","label":"2026/07/06（一）20:00–21:00","disabled":true,"disabledLabel":"（額滿）"},
    {"value":"2026/07/11（六）20:00–21:00","label":"2026/07/11（六）20:00–21:00","disabled":true,"disabledLabel":"（額滿）"},
    {"value":"2026/07/18（六）20:00–21:00","label":"2026/07/18（六）20:00–21:00","disabled":true,"disabledLabel":"（額滿）"},
    {"value":"2026/08/03（一）20:00–21:00","label":"2026/08/03（一）20:00–21:00"},
    {"value":"2026/08/08（六）20:00–21:00","label":"2026/08/08（六）20:00–21:00"},
    {"value":"2026/08/15（六）20:00–21:00","label":"2026/08/15（六）20:00–21:00"},
    {"value":"2026/09/07（一）20:00–21:00","label":"2026/09/07（一）20:00–21:00"},
    {"value":"2026/09/12（六）20:00–21:00","label":"2026/09/12（六）20:00–21:00"},
    {"value":"2026/09/19（六）20:00–21:00","label":"2026/09/19（六）20:00–21:00"},
    {"value":"2026/10/05（一）20:00–21:00","label":"2026/10/05（一）20:00–21:00"},
    {"value":"2026/10/10（六）20:00–21:00","label":"2026/10/10（六）20:00–21:00"},
    {"value":"2026/10/17（六）20:00–21:00","label":"2026/10/17（六）20:00–21:00"},
    {"value":"2026/11/02（一）20:00–21:00","label":"2026/11/02（一）20:00–21:00"},
    {"value":"2026/11/07（六）20:00–21:00","label":"2026/11/07（六）20:00–21:00"},
    {"value":"2026/11/14（六）20:00–21:00","label":"2026/11/14（六）20:00–21:00"},
    {"value":"2026/12/07（一）20:00–21:00","label":"2026/12/07（一）20:00–21:00"},
    {"value":"2026/12/12（六）20:00–21:00","label":"2026/12/12（六）20:00–21:00"},
    {"value":"2026/12/19（六）20:00–21:00","label":"2026/12/19（六）20:00–21:00"}
  ]}
]'::jsonb
from public.projects p where p.slug = 'navigator'
on conflict (project_id) do nothing;

-- 互助聚會報名表（依現行 Google 表單精神的最小欄位；正式欄位可於後台編輯器調整）
insert into public.form_schemas (project_id, fields)
select p.id, '[
  {"key":"nickname","label":"稱呼／暱稱","type":"text","required":true},
  {"key":"email","label":"電子信箱","type":"email","required":true,"helpText":"用於寄送場次提醒；沒報名也可以當天直接參加！"},
  {"key":"note","label":"想對彥宇說的話（選填）","type":"textarea","required":false}
]'::jsonb
from public.projects p where p.slug = 'peer-group'
on conflict (project_id) do nothing;

-- 全域信件範本起手式
insert into public.email_templates (project_id, name, subject, body)
values
  (null, '確認時段', '{{姓名}}您好，關於{{場次}}',
   E'您好 {{姓名}}：\n\n感謝您的報名，想和您確認 {{時段}} 是否方便。\n\n大A彥宇'),
  (null, '報名成功通知', '【報名成功】{{場次}}',
   E'您好 {{姓名}}：\n\n恭喜您完成報名！\n場次：{{場次}}\n視訊連結：{{Meet連結}}\n\n期待與您相見！\n大A彥宇')
on conflict do nothing;
