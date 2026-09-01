/**
 * 信件狀態機的行為測試。
 *
 * 這一支跟 check-admin-operations.mjs 不同：那邊斷言的是「原始碼裡有沒有這一行」，
 * 這邊真的把函式跑起來。因為要擋的那個 bug 從原始碼上完全看不出來——每一行都對，
 * 錯的是迴圈的順序，而順序只有實際跑一遍才看得到。
 *
 * 直接載入 Edge Function 用的同一份 .ts（Node 24 原生支援去型別後執行），
 * 不另外寫一份 JS 複本：複本會走鐘，而走鐘的測試比沒有測試更糟。
 */
import { threadStateUpdate } from '../supabase/functions/_shared/mailState.ts';

let passed = 0;
const fail = (name, detail) => { throw new Error(`FAIL: ${name}\n  ${detail}`); };
const check = (name, condition, detail) => {
  if (!condition) fail(name, detail);
  passed += 1;
};
const equal = (name, actual, expected) => check(name, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

const FOLLOW_UP_DAYS = 3;
const NOW = '2026-09-01T00:00:00.000Z';

/** 一條掛在報名底下的空信件串（gmail-sync 建串後的樣子）。 */
const newThread = (extra = {}) => ({
  subject: '報名確認',
  registration_id: 'reg-1',
  contact_id: null,
  last_message_at: null,
  last_outbound_at: null,
  last_inbound_at: null,
  ...extra,
});

const message = (messageAt, outbound, extra = {}) => ({
  messageAt,
  outbound,
  unread: !outbound,
  subject: '報名確認',
  counterpart: 'someone@example.com',
  ...extra,
});

/** 模擬 gmail-sync 的迴圈：逐封套用，每一次都把結果寫回 thread。 */
const applyAll = (thread, messages) => {
  let current = { ...thread };
  for (const item of messages) current = { ...current, ...threadStateUpdate(current, item, FOLLOW_UP_DAYS, NOW) };
  return current;
};

// --- 1. 基本判定 ---------------------------------------------------------
{
  const result = applyAll(newThread(), [message('2026-08-20T01:00:00.000Z', false)]);
  equal('來信 → 已回覆・待處理', result.mail_state, 'replied_pending');
  equal('來信 → 需要回覆', result.needs_reply, true);
  equal('來信 → 有未讀', result.has_unread, true);
  equal('來信 → 推進 last_inbound_at', result.last_inbound_at, '2026-08-20T01:00:00.000Z');
  equal('來信 → 不動 last_outbound_at', result.last_outbound_at, null);
}
{
  const result = applyAll(newThread(), [message('2026-08-20T01:00:00.000Z', true)]);
  equal('寄出 → 等待回覆', result.mail_state, 'waiting_reply');
  equal('寄出 → 不需回覆', result.needs_reply, false);
  equal('寄出 → 設催覆期限', result.follow_up_due_at, '2026-08-23T01:00:00.000Z');
}
{
  // 掛不到報名也掛不到聯絡人的信件串，不該跑去待辦清單上排隊。
  const result = applyAll(newThread({ registration_id: null }), [message('2026-08-20T01:00:00.000Z', false)]);
  equal('未關聯的來信 → 不標待回覆', result.needs_reply, false);
  equal('未關聯的來信 → 狀態仍然更新', result.mail_state, 'replied_pending');
}

// --- 2. 本次要擋的 bug：處理順序不得影響結果 -----------------------------
{
  // Gmail 的 messages.list 回傳新到舊，所以迴圈實際跑的就是這個順序：
  // 先處理「我的回信（新）」，再處理「對方的來信（舊）」。
  const inbound = message('2026-08-20T01:00:00.000Z', false);
  const myReply = message('2026-08-21T09:00:00.000Z', true);

  const newestFirst = applyAll(newThread(), [myReply, inbound]);
  const oldestFirst = applyAll(newThread(), [inbound, myReply]);

  equal('新到舊處理：狀態由最新那封決定', newestFirst.mail_state, 'waiting_reply');
  equal('舊到新處理：狀態由最新那封決定', oldestFirst.mail_state, 'waiting_reply');
  check('兩種順序結果一致', newestFirst.mail_state === oldestFirst.mail_state, `${newestFirst.mail_state} vs ${oldestFirst.mail_state}`);
  equal('補進來的舊來信仍記錄 last_inbound_at', newestFirst.last_inbound_at, '2026-08-20T01:00:00.000Z');
  equal('補進來的舊來信不覆蓋 last_message_at', newestFirst.last_message_at, '2026-08-21T09:00:00.000Z');
}
{
  // 分批同步：回信在第一批、更早的來信在第二批（BATCH_SIZE=5，很容易發生）。
  const afterBatch1 = applyAll(newThread(), [message('2026-08-21T09:00:00.000Z', true)]);
  const afterBatch2 = applyAll(afterBatch1, [message('2026-08-20T01:00:00.000Z', false)]);
  equal('跨批的舊來信不把狀態翻回紅', afterBatch2.mail_state, 'waiting_reply');
  equal('跨批的舊來信不動催覆期限', afterBatch2.follow_up_due_at, '2026-08-24T09:00:00.000Z');
}

// --- 3. 人工「標為已處理」不得被重新同步洗掉 -----------------------------
{
  const handled = {
    ...applyAll(newThread(), [message('2026-08-20T01:00:00.000Z', false)]),
    mail_state: 'handled', status: 'closed', has_unread: false, needs_reply: false,
  };
  // 同一封信再同步一次（upsert 是常態），時間完全相同。
  const resynced = applyAll(handled, [message('2026-08-20T01:00:00.000Z', false)]);
  equal('重新同步同一封信 → 維持已處理', resynced.mail_state, 'handled');
  equal('重新同步同一封信 → 不重新標未讀', resynced.has_unread, false);

  // 但真的有更新的來信時，一定要重新亮起——否則等於把提醒關死。
  const newLetter = applyAll(handled, [message('2026-08-25T10:00:00.000Z', false)]);
  equal('已處理後收到新信 → 重新亮紅', newLetter.mail_state, 'replied_pending');
  equal('已處理後收到新信 → 重新標待回覆', newLetter.needs_reply, true);
}

// --- 4. 時間比較不得用字串比大小 -----------------------------------------
{
  // PostgREST 讀回來的 timestamptz 是 `+00:00`，我們寫進去的是 `.000Z`。
  // 同一個時刻、兩種寫法：字串比大小會判成 '+00:00' < '.000Z'，於是舊信被當成新信。
  const stored = newThread({ last_message_at: '2026-08-21T09:00:00+00:00', last_outbound_at: '2026-08-21T09:00:00+00:00' });
  const sameMoment = applyAll(stored, [message('2026-08-21T09:00:00.000Z', false)]);
  equal('同一時刻的兩種 ISO 寫法視為相等', sameMoment.mail_state, undefined);

  const older = applyAll(stored, [message('2026-08-20T09:00:00.000Z', false)]);
  equal('PostgREST 格式的較新值不被舊信蓋掉', older.mail_state, undefined);

  const newer = applyAll(stored, [message('2026-08-22T09:00:00.000Z', false)]);
  equal('確實較新的信仍然套用', newer.mail_state, 'replied_pending');
}

// --- 5. 主旨只在原本是空的時候補寫 ---------------------------------------
{
  const forwarded = applyAll(newThread(), [message('2026-08-22T09:00:00.000Z', false, { subject: 'Fwd: 報名確認' })]);
  equal('轉寄不改串名', forwarded.subject, '報名確認');

  const blank = threadStateUpdate(newThread({ subject: '' }), message('2026-08-22T09:00:00.000Z', false, { subject: '報名確認' }), FOLLOW_UP_DAYS, NOW);
  equal('原本沒有主旨才補寫', blank.subject, '報名確認');
}

console.log(`check-mail-state: ${passed} assertions passed`);
