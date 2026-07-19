import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// 部署回原 GitHub Pages 網址 https://jin40225-boop.github.io/ADHD-Website/
// → base 需為 '/ADHD-Website/'。本機開發用 '/'。
// 可用環境變數 VITE_BASE 覆寫（例：改部署到 Cloudflare Pages 時設為 '/'）。
const base = process.env.VITE_BASE ?? (process.env.NODE_ENV === 'production' ? '/ADHD-Website/' : '/');

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@contracts': path.resolve(__dirname, './contracts'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        // 主 bundle 拆包：框架與 Supabase SDK 少變動，獨立成 vendor chunk
        // 讓內容更新時使用者只需重新下載頁面碼。
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
});
