# 自托管字體（public/fonts/）

00 檔第 4 節規定：**不使用 Google Fonts CDN**，字體一律自托管 woff2 子集。
`src/styles/tokens.css` 的 `@font-face` 已指向以下檔名，三個字型檔均已放入並由站內載入。

| 檔名（放這裡） | 字型 | 用途 | 來源授權 |
|---|---|---|---|
| `zen-maru-gothic.woff2` | Zen Maru Gothic 400 | 標題 | Fontsource／Google Fonts（SIL OFL 1.1） |
| `kiwi-maru.woff2` | Kiwi Maru 400 | 標題備援 | Fontsource／Google Fonts（SIL OFL 1.1） |
| `noto-sans-tc.woff2` | Noto Sans TC 400 | 內文 | Fontsource／Google Fonts（SIL OFL 1.1） |

## 子集化建議（縮小檔案）

繁體中文全字集很大，建議用 `fonttools` 依實際用到的字子集化：

```bash
pip install fonttools brotli
# 從 unicode-range 或掃描專案文案取字，範例（僅常用字 + 標點）：
pyftsubset NotoSansTC-Regular.otf \
  --output-file=noto-sans-tc.woff2 --flavor=woff2 \
  --unicodes="U+0020-007E,U+3000-303F,U+4E00-9FFF,U+FF00-FFEF"
```

字重：`tokens.css` 以 variable-weight 宣告（`font-weight: 300 700` 等）。
若下載到的是單一字重靜態檔，逐一補 `@font-face` 或改用 variable font 檔。
