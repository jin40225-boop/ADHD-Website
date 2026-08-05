/**
 * 列出信箱裡的 Gmail 標籤，給設定頁的「同步標籤」下拉用。
 *
 * **唯讀**：只呼叫 users.labels.list，不寫 Gmail、不寫資料庫。存在的理由是設定頁要存 label id
 * 而不是名稱（改名時 id 不變），但 id 對人來說不可讀，所以讓使用者用選的、程式存 id。
 *
 * 權限比照 gmail-sync：系統擁有者，或任一專案的 owner／admin_collab。它讀的是使用者信箱的
 * 標籤名稱，雖然不含信件內容，仍然不是可以公開的東西。
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function jsonResponse(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

async function getGoogleAccessToken() {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID'); const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET'); const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN');
  if (!clientId || !clientSecret || !refreshToken) throw new Error('GOOGLE_SECRETS_MISSING');
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }) });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(`GOOGLE_TOKEN_ERROR:${data.error_description ?? data.error ?? res.status}`);
  return data.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    // 先授權，再跟 Google 要 token：未授權的呼叫不該觸發任何對外請求。
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: auth } = await admin.auth.getUser(jwt);
    if (!auth.user) return jsonResponse({ error: 'UNAUTHORIZED' }, 401);
    const [{ data: profile }, { data: member }] = await Promise.all([
      admin.from('profiles').select('is_system_owner').eq('id', auth.user.id).maybeSingle(),
      admin.from('project_members').select('id').eq('user_id', auth.user.id).in('role', ['owner', 'admin_collab']).limit(1),
    ]);
    if (!profile?.is_system_owner && !member?.length) return jsonResponse({ error: 'FORBIDDEN' }, 403);

    const accessToken = await getGoogleAccessToken();
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? 'Gmail label 讀取失敗');
    // 只回使用者自己建的標籤：INBOX／SENT／CATEGORY_* 這些系統標籤幾乎每封信都帶，
    // 拿它們當收信規則等於沒有規則。
    const labels = ((data.labels ?? []) as { id: string; name: string; type?: string }[])
      .filter((label) => label.type === 'user')
      .map((label) => ({ id: label.id, name: label.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
    return jsonResponse({ ok: true, labels });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
