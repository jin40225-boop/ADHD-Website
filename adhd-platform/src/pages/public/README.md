# 公開頁面

本目錄是 ADHD 家長支持平台的公開 React 頁面。正式部署使用 GitHub Pages base path `/ADHD-Website/`，所有站內連結必須透過 `import.meta.env.BASE_URL` 或 React Router 產生。

## 主要路由

| 路由 | 用途 | 正式資料來源 |
|---|---|---|
| `/` | 首頁與服務入口 | 版本化內容元件 |
| `/peer-group` | 成人 ADHD 線上互助聚會 | 版本化內容＋Supabase 公開場次 view |
| `/navigator` | 心理師導航與諮詢 | 版本化內容＋Supabase 公開場次 view |
| `/parent` | 家長諮詢 | 版本化內容＋Supabase 公開場次 view |
| `/*/register` | 三類站內報名 | `projects`、`form_schemas`、`sessions_public`、`registrations` |
| `/map` | 就醫與支持推薦 | Supabase `recommendations`；JSON 為故障後援 |
| `/map/submit` | 推薦投稿 | Supabase `recommendation_submissions` |
| `/guide` | 新手指南 | 版本化內容與本機圖片 |
| `/articles` | 入門文章 | `articles-index.json` 與內容元件 |
| `/instructors` | 講師概況 | 版本化公開資料 |
| `/feedback` | 活動回饋 | Supabase `event_feedback` |
| `/instructor/availability` | 受邀講師時段回覆 | Supabase Auth、`availability_polls`、`availability_replies` |

## 外部連結

公開頁只保留可追溯的原始新聞與 YouTube 影片連結。報名、推薦查詢、推薦投稿與活動回饋均使用站內路由，不依賴外部 CMS 或第三方表單。

## 維護底線

- 公開資料不得包含報名者、個案、講師信箱或 OAuth 憑證。
- 公開場次只能讀 `sessions_public`，不可恢復 `sessions` 匿名 SELECT。
- 推薦地圖以 Supabase 為正式來源，`recommendations.json` 僅作離線後援。
- 新增公開路由時同步更新 `src/data/site-meta.json`，並執行 `npm run deploy` 與 `npm run check:site`。
