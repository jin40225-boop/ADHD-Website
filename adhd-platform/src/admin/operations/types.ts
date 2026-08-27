import type { CoHostInfo, Registration } from '@contracts/types';

export type ContactStatus = 'active' | 'inactive' | 'do_not_contact' | 'archived';
export type WorkPriority = 'low' | 'normal' | 'high' | 'urgent';

/** 信件連動狀態（計畫第七節）。`mail_state` 由 gmail-sync 自動判定，可被手動覆寫。 */
export type MailState =
  | 'not_sent' | 'waiting_reply' | 'overdue' | 'reminded'
  | 'replied_pending' | 'handled' | 'attend_confirmed' | 'reschedule_requested';

export interface RegistrationMailStatus {
  threadId: string;
  /** 自動判定值。 */
  auto: MailState;
  /** 人工覆寫；有值時前台顯示以它為準。 */
  override?: MailState;
  overrideReason?: string;
  /** 覆寫優先的實際顯示值。 */
  effective: MailState;
  lastOutboundAt?: string;
  lastInboundAt?: string;
  /** 催覆期限；超過即視為逾期。 */
  followUpDueAt?: string;
  /** 距催覆期限已逾期幾天；未逾期或無期限為 0。 */
  overdueDays: number;
}

export interface OperationalRegistration extends Registration {
  contactId?: string;
  assignedTo?: string;
  priority: WorkPriority;
  nextActionAt?: string;
  archivedAt?: string;
  projectName?: string;
  /** 專案代號（navigator／parent／peer-group）；後台分頁靠它切。 */
  projectSlug?: string;
  messages?: OperationalMessage[];
  /** 尚未寄過任何信的報名沒有 thread，因此可能為 undefined。 */
  mailStatus?: RegistrationMailStatus;
  /** 提醒信寄出時間；undefined 表示 03_v4 的「已寄信提醒」未勾。 */
  reminderSentAt?: string;
  /** 名額釋放時間。**undefined＝這筆還佔著 session_ids 裡每一場的名額**；有值＝已釋放。 */
  capacityReleasedAt?: string;
  /** 諮商師回覆確認：undefined 未回覆、true 可、false 不可。 */
  counselorConfirmed?: boolean;
  /** 導航計畫最終確定時段的開始時間（結束＝開始＋60 分）。 */
  finalSlotAt?: string;
}

export interface ContactRecord {
  id: string;
  displayName: string;
  primaryEmail?: string;
  phone?: string;
  status: ContactStatus;
  tags: string[];
  /** 常用聯絡人（團隊四人）置頂用。 */
  isFavorite: boolean;
  /** 本人表示不接收群發。一對一往來不受影響——退出群發不等於斷絕聯絡。 */
  noBulkEmail?: boolean;
  createdAt: string;
  updatedAt?: string;
  registrations: OperationalRegistration[];
}

/** 聯絡人類群（計畫第八節）。`auto_rule` 為 registration 者由報名成立時自動歸群。 */
export interface ContactGroupRecord {
  id: string;
  key: string;
  name: string;
  description?: string;
  projectId?: string;
  autoRule?: 'registration' | 'instructor' | 'manual';
  isSystem: boolean;
  members: { contactId: string; source: 'manual' | 'auto'; addedAt: string }[];
}

/** 文件生成紀錄（計畫第四節第 7 項）。Phase 6 接上 `generate-document` 後才會有資料。 */
export interface GeneratedDocumentRecord {
  id: string;
  docType: string;
  scope: 'single' | 'batch' | 'aggregate';
  title: string;
  /** 草稿全文。查詢本來就 `select('*')`，只是沒 map 出來，於是列表看得到紀錄卻看不到內容。 */
  content: string;
  status: 'draft' | 'reviewed' | 'sent' | 'discarded';
  redacted: boolean;
  /** `single` 是場次 id；彙整型是統計區間字串（例 `2025-09~2026-08`）。 */
  targetId?: string;
  createdAt: string;
}

export interface AppSettings {
  /** 寄出後幾天未回覆算逾期。Phase 4 的信件狀態機接線後才會真的依它判斷。 */
  followUpDays: number;
  /**
   * gmail-sync 第三條收信規則：帶著其中**任一個** Gmail 標籤的信就收進來。空陣列＝不啟用。
   * 存 id 不存名稱——標籤改名時 id 不變，比對名稱會在改名的那一刻安靜失效。
   */
  syncLabelIds?: string[];
  /** 舊的單選欄位。`syncLabelIds` 為空時才會被讀到；保留是為了讓還沒重新勾選的設定行為不變。 */
  syncLabelId?: string;
  /** 第四條收信規則：主旨含其中任一關鍵字就收。空陣列＝不啟用。 */
  syncSubjectKeywords?: string[];
  /**
   * 自動發現的起始日（YYYY-MM-DD）：只自動收這天之後的信。
   * 標籤查詢與「匯入這個人的歷史往來」不受此限制——那兩件都是使用者主動說「我要這封」。
   */
  syncSince?: string;
  updatedAt?: string;
}

export interface GmailLabel { id: string; name: string }

export type NoteType = 'general' | 'contact' | 'eligibility' | 'handoff' | 'risk';
export interface InternalNote {
  id: string;
  contactId?: string;
  registrationId?: string;
  caseId?: string;
  noteType: NoteType;
  content: string;
  authorId?: string;
  revision: number;
  createdAt: string;
  updatedAt?: string;
  archivedAt?: string;
}

export type TaskStatus = 'open' | 'in_progress' | 'snoozed' | 'done' | 'cancelled';
export interface FollowUpTask {
  id: string;
  projectId: string;
  contactId?: string;
  registrationId?: string;
  caseId?: string;
  title: string;
  description?: string;
  assignedTo?: string;
  dueAt?: string;
  priority: WorkPriority;
  status: TaskStatus;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
}

export interface EmailAttachmentRecord {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath?: string;
}

export interface OperationalMessage {
  id: string;
  threadId: string;
  direction: 'outbound' | 'inbound';
  from: string;
  to: string;
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  snippet?: string;
  isRead: boolean;
  deliveryStatus: 'draft' | 'queued' | 'sent' | 'received' | 'failed';
  sentAt: string;
  attachments: EmailAttachmentRecord[];
}

export interface OperationalThread {
  id: string;
  registrationId?: string;
  contactId?: string;
  gmailThreadId?: string;
  subject: string;
  counterpartEmail: string;
  hasUnread: boolean;
  needsReply: boolean;
  status: 'open' | 'waiting' | 'closed';
  lastMessageAt?: string;
  messages: OperationalMessage[];
}

export interface EmailDraftRecord {
  id: string;
  registrationId: string;
  threadId?: string;
  toEmail: string;
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  status: 'draft' | 'sending' | 'sent' | 'failed' | 'archived';
  revision: number;
  createdAt: string;
  updatedAt?: string;
}

export interface ActivityRecord {
  id: string;
  projectId: string;
  projectName?: string;
  name: string;
  status: 'draft' | 'published' | 'closed' | 'completed' | 'cancelled';
  publicSummary?: string;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
  sessionCount?: number;
  registrationCount?: number;
  /** 協辦活動的合作資訊（主辦單位、我方角色、對方報名連結）。非協辦活動留空。 */
  coHost?: CoHostInfo;
}

export interface TeamMemberRecord {
  id: string;
  projectId: string;
  projectName?: string;
  userId: string;
  email?: string;
  displayName?: string;
  role: 'owner' | 'admin_collab' | 'instructor_full' | 'instructor_slot';
  permissions?: Record<string, unknown>;
  createdAt: string;
}

export interface AuditRecord {
  id: string;
  action: string;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  result: 'success' | 'error';
  detail?: string;
  createdAt: string;
}

export interface GmailSyncState {
  mailboxEmail: string;
  historyId?: string;
  watchExpiration?: string;
  lastFullSyncAt?: string;
  lastIncrementalSyncAt?: string;
  lastError?: string;
  updatedAt: string;
}

