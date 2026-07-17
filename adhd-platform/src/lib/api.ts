/**
 * 資料存取層。【CLAUDE】
 * Supabase 讀寫的唯一入口：snake_case（DB）↔ camelCase（contracts/types.ts）映射集中於此。
 * 所有函式在 supabase 未設定時擲出 API_NOT_READY，由呼叫端決定退回 mock/JSON。
 * 個資紀律：本檔不含任何真實資料；讀取受 RLS 保護。
 */
import { supabase } from './supabase';
import type {
  EmailTemplate,
  FormSchema,
  Project,
  Registration,
  RecommendationSubmission,
  SessionSlot,
  StatusFlow,
} from '@contracts/types';

export class ApiError extends Error {
  constructor(
    message: string,
    /** 錯誤語意代碼：NOT_READY / SESSION_FULL / QUERY / INSERT */
    public code: 'NOT_READY' | 'SESSION_FULL' | 'QUERY' | 'INSERT' = 'QUERY',
  ) {
    super(message);
  }
}

function db() {
  if (!supabase) throw new ApiError('Supabase 未設定', 'NOT_READY');
  return supabase;
}

/* ============================== 映射 ============================== */

type Row = Record<string, unknown>;

function mapProject(r: Row): Project {
  return {
    id: r.id as string,
    name: r.name as string,
    type: r.type as Project['type'],
    slug: r.slug as string,
    description: (r.description as string) ?? undefined,
    isPublic: r.is_public as boolean,
    createdAt: r.created_at as string,
  };
}

function mapSession(r: Row): SessionSlot {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    title: r.title as string,
    startsAt: r.starts_at as string,
    endsAt: r.ends_at as string,
    capacity: r.capacity as number,
    bookedCount: r.booked_count as number,
    status: r.status as SessionSlot['status'],
    meetUrl: (r.meet_url as string) ?? undefined,
    instructorIds: (r.instructor_ids as string[]) ?? [],
    calendarEventId: (r.calendar_event_id as string) ?? undefined,
  };
}

function mapRegistration(r: Row): Registration {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    sessionIds: (r.session_ids as string[]) ?? [],
    answers: (r.answers as Registration['answers']) ?? {},
    status: r.status as string,
    email: r.email as string,
    createdAt: r.created_at as string,
    updatedAt: (r.updated_at as string) ?? undefined,
    threadId: (r.thread_id as string) ?? undefined,
    hasUnreadReply: (r.has_unread_reply as boolean) ?? false,
  };
}

function mapTemplate(r: Row): EmailTemplate {
  return {
    id: r.id as string,
    projectId: (r.project_id as string) ?? undefined,
    name: r.name as string,
    subject: r.subject as string,
    body: r.body as string,
    createdAt: r.created_at as string,
    updatedAt: (r.updated_at as string) ?? undefined,
  };
}

function mapSubmission(r: Row): RecommendationSubmission {
  return {
    id: r.id as string,
    type: r.type as RecommendationSubmission['type'],
    answers: (r.answers as RecommendationSubmission['answers']) ?? {},
    nickname: (r.nickname as string) ?? undefined,
    email: (r.email as string) ?? undefined,
    status: r.status as RecommendationSubmission['status'],
    relatedRecommendationId: (r.related_recommendation_id as string) ?? undefined,
    reviewNote: (r.review_note as string) ?? undefined,
    createdAt: r.created_at as string,
  };
}

/* ============================== 公開端 ============================== */

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const { data, error } = await db()
    .from('projects')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new ApiError(error.message);
  return data ? mapProject(data) : null;
}

export async function getFormSchema(projectId: string): Promise<FormSchema | null> {
  const { data, error } = await db()
    .from('form_schemas')
    .select('project_id, fields')
    .eq('project_id', projectId)
    .maybeSingle();
  if (error) throw new ApiError(error.message);
  return data ? { projectId: data.project_id, fields: data.fields as FormSchema['fields'] } : null;
}

/** 前台可見場次（開放＋額滿，未結束），依開始時間排序。 */
export async function getUpcomingSessions(projectId: string): Promise<SessionSlot[]> {
  const { data, error } = await db()
    .from('sessions')
    .select('*')
    .eq('project_id', projectId)
    .in('status', ['open', 'full'])
    .gte('ends_at', new Date().toISOString())
    .order('starts_at', { ascending: true });
  if (error) throw new ApiError(error.message);
  return (data ?? []).map(mapSession);
}

export interface SubmitRegistrationInput {
  projectId: string;
  sessionIds: string[];
  answers: Registration['answers'];
  email: string;
}

/** 公開報名。額滿由 DB 觸發器 enforce_session_capacity 保證（滿員擲 SESSION_FULL）。 */
export async function submitRegistration(input: SubmitRegistrationInput): Promise<void> {
  const { error } = await db().from('registrations').insert({
    project_id: input.projectId,
    session_ids: input.sessionIds,
    answers: input.answers,
    email: input.email,
    status: 'pending',
  });
  if (error) {
    if (error.message.includes('SESSION_FULL_OR_CLOSED')) {
      throw new ApiError('您選擇的場次剛剛額滿或已關閉，請重新選擇其他場次。', 'SESSION_FULL');
    }
    throw new ApiError(error.message, 'INSERT');
  }
}

export interface SubmitRecommendationInput {
  /** DB check 白名單：doctor/assessment/therapy/doctor_update/feature/correction/other */
  type: 'doctor' | 'assessment' | 'therapy' | 'doctor_update' | 'feature' | 'correction' | 'other';
  answers: Record<string, unknown>;
  nickname?: string;
  email?: string;
}

/** 公開投稿推薦資源。RLS 僅允許 status=pending 的 insert，anon 不可回讀。 */
export async function submitRecommendationSubmission(input: SubmitRecommendationInput): Promise<void> {
  const { error } = await db().from('recommendation_submissions').insert({
    type: input.type,
    answers: input.answers,
    nickname: input.nickname || null,
    email: input.email || null,
    status: 'pending',
  });
  if (error) throw new ApiError(error.message, 'INSERT');
}

/* ============================== 後台 ============================== */

export async function adminListProjects(): Promise<Project[]> {
  const { data, error } = await db().from('projects').select('*').order('created_at');
  if (error) throw new ApiError(error.message);
  return (data ?? []).map(mapProject);
}

export async function adminListSessions(): Promise<SessionSlot[]> {
  const { data, error } = await db()
    .from('sessions')
    .select('*')
    .order('starts_at', { ascending: true });
  if (error) throw new ApiError(error.message);
  return (data ?? []).map(mapSession);
}

/** 新增或更新場次（id 以 draft- 開頭視為新增）。回傳儲存後的列。 */
export async function adminSaveSession(session: SessionSlot): Promise<SessionSlot> {
  const payload = {
    project_id: session.projectId,
    title: session.title,
    starts_at: session.startsAt,
    ends_at: session.endsAt,
    capacity: session.capacity,
    status: session.status,
    meet_url: session.meetUrl ?? null,
    instructor_ids: session.instructorIds,
  };
  const isNew = session.id.startsWith('draft-');
  const query = isNew
    ? db().from('sessions').insert(payload).select().single()
    : db().from('sessions').update(payload).eq('id', session.id).select().single();
  const { data, error } = await query;
  if (error) throw new ApiError(error.message, 'INSERT');
  return mapSession(data);
}

/** 後台：投稿佇列（RLS 限系統擁有者），最新在前。 */
export async function adminListSubmissions(): Promise<RecommendationSubmission[]> {
  const { data, error } = await db()
    .from('recommendation_submissions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new ApiError(error.message);
  return (data ?? []).map(mapSubmission);
}

export interface ReviewSubmissionPatch {
  status?: RecommendationSubmission['status'];
  reviewNote?: string;
  relatedRecommendationId?: string | null;
}

/** 後台：審核投稿——更新狀態／核實備註／對應舊資料。回傳更新後的列。 */
export async function adminReviewSubmission(
  id: string,
  patch: ReviewSubmissionPatch,
): Promise<RecommendationSubmission> {
  const payload: Row = {};
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.reviewNote !== undefined) payload.review_note = patch.reviewNote || null;
  if (patch.relatedRecommendationId !== undefined) {
    payload.related_recommendation_id = patch.relatedRecommendationId;
  }
  const { data, error } = await db()
    .from('recommendation_submissions')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new ApiError(error.message, 'INSERT');
  return mapSubmission(data);
}

/** Registration＋信件串（後台工作台用）。 */
export type RegistrationWithMessages = Registration & {
  messages?: {
    id: string;
    threadId: string;
    direction: 'outbound' | 'inbound';
    from: string;
    to: string;
    subject: string;
    body: string;
    isRead: boolean;
    sentAt: string;
  }[];
};

export async function adminListRegistrations(): Promise<RegistrationWithMessages[]> {
  const { data, error } = await db()
    .from('registrations')
    .select('*, email_threads(id, email_messages(*))')
    .order('created_at', { ascending: false });
  if (error) throw new ApiError(error.message);
  return (data ?? []).map((row) => {
    const threads = (row.email_threads ?? []) as {
      id: string;
      email_messages: Row[];
    }[];
    const messages = threads
      .flatMap((thread) => thread.email_messages ?? [])
      .map((m) => ({
        id: m.id as string,
        threadId: m.thread_id as string,
        direction: m.direction as 'outbound' | 'inbound',
        from: m.from_email as string,
        to: m.to_email as string,
        subject: m.subject as string,
        body: m.body as string,
        isRead: m.is_read as boolean,
        sentAt: m.sent_at as string,
      }))
      .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
    return { ...mapRegistration(row), messages };
  });
}

export async function adminUpdateRegistrationStatus(id: string, status: string): Promise<void> {
  const { error } = await db().from('registrations').update({ status }).eq('id', id);
  if (error) throw new ApiError(error.message, 'INSERT');
}

export async function adminGetStatusFlow(projectId: string): Promise<StatusFlow | null> {
  const { data, error } = await db()
    .from('status_flows')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();
  if (error) throw new ApiError(error.message);
  return data
    ? {
        projectId: data.project_id,
        nodes: data.nodes as StatusFlow['nodes'],
        transitions: (data.transitions as StatusFlow['transitions']) ?? undefined,
      }
    : null;
}

export async function adminListFormSchemas(): Promise<Record<string, FormSchema>> {
  const { data, error } = await db().from('form_schemas').select('project_id, fields');
  if (error) throw new ApiError(error.message);
  const result: Record<string, FormSchema> = {};
  for (const row of data ?? []) {
    result[row.project_id] = {
      projectId: row.project_id,
      fields: row.fields as FormSchema['fields'],
    };
  }
  return result;
}

export async function adminListEmailTemplates(): Promise<EmailTemplate[]> {
  const { data, error } = await db().from('email_templates').select('*').order('created_at');
  if (error) throw new ApiError(error.message);
  return (data ?? []).map(mapTemplate);
}

/* ============================== Edge Functions（K2） ============================== */

async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().functions.invoke(name, { body });
  if (error) {
    // FunctionsHttpError：讀取函式回傳的錯誤訊息
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const detail = (await context.json()) as { error?: string };
        if (detail.error) throw new ApiError(detail.error, 'QUERY');
      } catch (parseErr) {
        if (parseErr instanceof ApiError) throw parseErr;
      }
    }
    throw new ApiError(error.message ?? `呼叫 ${name} 失敗`, 'QUERY');
  }
  return data as T;
}

/** 寄出報名回覆信（Gmail Edge Function）。 */
export async function invokeSendEmail(input: {
  registrationId: string;
  subject: string;
  body: string;
}): Promise<{ ok: boolean; threadId?: string }> {
  return invokeFunction('send-email', input);
}

/** 為場次建立/更新 Google Calendar 事件與 Meet 連結。 */
export async function invokeCalendarUpsert(sessionId: string): Promise<{ ok: boolean; meetUrl?: string }> {
  return invokeFunction('calendar-upsert', { sessionId });
}
