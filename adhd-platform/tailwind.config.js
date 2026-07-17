/**
 * Tailwind 設定 —— 內建 00 檔第 4 節全部設計代幣。
 * 顏色/字體/招牌樣式與 src/styles/tokens.css 雙軌同步，改動需兩處一起改。
 * 本檔由 CLAUDE 維護；其他方唯讀（import class 使用即可）。
 * @type {import('tailwindcss').Config}
 */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // 品牌底色與主色
        cream: '#FFFDF5',        // 頁面底色
        'base-yellow': '#FFEC8B', // 導覽列底
        brown: '#5D4037',        // 主文字、邊框
        highlight: '#D84315',    // 強調橘紅
        // 輔助色
        teal: '#80CBC4',
        'accent-orange': '#FFCC80',
        pink: '#FFB6B9',
        'accent-blue': '#B5EAEA',
        // 功能色
        'line-green': '#06C755',
        'alert-red': '#FF8A80',
        // 場景底色與裝飾色（2026-07-17 設計系統迭代新增）
        'mint-bg': '#F0FDF4',
        'sky-bg': '#B2EBF2',
        'sky-deep': '#006064',
        peach: '#FF9E80',
        'blob-peach': '#FFD6BA',
        'error-bg': '#FFF3F0',
      },
      fontFamily: {
        // 標題：Zen Maru Gothic / Kiwi Maru（自托管）
        heading: ['"Zen Maru Gothic"', '"Kiwi Maru"', '"Noto Sans TC"', 'sans-serif'],
        // 內文：Noto Sans TC（自托管）
        body: ['"Noto Sans TC"', '"Zen Maru Gothic"', 'sans-serif'],
      },
      borderRadius: {
        warm: '20px',
      },
      boxShadow: {
        // 招牌硬陰影（漫畫框）
        warm: '4px 4px 0 0 #5D4037',
        'warm-sm': '2px 2px 0 0 #5D4037',
        'warm-lg': '6px 6px 0 0 #5D4037',
      },
      backgroundImage: {
        // 背景點陣
        dots: 'radial-gradient(#FFCC80 1px, transparent 1px)',
      },
      backgroundSize: {
        dots: '30px 30px',
      },
      // 品牌動畫（2026-07-17 設計系統迭代同步；animate-pulse-slow / animate-blob 於首頁已在使用）
      keyframes: {
        'pulse-slow': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.03)' },
        },
        'blob-float': {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '50%': { transform: 'translate(0, -10px)' },
        },
      },
      animation: {
        'pulse-slow': 'pulse-slow 2.4s ease-in-out infinite',
        'blob-float': 'blob-float 6s ease-in-out infinite',
        blob: 'blob-float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
