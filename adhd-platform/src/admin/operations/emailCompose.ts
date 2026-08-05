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

export function buildContext(
  registration: OperationalRegistration,
  contact: ContactRecord | undefined,
  sessions: SessionSlot[],
  /** 站台根網址（結尾帶 /），用來組報名連結。由呼叫端傳入，這個函式才留得住純函式的可測性。 */
  siteBase = '',
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
    // 該月的候選時段，一行一個——就是報名表單上會出現的那幾個，不是另外抄一份。
    場次清單: (session?.slotOptions ?? [])
      .map((option) => `・${option.label}${option.note ? `（${option.note}）` : ''}`)
      .join('\n'),
    報名連結: slug && siteBase ? `${siteBase}${slug}/register` : '',
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
