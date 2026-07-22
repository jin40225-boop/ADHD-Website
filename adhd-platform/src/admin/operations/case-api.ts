import { supabase } from '@/lib/supabase';
import type { ServiceRecord } from '@contracts/types';

type Row = Record<string, any>;

export interface OperationalCase {
  id: string; projectId: string; registrationId?: string; contactId?: string; displayName: string;
  serviceType: 'single' | 'ongoing'; status: 'active' | 'paused' | 'closed'; summary?: string;
  assignedTo?: string; openedAt: string; closedAt?: string; closeReason?: string; archivedAt?: string;
  createdAt: string; updatedAt?: string; records: (ServiceRecord & { revision?: number; archivedAt?: string })[];
}
function db() { if (!supabase) throw new Error('Supabase 未設定'); return supabase; }
export async function listOperationalCases(): Promise<OperationalCase[]> {
  const { data, error } = await db().from('cases').select('*, service_records(*)').is('archived_at', null).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: Row) => ({ id: row.id, projectId: row.project_id, registrationId: row.registration_id ?? undefined, contactId: row.contact_id ?? undefined, displayName: row.display_name, serviceType: row.service_type, status: row.status, summary: row.summary ?? undefined, assignedTo: row.assigned_to ?? undefined, openedAt: row.opened_at, closedAt: row.closed_at ?? undefined, closeReason: row.close_reason ?? undefined, archivedAt: row.archived_at ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at ?? undefined, records: (row.service_records ?? []).filter((item: Row) => !item.archived_at).map((item: Row) => ({ id: item.id, caseId: item.case_id, kind: item.kind, occurredAt: item.occurred_at, title: item.title, content: item.content, authorId: item.author_id ?? undefined, createdAt: item.created_at, revision: item.revision, archivedAt: item.archived_at ?? undefined })).sort((a: ServiceRecord, b: ServiceRecord) => b.occurredAt.localeCompare(a.occurredAt)) }));
}
export async function saveOperationalCase(input: Partial<OperationalCase> & Pick<OperationalCase, 'projectId' | 'displayName' | 'serviceType' | 'status'>) {
  const payload = { project_id: input.projectId, registration_id: input.registrationId ?? null, contact_id: input.contactId ?? null, display_name: input.displayName.trim(), service_type: input.serviceType, status: input.status, summary: input.summary?.trim() || null, assigned_to: input.assignedTo ?? null, closed_at: input.status === 'closed' ? input.closedAt ?? new Date().toISOString() : null, close_reason: input.status === 'closed' ? input.closeReason?.trim() || null : null };
  const query = input.id ? db().from('cases').update(payload).eq('id', input.id) : db().from('cases').insert(payload);
  const { error } = await query; if (error) throw new Error(error.message);
}
export async function archiveOperationalCase(id: string) { const { error } = await db().from('cases').update({ archived_at: new Date().toISOString() }).eq('id', id); if (error) throw new Error(error.message); }
export async function saveServiceRecord(input: { id?: string; caseId: string; kind: 'service' | 'contact' | 'note'; occurredAt: string; title: string; content: string }) {
  const payload = { case_id: input.caseId, kind: input.kind, occurred_at: input.occurredAt, title: input.title.trim(), content: input.content.trim() };
  const query = input.id ? db().from('service_records').update(payload).eq('id', input.id) : db().from('service_records').insert(payload);
  const { error } = await query; if (error) throw new Error(error.message);
}
export async function archiveServiceRecord(id: string) { const { error } = await db().from('service_records').update({ archived_at: new Date().toISOString() }).eq('id', id); if (error) throw new Error(error.message); }
export async function transferCase(caseId: string, fromUserId: string | undefined, toUserId: string, reason: string) {
  const { error: transferError } = await db().from('case_transfers').insert({ case_id: caseId, from_user_id: fromUserId ?? null, to_user_id: toUserId, reason: reason.trim() }); if (transferError) throw new Error(transferError.message);
  const { error } = await db().from('cases').update({ assigned_to: toUserId }).eq('id', caseId); if (error) throw new Error(error.message);
}

