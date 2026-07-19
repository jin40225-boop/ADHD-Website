/**
 * 報名審核工作台路由頁。【CLAUDE 整合層】
 * Supabase 已設定時讀寫真實資料（報名紀錄/場次/表單/狀態流/範本皆來自 DB，
 * 狀態變更即時寫回）；未設定時退回本地示意資料。
 * 寄信（onSendEmail）為 K2 範圍，目前僅提示。
 */
import { useCallback, useEffect, useState } from 'react';
import type { EmailTemplate, FormSchema, SessionSlot, StatusFlow } from '@contracts/types';
import {
  RegistrationReviewWorkbench,
  mockEmailTemplates,
  mockRegistrations,
  mockSessions,
  mockStatusFlow,
} from '@/features/registration-review';
import type { RegistrationReviewData, SendEmailRequest } from '@/features/registration-review';
import { mockConsultationSchema } from '@/features/form-engine';
import {
  adminGetStatusFlow,
  adminListEmailTemplates,
  adminListFormSchemas,
  adminListProjects,
  adminListRegistrations,
  adminListSessions,
  adminUpdateRegistrationStatus,
  invokeSendEmail,
} from '@/lib/api';
import { isSupabaseReady } from '@/lib/supabase';
import DemoDataNotice from '../DemoDataNotice';

export default function RegistrationsPage() {
  const live = isSupabaseReady;
  const [registrations, setRegistrations] = useState<RegistrationReviewData[]>(
    live ? [] : mockRegistrations,
  );
  const [sessions, setSessions] = useState<SessionSlot[]>(live ? [] : mockSessions);
  const [schemas, setSchemas] = useState<Record<string, FormSchema>>(
    live ? {} : { [mockConsultationSchema.projectId]: mockConsultationSchema },
  );
  const [statusFlow, setStatusFlow] = useState<StatusFlow>(mockStatusFlow);
  const [statusFlows, setStatusFlows] = useState<Record<string, StatusFlow>>({});
  const [projectNames, setProjectNames] = useState<Record<string, string>>();
  const [templates, setTemplates] = useState<EmailTemplate[]>(live ? [] : mockEmailTemplates);
  const [loading, setLoading] = useState(live);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  const reload = useCallback(async () => {
    if (!live) return;
    try {
      const [regs, ss, fs, tpls, projects] = await Promise.all([
        adminListRegistrations(),
        adminListSessions(),
        adminListFormSchemas(),
        adminListEmailTemplates(),
        adminListProjects(),
      ]);
      // 各計畫各自的狀態流；報名筆數少、計畫僅個位數，逐一載入可接受
      const flowEntries = await Promise.all(
        projects.map(async (p) => [p.id, await adminGetStatusFlow(p.id)] as const),
      );
      const flows = Object.fromEntries(flowEntries.filter(([, f]) => f)) as Record<string, StatusFlow>;
      setRegistrations(regs);
      setSessions(ss);
      setSchemas(fs);
      setTemplates(tpls);
      setStatusFlows(flows);
      setProjectNames(Object.fromEntries(projects.map((p) => [p.id, p.name])));
      if (projects[0] && flows[projects[0].id]) setStatusFlow(flows[projects[0].id]);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入報名資料失敗');
    } finally {
      setLoading(false);
    }
  }, [live]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleStatusChange = async (registration: RegistrationReviewData, nextStatus: string) => {
    setNotice(undefined);
    setError(undefined);
    setRegistrations((prev) =>
      prev.map((item) => (item.id === registration.id ? { ...item, status: nextStatus } : item)),
    );
    if (!live) return;
    try {
      await adminUpdateRegistrationStatus(registration.id, nextStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : '狀態更新失敗');
      await reload(); // 還原為資料庫實際狀態
    }
  };

  const handleSendEmail = async (request: SendEmailRequest) => {
    setNotice(undefined);
    setError(undefined);
    if (!live) {
      setNotice('示意模式：未寄出信件。');
      return;
    }
    try {
      setNotice('寄送中…');
      await invokeSendEmail({
        registrationId: request.registration.id,
        subject: request.subject,
        body: request.body,
      });
      setNotice(`已透過 Gmail 寄出「${request.subject}」給 ${request.registration.email}。`);
      await reload();
    } catch (err) {
      setNotice(undefined);
      setError(err instanceof Error ? err.message : '寄信失敗');
    }
  };

  return (
    <div>
      {live ? (
        <div className="mb-4 rounded-xl border-2 border-brown/40 bg-accent-teal/20 px-4 py-2.5 text-sm">
          <strong>真實資料模式：</strong>顯示資料庫中的報名紀錄，狀態變更即時寫回。
        </div>
      ) : (
        <DemoDataNotice note="「寄送範本」目前僅記錄到本地信件串，不會真的寄信。" />
      )}
      {notice ? (
        <p role="status" className="mb-4 rounded-xl border-2 border-brown/40 bg-accent-blue/30 px-4 py-2.5 text-sm">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mb-4 rounded-xl border-2 border-alert-red bg-alert-red/10 px-4 py-2.5 text-sm font-bold">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="p-6 text-center text-brown/60">載入報名資料中…</p>
      ) : (
        <RegistrationReviewWorkbench
          registrations={registrations}
          sessions={sessions}
          schemas={schemas}
          statusFlow={statusFlow}
          statusFlows={statusFlows}
          projectNames={projectNames}
          emailTemplates={templates}
          onStatusChange={handleStatusChange}
          onSendEmail={handleSendEmail}
        />
      )}
    </div>
  );
}
