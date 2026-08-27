/**
 * 名冊匯出。零第三方套件——這個 repo 目前沒有任何匯出用相依，為了一支 CSV 拉一包
 * 進來不划算，而 CSV 本身就是三行字串處理。
 */
import type { SessionSlot } from '@contracts/types';
import type { ContactRecord, OperationalRegistration } from './types';
import { formatAnswerValue } from './answerLabels';

/**
 * 欄值裡的 Tab 與換行一律換成空格。
 * 自由填答（「最想處理的一件事」是 textarea）幾乎一定帶換行，不處理的話 Excel 會把
 * 一個人的一列拆成好幾列——看起來像多了幾個報名者，而那正是名冊最不能出錯的地方。
 */
function cell(value: string) {
  return String(value ?? '').replace(/[\t\r\n]+/g, ' ').trim();
}

/** 一律加引號並把內部引號加倍：逗號、引號、全形符號一起處理，規則只有一條就不會漏。 */
function quote(value: string) {
  return `"${cell(value).replace(/"/g, '""')}"`;
}

/**
 * 組 CSV 字串。前綴 BOM——沒有它，Excel 會以系統編碼開啟，
 * 中文全部變亂碼；使用者拿到的第一個印象就是「這個匯出壞了」。
 */
export function toCsv(rows: string[][]): string {
  return `\uFEFF${rows.map((row) => row.map(quote).join(',')).join('\r\n')}\r\n`;
}

/** Blob + a[download]。用完就撤掉 objectURL，不留在記憶體裡。 */
export function downloadCsv(filename: string, rows: string[][]) {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export interface RosterExportRow {
  contact: ContactRecord;
  registration: OperationalRegistration;
}

export interface RosterCsvOptions {
  sessionById: Map<string, SessionSlot>;
  /** answers key → 標題；由 `answerLabels` 的索引接上，這裡不自己認得任何 key。 */
  labelOf: (key: string) => string;
  /** 群組內層欄位的標題（例：children.alias）。 */
  subLabelOf: (groupKey: string, subKey: string) => string;
  statusLabelOf: (status: string) => string;
  /** 講師版：只剔除聯絡方式與家長真實姓名；孩子的狀況欄位保留（講師行前準備要用）。 */
  share?: boolean;
}

/**
 * 講師版剔除的答案欄——**只剔除「怎麼找到這個人」的資料**。
 *
 * ⚠ 這裡刻意「只拿掉聯絡方式」，不要再往下砍。使用者 2026-08-27 明確指示：
 *   「我要給講師知道，不然怎麼提前確認狀況和困擾？性別、年級、有無用藥、症狀這些都是重要的一句」
 * 孩子的性別、年齡、年級、用藥、診斷與其他狀況**正是講師行前準備要用的東西**——
 * 他實際寄出的講師行前通知信裡本來就寫著就學階段、確診狀態與用藥情形。
 * 把這些砍掉會讓這份檔案失去用途，講師只會回頭來問，或改用更不安全的方式傳。
 *
 * 這份檔案的定位因此是「**給講師團隊**」，不是「可以隨便轉發」——按鈕文字要照實說。
 * 真正的保護在別的地方：孩子姓名用代號（`alias`／`childName`）、AI 生成文件的去識別化
 * 固定啟用且孩子姓名刻意不可還原、以及信裡那句「資料請限本次行前準備與會談使用」。
 */
const SHARE_EXCLUDED_KEYS = [
  'email', 'phone', 'parentName', 'contactTimes', 'contactTimeNote', 'contactMethod',
];
/** 這幾個 key 已經有自己的固定欄，不要在「其餘 answers」再出現一次。 */
const FIXED_COLUMN_KEYS = ['email', 'phone', 'parentName', 'preferredName', 'nickname', 'name'];

/** 稱呼的收斂順位與 `emailCompose.ts` 的 `姓名` 完全一致；兩邊各排一套就會叫錯人。 */
export function displayNameOf(row: RosterExportRow): string {
  const answer = (key: string) => {
    const value = row.registration.answers?.[key];
    return typeof value === 'string' ? value.trim() : '';
  };
  return answer('preferredName') || answer('nickname') || answer('parentName') || answer('name') || row.contact.displayName || row.registration.email || '';
}

function heldSessionsText(row: RosterExportRow, sessionById: Map<string, SessionSlot>) {
  return row.registration.sessionIds
    .map((id) => sessionById.get(id))
    .filter((session): session is SessionSlot => Boolean(session))
    .map((session) => `${session.title}｜${new Date(session.startsAt).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}`)
    .join('；');
}

/**
 * 名冊 → CSV 列陣列（第一列是表頭）。
 *
 * 「是否佔名額」只看 `capacityReleasedAt`：有值＝已釋放，沒值＝還佔著。
 * 不從狀態推——狀態與名額是兩件事，用狀態推會在「已退回但名額還鎖著」這種
 * 真的需要被看見的情況下說謊。
 */
export function buildRosterCsv(rows: RosterExportRow[], options: RosterCsvOptions): string[][] {
  const { sessionById, labelOf, subLabelOf, statusLabelOf, share = false } = options;
  const skip = new Set([...FIXED_COLUMN_KEYS, ...(share ? SHARE_EXCLUDED_KEYS : [])]);

  // 欄位順序取所有列的聯集、依第一次出現的順序——同一場次不同人填的題目不一定一樣
  // （條件顯示欄位），用單一列決定欄位會讓其他人的答案整欄消失。
  const answerKeys: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row.registration.answers ?? {})) {
      if (!skip.has(key) && !answerKeys.includes(key)) answerKeys.push(key);
    }
  }

  const fixedHeaders = share
    ? ['稱呼', '報名狀態', '佔用場次', '是否佔名額']
    : ['稱呼', '家長姓名', 'Email', '電話', '報名狀態', '佔用場次', '是否佔名額'];
  const header = [...fixedHeaders, ...answerKeys.map(labelOf)];

  const body = rows.map((row) => {
    const answer = (key: string) => {
      const value = row.registration.answers?.[key];
      // 兩個版本的孩子欄位一律完整展開（性別／年級／用藥／症狀）。
      // 曾經有一版在講師版只留代號，被使用者退回：那些正是講師行前準備要看的，
      // 砍掉之後這份檔案就沒有用途，講師只會回頭來問、或改用更不安全的方式傳。
      return formatAnswerValue(key, value, sessionById, (subKey) => subLabelOf(key, subKey));
    };
    const fixed = share
      ? [displayNameOf(row), statusLabelOf(row.registration.status), heldSessionsText(row, sessionById), row.registration.capacityReleasedAt ? '否（已釋放）' : '是']
      : [
        displayNameOf(row),
        typeof row.registration.answers?.parentName === 'string' ? row.registration.answers.parentName : '',
        row.registration.email || row.contact.primaryEmail || '',
        typeof row.registration.answers?.phone === 'string' ? row.registration.answers.phone : row.contact.phone || '',
        statusLabelOf(row.registration.status),
        heldSessionsText(row, sessionById),
        row.registration.capacityReleasedAt ? '否（已釋放）' : '是',
      ];
    return [...fixed, ...answerKeys.map(answer)];
  });

  return [header, ...body];
}
