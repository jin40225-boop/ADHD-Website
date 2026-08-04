import { supabase } from '@/lib/supabase';
import type {
  ActivityRecord,
  AuditRecord,
  ContactRecord,
  EmailDraftRecord,
  FollowUpTask,
  GmailSyncState,
  InternalNote,
  OperationalMessage,
  OperationalRegistration,
  OperationalThread,
  TeamMemberRecord,
  WorkPriority,
} from './types';

type Row = Record<string, any>;

function db() {
  if (!supabase) throw new Error('Supabase 未設定');
  return supabase;
}

function assert(error: { message: string } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback);
}

async function assertFunction(
  error: ({ message: string; context?: Response } & Record<string, unknown>) | null,
  fallback: string,
) {
  if (!error) return;
  let message = error.message || fallback;
  if (error.context instanceof Response) {
    try {
      const body = await error.context.clone().json() as { error?: string; message?: string };
      message = body.error || body.message || message;
    } catch {
      // Keep the SDK error when the response body is not JSON.
    }
  }
  throw new Error(message);
}

function htmlToPlainText(html: string) {
  return html
    .replace(/<(style|script|head)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function cleanEmailBody(body: string, bodyHtml?: string) {
  const plain = body.trim();
  const looksLikeCss = /@media\b|!important|(?:font-size|line-height|padding|margin|display|width|height)\s*:[^;\n{}]+[;}]|\{[^{}]{0,180}:[^{}]{0,180}\}/i.test(plain);
  if ((!plain || looksLikeCss) && bodyHtml) {
    return htmlToPlainText(bodyHtml) || plain;
  }
  return plain;
}

function mapMessage(row: Row): OperationalMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    direction: row.direction,
    from: row.from_email,
    to: row.to_email,
    cc: row.cc_email ?? [],
    bcc: row.bcc_email ?? [],
    subject: row.subject ?? '',
    body: cleanEmailBody(row.body ?? '', row.body_html ?? undefined),
    bodyHtml: row.body_html ?? undefined,
    snippet: row.snippet ?? undefined,
    isRead: row.is_read,
    deliveryStatus: row.delivery_status ?? (row.direction === 'outbound' ? 'sent' : 'received'),
    sentAt: row.sent_at,
    attachments: (row.email_attachments ?? []).map((item: Row) => ({
      id: item.id,
      filename: item.filename,
      mimeType: item.mime_type,
      sizeBytes: Number(item.size_bytes ?? 0),
      storagePath: item.storage_path ?? undefined,
    })),
  };
}

function mapRegistration(row: Row, projectName?: string): OperationalRegistration {
  return {
    id: row.id,
    projectId: row.project_id,
    contactId: row.contact_id ?? undefined,
    sessionIds: row.session_ids ?? [],
    answers: row.answers ?? {},
    status: row.status,
    email: row.email,
    assignedTo: row.assigned_to ?? undefined,
    priority: row.priority ?? 'normal',
    nextActionAt: row.next_action_at ?? undefined,
    archivedAt: row.archived_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    threadId: row.thread_id ?? undefined,
    hasUnreadReply: row.has_unread_reply ?? false,
    projectName,
    messages: (row.email_threads ?? [])
      .flatMap((thread: Row) => thread.email_messages ?? [])
      .map(mapMessage)
      .sort((a: OperationalMessage, b: OperationalMessage) => a.sentAt.localeCompare(b.sentAt)),
  };
}

export async function listContacts(): Promise<ContactRecord[]> {
  const [contactResult, projectResult] = await Promise.all([
    db().from('contacts').select(`
      *,
      registrations(
        *,
        email_threads(id, email_messages(*, email_attachments(*)))
      )
    `).is('archived_at', null).order('created_at', { ascending: false }),
    db().from('projects').select('id,name'),
  ]);
  assert(contactResult.error, '讀取人員主檔失敗');
  assert(projectResult.error, '讀取專案失敗');
  const projectNames = new Map((projectResult.data ?? []).map((row: Row) => [row.id, row.name]));
  return (contactResult.data ?? []).map((row: Row) => ({
    id: row.id,
    displayName: row.display_name,
    primaryEmail: row.primary_email ?? undefined,
    phone: row.phone ?? undefined,
    status: row.status,
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    registrations: (row.registrations ?? []).map((reg: Row) => mapRegistration(reg, projectNames.get(reg.project_id))),
  }));
}

export async function updateContact(id: string, patch: Partial<Pick<ContactRecord, 'displayName' | 'primaryEmail' | 'phone' | 'status' | 'tags'>>) {
  const payload: Row = {};
  if (patch.displayName !== undefined) payload.display_name = patch.displayName.trim();
  if (patch.primaryEmail !== undefined) payload.primary_email = patch.primaryEmail.trim().toLowerCase() || null;
  if (patch.phone !== undefined) payload.phone = patch.phone.trim() || null;
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.tags !== undefined) payload.tags = patch.tags;
  const { error } = await db().from('contacts').update(payload).eq('id', id);
  assert(error, '更新人員主檔失敗');
}

export async function listNotes(target: { contactId?: string; registrationId?: string; caseId?: string }): Promise<InternalNote[]> {
  let query = db().from('internal_notes').select('*').is('archived_at', null).order('created_at', { ascending: false });
  if (target.contactId) query = query.eq('contact_id', target.contactId);
  if (target.registrationId) query = query.eq('registration_id', target.registrationId);
  if (target.caseId) query = query.eq('case_id', target.caseId);
  const { data, error } = await query;
  assert(error, '讀取內部註記失敗');
  return (data ?? []).map((row: Row) => ({
    id: row.id,
    contactId: row.contact_id ?? undefined,
    registrationId: row.registration_id ?? undefined,
    caseId: row.case_id ?? undefined,
    noteType: row.note_type,
    content: row.content,
    authorId: row.author_id ?? undefined,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    archivedAt: row.archived_at ?? undefined,
  }));
}

export async function saveNote(input: Pick<InternalNote, 'contactId' | 'registrationId' | 'caseId' | 'noteType' | 'content'> & { id?: string }) {
  const payload = {
    contact_id: input.contactId ?? null,
    registration_id: input.registrationId ?? null,
    case_id: input.caseId ?? null,
    note_type: input.noteType,
    content: input.content.trim(),
  };
  const query = input.id
    ? db().from('internal_notes').update(payload).eq('id', input.id)
    : db().from('internal_notes').insert(payload);
  const { error } = await query;
  assert(error, '儲存內部註記失敗');
}

export async function archiveNote(id: string) {
  const { error } = await db().from('internal_notes').update({ archived_at: new Date().toISOString() }).eq('id', id);
  assert(error, '封存註記失敗');
}

export async function listTasks(): Promise<FollowUpTask[]> {
  const { data, error } = await db().from('follow_up_tasks').select('*').neq('status', 'cancelled').order('due_at', { ascending: true, nullsFirst: false });
  assert(error, '讀取追蹤任務失敗');
  return (data ?? []).map(mapTask);
}

function mapTask(row: Row): FollowUpTask {
  return {
    id: row.id,
    projectId: row.project_id,
    contactId: row.contact_id ?? undefined,
    registrationId: row.registration_id ?? undefined,
    caseId: row.case_id ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    assignedTo: row.assigned_to ?? undefined,
    dueAt: row.due_at ?? undefined,
    priority: row.priority,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
  };
}

export async function saveTask(input: {
  id?: string;
  projectId: string;
  contactId?: string;
  registrationId?: string;
  caseId?: string;
  title: string;
  description?: string;
  assignedTo?: string;
  dueAt?: string;
  priority: WorkPriority;
  status?: FollowUpTask['status'];
}) {
  const status = input.status ?? 'open';
  const payload = {
    project_id: input.projectId,
    contact_id: input.contactId ?? null,
    registration_id: input.registrationId ?? null,
    case_id: input.caseId ?? null,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    assigned_to: input.assignedTo ?? null,
    due_at: input.dueAt || null,
    priority: input.priority,
    status,
    completed_at: status === 'done' ? new Date().toISOString() : null,
  };
  const query = input.id
    ? db().from('follow_up_tasks').update(payload).eq('id', input.id)
    : db().from('follow_up_tasks').insert(payload);
  const { error } = await query;
  assert(error, '儲存追蹤任務失敗');
}

export async function updateRegistrationAdministration(id: string, input: {
  /** `group` 型別欄位（例：多位孩子）的答案是物件陣列。 */
  answers?: Record<string, string | string[] | Record<string, string | string[]>[]>;
  assignedTo?: string | null;
  priority?: WorkPriority;
  nextActionAt?: string | null;
}) {
  const payload: Row = {};
  if (input.answers !== undefined) payload.answers = input.answers;
  if (input.assignedTo !== undefined) payload.assigned_to = input.assignedTo;
  if (input.priority !== undefined) payload.priority = input.priority;
  if (input.nextActionAt !== undefined) payload.next_action_at = input.nextActionAt;
  const { error } = await db().from('registrations').update(payload).eq('id', id);
  assert(error, '更新報名行政資料失敗');
}

export async function transitionRegistration(id: string, status: string) {
  const { error } = await db().rpc('admin_transition_registration', { p_registration_id: id, p_status: status });
  assert(error, '變更報名狀態失敗');
}

export async function moveRegistrationSessions(id: string, sessionIds: string[]) {
  const { error } = await db().rpc('admin_move_registration_sessions', { p_registration_id: id, p_session_ids: sessionIds });
  assert(error, '移轉報名場次失敗');
}

export async function createCaseFromRegistration(id: string, serviceType: 'single' | 'ongoing', summary: string) {
  const { error } = await db().rpc('admin_create_case_from_registration', {
    p_registration_id: id,
    p_service_type: serviceType,
    p_summary: summary,
    p_assigned_to: null,
  });
  assert(error, '由報名建立個案失敗');
}

export async function listInbox(): Promise<OperationalThread[]> {
  const { data, error } = await db().from('email_threads').select('*, email_messages(*, email_attachments(*))').order('last_message_at', { ascending: false, nullsFirst: false });
  assert(error, '讀取整合收件匣失敗');
  return (data ?? []).map((row: Row) => ({
    id: row.id,
    registrationId: row.registration_id ?? undefined,
    contactId: row.contact_id ?? undefined,
    gmailThreadId: row.gmail_thread_id ?? undefined,
    subject: row.subject,
    counterpartEmail: row.counterpart_email,
    hasUnread: row.has_unread,
    needsReply: row.needs_reply,
    status: row.status,
    lastMessageAt: row.last_message_at ?? undefined,
    messages: (row.email_messages ?? []).map(mapMessage).sort((a: OperationalMessage, b: OperationalMessage) => a.sentAt.localeCompare(b.sentAt)),
  }));
}

export async function markThreadRead(id: string) {
  const [thread, messages] = await Promise.all([
    db().from('email_threads').update({ has_unread: false, needs_reply: false }).eq('id', id),
    db().from('email_messages').update({ is_read: true }).eq('thread_id', id).eq('direction', 'inbound'),
  ]);
  assert(thread.error, '更新對話串失敗');
  assert(messages.error, '更新信件已讀狀態失敗');
}

export async function saveDraft(input: Omit<EmailDraftRecord, 'id' | 'createdAt' | 'revision' | 'status'> & { id?: string }) {
  const payload = {
    registration_id: input.registrationId,
    thread_id: input.threadId ?? null,
    to_email: input.toEmail,
    cc_email: input.cc,
    bcc_email: input.bcc,
    subject: input.subject,
    body: input.body,
  };
  const query = input.id
    ? db().from('email_drafts').update(payload).eq('id', input.id).select().single()
    : db().from('email_drafts').insert(payload).select().single();
  const { data, error } = await query;
  assert(error, '儲存信件草稿失敗');
  return data?.id as string;
}

export async function listActivities(): Promise<ActivityRecord[]> {
  const [activityResult, projectResult] = await Promise.all([
    db().from('activities').select('*, sessions(id)').is('archived_at', null).order('starts_at', { ascending: false, nullsFirst: false }),
    db().from('projects').select('id,name'),
  ]);
  assert(activityResult.error, '讀取活動失敗');
  assert(projectResult.error, '讀取專案失敗');
  const projects = new Map((projectResult.data ?? []).map((row: Row) => [row.id, row.name]));
  return (activityResult.data ?? []).map((row: Row) => ({
    id: row.id,
    projectId: row.project_id,
    projectName: projects.get(row.project_id),
    name: row.name,
    status: row.status,
    publicSummary: row.public_summary ?? undefined,
    startsAt: row.starts_at ?? undefined,
    endsAt: row.ends_at ?? undefined,
    createdAt: row.created_at,
    sessionCount: row.sessions?.length ?? 0,
  }));
}

export async function saveActivity(input: Omit<ActivityRecord, 'id' | 'createdAt'> & { id?: string }) {
  const payload = {
    project_id: input.projectId,
    name: input.name.trim(),
    status: input.status,
    public_summary: input.publicSummary?.trim() || null,
    starts_at: input.startsAt || null,
    ends_at: input.endsAt || null,
  };
  const query = input.id
    ? db().from('activities').update(payload).eq('id', input.id)
    : db().from('activities').insert(payload);
  const { error } = await query;
  assert(error, '儲存活動失敗');
}

export async function listTeamMembers(): Promise<TeamMemberRecord[]> {
  const { data, error } = await db().from('project_members').select('*, projects(name), profiles(email,display_name)').order('created_at');
  assert(error, '讀取團隊成員失敗');
  return (data ?? []).map((row: Row) => ({
    id: row.id,
    projectId: row.project_id,
    projectName: row.projects?.name,
    userId: row.user_id,
    email: row.profiles?.email,
    displayName: row.profiles?.display_name,
    role: row.role,
    permissions: row.permissions ?? undefined,
    createdAt: row.created_at,
  }));
}

export async function inviteTeamMember(projectId: string, email: string, role: TeamMemberRecord['role']) {
  const { data, error } = await db().functions.invoke('team-invite', { body: { projectId, email: email.trim().toLowerCase(), role } });
  assert(error, '邀請團隊成員失敗');
  return data as { ok: boolean; invited: boolean; userId: string };
}

export async function listAuditRecords(): Promise<AuditRecord[]> {
  const { data, error } = await db().from('audit_log').select('*').order('created_at', { ascending: false }).limit(200);
  assert(error, '讀取稽核紀錄失敗');
  return (data ?? []).map((row: Row) => ({
    id: row.id,
    action: row.action,
    actorId: row.actor_id ?? undefined,
    targetType: row.target_type ?? undefined,
    targetId: row.target_id ?? undefined,
    result: row.result,
    detail: row.detail ?? undefined,
    createdAt: row.created_at,
  }));
}

export async function getGmailSyncState(): Promise<GmailSyncState | null> {
  const { data, error } = await db().from('gmail_sync_state').select('*').maybeSingle();
  assert(error, '讀取 Gmail 同步狀態失敗');
  return data ? {
    mailboxEmail: data.mailbox_email,
    historyId: data.history_id ?? undefined,
    watchExpiration: data.watch_expiration ?? undefined,
    lastFullSyncAt: data.last_full_sync_at ?? undefined,
    lastIncrementalSyncAt: data.last_incremental_sync_at ?? undefined,
    lastError: data.last_error ?? undefined,
    updatedAt: data.updated_at,
  } : null;
}

export async function createEmailAttachmentUrl(storagePath: string) {
  const { data, error } = await db().storage.from('email-attachments').createSignedUrl(storagePath, 300);
  assert(error, '建立附件下載連結失敗');
  if (!data?.signedUrl) throw new Error('附件下載連結不存在');
  return data.signedUrl;
}

export async function triggerGmailSync(full = false) {
  const { data, error } = await db().functions.invoke('gmail-sync', { body: { full } });
  await assertFunction(error, '啟動 Gmail 同步失敗');
  return data as { ok: boolean; synced: number; mailboxEmail?: string };
}



