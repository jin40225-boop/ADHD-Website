# 講師邀約

`InstructorScheduling` 是無資料庫耦合的工作台元件；整合頁負責 Supabase 與 Edge Functions。

- 管理者可建立多個候選時段、設定名額並選擇專案講師。
- `availability_polls`／`availability_replies` 保存邀約與回覆，RLS 限制專案成員。
- 受邀講師從 `/instructor/availability?poll=...` 使用 Google 帳號登入回覆。
- `confirm_availability_poll` 在單一 transaction 內確認邀約並建立正式 `sessions` 場次。
- `send-instructor-invite` 寄送邀請；`calendar-upsert` 為成立場次建立 Calendar／Meet。
