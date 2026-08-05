import { supabase } from '@/lib/supabase';
import type {
  ActivityRecord,
  AuditRecord,
  AppSettings,
  ContactGroupRecord,
  ContactRecord,
  EmailDraftRecord,
  FollowUpTask,
  GeneratedDocumentRecord,
  GmailLabel,
  GmailSyncState,
  InternalNote,
  MailState,
  OperationalMessage,
  OperationalRegistration,
  OperationalThread,
  RegistrationMailStatus,
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

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 一筆報名的信件連動狀態（計畫第七節）。
 *
 * 一筆報名理論上只有一條 thread；真的有多條時取最近有往來的那條，避免舊 thread
 * 蓋掉現況。尚未寄過信的報名沒有 thread，回傳 undefined 讓呼叫端顯示「未寄信」。
 */
/**
 * 出席確認是**對方按下按鈕的決定**，不是往來狀態，所以由 attendance_confirmations 推導，
 * 不從 `mail_state` 讀。
 *
 * `mail_state` 是「這條信件串現在走到哪」，任何一封後續信件都會重設它——gmail-sync 同步到
 * 一封寄出的信就寫回 `waiting_reply`，於是工作台上「已確認出席」變回「還在等回覆」，
 * 接著就是一封多餘的催覆信寄給早就答應要來的人。確認本身沒有不見（token 的 action 與
 * responded_at 都還在），不見的只有畫面上那一格。
 *
 * 推導而非在同步端加例外：同步端的例外只擋得住今天想得到的那一個寫入者，推導則讓這個事實
 * 不存在於任何人可以覆寫的地方。與「逾期未回覆」同一個做法。
 */
function confirmedState(confirmations: Row[]): MailState | undefined {
  const responded = confirmations
    .filter((row) => row.responded_at)
    .sort((a, b) => String(b.responded_at).localeCompare(String(a.responded_at)))[0];
  if (!responded) return undefined;
  return responded.action === 'attend' ? 'attend_confirmed' : 'reschedule_requested';
}

export function mapMailStatus(threads: Row[], confirmations: Row[] = []): RegistrationMailStatus | undefined {
  const confirmed = confirmedState(confirmations);
  // 回覆了但信件串不在（例如串被併掉）——那個決定還是要看得到，不能退回「未寄信」。
  if (!threads.length) {
    return confirmed ? { threadId: '', auto: confirmed, effective: confirmed, overdueDays: 0 } : undefined;
  }
  const latest = [...threads].sort((a, b) =>
    String(b.last_outbound_at ?? b.last_inbound_at ?? '').localeCompare(
      String(a.last_outbound_at ?? a.last_inbound_at ?? ''),
    ),
  )[0];
  const stored = (latest.mail_state ?? 'not_sent') as MailState;
  const override = (latest.mail_state_override ?? undefined) as MailState | undefined;
  const followUpDueAt = latest.follow_up_due_at ?? undefined;
  const dueMs = followUpDueAt ? Date.parse(followUpDueAt) : NaN;
  // 「逾期未回覆」在讀取時推導，而不是存一個會過期的值：等待回覆的信一旦過了催覆期限就是逾期。
  // 這樣不需要排程去把狀態翻面，也不會出現「資料庫說等待回覆、畫面上其實早就逾期」的落差。
  const overdue = !confirmed && stored === 'waiting_reply' && !Number.isNaN(dueMs) && Date.now() > dueMs;
  // 確認結果勝過往來狀態；已經答應要來的人不該再被算成逾期未回覆。
  const auto = (confirmed ?? (overdue ? 'overdue' : stored)) as MailState;
  return {
    threadId: latest.id,
    auto,
    override,
    overrideReason: latest.mail_state_override_reason ?? undefined,
    effective: override ?? auto,
    lastOutboundAt: latest.last_outbound_at ?? undefined,
    lastInboundAt: latest.last_inbound_at ?? undefined,
    followUpDueAt,
    overdueDays: Number.isNaN(dueMs) ? 0 : Math.max(0, Math.floor((Date.now() - dueMs) / DAY_MS)),
  };
}

function mapRegistration(row: Row, projectName?: string, projectSlug?: string): OperationalRegistration {
  return {
    projectSlug,
    mailStatus: mapMailStatus(row.email_threads ?? [], row.attendance_confirmations ?? []),
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
    reminderSentAt: row.reminder_sent_at ?? undefined,
    counselorConfirmed: row.counselor_confirmed ?? undefined,
    finalSlotAt: row.final_slot_at ?? undefined,
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
        email_threads(
          id, mail_state, mail_state_override, mail_state_override_reason,
          last_outbound_at, last_inbound_at, follow_up_due_at,
          email_messages(*, email_attachments(*))
        ),
        attendance_confirmations(action, responded_at)
      )
    `).is('archived_at', null).order('created_at', { ascending: false }),
    db().from('projects').select('id,name,slug'),
  ]);
  assert(contactResult.error, '讀取人員主檔失敗');
  assert(projectResult.error, '讀取專案失敗');
  const projectNames = new Map((projectResult.data ?? []).map((row: Row) => [row.id, row.name]));
  const projectSlugs = new Map((projectResult.data ?? []).map((row: Row) => [row.id, row.slug]));
  return (contactResult.data ?? []).map((row: Row) => ({
    id: row.id,
    displayName: row.display_name,
    primaryEmail: row.primary_email ?? undefined,
    phone: row.phone ?? undefined,
    status: row.status,
    tags: row.tags ?? [],
    isFavorite: row.is_favorite ?? false,
    noBulkEmail: row.no_bulk_email ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    registrations: (row.registrations ?? []).map((reg: Row) => mapRegistration(reg, projectNames.get(reg.project_id), projectSlugs.get(reg.project_id))),
  }));
}

export async function updateContact(id: string, patch: Partial<Pick<ContactRecord, 'displayName' | 'primaryEmail' | 'phone' | 'status' | 'tags' | 'isFavorite' | 'noBulkEmail'>>) {
  const payload: Row = {};
  if (patch.displayName !== undefined) payload.display_name = patch.displayName.trim();
  if (patch.primaryEmail !== undefined) payload.primary_email = patch.primaryEmail.trim().toLowerCase() || null;
  if (patch.phone !== undefined) payload.phone = patch.phone.trim() || null;
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.tags !== undefined) payload.tags = patch.tags;
  if (patch.isFavorite !== undefined) payload.is_favorite = patch.isFavorite;
  if (patch.noBulkEmail !== undefined) payload.no_bulk_email = patch.noBulkEmail;
  const { error } = await db().from('contacts').update(payload).eq('id', id);
  assert(error, '更新人員主檔失敗');
}

export async function createContact(input: { displayName: string; primaryEmail?: string; phone?: string; isFavorite?: boolean; tags?: string[] }) {
  const payload: Row = {
    display_name: input.displayName.trim(),
    primary_email: input.primaryEmail?.trim().toLowerCase() || null,
    phone: input.phone?.trim() || null,
    is_favorite: input.isFavorite ?? false,
    tags: input.tags ?? [],
  };
  const { data, error } = await db().from('contacts').insert(payload).select('id').single();
  assert(error, '新增聯絡人失敗');
  return (data?.id ?? '') as string;
}

export async function listContactGroups(): Promise<ContactGroupRecord[]> {
  const { data, error } = await db()
    .from('contact_groups')
    .select('*, contact_group_members(contact_id, source, added_at)')
    .order('is_system', { ascending: false })
    .order('name');
  assert(error, '讀取聯絡人類群失敗');
  return (data ?? []).map((row: Row) => ({
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description ?? undefined,
    projectId: row.project_id ?? undefined,
    autoRule: row.auto_rule ?? undefined,
    isSystem: row.is_system ?? false,
    members: (row.contact_group_members ?? []).map((member: Row) => ({
      contactId: member.contact_id,
      source: member.source,
      addedAt: member.added_at,
    })),
  }));
}

/** 手動加入／移出類群。自動歸群由 sync_registration_contact_group 負責，不走這裡。 */
export async function setContactGroupMember(groupId: string, contactId: string, member: boolean) {
  const query = member
    ? db().from('contact_group_members').insert({ group_id: groupId, contact_id: contactId, source: 'manual' })
    : db().from('contact_group_members').delete().eq('group_id', groupId).eq('contact_id', contactId);
  const { error } = await query;
  assert(error, member ? '加入類群失敗' : '移出類群失敗');
}

/** 文件生成紀錄。Phase 6 之前必然是空的——生成功能還沒接上，沒有任何東西會寫入。 */
export async function listGeneratedDocuments(): Promise<GeneratedDocumentRecord[]> {
  const { data, error } = await db()
    .from('generated_documents')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  assert(error, '讀取文件生成紀錄失敗');
  return (data ?? []).map((row: Row) => ({
    id: row.id,
    docType: row.doc_type,
    scope: row.scope,
    title: row.title,
    status: row.status,
    redacted: row.redacted,
    createdAt: row.created_at,
  }));
}

export async function getAppSettings(): Promise<AppSettings> {
  const { data, error } = await db().from('app_settings').select('*').maybeSingle();
  assert(error, '讀取設定失敗');
  return {
    followUpDays: data?.follow_up_days ?? 3,
    // 欄位可能還沒套用 migration；沒有就是「第三條收信規則未啟用」。
    syncLabelIds: Array.isArray(data?.sync_label_ids) ? (data!.sync_label_ids as string[]).map(String) : [],
    syncLabelId: data?.sync_label_id ?? undefined,
    syncSubjectKeywords: Array.isArray(data?.sync_subject_keywords) ? (data!.sync_subject_keywords as string[]).map(String) : [],
    updatedAt: data?.updated_at ?? undefined,
  };
}

export async function updateAppSettings(patch: { followUpDays?: number; syncLabelIds?: string[]; syncSubjectKeywords?: string[] }) {
  const { error } = await db()
    .from('app_settings')
    .update({
      ...(patch.followUpDays === undefined ? {} : { follow_up_days: patch.followUpDays }),
      // 只寫新的清單欄位。舊的 sync_label_id 一律不動——它是「還沒重新勾選時的退路」，
      // 被這裡覆寫掉的話，那條退路就在使用者沒察覺的情況下消失了。
      ...(patch.syncLabelIds === undefined ? {} : { sync_label_ids: patch.syncLabelIds }),
      ...(patch.syncSubjectKeywords === undefined ? {} : { sync_subject_keywords: patch.syncSubjectKeywords }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', true);
  assert(error, '更新設定失敗');
}

/** 唯讀：列出信箱裡使用者自建的 Gmail 標籤，給設定頁的下拉用（存 id、顯示名稱）。 */
export async function listGmailLabels(): Promise<GmailLabel[]> {
  const { data, error } = await db().functions.invoke('gmail-labels', { body: {} });
  await assertFunction(error, '讀取 Gmail 標籤失敗');
  return (data as { labels?: GmailLabel[] }).labels ?? [];
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
  /** 以下三欄：undefined＝不動，null＝清空（取消勾選／改回「—」）。 */
  reminderSentAt?: string | null;
  counselorConfirmed?: boolean | null;
  finalSlotAt?: string | null;
  /** 名冊比對用的信箱；呼叫端負責同時更新 answers.email。 */
  email?: string;
}) {
  const payload: Row = {};
  if (input.answers !== undefined) payload.answers = input.answers;
  if (input.assignedTo !== undefined) payload.assigned_to = input.assignedTo;
  if (input.priority !== undefined) payload.priority = input.priority;
  if (input.nextActionAt !== undefined) payload.next_action_at = input.nextActionAt;
  if (input.reminderSentAt !== undefined) payload.reminder_sent_at = input.reminderSentAt;
  if (input.counselorConfirmed !== undefined) payload.counselor_confirmed = input.counselorConfirmed;
  if (input.finalSlotAt !== undefined) payload.final_slot_at = input.finalSlotAt;
  if (input.email !== undefined) payload.email = input.email.trim().toLowerCase();
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

export async function triggerGmailSync(full = false, discoverOnly = false) {
  const { data, error } = await db().functions.invoke('gmail-sync', { body: { full, discoverOnly } });
  await assertFunction(error, '啟動 Gmail 同步失敗');
  return data as {
    ok: boolean; synced?: number; skipped?: number; failed?: number; remaining?: number; mailboxEmail?: string; syncLabelCount?: number;
    /** 只量體、不收信的模式回傳的數字。 */
    discoverOnly?: boolean; found?: number; candidates?: number; newMessages?: number; knownAddresses?: number;
  };
}




