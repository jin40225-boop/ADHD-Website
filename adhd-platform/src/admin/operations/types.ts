import type { Registration } from '@contracts/types';

export type ContactStatus = 'active' | 'inactive' | 'do_not_contact' | 'archived';
export type WorkPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface OperationalRegistration extends Registration {
  contactId?: string;
  assignedTo?: string;
  priority: WorkPriority;
  nextActionAt?: string;
  archivedAt?: string;
  projectName?: string;
  messages?: OperationalMessage[];
}

export interface ContactRecord {
  id: string;
  displayName: string;
  primaryEmail?: string;
  phone?: string;
  status: ContactStatus;
  tags: string[];
  createdAt: string;
  updatedAt?: string;
  registrations: OperationalRegistration[];
}

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
