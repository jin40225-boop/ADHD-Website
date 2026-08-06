/**
 * 取得 Google refresh token（本機執行一次，用來修復 GOOGLE_REFRESH_TOKEN）。
 *
 * 用法：
 *   node scripts/get-google-refresh-token.mjs
 *
 * 它會問你 Client ID 與 Client Secret（輸入時不回顯）、開一個本機 callback、
 * 把授權網址印出來讓你在瀏覽器完成同意，然後**只把 refresh token 印在終端機**。
 *
 * ⚠ 這支腳本刻意不寫任何檔案、不寫 log、不呼叫外部服務（除了 Google 的 token 端點）。
 *   token 只存在於這個行程的記憶體與你的終端機捲動緩衝區裡。貼進 Supabase secrets 之後，
 *   清掉終端機（Windows Terminal：Ctrl+Shift+W 關掉分頁最乾脆）。
 *
 * ⚠ 一定要 access_type=offline ＋ prompt=consent：
 *   - 少了 offline，Google 只給 access token（1 小時後就沒了），不會給 refresh token。
 *   - 少了 consent，若你先前已同意過，Google 會直接跳過同意畫面並且**不再回傳
 *     refresh token**——你會拿到一個看起來成功、卻沒有 refresh_token 欄位的回應。
 *     這是重新授權時最常見的空手而回。
 */
import { createServer } from 'node:http';
import { createInterface } from 'node:readline';
import { randomBytes } from 'node:crypto';
import { stdin, stdout } from 'node:process';

const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.events',
];

/** 讀一行輸入。secret=true 時不回顯——client secret 不該留在終端機捲動紀錄裡。 */
function ask(question, secret = false) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout, terminal: true });
    if (!secret) { rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); }); return; }
    stdout.write(question);
    const onData = (char) => {
      if (['\n', '\r', ''].includes(String(char))) stdin.removeListener('data', onData);
      else stdout.write('*');
    };
    stdin.on('data', onData);
    rl.question('', (answer) => { stdin.removeListener('data', onData); rl.close(); stdout.write('\n'); resolve(answer.trim()); });
  });
}

const clientId = await ask('Google Client ID: ');
const clientSecret = await ask('Google Client Secret（不會顯示）: ', true);
if (!clientId || !clientSecret) { console.error('\n兩個都要填。中止。'); process.exit(1); }

// state 防的是別人把自己的授權碼塞進你的 callback。
const state = randomBytes(16).toString('hex');
const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', clientId);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', SCOPES.join(' '));
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent');
authUrl.searchParams.set('state', state);

console.log('\n1. 先確認 Google Cloud Console 的 OAuth 用戶端已把這個網址列為「已授權的重新導向 URI」：');
console.log(`   ${REDIRECT_URI}`);
console.log('\n2. 用要授權的那個 Google 帳號（jin40225@gmail.com）開啟以下網址並完成同意：\n');
console.log(authUrl.toString());
console.log('\n等待授權回跳…（Ctrl+C 可中止）\n');

const code = await new Promise((resolve, reject) => {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    if (url.pathname !== '/oauth2callback') { res.writeHead(404).end(); return; }
    const finish = (message) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<meta charset="utf-8"><body style="font-family:system-ui;padding:2rem">${message}</body>`);
      server.close();
    };
    if (url.searchParams.get('state') !== state) { finish('state 不符，已拒絕。請重跑腳本。'); reject(new Error('state 不符，可能不是你發起的授權。')); return; }
    const error = url.searchParams.get('error');
    if (error) { finish(`授權被拒絕：${error}`); reject(new Error(`授權被拒絕：${error}`)); return; }
    const received = url.searchParams.get('code');
    if (!received) { finish('回跳網址少了 code。'); reject(new Error('回跳網址少了 code。')); return; }
    finish('授權完成，可以關掉這個分頁，回終端機看結果。');
    resolve(received);
  });
  server.listen(PORT, '127.0.0.1');
  server.on('error', reject);
});

const res = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code' }),
});
const token = await res.json();
if (!res.ok) {
  // 不要把整包回應印出來——它可能含 client secret 的回音。
  console.error(`\n換 token 失敗：${token.error ?? res.status}${token.error_description ? `（${token.error_description}）` : ''}`);
  process.exit(1);
}
if (!token.refresh_token) {
  console.error('\nGoogle 沒有回傳 refresh token。');
  console.error('最常見的原因：這個帳號先前已同意過，而請求少了 prompt=consent，Google 便直接跳過同意畫面。');
  console.error('本腳本已帶 prompt=consent，若仍如此，請到 https://myaccount.google.com/permissions 移除本應用的授權後重跑。');
  process.exit(1);
}

const granted = String(token.scope ?? '').split(' ');
const missing = SCOPES.filter((scope) => !granted.includes(scope));

console.log('\n────────────────────────────────────────');
console.log('GOOGLE_REFRESH_TOKEN=' + token.refresh_token);
console.log('────────────────────────────────────────');
console.log(missing.length
  ? `\n⚠ 同意畫面少勾了：${missing.join('、')}\n  少了 scope 的 token 會在實際呼叫時才失敗（而不是現在），建議重跑並全部勾選。`
  : `\n✅ 三個 scope 都拿到了。`);
console.log('\n接著：');
console.log('  1. 到 Supabase → Project Settings → Edge Functions → Secrets，更新 GOOGLE_REFRESH_TOKEN。');
console.log('     （或 npx supabase secrets set GOOGLE_REFRESH_TOKEN=...，但那會留在 shell 歷史裡。）');
console.log('  2. 回後台整合設定按一次「同步 Gmail」確認恢復。');
console.log('  3. 清掉這個終端機分頁——上面那行是完整憑證。');
console.log('\n⚠ 若 OAuth 同意畫面仍是「測試中（Testing）」狀態，這個 refresh token 7 天後會再次失效。');
console.log('  要一勞永逸，把發布狀態改成「已發布（In production）」；內部自用不需要通過 Google 審查。\n');
