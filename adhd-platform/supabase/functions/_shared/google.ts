/**
 * Google API 存取（refresh token → access token）。【CLAUDE / K2】
 * Secrets（supabase secrets set）：GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN
 * refresh token 需含 scopes：gmail.send、calendar.events。
 */
export async function getGoogleAccessToken(): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN');
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('GOOGLE_SECRETS_MISSING：請先以 supabase secrets set 設定 Google 憑證');
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`GOOGLE_TOKEN_ERROR：${data.error_description ?? data.error ?? res.status}`);
  }
  return data.access_token as string;
}

/** UTF-8 字串 → base64。 */
export function b64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** base64url（Gmail raw 需要）。 */
export function b64url(input: string): string {
  return b64(input).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
