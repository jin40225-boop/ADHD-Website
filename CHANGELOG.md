# ADHD-Website 變更紀錄 (CHANGELOG.md)

所有對此網站專案的更新與結構性調整都將在此記錄。

---

## [2026-06-08] - 活動時程與狀態更新

### 調整
- 將 6 月 6 日已辦理完畢的成人線上團體「6月場」卡片移至「已經完成辦理活動區」，並套用變灰樣式。
- 將 7 月成人線上團體「7月場」日期由原定的 7月25日 調整為 7月18日。
- 重新執行 `build_all.py` 建置並更新 `index.html` 與 `peer-group.html`。

---

## [2026-06-08] - 專案整合與基準建立 (整合變更)

### 新增
- 基準文件 `PROJECT_MAP.md`，詳述專案架構、防汙染目錄、以及自動化建置原理。
- 變更紀錄文件 `CHANGELOG.md` (本檔案)。
- 本機備份隔離區 `archive/`，完整保存 `Downloads` 與 `OneDrive 1` 等舊版複本，避免後續修改發生覆蓋與資料汙染。
- 配置 `.gitignore` 檔案以確保 `archive/` 與 Python 快取不會被推送到線上。

### 調整
- 將目前的 Workspace (`C:\Users\User\Desktop\115年度ADHD專案`) 重建為唯一的主開發倉庫，移入 OneDrive 2 的最新程式碼（對應遠端最新 commit `b08f8fd`）。
- 集中整合 `專案做法與細節整理.md` 筆記至工作區根目錄。

---

## [2026-06-03] - 活動狀態更新與分頁重新建置 (`b08f8fd`)

### 調整
- 對齊已完成的活動：更新活動標籤為「線上團體」並加上前綴。
- 重新命名 4 月的時程欄位，修正標籤不一致的問題。
- 重新執行 `build_all.py` 生成分頁（包含 `index.html`、`peer-group.html`）。

---

## [2026-03-20] - 社群分享與獨立 SEO 優化 (`0cd92b2`)

### 新增
- 於 `build_all.py` 中引入 `inject_meta_tags` 邏輯，為 `index.html`、`peer-group.html`、`welfare-consultation.html`、`parent-consultation.html` 注入各自獨立的 title, description, og:title, og:description 與 og:url 標籤，解決 LINE / Facebook 社群分享預覽完全一致的問題。
