# ADHD 專管系統 協作規則

> 本專案使用 Project Cairn 組織專案知識：`AGENTS.md` 是規則與導覽入口，`cairn/` 是專案知識／狀態層。
> 同目錄的 `CLAUDE.md` 只有一行 `@AGENTS.md`，讓 Claude Code 讀到同一份規則；Codex 直接讀本檔。

## 專案一句話

大A彥宇的 ADHD 家長支持平台：React／Supabase 公益服務網站，含三項公開報名服務（親職諮詢、導航計畫、同儕聚會）與行政營運後台，正式站部署於 GitHub Pages。

> 本檔由 `cairn init` 產生，已填入本專案自身的定位與 provider 設定；其他專案請先跑自己的 init 再沿用。

## Init 設定

- Graduation provider(s)：軟體資料庫（本機檔案庫，寫入交棒給 Claude Code 的 `software-library` 技能）
- 知識庫索引：`C:/Users/User/OneDrive/Desktop/工作與知識庫總集/03_獨立軟體與網頁專案/軟體資料庫/INDEX.md`
- 畢業目標：`C:/Users/User/OneDrive/Desktop/工作與知識庫總集/03_獨立軟體與網頁專案/軟體資料庫`

## 進入專案後的閱讀順序

1. 先讀本檔（AGENTS.md）。
2. 讀 `cairn/ROADMAP.md`——路線圖、當前重點與開放問題。
3. 讀 `cairn/LOG.md` 最上面幾筆（最新在最前）——近期進度與關鍵決策。
4. 依手上任務讀相關的 `cairn/` 知識專題文檔。

> ⚠️ 本專案另有**外部施工依據**，優先於本檔的一切推測：
> `C:\Users\User\OneDrive\Desktop\工作與知識庫總集\00_進行中專案\ADHD專管系統\` 內的
> `MOC.md`（⭐區）、`重構建構計畫_2026-08-04.md`（15 條裁決不得重談）、
> `重構審閱稿_2026-08-04\` 的定稿（01_v3／02_v2／03_v4／04_v4）。
> 技術現況以 `adhd-platform/docs/PROJECT_BASELINE.md` 為唯一事實來源。

## 文件職責

| 檔案 | 角色 | 維護方式 |
|---|---|---|
| `AGENTS.md`（根目錄） | 規則與導覽 | 很少變動，≤ 60 行 |
| `CLAUDE.md`（根目錄） | 一行 `@AGENTS.md` | 寫一次，之後不再動 |
| `cairn/ROADMAP.md` | 路線圖與進度 | 就地更新，保持精簡 |
| `cairn/LOG.md` | 時序日誌 | 新條目加在最上面，每筆 ≤ 20 行，只放摘要與指標 |
| `cairn/<topic>.md` | 知識專題文檔（當前真相） | 就地更新；踩雷寫在內文段落並以 `contains` 標記；改版留 LOG 指標 |
| `cairn/Reference/` | 外部原始素材 | 需要時才建，只追加 |
| `cairn/Cited.md` | 知識庫引用清單 | 只放指標，絕不複製原文 |

> 其餘檔案只在有具體訊號時才建立（有決策要記錄、踩雷被解決、目標跨越單次會話），不預先擺空殼。工程資產（被程式或流程消費的 contracts／config／spec）不歸本系統管，留在程式樹裡，不進 `cairn/`。

## 衝突仲裁規則

- 優先序：**專題文檔 > LOG 歷史**；規則層級的衝突由本檔仲裁。
- 但**外部施工依據（重構建構計畫的 15 條裁決、審閱稿定稿）優先於 `cairn/` 內的一切**——那是使用者拍板的，不得重談。
- 業務／設計結論以 `cairn/` 專題文檔的最新紀錄為準，不看較舊的 LOG 條目。

## 知識庫消費反射

- 動手做「其可複用內核夠格畢業」的工作之前，先查軟體資料庫的 `INDEX.md`；只有真正影響產出的條目才在 `cairn/Cited.md` 補一筆（只放指標，絕不複製內文）。

## 文件協作規則

- 動手改之前先判斷使用者要的是「討論／建議」還是「直接改文件」；當他說「先看看／先評估」時，先給分析，不要直接改寫正式文件。
- 修正過去的判斷時用追加更正說明，不要無聲覆蓋。
- 未經確認的判斷不得寫成既定事實。

## 知識沉澱規則

- 每次有實質進展後，在 `cairn/LOG.md` 最上面加一筆（摘要＋指標）；結論沉澱進 `cairn/` 專題文檔。
- 跨專案可複用的經驗，透過畢業機制沉澱進軟體資料庫。

## 本專案不可踰越的紀律

1. **真實個資不進 Git、不貼入對話。** 含個資的 migration 走 `adhd-platform/supabase/private/`＋`.gitignore` 精確排除，Git 內只放同版本號的 redacted 佔位檔。
2. **動 Supabase 前**先跑 `npx -y supabase migration list --linked`，差異給使用者確認才 `db push`。本專案與「白露 LINE 工作助手」**共用同一個 Supabase**（其表在 `personal_assistant` schema），新增表前先 `inspect db table-stats --linked` 盤點。
3. **不刪正式資料。** 要下架就改狀態並在 `admin_note` 留原因，保留稽核。
4. **每個檢查點回報四行**：資料夾／分支／commit／預覽網址。
5. **程式碼唯一位置是 `D:\ADHD-Website-release`。** OneDrive 內的 `adhd-platform/`、`_codex_maintenance/`、`antigravity-staging/` 是歷史副本，不得作為來源。
