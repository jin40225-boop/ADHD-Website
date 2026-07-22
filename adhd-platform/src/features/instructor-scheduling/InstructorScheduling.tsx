import { useMemo, useState } from 'react';
import { CalendarCheck, Plus, Send, Trash2 } from 'lucide-react';
import type {
  AvailabilityAnswer,
  AvailabilityPoll,
  CandidateSlot,
  Instructor,
} from '@contracts/types';
import { CheckboxGroup, TextInput } from '@/components/ui/FormField';
import { WarmButton } from '@/components/ui/WarmButton';

export interface InstructorSchedulingProps {
  poll: AvailabilityPoll;
  instructors: Instructor[];
  busy?: boolean;
  onSavePoll: (candidateSlots: CandidateSlot[], instructorIds: string[]) => void;
  onSendInvites: () => void;
  onReply: (
    instructorId: string,
    slotId: string,
    answer: Exclude<AvailabilityAnswer, 'pending'>,
  ) => void;
  onConfirmSession: (slot: CandidateSlot) => void;
}

const answerLabels: Record<AvailabilityAnswer, string> = {
  yes: '可以',
  no: '不行',
  pending: '待回覆',
};

function newCandidateSlot(index: number): CandidateSlot {
  return {
    id: `slot-${crypto.randomUUID()}`,
    title: `候選時段 ${index}`,
    startsAt: '',
    endsAt: '',
    capacity: 1,
  };
}

function formatSlotTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(+date)
    ? value
    : new Intl.DateTimeFormat('zh-TW', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
}

/** 建立邀約、代填回覆與確認正式場次的共用工作台。 */
export function InstructorScheduling({
  poll,
  instructors,
  busy = false,
  onSavePoll,
  onSendInvites,
  onReply,
  onConfirmSession,
}: InstructorSchedulingProps) {
  const [candidateSlots, setCandidateSlots] = useState<CandidateSlot[]>(() =>
    poll.candidateSlots.length ? poll.candidateSlots : [newCandidateSlot(1)],
  );
  const [selectedInstructorIds, setSelectedInstructorIds] = useState<string[]>(() =>
    poll.instructorIds,
  );
  const invitedInstructors = useMemo(
    () => instructors.filter((instructor) => selectedInstructorIds.includes(instructor.id)),
    [instructors, selectedInstructorIds],
  );
  const isDraft = poll.id.startsWith('draft-');
  const validSlots = candidateSlots.every((slot) => (
    slot.title.trim()
    && slot.startsAt
    && slot.endsAt
    && new Date(slot.endsAt) > new Date(slot.startsAt)
    && slot.capacity > 0
  ));
  const canSave = poll.status === 'open' && validSlots && selectedInstructorIds.length > 0 && !busy;

  const patchSlot = (slotId: string, patch: Partial<CandidateSlot>) => {
    setCandidateSlots((current) => current.map((slot) => (
      slot.id === slotId ? { ...slot, ...patch } : slot
    )));
  };

  return (
    <div className="grid gap-6">
      <section className="rounded-xl border-2 border-brown bg-white p-5 shadow-warm-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold">邀約設定</h2>
            <p className="text-sm text-brown/65">候選時段、名額與受邀講師會儲存在受 RLS 保護的資料庫。</p>
          </div>
          <span className="rounded-md border border-brown/30 bg-cream px-2.5 py-1 text-xs font-bold">
            {isDraft ? '尚未儲存' : poll.status === 'open' ? '邀約中' : poll.status === 'confirmed' ? '已成立' : '已取消'}
          </span>
        </div>

        <div className="grid gap-4">
          {candidateSlots.map((slot, index) => (
            <div key={slot.id} className="grid gap-3 rounded-lg border border-brown/25 bg-cream/60 p-4 lg:grid-cols-[1.4fr_1fr_1fr_100px_auto] lg:items-end">
              <TextInput
                label={`候選時段 ${index + 1}`}
                value={slot.title}
                onChange={(event) => patchSlot(slot.id, { title: event.target.value })}
              />
              <TextInput
                label="開始時間"
                type="datetime-local"
                value={slot.startsAt}
                onChange={(event) => patchSlot(slot.id, { startsAt: event.target.value })}
              />
              <TextInput
                label="結束時間"
                type="datetime-local"
                value={slot.endsAt}
                onChange={(event) => patchSlot(slot.id, { endsAt: event.target.value })}
              />
              <TextInput
                label="名額"
                type="number"
                min="1"
                value={slot.capacity}
                onChange={(event) => patchSlot(slot.id, { capacity: Number(event.target.value) })}
              />
              <button
                type="button"
                className="inline-flex size-10 items-center justify-center rounded-lg border-2 border-brown bg-white hover:bg-accent-pink/25 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => setCandidateSlots((current) => current.filter((item) => item.id !== slot.id))}
                disabled={candidateSlots.length === 1}
                aria-label={`移除${slot.title}`}
                title="移除候選時段"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <WarmButton
            variant="secondary"
            icon={Plus}
            onClick={() => setCandidateSlots((current) => [...current, newCandidateSlot(current.length + 1)])}
          >
            新增候選時段
          </WarmButton>
        </div>

        <div className="mt-5 border-t border-brown/15 pt-5">
          {instructors.length ? (
            <CheckboxGroup
              label="受邀講師"
              name="instructors"
              value={selectedInstructorIds}
              onChange={setSelectedInstructorIds}
              options={instructors.map((instructor) => ({
                value: instructor.id,
                label: `${instructor.name}（${instructor.title}）`,
              }))}
            />
          ) : (
            <p className="rounded-lg border border-highlight bg-accent-orange/15 p-3 text-sm font-bold">
              此專案尚無講師成員，請先在 Supabase 將講師加入 project_members。
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <WarmButton disabled={!canSave} onClick={() => onSavePoll(candidateSlots, selectedInstructorIds)}>
            {busy ? '儲存中…' : '儲存邀約'}
          </WarmButton>
          <WarmButton
            variant="secondary"
            icon={Send}
            disabled={isDraft || poll.status !== 'open' || busy}
            onClick={onSendInvites}
          >
            寄送邀請
          </WarmButton>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border-2 border-brown bg-white shadow-warm-sm">
        <div className="border-b-2 border-brown bg-base-yellow px-5 py-4">
          <h2 className="text-lg font-extrabold">回覆總覽</h2>
          <p className="text-sm text-brown/65">講師可從邀請連結登入回覆；管理者也能在此代填。</p>
        </div>
        {isDraft ? (
          <p className="p-6 text-center text-brown/60">儲存邀約後即可收集回覆。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="bg-cream text-left">
                  <th className="border-b border-brown/20 px-4 py-3">候選時段</th>
                  {invitedInstructors.map((instructor) => (
                    <th key={instructor.id} className="border-b border-brown/20 px-4 py-3">{instructor.name}</th>
                  ))}
                  <th className="border-b border-brown/20 px-4 py-3">成立場次</th>
                </tr>
              </thead>
              <tbody>
                {poll.candidateSlots.map((slot) => {
                  const slotReplies = poll.replies.filter((reply) => reply.slotId === slot.id);
                  const hasAvailableInstructor = slotReplies.some((reply) => reply.answer === 'yes');
                  return (
                    <tr key={slot.id} className="border-b border-brown/10 align-top last:border-0">
                      <td className="px-4 py-3">
                        <strong className="block">{slot.title}</strong>
                        <span className="text-xs text-brown/60">{formatSlotTime(slot.startsAt)} · {slot.capacity} 名</span>
                      </td>
                      {invitedInstructors.map((instructor) => {
                        const answer = poll.replies.find((reply) => (
                          reply.slotId === slot.id && reply.instructorId === instructor.id
                        ))?.answer ?? 'pending';
                        return (
                          <td key={instructor.id} className="px-4 py-3">
                            <span className="mb-2 block font-bold">{answerLabels[answer]}</span>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                className="rounded-md border border-brown px-2 py-1 text-xs font-bold hover:bg-accent-teal/25"
                                onClick={() => onReply(instructor.id, slot.id, 'yes')}
                              >
                                可以
                              </button>
                              <button
                                type="button"
                                className="rounded-md border border-brown px-2 py-1 text-xs font-bold hover:bg-accent-pink/25"
                                onClick={() => onReply(instructor.id, slot.id, 'no')}
                              >
                                不行
                              </button>
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-4 py-3">
                        <WarmButton
                          size="sm"
                          icon={CalendarCheck}
                          disabled={!hasAvailableInstructor || poll.status !== 'open' || busy}
                          onClick={() => onConfirmSession(slot)}
                        >
                          確認成立
                        </WarmButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
