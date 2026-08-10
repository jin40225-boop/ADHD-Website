import { useEffect, useState, type ReactNode } from 'react';
import type { SessionSlot } from '@contracts/types';
import { Select, TextInput } from '@/components/ui/FormField/FormField';
import { WarmButton } from '@/components/ui/WarmButton/WarmButton';
import { setMailStateOverride } from './api';
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

export const MAIL_LABEL: Record<MailState, string> = {
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
  /**
   * 這筆報名**實際佔住的所有場次**。
   *
   * 一定要有這一項：報名表的時段欄是「可複選」，家長勾兩個時段就會各扣一個名額
   * （`enforce_session_capacity` 逐一遞增），而確認錄取只改狀態、不會動 session_ids。
   * 在此之前這一欄只餵 `session`（第一筆），所以「一筆報名佔著兩個時段」在清單上
   * 完全看不出來——只有點進詳情的場次移轉面板才看得到。
   */
  heldSessions: SessionSlot[];
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

/**
 * 手動覆寫信件狀態（裁決 11）。欄位（`mail_state_override` 一組四欄）從 Phase 1 就在，
 * 表頭也一直寫著「自動＋可覆寫」，但一直沒有入口——宣稱有、實際沒有，比誠實地寫「不可改」更糟。
 *
 * 覆寫不動 `mail_state`：那一欄記的是最後真的發生了什麼，改它等於竄改事實。原因必填，
 * 因為覆寫是一個人推翻系統判斷的決定，三個月後要看得懂當初為什麼。
 */
export function MailOverrideEditor({ registration, onDone, onError }: {
  registration: OperationalRegistration;
  onDone: (message: string) => Promise<void> | void;
  onError: (message: string) => void;
}) {
  const status = registration.mailStatus;
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<MailState | ''>(status?.override ?? '');
  const [reason, setReason] = useState(status?.overrideReason ?? '');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setState(status?.override ?? ''); setReason(status?.overrideReason ?? ''); setOpen(false); }, [registration.id, status?.override, status?.overrideReason]);

  if (!status?.threadId) {
    return <p className="ops-override-hint">尚無信件往來，沒有可覆寫的對象——寄出第一封信之後這裡才會出現覆寫入口。</p>;
  }
  const save = async (next: MailState | null) => {
    setBusy(true);
    try {
      await setMailStateOverride(status.threadId, next, reason);
      await onDone(next ? `信件狀態已手動覆寫為「${MAIL_LABEL[next]}」，原因已記錄。` : '已收回手動覆寫，交還給自動判定。');
      setOpen(false);
    } catch (e) { onError(e instanceof Error ? e.message : '覆寫信件狀態失敗'); }
    finally { setBusy(false); }
  };
  if (!open) {
    return <p className="ops-override-hint">
      {status.override ? <>目前為手動覆寫（自動判定為「{MAIL_LABEL[status.auto]}」）。</> : '目前依系統自動判定。'}
      <button type="button" className="ops-override-toggle" onClick={() => setOpen(true)}>手動覆寫…</button>
    </p>;
  }
  return <div className="ops-override-box">
    <Select label="覆寫為" value={state} onChange={(e) => setState(e.target.value as MailState | '')} disabled={busy}>
      <option value="">（不覆寫，使用自動判定）</option>
      {(Object.keys(MAIL_LABEL) as MailState[]).map((key) => <option key={key} value={key}>{MAIL_LABEL[key]}</option>)}
    </Select>
    <TextInput label="覆寫原因（必填）" value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy} placeholder="例：改用 LINE 聯繫中、電話已確認出席" />
    <div className="ops-button-row">
      <WarmButton size="sm" onClick={() => void save(state === '' ? null : state)} disabled={busy || (state !== '' && !reason.trim())}>{busy ? '儲存中…' : state === '' ? '收回覆寫' : '儲存覆寫'}</WarmButton>
      <WarmButton size="sm" variant="secondary" onClick={() => setOpen(false)} disabled={busy}>取消</WarmButton>
    </div>
  </div>;
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
  cell: (row) => {
    // Notion 匯入的舊報名把它存成 answers.reminderSent（是／否）且沒有寄出時間，推不出
    // timestamp。勾選框只綁新欄位（寫入語意才明確），舊值另外標出來，不讓表格謊稱沒寄過。
    const legacy = textAnswer(row.registration, 'reminderSent');
    return <span className="ops-inline-check">
      <input
        type="checkbox"
        className="ops-cell-check"
        checked={Boolean(row.registration.reminderSentAt)}
        disabled={row.busy}
        title={row.registration.reminderSentAt ? `寄出於 ${new Date(row.registration.reminderSentAt).toLocaleString('zh-TW')}` : '尚未寄送'}
        onChange={(e) => row.patch({ reminderSentAt: e.target.checked ? new Date().toISOString() : null })}
      />
      {!row.registration.reminderSentAt && legacy
        ? <span className="ops-cell-legacy" title="Notion 匯入的歷史紀錄，未記錄寄出時間">歷史：{legacy}</span>
        : null}
    </span>;
  },
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
  cell: (row) => {
    // 舊報名的 answers.finalSlot 是像「【五月場】5/23（六）11:00–12:00」的標籤，沒有年份，
    // 轉成 timestamp 等於猜，所以原樣顯示；要落成正式時間就自己填右邊那格。
    const legacy = textAnswer(row.registration, 'finalSlot');
    return <span className="ops-inline-check">
      <input
        type="datetime-local"
        className="ops-cell-datetime"
        value={toLocalInput(row.registration.finalSlotAt)}
        disabled={row.busy}
        onChange={(e) => row.patch({ finalSlotAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
      />
      {!row.registration.finalSlotAt && legacy
        ? <span className="ops-cell-legacy" title="Notion 匯入的歷史紀錄，原文無年份，未自動換算">歷史：{legacy}</span>
        : null}
    </span>;
  },
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

/** `childAge` 的舊資料有的填「8」有的填「8歲」，補字前先看它有沒有自己帶。 */
function ageText(value: string) {
  if (!value) return '';
  return /歲|個月/.test(value) ? value : `${value} 歲`;
}

/**
 * 孩子欄。新報名是可增減的 `children` 群組，但**現有 19 筆親職報名全部是舊的平面
 * key**（childName／childGender／…，`children` 群組零使用），所以沒有 fallback 的話
 * 這一欄對真實資料全是「—」。兩種格式都要讀。
 */
const childrenColumn: RegistrationColumn = {
  key: 'children',
  header: '🧒 孩子',
  cell: (row) => {
    const children = row.registration.answers?.children;
    if (Array.isArray(children) && children.length) {
      return <span className="ops-chip-row">{children.map((child, index) => {
        if (typeof child !== 'object' || child === null) return null;
        const field = (key: string) => { const v = (child as Record<string, string | string[]>)[key]; return typeof v === 'string' ? v : Array.isArray(v) ? v.join('、') : ''; };
        const parts = [field('alias') || `第 ${index + 1} 位`, field('gender'), ageText(field('age')), field('medication')].filter(Boolean);
        const detail = [['年級', field('grade')], ['診斷', field('diagnosis')], ['現況', field('currentStatus')], ['其他疾病史', field('otherConditions')]]
          .filter(([, value]) => value).map(([label, value]) => `${label}：${value}`).join('\n');
        return <span className="ops-status ops-status--gray" key={index} title={detail || undefined}>{parts.join('・')}</span>;
      })}</span>;
    }
    const legacy = (key: string) => textAnswer(row.registration, key);
    const parts = [legacy('childName'), legacy('childGender'), ageText(legacy('childAge')), legacy('childMedication')].filter(Boolean);
    if (!parts.length) return <span className="ops-cell-muted">—</span>;
    const detail = [['年級', legacy('childGrade')], ['現況', legacy('childStatus')], ['其他疾病史', legacy('childOtherConditions')]]
      .filter(([, value]) => value).map(([label, value]) => `${label}：${value}`).join('\n');
    return <span className="ops-chip-row"><span className="ops-status ops-status--gray" title={detail || undefined}>{parts.join('・')}</span></span>;
  },
};

/** 一筆報名佔住多個時段時的顯示格式：`12/20 09:00`。 */
function slotLabel(session: SessionSlot) {
  return new Date(session.startsAt).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

/** 確定場次：直接在格內換場次，走原子移轉。 */
const sessionSelectColumn: RegistrationColumn = {
  key: 'sessionPick',
  header: '🕐 確定場次（可改）',
  cell: (row) => {
    // 佔住多個時段時，下拉選單會說謊——它只顯示得出一個值，而這筆報名實際上把
    // 每一個被勾選的時段都扣掉了一個名額。家長「可複選」是刻意的（先給幾個可以配合
    // 的時間），但最終一定要收斂成一個；而確認錄取只改狀態、不會動 session_ids，
    // 多的那些就會一直被佔著。這裡把實況攤開，並給一鍵收斂。
    const multi = row.heldSessions.length > 1;
    // 已完成／已取消的場次不列入可選項——這份清單是用來「改成哪一場」的，
    // 把歷年場次全列出來只會讓清單長到難用。目前掛著的那些一定保留，否則會從自己的格子裡消失。
    const held = new Set(row.heldSessions.map((session) => session.id));
    const options = row.projectSessions.filter(
      (session) => held.has(session.id) || session.id === row.session?.id
        || (session.status !== 'done' && session.status !== 'cancelled'),
    );
    // 收斂動作沿用同一顆下拉——挑一個時段本來就是下拉的事，不必為這個情況換一種控制項。
    // 下拉的 onChange 一直都是 setSessions([一個 id])，本來就會收斂；缺的只是「看得出佔了幾個」。
    if (multi) {
      return <div className="ops-multi-slot">
        <span className="ops-multi-slot__warn">⚠ 佔用 {row.heldSessions.length} 個時段</span>
        <select
          className="ops-cell-select ops-cell-select--red"
          value=""
          disabled={row.busy}
          title="選一個時段收斂；其餘時段的名額會自動釋放"
          onChange={(e) => e.target.value && row.setSessions([e.target.value])}
        >
          <option value="">選定一個時段…</option>
          {options.map((session) => <option key={session.id} value={session.id}>
            {slotLabel(session)}｜{session.title}{held.has(session.id) ? '（目前佔用）' : ''}
          </option>)}
        </select>
        <small className="ops-multi-slot__list">目前佔住：{row.heldSessions.map(slotLabel).join('、')}</small>
      </div>;
    }
    return <select
      className={`ops-cell-select ops-cell-select--${row.session ? 'green' : 'gray'}`}
      value={row.session?.id ?? ''}
      disabled={row.busy}
      onChange={(e) => row.setSessions(e.target.value ? [e.target.value] : [])}
    >
      <option value="">未指定</option>
      {options.map((session) => <option key={session.id} value={session.id}>
        {new Date(session.startsAt).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}｜{session.title}
        {session.status === 'done' ? '（已完成）' : session.status === 'cancelled' ? '（已取消）' : ''}
      </option>)}
    </select>;
  },
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
/**
 * 職場生活諮詢分頁。
 *
 * 報名表沿用導航計畫的成人自填題目，但場次做法沿用親職（同一天多個時段、各自名額），
 * 所以這裡取的是「勾選場次」，而不是導航那組「報名月份／確定時段」——後者是為了
 * 跨月候選時段媒合而存在的，這條服務線用不到，放上去只會是永遠空白的欄。
 */
export const CAREER_COLUMNS = [nameColumn, statusColumn, mailColumn, answerColumn('occupation', '職業'), sessionSelectColumn, reminderColumn, ageColumn];
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
