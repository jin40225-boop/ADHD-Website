# 場次管理

場次的後台介面已改為 `admin/operations/SessionTable.tsx`＋`admin/pages/SessionsPage.tsx`（03_v4 的可編輯表格與詳情抽屜）。原本的 `SessionManager` 彈窗編輯器隨該次改寫移除。

此模組現在只留 `mockInstructors`，供 `InstructorSchedulingPage` 在 Supabase 未設定時顯示示意資料。
