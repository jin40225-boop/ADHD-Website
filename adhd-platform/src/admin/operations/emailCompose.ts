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

export function buildContext(
  registration: OperationalRegistration,
  contact: ContactRecord | undefined,
  sessions: SessionSlot[],
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
  return {
    姓名,
    場次: session ? session.title : '',
    時段,
    Meet連結: session?.meetUrl ?? '',
  };
}

export function applyTemplate(text: string, context: ComposeContext): { text: string; missing: string[] } {
  const missing: string[] = [];
  const filled = text.replace(/\{\{([^}]+)\}\}/g, (whole, rawKey: string) => {
    const key = rawKey.trim() as keyof ComposeContext;
    const value = context[key];
    if (typeof value !== 'string' || !value) { missing.push(rawKey.trim()); return whole; }
    return value;
  });
  return { text: filled, missing: [...new Set(missing)] };
}

export interface BulkRecipient { contactId: string; displayName: string; email: string; via: string }

/**
 * 群發名單：選定類群的成員 ＋ 另外加選的人 － 排除的人，依聯絡人去重。
 * 沒有信箱的人不會進名單（也不會被靜靜吞掉，另外回報在 skipped）——寄不到卻顯示「已寄出 N 封」
 * 是最容易讓人以為通知過了的假象。
 */
export function resolveBulkRecipients(
  groups: { id: string; name: string; members: { contactId: string }[] }[],
  contacts: { id: string; displayName: string; primaryEmail?: string }[],
  selection: { groupIds: string[]; includeIds: string[]; excludeIds: string[] },
): { recipients: BulkRecipient[]; skipped: { displayName: string; reason: string }[] } {
  const byId = new Map(contacts.map((contact) => [contact.id, contact]));
  const excluded = new Set(selection.excludeIds);
  const via = new Map<string, string>();
  for (const group of groups) {
    if (!selection.groupIds.includes(group.id)) continue;
    for (const member of group.members) if (!via.has(member.contactId)) via.set(member.contactId, group.name);
  }
  for (const id of selection.includeIds) if (!via.has(id)) via.set(id, '個別加選');

  const recipients: BulkRecipient[] = []; const skipped: { displayName: string; reason: string }[] = [];
  for (const [contactId, source] of via) {
    if (excluded.has(contactId)) continue;
    const contact = byId.get(contactId);
    if (!contact) { skipped.push({ displayName: contactId, reason: '找不到這個聯絡人' }); continue; }
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
