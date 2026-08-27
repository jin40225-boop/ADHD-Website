-- 修掉既有範本裡「看起來像變數、實際是死字」的單括號佔位。
--
-- 背景：變數替換的正則是 /\{\{([^}]+)\}\}/ ——**只認雙括號**。
-- 但十封定稿範本裡有八封用的是單括號（`{稱呼}`、`{月份}`…），
-- 這些寄出去會**原樣帶著括號**，收信人看到的是「{稱呼} 您好：」。
-- 只有「確認信・親職版」「確認信・導航版」兩封用的是真的 `{{}}`。
--
-- 使用者 2026-08-27 裁定：「我記得有一組是會代入的……沿用那個不就好了」。
-- 確實如此——`{{姓名}}` 的解析順序（preferredName → nickname → parentName → name → 主檔顯示名）
-- 就是「稱呼」在做的事，其餘多數也都有一對一的既有變數。
--
-- 三種處理：
--   一、能一對一換的，換成既有變數。
--   二、系統本來就會自動附加、範本裡等於重複的，拿掉（期限、兩顆確認按鈕）。
--   三、沒有資料來源、本來就該人工填的，改成全形底線＋括號說明——
--       底線不會再被誤認成變數（與 20260827000042 的新範本同一體例）。
--
-- data-only：不動 schema，不改任何一句話的語意，只換佔位符。
-- ⚠ 只 update「真的含有死字」的列：email_templates 有版本封存 trigger，
--    無條件 update 會替每一封都生一筆假的版本紀錄。

-- 通用偵測：先把合法的 {{ }} 換成不會混淆的符號，剩下的任何 { 都是死字。
-- 刻意不用「已知佔位符清單」——列舉式偵測，列不到的就靜悄悄漏掉，
-- 而這支 migration 本來就是在收拾「沒人發現」的東西。
create or replace function pg_temp.has_dead_placeholder(txt text) returns boolean
language sql immutable as $fn$
  select strpos(replace(replace(coalesce(txt, ''), '{{', '⟪'), '}}', '⟫'), '{') > 0;
$fn$;

-- 替換鏈抽成一支函式，主旨與內文跑**同一套**。
-- 分成兩條鏈維護的第一版就漏了：主旨裡的 {期限} 被寫進了內文那條鏈，等於沒修。
create or replace function pg_temp.fix_placeholders(txt text) returns text
language sql immutable as $fn$
  select
    -- 三、沒有資料來源，本來就要人工填
    replace(replace(replace(replace(replace(
    -- 二、系統會自動附加，範本裡是重複的
    replace(replace(replace(
    -- 一、一對一換成既有變數
    replace(replace(replace(replace(replace(replace(replace(replace(coalesce(txt, ''),
      '{稱呼}',     '{{姓名}}'),
      '{計畫名}',   '{{計畫名}}'),
      '{日期時間}', '{{時段}}'),
      '{日期}',     '{{時段}}'),
      '{月份}',     '{{月份}}'),
      '{Meet連結}', '{{Meet連結}}'),
      '{場次清單}', '{{場次清單}}'),
      '{報名連結}', '{{報名連結}}'),

      -- 期限：催覆信寄出時 emailCompose 會在信末補「（麻煩在 X 前回覆…）」，
      --       範本這裡拿不到期限值。內文與主旨各有一種寫法，兩種都要處理。
      '請您於 {期限} 前回覆確認', '請您回覆確認'),
      '請於 {期限} 前確認出席',   '請確認出席'),
      -- 兩顆按鈕：confirm-attendance 的連結區塊由系統在信末整段附加，
      --       範本裡這一行只會變成兩串死字。整行移除。
      E'\n\n{確認出席按鈕}　{請假改期按鈕}', ''),

      '{本場團隊成員}', '＿＿＿＿（本場團隊成員）'),
      '{聯繫事項}',     '＿＿＿＿（想確認的事項，逐條列出）'),
      '{主題方向}',     '＿＿＿＿（想邀請分享的主題方向）'),
      -- 這兩個現在有來源了：這一輪新做的「場次彙整」就會產出這份素材。
      '{議題摘要}',     '＿＿＿＿（該家長最想處理的一件事，可從場次彙整複製）'),
      '{去識別化摘要}', '＿＿＿＿（開該場次名冊的「彙整」分頁，按「複製講師信素材」後貼上）');
$fn$;

do $$
declare
  touched  integer;
  leftover integer;
begin
  -- 回絕信的原因是人工二擇一，佔位符本身寫著選項，保留成提示。
  -- 連同外層括號一起換，否則會變成雙層括號。
  update public.email_templates
     set body = replace(body,
           '（{原因：本月名額已滿／本次服務形式暫時無法妥善回應您的需求}）',
           '（＿＿＿＿　例如：本月名額已滿／本次服務形式暫時無法妥善回應您的需求）')
   where strpos(body, '{原因：') > 0;

  update public.email_templates
     set subject = pg_temp.fix_placeholders(subject),
         body    = pg_temp.fix_placeholders(body)
   where pg_temp.has_dead_placeholder(subject) or pg_temp.has_dead_placeholder(body);

  get diagnostics touched = row_count;

  -- 斷言一：死字必須歸零。少換一個就整支回滾——
  -- 半修好的範本比沒修更危險，因為它看起來已經處理過了。
  select count(*) into leftover
    from public.email_templates
   where pg_temp.has_dead_placeholder(subject) or pg_temp.has_dead_placeholder(body);

  if leftover <> 0 then
    raise exception '還有 % 封範本殘留單括號死字，全數回滾——可能有新的佔位符沒列進替換鏈', leftover;
  end if;

  -- 斷言二：第一次跑應該正好動到 8 封（十封定稿中用單括號的那八封）。
  -- 重跑時 where 條件不成立 → touched = 0，也是合法結果。
  if touched not in (0, 8) then
    raise exception '本次改到 % 封，預期 0 封（已處理過）或 8 封（首次）——範本內容與預期不符，全數回滾', touched;
  end if;

  raise notice '單括號死字修正完成：本次處理 % 封', touched;
end $$;
