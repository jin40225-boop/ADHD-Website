# 推薦資料庫審核
`RecommendationReview` 接收投稿、`candidateMatches`，並以 `onApplyMatch`、`onPublish`、`onReject`（選用，INTEGRATED-FIX）讓 CLAUDE 執行更新／上架／退回。核實工作區必須先勾選「已完成資料核實」才能上架。UI 僅引導正向推薦；不連資料庫（資料層由路由頁 RecommendationsPage 接 Supabase）。
