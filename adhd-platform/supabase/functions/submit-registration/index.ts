import { createClient } from 'npm:@supabase/supabase-js@2';
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function jsonResponse(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

/**
 * Supabase 回傳的 error 是**純物件、不是 Error 實例**，所以 `String(err)` 會得到
 * 字面上的 "[object Object]"，把真正的原因整段吃掉。
 *
 * 2026-08-27 的實際事故：報名者重複報名同一場，DB 依 20260811000040 丟出
 * `DUPLICATE_REGISTRATION:<場次>`，但這裡轉成 "[object Object]" 送回前端；
 * api.ts 裡那句寫好的「您先前已報名過這些場次…」因為比對不到關鍵字，永遠不會出現。
 * 使用者看到的就只是一個看不懂的錯誤框，而且不知道自己其實已經報名成功過了。
 */
function errText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    const parts = [e.message, e.details, e.hint].filter(
      (v): v is string => typeof v === 'string' && v.length > 0,
    );
    if (parts.length) return parts.join(' | ');
    try { return JSON.stringify(err); } catch { /* 落到最後一行 */ }
  }
  return String(err);
}

async function digest(value: string) { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return [...new Uint8Array(bytes)].map((item) => item.toString(16).padStart(2, '0')).join(''); }
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const { projectId, sessionIds, answers, email: rawEmail, turnstileToken } = await req.json(); const email = String(rawEmail ?? '').trim().toLowerCase();
    if (!projectId || !email || !Array.isArray(sessionIds) || !answers || typeof answers !== 'object') return jsonResponse({ error: 'BAD_REQUEST' }, 400);
    const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
    if (secret) { if (!turnstileToken) return jsonResponse({ error: 'CAPTCHA_REQUIRED' }, 400); const form = new FormData(); form.set('secret', secret); form.set('response', String(turnstileToken)); form.set('remoteip', (req.headers.get('x-forwarded-for') ?? '').split(',')[0]); const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form }); const verified = await response.json(); if (!verified.success) return jsonResponse({ error: 'CAPTCHA_FAILED' }, 400); }
    const ip = (req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? 'unknown').split(',')[0].trim();
    for (const key of [`ip:${await digest(ip)}`, `email:${await digest(email)}`]) { const { data, error } = await admin.rpc('consume_registration_rate_limit', { p_bucket_key: key, p_limit: 5 }); if (error) throw error; if (!data) return jsonResponse({ error: 'RATE_LIMITED：請稍後再試或聯絡管理員' }, 429); }
    const { error } = await admin.from('registrations').insert({ project_id: projectId, session_ids: sessionIds, answers, email, status: 'pending' });
    if (error) {
      const detail = errText(error);
      // P0001 是報名守門自己丟的例外（額滿、重複報名…）。那些是使用者看得懂、
      // 也需要知道的情況，原文必須**原封不動**傳回前端，由 api.ts 換成中文說明。
      // 只挑一種來處理，其餘就會掉進 500 並被 String() 抹平——那正是這次的事故。
      if (detail.includes('SESSION_FULL_OR_CLOSED')) return jsonResponse({ error: 'SESSION_FULL_OR_CLOSED' }, 409);
      if ((error as { code?: string }).code === 'P0001' || detail.includes('DUPLICATE_REGISTRATION')) {
        return jsonResponse({ error: detail }, 409);
      }
      throw error;
    }
    return jsonResponse({ ok: true }, 201);
  } catch (err) { return jsonResponse({ error: errText(err) }, 500); }
});

