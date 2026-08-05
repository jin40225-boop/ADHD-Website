/**
 * 信中「✅ 我確認出席／🔁 我需要請假改期」按鈕的落點（計畫第五節、裁決 12）。
 *
 * 對方是從信件裡點進來的，不可能帶 JWT，所以這支必須公開（config.toml 設 verify_jwt = false）。
 * 授權完全靠一次性 token：token 不可猜、只能用一次、預設 30 天過期。除了 token 對應的那一筆
 * 報名之外，這支函式不讀也不寫任何其他資料。
 *
 * 回應是一頁人看得懂的中文 HTML——按鈕是給家長點的，不是給程式呼叫的。
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const ACTIONS = new Set(['attend', 'reschedule']);
/**
 * 只有還在安排中的報名才受理信裡的按鈕。白名單而非黑名單：認不得的狀態一律當作不可動，
 * 與 propose／executor 的動作白名單同一個原則——不確定的時候寧可請對方回信。
 */
const ACTIVE_STATUSES = new Set(['pending', 'reviewing', 'confirmed', 'success', 'waitlist', 'reschedule']);

/**
 * 這支函式**不自己畫頁面**，一律 302 導回站內的 /confirm-result。
 *
 * 原本是直接回一頁 HTML，家長點下去看到的卻是一整片原始碼加中文亂碼：Supabase Functions 的閘道
 * 會把回應強制成 `text/plain`（且不帶 charset）並加上 `X-Content-Type-Options: nosniff`，函式自己設的
 * `text/html; charset=utf-8` 被覆蓋掉——nosniff + text/plain 讓瀏覽器把標籤當字印出來，沒有 charset
 * 則讓中文以 Big5 解碼。那是平台不讓人在 supabase.co 上託管任意 HTML 的限制，不是這裡寫錯，
 * 所以也修不掉，只能不要在這裡出頁面。資料動作在導向之前就已經全部完成。
 *
 * 結果碼只作顯示用：改網址上的 r 只會換掉那一頁的字，不會回頭影響任何資料。**token 不進網址。**
 */
const SITE_URL = (Deno.env.get('PUBLIC_SITE_URL') ?? 'https://jin40225-boop.github.io/ADHD-Website/').replace(/\/?$/, '/');
type ResultCode = 'attend' | 'reschedule' | 'duplicate' | 'expired' | 'invalid' | 'closed' | 'error';

function result(code: ResultCode) {
  return new Response(null, {
    status: 302,
    headers: { Location: `${SITE_URL}confirm-result/?r=${code}`, 'Cache-Control': 'no-store' },
  });
}

Deno.serve(async (req) => {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const url = new URL(req.url);
    const token = (url.searchParams.get('token') ?? '').trim();
    const action = (url.searchParams.get('action') ?? '').trim();
    if (!token || !ACTIONS.has(action)) return result('invalid');

    const { data: record } = await admin
      .from('attendance_confirmations')
      .select('id, registration_id, session_id, action, responded_at, expires_at')
      .eq('token', token)
      .maybeSingle();
    if (!record) return result('invalid');

    if (record.responded_at) {
      // 重複點擊不改寫既有回覆——第一次的決定才算數，避免誤點蓋掉。
      return result('duplicate');
    }
    if (new Date(record.expires_at).getTime() < Date.now()) {
      return result('expired');
    }

    // 這筆報名還在安排中嗎？退回／已取消／中途放棄是後台或本人已經下過的決定，
    // 一封舊信裡的按鈕不能把它翻回來。查在消耗 token 之前，這種點擊什麼都不會動到。
    const { data: registration } = await admin
      .from('registrations').select('id, status, thread_id').eq('id', record.registration_id).maybeSingle();
    if (!registration || !ACTIVE_STATUSES.has(registration.status)) {
      return result('closed');
    }

    const respondedAt = new Date().toISOString();
    const { data: consumed, error: updateError } = await admin
      .from('attendance_confirmations')
      .update({ action, responded_at: respondedAt, responded_ip: req.headers.get('x-forwarded-for') ?? null })
      // 只有還沒回覆過的那一列會被更新：同時點兩次也只有一次會成立。
      .eq('id', record.id)
      .is('responded_at', null)
      // 真的更新到才算數。上面那個 responded_at 檢查擋不住併發——兩個請求可能都讀到 null，
      // 然後一起往下寫狀態。回筆數才知道自己是不是搶到的那一個。
      .select('id');
    if (updateError) throw updateError;
    if (!consumed?.length) {
      return result('duplicate');
    }

    const mailState = action === 'attend' ? 'attend_confirmed' : 'reschedule_requested';
    if (registration.thread_id) {
      await admin.from('email_threads')
        .update({ mail_state: mailState, last_inbound_at: respondedAt, needs_reply: action === 'reschedule', updated_at: respondedAt })
        .eq('id', registration.thread_id);
    }
    if (action === 'reschedule' && registration.status !== 'reschedule') {
      // 進「待改訂時間」流程（計畫第七節）。這個狀態不釋額，位子先保留著等改期。
      await admin.from('registrations').update({ status: 'reschedule' }).eq('id', registration.id);
      await admin.from('audit_log').insert({
        action: 'registration_status_change', target_type: 'registration', target_id: registration.id, result: 'success',
        detail: JSON.stringify({ from: registration.status, to: 'reschedule', via: 'confirm-attendance' }),
      });
    }
    await admin.from('audit_log').insert({
      action: 'attendance_confirmation', target_type: 'registration', target_id: record.registration_id, result: 'success',
      detail: JSON.stringify({ action, session_id: record.session_id }),
    });

    return result(action === 'attend' ? 'attend' : 'reschedule');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin.from('audit_log').insert({ action: 'attendance_confirmation', result: 'error', detail: message });
    return result('error');
  }
});
