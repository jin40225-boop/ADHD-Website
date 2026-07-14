# 場次管理
`SessionManager` 需要 `sessions`、`instructors`，並以 `onSave(session)`、`onCreateCalendarEvent(session)` 交由 CLAUDE 的資料／Calendar 層執行。元件不建立 Meet、不存取行事曆；mock 為假資料。
