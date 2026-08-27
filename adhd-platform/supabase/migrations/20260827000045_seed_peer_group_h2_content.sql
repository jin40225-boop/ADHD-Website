-- ============================================================================
-- 同儕聚會下半年四場的內容補齊 ＋ 延伸連結機制（WP10）
--
-- 兩段：
--   第一段【schema】sessions 加 guest_url／attachments，sessions_public 尾端追加這兩欄
--                    ＋ 20260827000044 建立的 allow_waitlist（view 的改動集中在這一支，
--                    見下方註解）。
--   第二段【data-only】把 9／10／11／12 月四場的主題、來賓、來賓連結、介紹填進去。
--
-- 為什麼「顯示」不用改程式：topic／guest／description 三欄早就存在（000007／000033），
-- UpcomingSessions 也早就在渲染 description。訪客看到「神秘驚喜！」不是功能缺口，
-- 是這四列的欄位還是空的。這支補的是資料，不是能力。
--
-- 【紅線】第二段只寫 topic／guest／guest_url／description 四欄。starts_at／ends_at／
-- capacity／status／registration_deadline／admin_note 一個都不碰——上架與名額是使用者
-- 在後台的決定，不該被一支種資料的 migration 順手改掉。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 第一段：延伸連結欄位
--
-- guest_url：認識來賓的外部連結。刻意獨立成一欄而不是塞進 attachments——它在前台
-- 是「來賓」那一列的延伸，語意固定，不需要標籤，也不該讓行政人員每次自己打一次
-- 「認識來賓」當標籤。
--
-- attachments：連結型附件（活動內容整理、講義、報導…）。`not null default '[]'`，
-- 讀出來永遠是陣列，前台不必為 null 分支。每筆形狀：
--   {"label": "顯示文字", "url": "https://…", "kind": "link"}
-- kind 目前只會是 'link'。留這個鍵是因為之後真的要接檔案上傳時（需要 Storage bucket
-- 與權限設計，不在本輪），既有資料不必再搬一次形狀。
--
-- ⚠ 沒有加 jsonb 形狀的 check constraint：唯一的寫入端是後台 SessionsPage，它送出前
-- 就把純文字轉成固定形狀了；前台另外用 Array.isArray 收尾。多一條約束擋不到新的風險，
-- 卻會讓之後擴充形狀時多一次 migration。
--
-- 冪等：add column if not exists。
-- ---------------------------------------------------------------------------
alter table public.sessions
  add column if not exists guest_url text;

alter table public.sessions
  add column if not exists attachments jsonb not null default '[]'::jsonb;

comment on column public.sessions.guest_url is
  '認識來賓的外部連結（前台「延伸連結」區塊的「認識來賓」）。留空則不顯示該列。';
comment on column public.sessions.attachments is
  '延伸連結／附件陣列，每筆 {"label","url","kind"}；kind 目前僅 ''link''。空陣列＝前台不顯示延伸連結區塊。';

-- sessions_public 追加這三欄（欄位清單逐字照抄 20260810000034 版本，只在尾端追加，
-- 不更動既有欄位名稱／型別／順序，也不動 where 條件與 security_barrier）。
--
-- ⚠ `allow_waitlist` 的欄位在 20260827000044 建立，但 view 的改動集中在這一支：
-- 同一支 view 只能在一個地方 create or replace，兩支 migration 各改一次會互相把
-- 對方的欄位蓋掉。前台的報名按鈕要說出與該場次設定一致的話，就得讀得到這一欄。
--
-- ⚠ 追加的是 guest_url／attachments／allow_waitlist，**不是** meet_url。meet_url 至今
-- 沒有進過這個 view，是刻意的：Meet 連結只給報名成功的人，不給任何路過的匿名訪客。
-- 這三個新欄位的內容本來就是要公開展示（或據以顯示按鈕）的，性質與 topic／guest／
-- description 同級。
create or replace view public.sessions_public
with (security_barrier) as
  select s.id, s.project_id, s.title, s.starts_at, s.ends_at,
         s.capacity, s.booked_count, s.status,
         s.registration_deadline, s.slot_options, s.quota_group,
         s.topic, s.guest, s.description, s.activity_id,
         s.guest_url, s.attachments, s.allow_waitlist
  from public.sessions s
  where exists (
    select 1 from public.projects p
    where p.id = s.project_id and p.is_public
  );
grant select on public.sessions_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 第二段：四場內容（data-only）
--
-- 匹配方式：peer-group 的 project_id ＋ starts_at 換算成台北日期後比對。
-- ⚠ 資料庫存的是 UTC，`starts_at::date` 會把 08:00+08 之前的場次算成前一天。這四場是
-- 14:00+08＝06:00 UTC，直接比日期剛好不會錯——但「剛好不會錯」不是理由，一旦有人把
-- 場次改到早上就會靜默對不到。一律 `at time zone 'Asia/Taipei'` 再取 date。
--
-- 冪等與「不覆蓋使用者手改」：where 條件要求 topic／guest／description 三欄**都還是空的**
-- 才寫。使用者之後去後台改過任何一欄，這一列就整列跳過——不是「跳過那一欄」，是整列跳過，
-- 因為這四段文字是一組的，補半組會拼出他沒寫過的內容。
-- 重跑時四列都已經有內容，updated＝0，不會產生第二份、也不會蓋掉任何人的字。
--
-- 筆數斷言分兩層：
--   matched  ＝ 四個日期各自對到的場次數，必須正好 4。對不上就是日期／時區／專案 slug
--               有問題，這是真正會靜默壞掉的地方。
--   fillable ＝ 其中「還沒有人動過」的場次數，也就是這支預期會寫的列數。
--               updated 必須等於它——重跑時兩邊都是 0，第一次跑兩邊都是 4，
--               使用者改過兩場時兩邊都是 2。這樣既擋得住真的壞掉，又不會因為
--               「他去後台改了文案」就讓整支 migration 炸掉。
-- ---------------------------------------------------------------------------
do $$
declare
  peer_id uuid;
  matched integer;
  fillable integer;
  updated integer;
  target_dates date[] := array[date '2026-09-06', date '2026-10-11', date '2026-11-08', date '2026-12-20'];
begin
  select id into peer_id from public.projects where slug = 'peer-group';
  if peer_id is null then
    raise exception '找不到 peer-group 服務線，無法補齊場次內容，全數回滾';
  end if;

  select count(*) into matched
    from public.sessions s
   where s.project_id = peer_id
     and (s.starts_at at time zone 'Asia/Taipei')::date = any (target_dates);
  if matched <> 4 then
    raise exception '9／10／11／12 月四場只對到 % 場，預期 4 場——日期或時區換算對不上，全數回滾', matched;
  end if;

  select count(*) into fillable
    from public.sessions s
   where s.project_id = peer_id
     and (s.starts_at at time zone 'Asia/Taipei')::date = any (target_dates)
     and coalesce(btrim(s.topic), '') = ''
     and coalesce(btrim(s.guest), '') = ''
     and coalesce(btrim(s.description), '') = '';

  update public.sessions s
     set topic = v.topic,
         guest = v.guest,
         guest_url = v.guest_url,
         description = v.description
    from (values

    (date '2026-09-06',
     '我獨自工作：一人工作室的經營分享',
     '吳柏賢｜藝術獨立工作者',
     'https://wubaixian.webnode.tw/'::text,
     '大家是否曾經想過創業、接案，或成立屬於自己的一人工作室？獨立工作看似可以自由安排時間，但從尋找案源、溝通報價、製作修改到完成結案，往往都必須由一個人承擔。

本次邀請藝術獨立工作者吳柏賢，分享自己如何透過繪畫、裝置、影像、插畫、雕塑與藝術計畫養活自己，以及在創作、金錢、時間與身體之間，重新理解自己的勞動與價值。

無論你已經開始接案、正在經營個人工作室，或只是對自由工作與創業感到好奇，都歡迎一起交流彼此的經驗與想法！'),

    (date '2026-10-11',
     '從興趣走向事業：科學教育與公司經營經驗',
     '柏宇｜大A公司經營者、方舟科學教育創辦人',
     'https://www.facebook.com/100067608102849/videos/965127656413500/',
     '大家是否曾經想過，把自己的興趣或專長發展成一份工作，甚至成立一家公司？創業除了實現理想，也需要面對課程設計、客戶溝通、工作安排與公司經營等各種挑戰。

本次邀請高雄「方舟科學教育」創辦人柏宇，分享他如何投入兒童及銀髮族的STEAM科學教育，並將科學、科技、工程、藝術與數學結合親子手作課程，逐步發展成自己的事業。

無論你正在創業、考慮轉換職涯，或只是對公司經營與教育工作感到好奇，都歡迎一起聊聊工作、創業與職場中的真實經驗！'),

    -- ⚠ 這一條原始連結帶了一長串追蹤參數，已截成乾淨的粉專網址。不要把參數加回來。
    (date '2026-11-08',
     '握緊方向盤的自信：行車安全與駕駛經驗',
     '傑夫（Jeff）｜資深私人駕訓教練',
     'https://www.facebook.com/SolidDriving',
     '大家喜歡開車嗎？在駕駛的過程中，有沒有什麼獨特的習慣、困難或有趣經驗？

無論你是享受駕駛的樂趣，還是對上路、停車或複雜路況感到緊張，都歡迎一起交流。

因為上次獲得許多迴響，這次再次邀請資深私人駕訓教練傑夫，陪大家分享實用的行車安全知識、駕駛觀念與開車訣竅，讓我們在握緊方向盤時，更安全、更從容，也更有自信！'),

    -- 12 月這場沒有來賓連結，留 null——前台「認識來賓」那一列自然不出現。
    (date '2026-12-20',
     '聊聊理財這件事：從經驗分享到專業建議',
     '博那（Bona）',
     null,
     '大家對於管理財務，有沒有什麼獨特的心得？或是曾經在理財路上，遇過什麼難忘的經驗？

這次讓我們輕鬆聚在一起，分享彼此的理財故事。不論是自己發現的實用方法、曾經踩過的坑，或是希望有所改進的地方，都歡迎提出來交流。

本次邀請好朋友博那，除了聽聽大家的故事，也將從專業角度提供理財觀點與建議，陪大家一起找出更適合自己的財務管理方式！')

    ) as v(on_date, topic, guest, guest_url, description)
   where s.project_id = peer_id
     and (s.starts_at at time zone 'Asia/Taipei')::date = v.on_date
     and coalesce(btrim(s.topic), '') = ''
     and coalesce(btrim(s.guest), '') = ''
     and coalesce(btrim(s.description), '') = '';

  get diagnostics updated = row_count;
  if updated <> fillable then
    raise exception '預期填入 % 場、實際寫了 % 場——對不上，全數回滾', fillable, updated;
  end if;

  raise notice 'WP10：四場中補齊 % 場，其餘 % 場已有內容、跳過不覆蓋。', updated, 4 - updated;
end $$;
