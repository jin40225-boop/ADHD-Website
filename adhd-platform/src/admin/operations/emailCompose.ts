import type { SessionSlot } from '@contracts/types';
import type { ContactRecord, OperationalRegistration } from './types';

/**
 * 範本變數帶入。**在後台載入範本時就替換完成**，不是寄出時才在後端替換——
 * 使用者審閱到的必須就是實際會寄出的字（裁決 15：草稿一律經使用者審閱）。
 * 認不得的變數原樣留著並列進 missing，讓人一眼看到還有洞沒補，而不是靜靜換成空字串。
 */
export interface ComposeContext {
  姓名: string;
  場次: string;
  時段: string;
  Meet連結: string;
  計畫名: string;
  團隊署名: string;
  月份: string;
  場次清單: string;
  報名連結: string;
}

/** 撰寫面板列在編輯框上方的可用變數；順序即顯示順序。 */
export const TEMPLATE_VARIABLES: (keyof ComposeContext)[] = [
  '姓名', '計畫名', '場次', '月份', '時段', '場次清單', 'Meet連結', '報名連結', '團隊署名',
];

/**
 * 署名依專案而不同：兩個計畫是不同的人在寫信，署名寫錯比沒有署名更失禮。
 * 沒有列在這裡的專案回空字串——它會被列進「沒有值的變數」，由使用者自己補，
 * 而不是替他掛上一個可能不對的名字。
 */
const TEAM_SIGNATURE: Record<string, string> = {
  parent: '家長諮詢服務團隊',
  navigator: '大A彥宇、諮商心理師 鏡子',
};

export type LetterKind = 'confirm' | 'follow_up' | 'notice' | 'bulk' | 'instructor' | 'reject';

/**
 * 信件類型：以 `email_templates.letter_kind` 為準。
 *
 * 欄位是 null 時才退回名稱判斷，而名稱判斷本身已經不可靠——範本改過名（確認時段→確認信・導航版、
 * 報名成功通知→確認信・親職版、確認信→收件通知），一個叫「收件通知」的範本在舊規則下會被當成
 * 要附出席確認按鈕的信。因此這裡認不出來就回 undefined，讓預設落在「不附按鈕」那一邊：
 * 少勾一個框使用者看得到，多附兩個連結寄出去才發現看不到。
 */
export function letterKindOf(template: { letterKind?: LetterKind | null; name: string }): LetterKind | undefined {
  if (template.letterKind) return template.letterKind;
  const name = template.name;
  // 「出席確認信（催覆）」同時含「確認」與「催覆」，催覆要先判，否則會被當成確認信。
  if (name.includes('催覆') || name.includes('出席確認')) return 'follow_up';
  if (name.includes('回絕') || name.includes('婉拒')) return 'reject';
  if (name.includes('講師') || name.includes('客座')) return 'instructor';
  // 「改期確認信」含「確認信」，落到下一行就會被當成 confirm 而掛上出席確認按鈕——
  // 但那是一封只想跟對方商量新時間的信，附「我確認出席」等於問錯問題。所以改期先判。
  if (name.includes('改期') || name.includes('改時間') || name.includes('挪動')) return 'notice';
  if (name.includes('確認信') || name.includes('確認時段') || name.includes('報名成功')) return 'confirm';
  if (name.includes('宣傳') || name.includes('群發')) return 'bulk';
  if (name.includes('通知') || name.includes('聯繫')) return 'notice';
  return undefined;
}

const pad = (value: number) => String(value).padStart(2, '0');
const dateLabel = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}（${'日一二三四五六'[d.getDay()]}）`;
};
const timeLabel = (iso: string) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

function answerText(registration: OperationalRegistration, key: string) {
  const value = registration.answers?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

/** 開放報名的場次：與前台「即將場次」同一個定義（`open`／`full` 且尚未結束）。 */
function openSessions(sessions: SessionSlot[], now: Date) {
  return sessions
    .filter((item) => (item.status === 'open' || item.status === 'full') && new Date(item.endsAt).getTime() >= now.getTime())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/**
 * 該月開放報名的場次，一行一個，**跨服務線**。群發信不對應任何單一場次，月度宣傳信本來
 * 就是列整個月有哪些場次；一對一的信沿用同一份，兩邊講的月份內容才會一致。
 */
function sessionList(sessions: SessionSlot[], month: number | undefined, now: Date) {
  if (month === undefined) return '';
  return openSessions(sessions, now)
    .filter((item) => new Date(item.startsAt).getMonth() === month)
    .map((item) => `・${item.title}｜${dateLabel(item.startsAt)} ${timeLabel(item.startsAt)}–${timeLabel(item.endsAt)}`)
    .join('\n');
}

/**
 * 群發可用的「非個人」變數。裁決 4 擋的是報名者個人變數與出席確認按鈕，這三個都不是個人資料。
 * 其餘變數刻意不給：群發沒有單一對象，`{{姓名}}` 之類留在原地會被寄出前的守門擋下。
 */
export function buildBulkContext(sessions: SessionSlot[], siteBase = '', now = new Date()): Partial<ComposeContext> {
  // 最近一個還有開放場次的月份就是「這封信在講的那個月」。
  const next = openSessions(sessions, now)[0];
  const month = next ? new Date(next.startsAt).getMonth() : undefined;
  return {
    月份: month === undefined ? '' : `${month + 1} 月`,
    場次清單: sessionList(sessions, month, now),
    // 群發跨服務線，沒有單一報名頁可指；首頁本來就列著所有開放中的月份。
    報名連結: siteBase,
  };
}

export function buildContext(
  registration: OperationalRegistration,
  contact: ContactRecord | undefined,
  sessions: SessionSlot[],
  /** 站台根網址（結尾帶 /），用來組報名連結。由呼叫端傳入，這個函式才留得住純函式的可測性。 */
  siteBase = '',
  now = new Date(),
): ComposeContext {
  // 稱呼優先用報名者自己填的（親職填「希望如何被稱呼」、同儕填暱稱），沒有才退回人物主檔。
  const 姓名 = answerText(registration, 'preferredName')
    || answerText(registration, 'nickname')
    || answerText(registration, 'parentName')
    || answerText(registration, 'name')
    || contact?.displayName
    || '';
  const session = registration.sessionIds.map((id) => sessions.find((item) => item.id === id)).find(Boolean);
  // 已敲定的確切時段優先於場次的預設時間——導航是先給候選、確定後才有真正的時間。
  const 時段 = registration.finalSlotAt
    ? `${dateLabel(registration.finalSlotAt)} ${timeLabel(registration.finalSlotAt)}`
    : session ? `${dateLabel(session.startsAt)} ${timeLabel(session.startsAt)}–${timeLabel(session.endsAt)}` : '';
  // 月份取已敲定的時段，沒有才取場次——兩者都沒有就留白（會被列進沒有值的變數）。
  const monthSource = registration.finalSlotAt || session?.startsAt;
  const slug = registration.projectSlug ?? '';
  return {
    姓名,
    場次: session ? session.title : '',
    時段,
    Meet連結: session?.meetUrl ?? '',
    計畫名: registration.projectName ?? '',
    團隊署名: TEAM_SIGNATURE[slug] ?? '',
    月份: monthSource ? `${new Date(monthSource).getMonth() + 1} 月` : '',
    場次清單: sessionList(sessions, monthSource ? new Date(monthSource).getMonth() : undefined, now),
    報名連結: slug && siteBase ? `${siteBase}${slug}/register` : '',
  };
}

/**
 * 空值是合法值的變數：同儕聚會沒有定義團隊署名，那是刻意留白，不是漏填。
 * 這種變數為空時整個拿掉（連同左右多餘的空白），也不列進缺值警告——否則每封同儕的信
 * 都會掛一個永遠補不掉的提示，久了就沒有人會看那個提示。
 */
const BLANK_IS_VALID: (keyof ComposeContext)[] = ['團隊署名'];

/** 拿掉留白的變數，順便收掉它留下的空白：「大A彥宇  敬上」不該有兩個空格，行首也不該多一個。 */
function dropBlank(text: string, key: string) {
  return text.replace(new RegExp(`[ \\t]*\\{\\{\\s*${key}\\s*\\}\\}[ \\t]*`, 'g'), (whole, offset: number) => {
    const before = text[offset - 1];
    const after = text[offset + whole.length];
    // 前後都還有字才留一個空格；在行首或行尾就整段收掉。
    return before && after && before !== '\n' && after !== '\n' ? ' ' : '';
  });
}

export function applyTemplate(text: string, context: Partial<ComposeContext>): { text: string; missing: string[] } {
  const missing: string[] = [];
  let source = text;
  for (const key of BLANK_IS_VALID) {
    if (key in context && !context[key]) source = dropBlank(source, key);
  }
  const filled = source.replace(/\{\{([^}]+)\}\}/g, (whole, rawKey: string) => {
    const key = rawKey.trim() as keyof ComposeContext;
    const value = context[key];
    if (typeof value !== 'string' || !value) { missing.push(rawKey.trim()); return whole; }
    return value;
  });
  return { text: filled, missing: [...new Set(missing)] };
}

/**
 * 還有沒有沒帶進去的變數？群發只有這一次機會——一按下去就同時寄給所有人，
 * 沒有「寄出前逐封補」那一步，所以殘留的 {{...}} 必須擋在寄出之前。
 */
export function residualVariables(...texts: string[]): string[] {
  const found = texts.flatMap((text) => [...text.matchAll(/\{\{([^}]+)\}\}/g)].map((match) => match[1].trim()));
  return [...new Set(found)];
}

export interface BulkRecipient { contactId: string; displayName: string; email: string; via: string }

/**
 * 「已退回／中途放棄／已取消」的報名不算這場還有效的人。拼法在這個專案裡兩種同時存在
 * （cancelled／canceled，見 `admin_transition_registration` 的釋額清單），兩種都要擋，
 * 比對前先小寫化以防萬一。
 */
const NON_ATTENDING_STATUS = new Set(['rejected', 'withdrawn', 'cancelled', 'canceled']);

/**
 * 某場次目前仍算數的報名者，對應到的聯絡人 id（去重）。
 * 只看「這人在這場有沒有一筆還算數的報名」，不管他是否同時報了別場——
 * 選單一場次時，報兩場的人只該算一次。
 */
export function sessionAttendeeIds(
  contacts: { id: string; registrations: { sessionIds: string[]; status: string }[] }[],
  sessionId: string,
): string[] {
  return contacts
    .filter((contact) => contact.registrations.some(
      (reg) => reg.sessionIds.includes(sessionId) && !NON_ATTENDING_STATUS.has(reg.status.toLowerCase()),
    ))
    .map((contact) => contact.id);
}

/**
 * 群發名單：選定類群的成員 ＋ 選定場次的報名者 ＋ 另外加選的人 － 排除的人，依聯絡人去重。
 * 沒有信箱的人不會進名單（也不會被靜靜吞掉，另外回報在 skipped）——寄不到卻顯示「已寄出 N 封」
 * 是最容易讓人以為通知過了的假象。
 */
export function resolveBulkRecipients(
  groups: { id: string; name: string; members: { contactId: string }[] }[],
  contacts: { id: string; displayName: string; primaryEmail?: string; noBulkEmail?: boolean }[],
  selection: {
    groupIds: string[]; includeIds: string[]; excludeIds: string[];
    /** 依場次選出的收件人，來源標籤已由呼叫端算好（例如「場次 8/16 14:00」）。 */
    sessionIncludes?: { contactId: string; via: string }[];
  },
): { recipients: BulkRecipient[]; skipped: { displayName: string; reason: string }[] } {
  const byId = new Map(contacts.map((contact) => [contact.id, contact]));
  const excluded = new Set(selection.excludeIds);
  const via = new Map<string, string>();
  for (const group of groups) {
    if (!selection.groupIds.includes(group.id)) continue;
    for (const member of group.members) if (!via.has(member.contactId)) via.set(member.contactId, group.name);
  }
  for (const item of selection.sessionIncludes ?? []) if (!via.has(item.contactId)) via.set(item.contactId, item.via);
  for (const id of selection.includeIds) if (!via.has(id)) via.set(id, '個別加選');

  const recipients: BulkRecipient[] = []; const skipped: { displayName: string; reason: string }[] = [];
  for (const [contactId, source] of via) {
    if (excluded.has(contactId)) continue;
    const contact = byId.get(contactId);
    if (!contact) { skipped.push({ displayName: contactId, reason: '找不到這個聯絡人' }); continue; }
    // 本人表示不收群發。列出來而不是靜靜消失——名單少一個人要看得見理由，
    // 而且這個理由不會因為報名狀態變動而失效，它記在人身上。
    if (contact.noBulkEmail) { skipped.push({ displayName: contact.displayName, reason: '不接收群發' }); continue; }
    if (!contact.primaryEmail) { skipped.push({ displayName: contact.displayName, reason: '沒有信箱' }); continue; }
    recipients.push({ contactId, displayName: contact.displayName, email: contact.primaryEmail, via: source });
  }
  recipients.sort((a, b) => a.displayName.localeCompare(b.displayName, 'zh-Hant'));
  return { recipients, skipped };
}

/** 催覆信要帶回覆期限；沿用範本原文，只在信末補一行明確的期限。 */
export function withReplyDeadline(body: string, deadline: Date) {
  const label = `${deadline.getFullYear()}/${pad(deadline.getMonth() + 1)}/${pad(deadline.getDate())}`;
  return `${body}\n\n（麻煩在 ${label} 前回覆，逾期我們會先把名額釋出給候補的家庭，之後仍可再報名。）`;
}
