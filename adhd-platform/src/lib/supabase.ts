/**
 * Supabase 前端 client（單例）。【CLAUDE】
 * 僅使用 anon key（受 RLS 保護）。所有敏感呼叫走 Edge Functions，前端不碰 token。
 * 環境變數未設定時回傳 null，讓前台/骨架階段能以本地 JSON 運作而不崩潰。
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** 未設定環境變數時為 null；呼叫端需自行判斷或走 mock/JSON 資料。 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

/** 是否已設定 Supabase 連線（骨架/離線階段為 false）。 */
export const isSupabaseReady = supabase !== null;
