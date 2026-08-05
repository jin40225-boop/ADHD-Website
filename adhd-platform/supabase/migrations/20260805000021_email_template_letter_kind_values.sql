-- 十封定稿範本標上 letter_kind（018 加的欄位）。**只寫 letter_kind**，name／subject／body
-- 一個字都不碰——那十封的內容已由使用者定稿。
--
-- 對照由使用者提供。家長行前信刻意標 notice 而非 confirm：出席確認在更早的確認信就做過了，
-- 臨場再鑄一次 token 會讓家長困惑，該封內文已寫「臨時無法出席請提前來信」。
--
-- 019 的稽核 trigger 已經在線上，所以這次標記本身會留下十筆 email_template_edit。
-- 包在 DO 裡是為了拿得到 row_count：對不上 10 列就整筆回滾並把實際筆數丟出來，
-- 不讓「名稱對不上」變成一次靜悄悄的半套更新。
do $$
declare
  updated integer;
begin
  update public.email_templates as t set letter_kind = v.kind
  from (values
    ('確認信・親職版',     'confirm'),
    ('確認信・導航版',     'confirm'),
    ('收件通知',           'notice'),
    ('出席確認信（催覆）', 'follow_up'),
    ('聯繫信',             'notice'),
    ('月度宣傳信',         'bulk'),
    ('客座邀請信',         'instructor'),
    ('講師行前通知信',     'instructor'),
    ('回絕信（修訂版）',   'reject'),
    ('家長行前信',         'notice')
  ) as v(name, kind)
  where t.name = v.name
    and t.letter_kind is distinct from v.kind;

  get diagnostics updated = row_count;
  if updated <> 10 then
    raise exception 'letter_kind 只更新了 % 列，預期 10 列——名稱對不上，全數回滾', updated;
  end if;
end $$;
