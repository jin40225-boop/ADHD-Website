import { useState } from 'react';
import type {
  AvailabilityAnswer,
  AvailabilityPoll,
  CandidateSlot,
  Instructor,
} from '@contracts/types';
import { CheckboxGroup } from '@/components/ui/FormField';
import { WarmButton } from '@/components/ui/WarmButton';

export interface InstructorSchedulingProps {
  poll: AvailabilityPoll;
  instructors: Instructor[];
  onCreatePoll: (instructorIds: string[], slotIds: string[]) => void;
  onReply: (instructorId: string, slotId: string, answer: AvailabilityAnswer) => void;
  onConfirmSession: (slot: CandidateSlot) => void;
}

/** Candidate-slot creation, instructor reply form, and response matrix. */
export function InstructorScheduling({
  poll,
  instructors,
  onCreatePoll,
  onReply,
  onConfirmSession,
}: InstructorSchedulingProps) {
  const [selectedInstructorIds, setSelectedInstructorIds] = useState<string[]>(() => poll.instructorIds);
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>(() =>
    poll.candidateSlots.map((slot) => slot.id),
  );
  const canCreatePoll = selectedInstructorIds.length > 0 && selectedSlotIds.length > 0;

  return (
    <div className="instructor-scheduling">
      <section>
        <h2>建立邀約</h2>
        <CheckboxGroup
          label="候選時段"
          name="candidate-slots"
          value={selectedSlotIds}
          onChange={setSelectedSlotIds}
          options={poll.candidateSlots.map((slot) => ({
            value: slot.id,
            label: `${slot.title} ${slot.startsAt}`,
          }))}
        />
        <CheckboxGroup
          label="講師"
          name="instructors"
          value={selectedInstructorIds}
          onChange={setSelectedInstructorIds}
          options={instructors.map((instructor) => ({
            value: instructor.id,
            label: instructor.name,
          }))}
        />
        <WarmButton
          disabled={!canCreatePoll}
          onClick={() => onCreatePoll(selectedInstructorIds, selectedSlotIds)}
        >
          建立邀約
        </WarmButton>
      </section>

      <section>
        <h2>講師回覆</h2>
        {instructors.map((instructor) => (
          <div key={instructor.id}>
            <strong>{instructor.name}</strong>
            {poll.candidateSlots.map((slot) => (
              <span key={slot.id}>
                <button type="button" onClick={() => onReply(instructor.id, slot.id, 'yes')}>可以</button>
                <button type="button" onClick={() => onReply(instructor.id, slot.id, 'no')}>不行</button>
              </span>
            ))}
          </div>
        ))}
      </section>

      <section>
        <h2>回覆總覽</h2>
        <table>
          <thead>
            <tr>
              <th>時段</th>
              {instructors.map((instructor) => <th key={instructor.id}>{instructor.name}</th>)}
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {poll.candidateSlots.map((slot) => (
              <tr key={slot.id}>
                <td>{slot.title}</td>
                {instructors.map((instructor) => (
                  <td key={instructor.id}>
                    {poll.replies.find((reply) =>
                      reply.slotId === slot.id && reply.instructorId === instructor.id
                    )?.answer ?? 'pending'}
                  </td>
                ))}
                <td><WarmButton size="sm" onClick={() => onConfirmSession(slot)}>確認成立</WarmButton></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
