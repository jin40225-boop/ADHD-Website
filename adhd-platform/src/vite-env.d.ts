/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase 專案 URL（公開安全，anon 用）。 */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon public key（受 RLS 保護，可進前端）。 */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** DEV 後台旁路（'true' 時跳過登入；OAuth 設定完成後移除）。 */
  readonly VITE_DEV_AUTH_BYPASS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** 允許 import .css 副檔（Vite 處理）。 */
declare module '*.css';
