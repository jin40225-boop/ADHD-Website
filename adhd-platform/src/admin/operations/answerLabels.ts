/**
 * 報名答案的「標題」與「呈現」。
 *
 * 標題唯一的來源是**報名表定義本身**（`form_schemas.fields`）——後台任何地方要把一筆
 * 報名攤開給人看（名冊、彙整、CSV），問題的中文問法都得跟家長當初在表單上看到的一致。
 * 這個檔刻意不放第三份寫死的 key→中文對照表：表格欄位的表頭在 `RegistrationTable.tsx`、
 * 家長看到的問法在 `form_schemas`，再加第三份就等於再多一個會各說各話的地方。
 * 查不到標題時退回呼叫端傳入的 fallback，再退回 key 本身——寧可顯示英文 key，
 * 也不要顯示一個猜出來的中文問句。
 */
import type { FormField, FormSchema, SessionSlot } from '@contracts/types';
import type { OperationalRegistration } from './types';
import { textAnswer } from './RegistrationTable';

/** `${projectId}::${key}` → label。群組的內層欄位另外以 `${groupKey}.${subKey}` 收錄。 */
export type AnswerLabelIndex = Map<string, string>;

const indexKey = (projectId: string, key: string) => `${projectId}::${key}`;

/**
 * 攤平 fields。`group` 型別（例：親職的 `children`）的內層題目住在 `subFields`，
 * 少了這一層遞迴，孩子那一段就只剩 `alias`／`gender` 這種英文 key。
 */
function collect(projectId: string, fields: FormField[], index: AnswerLabelIndex, prefix = '') {
  for (const field of fields) {
    if (!field?.key) continue;
    const path = prefix ? `${prefix}.${field.key}` : field.key;
    index.set(indexKey(projectId, path), field.label || field.key);
    // 內層欄位也用裸 key 收一份，方便只拿得到 subKey 的呼叫端查得到；
    // 已存在就不覆蓋，外層題目的標題優先。
    if (prefix && !index.has(indexKey(projectId, field.key))) index.set(indexKey(projectId, field.key), field.label || field.key);
    if (field.subFields?.length) collect(projectId, field.subFields, index, path);
  }
}

/** 吃 `adminListFormSchemas()` 的回傳值（projectId → FormSchema）。 */
export function buildAnswerLabelIndex(schemas: Record<string, FormSchema> | undefined): AnswerLabelIndex {
  const index: AnswerLabelIndex = new Map();
  for (const [projectId, schema] of Object.entries(schemas ?? {})) {
    collect(projectId, schema?.fields ?? [], index);
  }
  return index;
}

/** 查標題：報名表定義 → 呼叫端 fallback → key 本身。 */
export function answerLabel(
  index: AnswerLabelIndex,
  projectId: string,
  key: string,
  fallback: Record<string, string> = {},
): string {
  return index.get(indexKey(projectId, key)) ?? fallback[key] ?? key;
}

const pad = (value: number) => String(value).padStart(2, '0');

/** 場次在答案裡只是一串 UUID，對人沒有意義；一律換成「標題｜M/D HH:mm」。 */
export function sessionLabel(session: SessionSlot) {
  const start = new Date(session.startsAt);
  return `${session.title}｜${start.getMonth() + 1}/${start.getDate()} ${pad(start.getHours())}:${pad(start.getMinutes())}`;
}

type AnswerValue = OperationalRegistration['answers'][string] | undefined;

function plainText(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string').join('、');
  return typeof value === 'string' ? value : '';
}

/**
 * 一個答案值 → 一行純文字。
 *
 * - 字串／字串陣列裡只要對得上場次的 UUID，就換成場次標題與時間（`sessionIds` 與
 *   `preferredSlots` 兩種都會走到這裡，所以判準看值、不看欄位名）。
 * - `children[]` 這種群組答案（物件陣列）用 subFields 的 label 展開，
 *   `subLabel` 由呼叫端接上 `answerLabel(index, projectId, '<群組>.<子欄>')`。
 */
export function formatAnswerValue(
  key: string,
  value: AnswerValue,
  sessionById: Map<string, SessionSlot>,
  subLabel?: (subKey: string) => string,
): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') {
    const session = sessionById.get(value);
    return session ? sessionLabel(session) : value;
  }
  if (!Array.isArray(value)) return '';
  const isGroup = value.some((item) => item !== null && typeof item === 'object' && !Array.isArray(item));
  const parts = value.map((item, index) => {
    if (typeof item === 'string') {
      const session = sessionById.get(item);
      return session ? sessionLabel(session) : item;
    }
    if (item === null || typeof item !== 'object') return '';
    const entries = Object.entries(item as Record<string, string | string[]>)
      .map(([subKey, subValue]) => [subLabel ? subLabel(subKey) : subKey, plainText(subValue)] as const)
      .filter(([, text]) => text)
      .map(([label, text]) => `${label}：${text}`);
    // 群組整筆空白時仍要看得出「有這一筆」，否則名冊上一位孩子會整個消失。
    return entries.length ? entries.join('，') : `${key} 第 ${index + 1} 筆（未填）`;
  }).filter(Boolean);
  return parts.join(isGroup ? '；' : '、');
}

/** `childAge` 的舊資料有的填「8」有的填「8歲」，補字前先看它有沒有自己帶。 */
function ageText(value: string) {
  if (!value) return '';
  return /歲|個月/.test(value) ? value : `${value} 歲`;
}

/**
 * 孩子概況的純文字版。
 *
 * 讀取邏輯**照抄** `RegistrationTable.tsx` 的 `childrenColumn`：新報名是可增減的
 * `children` 群組，但現有親職報名全部是舊的平面 key（childName／childGender／childAge／
 * childMedication），沒有這個 fallback，這一段對真實資料會整片是「—」，
 * 而用新格式的假資料測起來卻全綠——這個專案已經踩過一次。
 * 刻意複製而不是把 `RegistrationTable.tsx` 抽成共用：那個檔在本輪凍結，
 * 動它等於把一個已驗過的表格重新拉進風險裡。
 */
export function childSummaryText(registration: OperationalRegistration): string {
  const children = registration.answers?.children;
  if (Array.isArray(children) && children.length) {
    return children.map((child, index) => {
      if (typeof child !== 'object' || child === null) return '';
      const field = (key: string) => plainText((child as Record<string, string | string[]>)[key]);
      return [field('alias') || `第 ${index + 1} 位`, field('gender'), ageText(field('age')), field('medication')].filter(Boolean).join('・');
    }).filter(Boolean).join('；');
  }
  const legacy = (key: string) => textAnswer(registration, key);
  return [legacy('childName'), legacy('childGender'), ageText(legacy('childAge')), legacy('childMedication')].filter(Boolean).join('・');
}

/**
 * 「最想處理的一件事」。親職填 `issueDesc`、選填的 `consultTopics` 是輔助，
 * 同儕聚會沒有這一題、只有 `note`（想聊的話題）——三個依序取第一個有值的，
 * 不是三份不同的欄位對照表，而是同一個問題在三張表單上的名字。
 */
export const ISSUE_KEYS = ['issueDesc', 'consultTopics', 'note'];

export function issueText(registration: OperationalRegistration): string {
  for (const key of ISSUE_KEYS) {
    const text = textAnswer(registration, key);
    if (text) return text;
  }
  return '';
}
