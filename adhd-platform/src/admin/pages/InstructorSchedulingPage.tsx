/** 講師邀約：Supabase 邀約、回覆、場次成立與 Gmail／Calendar 接線。 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AvailabilityAnswer,
  AvailabilityPoll,
  CandidateSlot,
  Instructor,
  Project,
} from '@contracts/types';
import { InstructorScheduling, mockPoll } from '@/features/instructor-scheduling';
import { mockInstructors } from '@/features/session-manager';
import {
  adminConfirmAvailabilityPoll,
  adminListAvailabilityPolls,
  adminListInstructors,
  adminListProjects,
  adminSaveAvailabilityPoll,
  invokeCalendarUpsert,
  invokeSendInstructorInvite,
  saveAvailabilityReply,
} from '@/lib/api';
import { isSupabaseReady } from '@/lib/supabase';
import { WarmButton } from '@/components/ui/WarmButton';
import DemoDataNotice from '../DemoDataNotice';

function toLocalInput(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(+date)) return value;
  const part = (number: number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`;
}

function toIso(value: string): string {
  const date = new Date(value);
  return Number.isNaN(+date) ? value : date.toISOString();
}

function editablePoll(poll: AvailabilityPoll): AvailabilityPoll {
  return {
    ...poll,
    candidateSlots: poll.candidateSlots.map((slot) => ({
      ...slot,
      startsAt: toLocalInput(slot.startsAt),
      endsAt: toLocalInput(slot.endsAt),
    })),
  };
}

function createDraft(projectId: string): AvailabilityPoll {
  return {
    id: `draft-${crypto.randomUUID()}`,
    projectId,
    candidateSlots: [],
    instructorIds: [],
    status: 'open',
    replies: [],
    createdAt: new Date().toISOString(),
  };
}

export default function InstructorSchedulingPage() {
  const live = isSupabaseReady;
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [polls, setPolls] = useState<AvailabilityPoll[]>(live ? [] : [mockPoll]);
  const [instructors, setInstructors] = useState<Instructor[]>(live ? [] : mockInstructors);
  const [selectedPollId, setSelectedPollId] = useState(live ? '' : mockPoll.id);
  const [draft, setDraft] = useState<AvailabilityPoll>();
  const [loading, setLoading] = useState(live);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    void adminListProjects()
      .then((rows) => {
        if (cancelled) return;
        setProjects(rows);
        setProjectId((current) => current || rows[0]?.id || '');
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : '載入專案失敗');
      });
    return () => { cancelled = true; };
  }, [live]);

  const reloadProject = useCallback(async (targetProjectId: string, preferredPollId?: string) => {
    if (!live || !targetProjectId) return;
    setLoading(true);
    try {
      const [nextPolls, nextInstructors] = await Promise.all([
        adminListAvailabilityPolls(targetProjectId),
        adminListInstructors(targetProjectId),
      ]);
      setPolls(nextPolls);
      setInstructors(nextInstructors);
      setSelectedPollId((current) => {
        const candidate = preferredPollId ?? current;
        return nextPolls.some((poll) => poll.id === candidate) ? candidate : (nextPolls[0]?.id ?? '');
      });
      setDraft(undefined);
      setError(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '載入講師邀約失敗');
    } finally {
      setLoading(false);
    }
  }, [live]);

  useEffect(() => {
    void reloadProject(projectId);
  }, [projectId, reloadProject]);

  const selectedPoll = useMemo(
    () => draft ?? polls.find((poll) => poll.id === selectedPollId),
    [draft, polls, selectedPollId],
  );
  const workbenchPoll = selectedPoll ? editablePoll(selectedPoll) : undefined;

  const handleSavePoll = async (candidateSlots: CandidateSlot[], instructorIds: string[]) => {
    if (!selectedPoll) return;
    if (!live) {
      setPolls([{ ...selectedPoll, candidateSlots, instructorIds }, ...polls.filter((poll) => poll.id !== selectedPoll.id)]);
      setNotice('示意模式：邀約只保留在目前瀏覽器工作階段。');
      return;
    }
    setBusy(true);
    setNotice(undefined);
    setError(undefined);
    try {
      const saved = await adminSaveAvailabilityPoll({
        id: selectedPoll.id,
        projectId: selectedPoll.projectId,
        candidateSlots: candidateSlots.map((slot) => ({
          ...slot,
          startsAt: toIso(slot.startsAt),
          endsAt: toIso(slot.endsAt),
        })),
        instructorIds,
      });
      await reloadProject(projectId, saved.id);
      setNotice('邀約已儲存，可寄送邀請給講師。');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '儲存邀約失敗');
    } finally {
      setBusy(false);
    }
  };

  const handleSendInvites = async () => {
    if (!selectedPoll || selectedPoll.id.startsWith('draft-')) return;
    if (!live) {
      setNotice('示意模式：未寄出邀請信。');
      return;
    }
    setBusy(true);
    setNotice(undefined);
    setError(undefined);
    try {
      const result = await invokeSendInstructorInvite(selectedPoll.id);
      setNotice(`已寄出 ${result.sent} 封講師邀請信。`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '寄送邀請失敗');
    } finally {
      setBusy(false);
    }
  };

  const handleReply = async (
    instructorId: string,
    slotId: string,
    answer: Exclude<AvailabilityAnswer, 'pending'>,
  ) => {
    if (!selectedPoll) return;
    if (!live) {
      setPolls((current) => current.map((poll) => poll.id === selectedPoll.id ? {
        ...poll,
        replies: [
          ...poll.replies.filter((reply) => !(reply.instructorId === instructorId && reply.slotId === slotId)),
          { id: `reply-${crypto.randomUUID()}`, pollId: poll.id, instructorId, slotId, answer },
        ],
      } : poll));
      return;
    }
    setBusy(true);
    try {
      await saveAvailabilityReply({ pollId: selectedPoll.id, instructorId, slotId, answer });
      await reloadProject(projectId, selectedPoll.id);
      setNotice('講師回覆已更新。');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '更新回覆失敗');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmSession = async (slot: CandidateSlot) => {
    if (!selectedPoll || selectedPoll.id.startsWith('draft-')) return;
    if (!live) {
      setNotice(`示意模式：已選定「${slot.title}」，未建立正式場次。`);
      return;
    }
    setBusy(true);
    setNotice(undefined);
    setError(undefined);
    try {
      const session = await adminConfirmAvailabilityPoll(selectedPoll.id, slot.id);
      try {
        const calendar = await invokeCalendarUpsert(session.id);
        setNotice(calendar.meetUrl
          ? `「${session.title}」已成立並建立 Meet：${calendar.meetUrl}`
          : `「${session.title}」已成立並建立行事曆事件。`);
      } catch (calendarError) {
        setNotice(`「${session.title}」已建立為正式場次。`);
        setError(`場次已建立，但 Calendar／Meet 建立失敗：${calendarError instanceof Error ? calendarError.message : '未知錯誤'}`);
      }
      await reloadProject(projectId, selectedPoll.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '確認場次失敗');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {!live ? <DemoDataNotice /> : null}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border-2 border-brown/40 bg-accent-teal/20 px-4 py-3 text-sm">
        <label className="font-bold" htmlFor="instructor-project">專案</label>
        <select
          id="instructor-project"
          className="min-w-52 rounded-lg border-2 border-brown bg-white px-3 py-2"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          disabled={!live || busy}
        >
          {!projects.length ? <option value="">無可管理專案</option> : null}
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        <label className="ml-2 font-bold" htmlFor="availability-poll">邀約</label>
        <select
          id="availability-poll"
          className="min-w-52 rounded-lg border-2 border-brown bg-white px-3 py-2"
          value={draft?.id ?? selectedPollId}
          onChange={(event) => {
            setDraft(undefined);
            setSelectedPollId(event.target.value);
          }}
          disabled={busy}
        >
          {draft ? <option value={draft.id}>新邀約（尚未儲存）</option> : null}
          {!polls.length && !draft ? <option value="">尚無邀約</option> : null}
          {polls.map((poll, index) => (
            <option key={poll.id} value={poll.id}>邀約 {polls.length - index} · {poll.status}</option>
          ))}
        </select>
        <WarmButton
          size="sm"
          variant="secondary"
          disabled={!projectId || busy}
          onClick={() => setDraft(createDraft(projectId))}
        >
          建立新邀約
        </WarmButton>
      </div>

      {notice ? <p role="status" className="mb-4 rounded-xl border-2 border-brown/40 bg-accent-blue/30 px-4 py-2.5 text-sm">{notice}</p> : null}
      {error ? <p role="alert" className="mb-4 rounded-xl border-2 border-alert-red bg-alert-red/10 px-4 py-2.5 text-sm font-bold">{error}</p> : null}

      {loading ? (
        <p className="p-8 text-center text-brown/60">載入講師邀約中…</p>
      ) : workbenchPoll ? (
        <InstructorScheduling
          key={`${workbenchPoll.id}-${workbenchPoll.createdAt}`}
          poll={workbenchPoll}
          instructors={instructors}
          busy={busy}
          onSavePoll={(slots, instructorIds) => void handleSavePoll(slots, instructorIds)}
          onSendInvites={() => void handleSendInvites()}
          onReply={(instructorId, slotId, answer) => void handleReply(instructorId, slotId, answer)}
          onConfirmSession={(slot) => void handleConfirmSession(slot)}
        />
      ) : (
        <div className="rounded-xl border-2 border-dashed border-brown/35 bg-white p-10 text-center">
          <p className="font-bold">這個專案尚無講師邀約。</p>
          <p className="mt-1 text-sm text-brown/60">建立第一份邀約，加入候選時段與講師。</p>
        </div>
      )}
    </div>
  );
}
