# 報名審核工作台

`RegistrationReviewWorkbench` 是純 UI 元件：不連 Supabase、不寄信、不直接改狀態。父層只提供已授權的資料並接收兩個動作。

## Props 與 CLAUDE 資料需求

- `registrations: RegistrationReviewData[]`：`Registration` 加上選用 `messages: EmailMessage[]`。
- `sessions: SessionSlot[]`、`schemas: Record<projectId, FormSchema>`、`statusFlow: StatusFlow`、`emailTemplates: EmailTemplate[]`。
- `onStatusChange(registration, nextStatus)`：由 CLAUDE 依 status flow、權限與 API 成功結果處理更新。
- `onSendEmail({ registration, templateId, subject, body })`：由 CLAUDE 呼叫 Gmail Edge Function；元件不持有 token、不實作寄信。

前端資格提醒只做「必填答案缺漏」與同 email 的目前資料集比對，不能取代後端/RLS 驗證。`mock.ts` 全部是假資料。
