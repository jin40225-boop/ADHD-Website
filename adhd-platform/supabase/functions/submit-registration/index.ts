import { createClient } from 'npm:@supabase/supabase-js@2';
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function jsonResponse(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

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
    const { error } = await admin.from('registrations').insert({ project_id: projectId, session_ids: sessionIds, answers, email, status: 'pending' }); if (error) { if (error.message.includes('SESSION_FULL_OR_CLOSED')) return jsonResponse({ error: 'SESSION_FULL_OR_CLOSED' }, 409); throw error; }
    return jsonResponse({ ok: true }, 201);
  } catch (err) { return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500); }
});

