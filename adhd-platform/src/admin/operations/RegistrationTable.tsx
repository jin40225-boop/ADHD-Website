import { useEffect, useState, type ReactNode } from 'react';
import type { SessionSlot } from '@contracts/types';
import type { ContactRecord, MailState, OperationalRegistration } from './types';

/** 03_v4 的核可狀態流。值一個都沒改，只有標籤改成定稿用語＋新增 reschedule。 */
export const STATUS_OPTIONS = ['pending', 'reviewing', 'confirmed', 'success', 'waitlist', 'rejected', 'reschedule', 'withdrawn', 'cancelled'];
export const STATUS_LABEL: Record<string, string> = {
  pending: '待審核', reviewing: '回信確認中', confirmed: '報名成功', success: '錄取／完成',
  waitlist: '候補', rejected: '退回', reschedule: '待改訂時間', withdrawn: '中途放棄', cancelled: '已取消',
};
/** 下拉本身帶顏色（03_v4：外觀像標籤、實際是 select）。 */
const STATUS_TONE: Record<string, string> = {
  pending: 'gray', reviewing: 'yellow', confirmed: 'green', success: 'green',
  waitlist: 'orange', rejected: 'red', reschedule: 'purple', withdrawn: 'gray', cancelled: 'gray',
};

const MAIL_LABEL: Record<MailState, string> = {
  not_sent: '未寄信', waiting_reply: '已寄出・等待回覆', overdue: '⚠ 逾期未回覆', reminded: '已催覆',
  replied_pending: '🔴 已回覆・待處理', handled: '已處理', attend_confirmed: '✅ 已確認出席', reschedule_requested: '🔁 請假改期',
};
const MAIL_TONE: Record<MailState, string> = {
  not_sent: 'gray', waiting_reply: 'yellow', overdue: 'orange', reminded: 'yellow',
  replied_pending: 'red', handled: 'green', attend_confirmed: 'green', reschedule_requested: 'purple',
};

export interface RegistrationPatch {
  reminderSentAt?: string | null;
  counselorConfirmed?: boolean | null;
  finalSlotAt?: string | null;
  /** 改信箱要連 answers.email 一起改，否則名冊與表單答案會各說各話。 */
  email?: string;
}

export interface RowContext {
  registration: OperationalRegistration;
  contact: ContactRecord;
  /** 這筆報名的主場次（session_ids 的第一筆）；導航＝該月名額。 */
  session?: SessionSlot;
  /** 同專案的所有場次，供「確定場次」下拉選。 */
  projectSessions: SessionSlot[];
  busy: boolean;
  patch: (input: RegistrationPatch) => void;
  setStatus: (status: string) => void;
  /** 走 admin_move_registration_sessions，原場次與新場次名額原子同步。 */
  setSessions: (sessionIds: string[]) => void;
  open: () => void;
}

export interface RegistrationColumn {
  key: string;
  header: string;
  cell: (row: RowContext) => ReactNode;
}

/** ISO → datetime-local 需要的本機時間字串（不是 UTC，直接切 ISO 會差 8 小時）。 */
export function toLocalInput(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MailStatusTag({ registration }: { registration: OperationalRegistration }) {
  const status = registration.mailStatus;
  if (!status) return <span className="ops-status ops-status--gray">未寄信</span>;
  const label = status.effective === 'overdue' && status.overdueDays > 0
    ? `⚠ 逾 ${status.overdueDays} 天未回覆`
    : status.effective === 'waiting_reply' && status.lastOutboundAt
      ? `已寄出・等待回覆（${daysSince(status.lastOutboundAt)} 天）`
      : MAIL_LABEL[status.effective];
  return <span className={`ops-status ops-status--${MAIL_TONE[status.effective]}`} title={status.override ? `手動覆寫${status.overrideReason ? `：${status.overrideReason}` : ''}` : '自動判定'}>
    {label}{status.override ? ' ✎' : ''}
  </span>;
}

function daysSince(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

const nameColumn: RegistrationColumn = {
  key: 'name',
  header: 'Aa 姓名',
  cell: (row) => <button type="button" className="ops-cell-name" onClick={row.open}>
    <strong>{row.contact.displayName || row.registration.email}</strong>
    {row.registration.hasUnreadReply ? <span className="ops-dot" title="有未讀回信" /> : null} ▸
  </button>,
};

const statusColumn: RegistrationColumn = {
  key: 'status',
  header: '◉ 審核狀態（可改）',
  cell: (row) => <select
    className={`ops-cell-select ops-cell-select--${STATUS_TONE[row.registration.status] ?? 'gray'}`}
    value={row.registration.status}
    disabled={row.busy}
    onChange={(e) => row.setStatus(e.target.value)}
  >
    {/* 舊資料可能有不在清單裡的狀態值，補一個選項才不會被下拉悄悄改掉。 */}
    {(STATUS_OPTIONS.includes(row.registration.status) ? STATUS_OPTIONS : [row.registration.status, ...STATUS_OPTIONS])
      .map((status) => <option key={status} value={status}>{STATUS_LABEL[status] ?? status}</option>)}
  </select>,
};

const mailColumn: RegistrationColumn = { key: 'mail', header: '✉ 信件狀態（自動＋可覆寫）', cell: (row) => <MailStatusTag registration={row.registration} /> };

const reminderColumn: RegistrationColumn = {
  key: 'reminder',
  header: '☑ 已寄信提醒',
  cell: (row) => <input
    type="checkbox"
    className="ops-cell-check"
    checked={Boolean(row.registration.reminderSentAt)}
    disabled={row.busy}
    title={row.registration.reminderSentAt ? `寄出於 ${new Date(row.registration.reminderSentAt).toLocaleString('zh-TW')}` : '尚未寄送'}
    onChange={(e) => row.patch({ reminderSentAt: e.target.checked ? new Date().toISOString() : null })}
  />,
};

const counselorColumn: RegistrationColumn = {
  key: 'counselor',
  header: '◉ 諮商師回覆確認',
  cell: (row) => <select
    className={`ops-cell-select ops-cell-select--${row.registration.counselorConfirmed === true ? 'green' : row.registration.counselorConfirmed === false ? 'red' : 'gray'}`}
    value={row.registration.counselorConfirmed === true ? 'yes' : row.registration.counselorConfirmed === false ? 'no' : ''}
    disabled={row.busy}
    onChange={(e) => row.patch({ counselorConfirmed: e.target.value === 'yes' ? true : e.target.value === 'no' ? false : null })}
  >
    <option value="">—</option><option value="yes">可</option><option value="no">不可</option>
  </select>,
};

const monthColumn: RegistrationColumn = {
  key: 'month',
  header: '📅 報名月份',
  cell: (row) => {
    if (!row.session) return <span className="ops-cell-muted">—</span>;
    const month = new Date(row.session.startsAt).getMonth() + 1;
    const done = row.session.status === 'done';
    return <span className={`ops-status ops-status--${done ? 'gray' : 'blue'}`}>{month} 月{done ? '・已完成' : ''}</span>;
  },
};

const finalSlotColumn: RegistrationColumn = {
  key: 'finalSlot',
  header: '✅ 最終確定時段',
  cell: (row) => <input
    type="datetime-local"
    className="ops-cell-datetime"
    value={toLocalInput(row.registration.finalSlotAt)}
    disabled={row.busy}
    onChange={(e) => row.patch({ finalSlotAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
  />,
};

const ageColumn: RegistrationColumn = {
  key: 'age',
  header: '年齡',
  cell: (row) => <span className="ops-cell-muted">{textAnswer(row.registration, 'age') || '—'}</span>,
};

const sessionColumn: RegistrationColumn = {
  key: 'session',
  header: '🕐 場次',
  cell: (row) => row.session
    ? <span className="ops-cell-muted">{new Date(row.session.startsAt).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
    : <span className="ops-cell-muted">—</span>,
};

const createdColumn: RegistrationColumn = {
  key: 'created',
  header: '報名時間',
  cell: (row) => <span className="ops-cell-muted">{new Date(row.registration.createdAt).toLocaleDateString('zh-TW')}</span>,
};

export function textAnswer(registration: OperationalRegistration, key: string) {
  const value = registration.answers?.[key];
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string').join('、');
  return '';
}

/** 同一個欄位在不同分頁的表頭用語不同（例：審核狀態／處理狀態），只換標題不複製邏輯。 */
function withHeader(column: RegistrationColumn, header: string): RegistrationColumn {
  return { ...column, header };
}

/** 唯讀的表單答案欄。 */
function answerColumn(key: string, header: string, fallbackKey?: string): RegistrationColumn {
  return {
    key,
    header,
    cell: (row) => {
      const value = textAnswer(row.registration, key) || (fallbackKey ? textAnswer(row.registration, fallbackKey) : '');
      return <span className="ops-cell-muted">{value || '—'}</span>;
    },
  };
}

/** 出席方式＝方式本身＋同行對象，兩個 key 合成一格才讀得懂。 */
const attendColumn: RegistrationColumn = {
  key: 'attend',
  header: '出席方式',
  cell: (row) => {
    const mode = textAnswer(row.registration, 'attendMode');
    const withWhom = textAnswer(row.registration, 'attendWith');
    if (!mode) return <span className="ops-cell-muted">—</span>;
    return <span className="ops-status ops-status--gray">{mode}{withWhom ? `・${withWhom}` : ''}</span>;
  },
};

/** 孩子是可增減的重複群組，一位一個標籤。 */
const childrenColumn: RegistrationColumn = {
  key: 'children',
  header: '🧒 孩子',
  cell: (row) => {
    const children = row.registration.answers?.children;
    if (!Array.isArray(children) || !children.length) return <span className="ops-cell-muted">—</span>;
    return <span className="ops-chip-row">{children.map((child, index) => {
      if (typeof child !== 'object' || child === null) return null;
      const field = (key: string) => { const v = (child as Record<string, string | string[]>)[key]; return typeof v === 'string' ? v : Array.isArray(v) ? v.join('、') : ''; };
      const parts = [field('alias') || `第 ${index + 1} 位`, field('gender'), field('age') ? `${field('age')} 歲` : '', field('medication')].filter(Boolean);
      return <span className="ops-status ops-status--gray" key={index}>{parts.join('・')}</span>;
    })}</span>;
  },
};

/** 確定場次：直接在格內換場次，走原子移轉。 */
const sessionSelectColumn: RegistrationColumn = {
  key: 'sessionPick',
  header: '🕐 確定場次（可改）',
  cell: (row) => <select
    className={`ops-cell-select ops-cell-select--${row.session ? 'green' : 'gray'}`}
    value={row.session?.id ?? ''}
    disabled={row.busy}
    onChange={(e) => row.setSessions(e.target.value ? [e.target.value] : [])}
  >
    <option value="">未指定</option>
    {row.projectSessions.map((session) => <option key={session.id} value={session.id}>
      {new Date(session.startsAt).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}｜{session.title}
    </option>)}
  </select>,
};

/** 格內編輯信箱：離開欄位才送出，免得每打一個字就打一次資料庫。 */
function EmailCell({ row }: { row: RowContext }) {
  const [value, setValue] = useState(row.registration.email);
  useEffect(() => { setValue(row.registration.email); }, [row.registration.email]);
  const commit = () => {
    const next = value.trim();
    if (!next || next === row.registration.email) { setValue(row.registration.email); return; }
    row.patch({ email: next });
  };
  return <input
    className="ops-cell-text" type="email" value={value} disabled={row.busy}
    onChange={(e) => setValue(e.target.value)} onBlur={commit}
    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setValue(row.registration.email); }}
  />;
}

const emailColumn: RegistrationColumn = { key: 'email', header: '✉ 信箱（可改）', cell: (row) => <EmailCell row={row} /> };

/** 導航計畫分頁的欄位，逐欄對應 03_v4 的表頭。 */
export const NAVIGATOR_COLUMNS = [nameColumn, statusColumn, mailColumn, reminderColumn, counselorColumn, monthColumn, finalSlotColumn, ageColumn];
/** 親職諮詢分頁（03_v4 的表頭＋使用者指定補上的家庭型態）。 */
export const PARENT_COLUMNS = [
  withHeader(nameColumn, 'Aa 稱呼'),
  withHeader(statusColumn, '◉ 處理狀態（可改）'),
  mailColumn,
  answerColumn('relationship', '身份', 'relationshipOther'),
  answerColumn('familyType', '家庭型態'),
  attendColumn,
  childrenColumn,
  sessionSelectColumn,
  reminderColumn,
];
/** 同儕聚會分頁（03_v4）。聚會是統計性質，沒有審核狀態欄。 */
export const PEER_COLUMNS = [
  withHeader(nameColumn, 'Aa 姓名／稱呼'),
  withHeader(sessionSelectColumn, '場次（可改）'),
  emailColumn,
  answerColumn('phone', '📱 手機'),
  answerColumn('note', '想聊的話題'),
  withHeader(reminderColumn, '☑ 提醒信'),
];
/** 其餘分頁在 3-3 換上各自的欄位前，先用這組共通欄位，功能不缺。 */
export const DEFAULT_COLUMNS = [nameColumn, statusColumn, mailColumn, reminderColumn, sessionColumn, createdColumn];

export function RegistrationTable({ columns, rows }: { columns: RegistrationColumn[]; rows: RowContext[] }) {
  return <div className="ops-table-wrap">
    <table className="ops-table ops-table--editable">
      <thead><tr>{columns.map((column) => <th key={column.key}>{column.header}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row.registration.id} className={row.busy ? 'ops-row--busy' : undefined}>
        {columns.map((column) => <td key={column.key}>{column.cell(row)}</td>)}
      </tr>)}</tbody>
    </table>
  </div>;
}
