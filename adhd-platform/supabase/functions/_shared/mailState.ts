/**
 * 一封信同步進來之後，那條信件串的狀態該變成什麼。
 *
 * 為什麼要抽成純函式：這段判斷原本直接寫在 gmail-sync 的迴圈裡，每處理一封信就寫一次
 * 整條 thread 的狀態。而 Gmail 的 messages.list 回傳順序是**新到舊**，所以最後落地的
 * 是這一批裡**最舊**的那一封——你回了信、狀態轉黃，下一次同步把更早的那封來信處理完，
 * 狀態就被蓋回「已回覆・待處理」，紅點永遠滅不掉。
 *
 * 錯誤本身很小，但它藏在副作用裡：迴圈跑完只看得到最終結果，看不到中間被覆蓋幾次。
 * 抽成「輸入一個 thread 現況與一封信，輸出要寫回去的欄位」之後，
 * 「最新那封才算數」變成一句可以直接斷言的話（scripts/check-mail-state.mjs）。
 */

/** 資料庫裡這條信件串現在的樣子（只取判斷會用到的欄位）。 */
export interface ThreadRow {
  subject?: string | null;
  registration_id?: string | null;
  contact_id?: string | null;
  last_message_at?: string | null;
  last_outbound_at?: string | null;
  last_inbound_at?: string | null;
}

/** 剛剛同步進來的那一封信。 */
export interface SyncedMessage {
  /** 這封信的時間（ISO 字串）。 */
  messageAt: string;
  /** 是我們寄出去的嗎。 */
  outbound: boolean;
  /** Gmail 上仍標著 UNREAD 嗎。 */
  unread: boolean;
  subject: string;
  counterpart: string;
}

/**
 * 時間比較一律走 Date.parse，不用字串比大小。
 *
 * PostgREST 讀回來的 timestamptz 長成 `2026-08-29T06:15:00+00:00`，而我們寫進去的是
 * `new Date().toISOString()` 產生的 `2026-08-29T06:15:00.000Z`。同一個時刻、兩種寫法，
 * 字串比大小會得到錯的答案（'+' < '.'），於是「這封比較新嗎」在某些筆上直接翻面。
 */
function timeOf(value?: string | null): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

/** 嚴格「比較新」。同一時刻不算——重新同步同一封信不該把人工標記的狀態洗掉。 */
function isNewerThan(candidate: string, stored?: string | null): boolean {
  const value = Date.parse(candidate);
  if (Number.isNaN(value)) return false;
  return value > timeOf(stored);
}

export function threadStateUpdate(
  thread: ThreadRow,
  message: SyncedMessage,
  followUpDays: number,
  now: string = new Date().toISOString(),
): Record<string, unknown> {
  const { messageAt, outbound } = message;

  const update: Record<string, unknown> = {
    // 主旨在建串時就定了，之後不再覆寫：轉寄一次整條串就會改名成「Fwd: …」，
    // 而使用者是靠這個名字在收件匣裡找那條往來的。只有原本是空的才補寫。
    ...(thread.subject ? {} : { subject: message.subject }),
    counterpart_email: message.counterpart,
    updated_at: now,
  };

  // 方向時間戳各自獨立推進：補收到一封很舊的來信，不該把「最後寄出時間」也一起改掉。
  if (outbound && isNewerThan(messageAt, thread.last_outbound_at)) {
    update.last_outbound_at = messageAt;
    update.follow_up_due_at = new Date(Date.parse(messageAt) + followUpDays * 86400000).toISOString();
  }
  if (!outbound && isNewerThan(messageAt, thread.last_inbound_at)) {
    update.last_inbound_at = messageAt;
  }

  // 這裡是整段的重點：狀態機欄位只由**目前已知最新的那一封信**決定。
  // 補進來的舊信只會補齊往來紀錄與方向時間戳，不會改變「這條串現在走到哪」。
  //
  // 用嚴格大於而不是大於等於：同一封信被重新同步時（upsert 是常態）時間完全相同，
  // 若允許相等就會再寫一次 replied_pending，把人工按下的「已處理」洗掉——
  // 那就是換一種方式回到「紅點滅不掉」。
  if (isNewerThan(messageAt, thread.last_message_at)) {
    update.has_unread = !outbound && message.unread;
    // 掛不到報名或聯絡人的信件串不會被標成「要回覆」——那會是一封要回覆但不知道
    // 要回給誰的信，只會在待辦清單上排隊。
    update.needs_reply = !outbound && Boolean(thread.registration_id || thread.contact_id);
    update.status = outbound ? 'waiting' : 'open';
    update.mail_state = outbound ? 'waiting_reply' : 'replied_pending';
    update.last_message_at = messageAt;
  }

  return update;
}
