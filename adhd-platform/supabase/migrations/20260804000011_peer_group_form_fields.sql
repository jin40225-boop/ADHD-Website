-- ============================================================================
-- 同儕聚會報名表欄位對齊 02_v2（2026-08-04 Phase 2 收尾）
--
-- 依據：重構審閱稿 02_前台_同儕聚會報名頁_v2.html 的報名表（第 166–171 行）。
--
-- 目前 DB 只有 3 個欄位（nickname／email／note），定稿有 5 個。差異：
--   1. 缺「手機號碼」（選填）
--   2. 缺「是否第一次參加？」（選填單選）——這題是給主持人備場用的
--   3. note 的標籤是「想對彥宇說的話（選填）」，定稿是「想聊或想問的話題」，
--      用途寫明是「讓客座夥伴可以先準備」，語意不同
--
-- 另補上定稿的提示語「表單是預先統計人數用的！沒報名也可以當天直接參加。」——
-- 這句寫進 projects.description，報名頁會顯示在標題下方。
--
-- 場次選擇欄位由前台依真實 sessions 注入，不寫在 form_schemas 裡。
-- 既有 97 筆報名的 answers 不受影響（欄位是新增與改標籤，不刪 key）。
--
-- 冪等：可重複執行。
-- ============================================================================

-- 1. note 改標籤與說明（key 不動，舊答案照樣對得上）
update public.form_schemas fs
set fields = (
      select jsonb_agg(
        case when field ->> 'key' = 'note'
          then field
               || jsonb_build_object('label', '想聊或想問的話題')
               || jsonb_build_object('helpText', '讓客座夥伴可以先準備。')
          else field
        end
        order by ordinality
      )
      from jsonb_array_elements(fs.fields) with ordinality as t(field, ordinality)
    ),
    updated_at = now()
from public.projects p
where p.slug = 'peer-group' and fs.project_id = p.id
  and fs.fields @> '[{"key":"note"}]'::jsonb;

-- 2. 補「手機號碼」（選填），排在 email 之後
update public.form_schemas fs
set fields = (
      select jsonb_agg(field order by ordinality)
      from (
        select field, ordinality from jsonb_array_elements(fs.fields) with ordinality as t(field, ordinality)
        union all
        select '{"key":"phone","label":"手機號碼","type":"phone","required":false,"helpText":"選填，用於臨時異動通知。"}'::jsonb, 2.5
      ) as merged
    ),
    updated_at = now()
from public.projects p
where p.slug = 'peer-group' and fs.project_id = p.id
  and not (fs.fields @> '[{"key":"phone"}]'::jsonb);

-- 3. 補「是否第一次參加？」（選填單選），排在最後
update public.form_schemas fs
set fields = fs.fields || '[
  {"key":"attendedBefore","label":"是否第一次參加？","type":"radio","required":false,
   "options":["第一次參加","參加過 1–3 次","常客！"]}
]'::jsonb,
    updated_at = now()
from public.projects p
where p.slug = 'peer-group' and fs.project_id = p.id
  and not (fs.fields @> '[{"key":"attendedBefore"}]'::jsonb);

-- 4. 定稿的提示語（報名頁會顯示在標題下方）
update public.projects
set description = '自辦線上聚會，每月主題場次，Google Meet 進行。表單是預先統計人數用的！沒報名也可以當天直接參加。'
where slug = 'peer-group'
  and description not like '%沒報名也可以當天直接參加%';
