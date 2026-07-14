/**
 * 講師邀約路由頁。【CLAUDE 整合層】
 * 回覆先寫本地 poll 狀態；建立邀約信與場次正式成立之後接 Edge Functions（K2）。
 */
import { useState } from 'react';
import type { AvailabilityAnswer, AvailabilityPoll, CandidateSlot } from '@contracts/types';
import { InstructorScheduling, mockPoll } from '@/features/instructor-scheduling';
import { mockInstructors } from '@/features/session-manager';
import DemoDataNotice from '../DemoDataNotice';

export default function InstructorSchedulingPage() {
  const [poll, setPoll] = useState<AvailabilityPoll>(mockPoll);
  const [notice, setNotice] = useState<string>();

  const handleCreatePoll = (instructorIds: string[], slotIds: string[]) => {
    setPoll((prev) => ({ ...prev, instructorIds, status: 'open' }));
    setNotice(
      `邀約已建立（${instructorIds.length} 位講師 × ${slotIds.length} 個候選時段）。邀約信寄送需 Gmail Edge Function（K2），目前僅示意。`,
    );
  };

  const handleReply = (instructorId: string, slotId: string, answer: AvailabilityAnswer) => {
    setPoll((prev) => {
      const others = prev.replies.filter(
        (reply) => !(reply.instructorId === instructorId && reply.slotId === slotId),
      );
      return {
        ...prev,
        replies: [
          ...others,
          {
            id: `reply-${instructorId}-${slotId}`,
            pollId: prev.id,
            slotId,
            instructorId,
            answer,
            repliedAt: new Date().toISOString(),
          },
        ],
      };
    });
  };

  const handleConfirmSession = (slot: CandidateSlot) => {
    setPoll((prev) => ({ ...prev, status: 'confirmed' }));
    setNotice(
      `已選定「${slot.title}」。正式建立場次與 Google Meet 連結由後端（K1／K2）完成，目前僅示意。`,
    );
  };

  return (
    <div>
      <DemoDataNotice />
      {notice ? (
        <p role="status" className="mb-4 rounded-xl border-2 border-brown/40 bg-accent-blue/30 px-4 py-2.5 text-sm">
          {notice}
        </p>
      ) : null}
      <InstructorScheduling
        poll={poll}
        instructors={mockInstructors}
        onCreatePoll={handleCreatePoll}
        onReply={handleReply}
        onConfirmSession={handleConfirmSession}
      />
    </div>
  );
}
