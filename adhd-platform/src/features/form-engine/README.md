# 動態表單引擎

本模組只處理表單 UI 與前端互動；不讀寫 Supabase，也不處理路由或認證。

## 匯出

- `SchemaForm`：公開報名頁使用。Props：`schema: FormSchema`、`onSubmit(answers)`、選用 `initialValues`、`submitLabel`、`disabled`。先做必填、Email、電話驗證，再顯示確認畫面；使用者確認後才呼叫 `onSubmit`。
- `SchemaFormEditor`：後台編輯器。受控 Props：`value: FormSchema`、`onChange(schema)`；可選 `showPreview`。可新增、刪除、上下移動欄位，編輯選項與「額滿」停用狀態。
- `mockConsultationSchema`：假資料展示；不可替換為真實報名資料。

## CLAUDE 串接需求

1. 前台載入專案的 `FormSchema` 後，將其傳入 `SchemaForm`；`onSubmit` 應呼叫既有 API/Edge Function。
2. 後台讀取與儲存 schema 時，將 `SchemaFormEditor` 當成受控元件使用，將 `onChange` 的完整 schema 交給資料層。
3. 選項停用請使用 `FormFieldOption`：`{ value, label, disabled: true, disabledLabel: '（額滿）' }`。

本模組依賴 `@contracts/types` 與 `src/components/ui/`；CSS 由元件入口自行載入。
