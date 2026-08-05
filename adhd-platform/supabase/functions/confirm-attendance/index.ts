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

function page(title: string, message: string, tone: 'ok' | 'warn' = 'ok') {
  const accent = tone === 'ok' ? '#2E7D32' : '#B75F43';
  return new Response(
    `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}｜ADHD 家長支持平台</title>
<style>
 body{background:#FFFDF5;color:#5D4037;font-family:"Noto Sans TC",system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px}
 .card{background:#fff;border:2px solid #5D4037;border-radius:16px;box-shadow:4px 4px 0 #5D4037;max-width:480px;padding:28px 26px;text-align:center}
 h1{color:${accent};font-size:1.3rem;margin:0 0 12px}
 p{line-height:1.8;margin:0 0 8px}
 small{color:#8d6e63;display:block;margin-top:16px}
</style></head><body><div class="card">
<h1>${title}</h1><p>${message}</p>
<small>如有其他問題，直接回覆這封信或來信 jin40225@gmail.com 都可以。</small>
</div></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  );
}

Deno.serve(async (req) => {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const url = new URL(req.url);
    const token = (url.searchParams.get('token') ?? '').trim();
    const action = (url.searchParams.get('action') ?? '').trim();
    if (!token || !ACTIONS.has(action)) return page('連結不完整', '這個連結看起來不完整，請直接回覆信件告訴我們你的決定。', 'warn');

    const { data: record } = await admin
      .from('attendance_confirmations')
      .select('id, registration_id, session_id, action, responded_at, expires_at')
      .eq('token', token)
      .maybeSingle();
    if (!record) return page('連結無效', '這個連結已失效。請直接回覆信件告訴我們你的決定。', 'warn');

    if (record.responded_at) {
      // 重複點擊不改寫既有回覆——第一次的決定才算數，避免誤點蓋掉。
      const done = record.action === 'attend' ? '確認出席' : '請假改期';
      return page('已經收到了', `你先前已經回覆「${done}」，我們已經記錄下來，不需要再操作一次。`);
    }
    if (new Date(record.expires_at).getTime() < Date.now()) {
      return page('連結已過期', '這個確認連結已經過期。請直接回覆信件告訴我們你的決定，我們會協助處理。', 'warn');
    }

    // 這筆報名還在安排中嗎？退回／已取消／中途放棄是後台或本人已經下過的決定，
    // 一封舊信裡的按鈕不能把它翻回來。查在消耗 token 之前，這種點擊什麼都不會動到。
    const { data: registration } = await admin
      .from('registrations').select('id, status, thread_id').eq('id', record.registration_id).maybeSingle();
    if (!registration || !ACTIVE_STATUSES.has(registration.status)) {
      return page(
        '這筆報名已經結案',
        '這筆報名目前不在安排中，信裡的按鈕不會再更動它。如果你想重新安排，請直接回覆這封信告訴我們，我們會協助處理。',
        'warn',
      );
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
      return page('已經收到了', '你的回覆已經記錄下來了，不需要再操作一次。');
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

    return action === 'attend'
      ? page('收到，感謝你的確認 🎉', '我們已經記錄你會出席。活動前我們會再寄一次提醒信給你。')
      : page('收到，我們會再聯繫你 🔁', '已經記錄你需要請假或改期，我們會盡快與你聯繫安排新的時間。名額會先為你保留。');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin.from('audit_log').insert({ action: 'attendance_confirmation', result: 'error', detail: message });
    return page('系統忙碌中', '記錄的時候出了點狀況。請直接回覆信件告訴我們你的決定，我們會手動處理。', 'warn');
  }
});
