import { Check, CopyCheck } from 'lucide-react';
import { useState } from 'react';
import type {
  Recommendation,
  RecommendationSubmission,
  SubmissionType,
} from '@contracts/types';
import { EmptyState } from '@/components/ui/EmptyState';
import { Textarea } from '@/components/ui/FormField';
import { WarmButton } from '@/components/ui/WarmButton';
import { WarmCard } from '@/components/ui/WarmCard';

const tabs: { key: SubmissionType; label: string }[] = [
  { key: 'doctor', label: '醫師推薦' },
  { key: 'assessment', label: '衡鑑測驗' },
  { key: 'therapy', label: '治療課程' },
  { key: 'doctor_update', label: '醫師動態' },
  { key: 'feature', label: '專題投稿' },
  { key: 'correction', label: '糾錯' },
  { key: 'other', label: '其他資源' },
];

export interface RecommendationReviewProps {
  submissions: RecommendationSubmission[];
  candidateMatches: Record<string, Recommendation[]>;
  onApplyMatch: (submission: RecommendationSubmission, recommendation: Recommendation) => void;
  onPublish: (submission: RecommendationSubmission, note: string) => void;
}

/** Review queue for positive recommendation submissions; all publish actions are props. */
export function RecommendationReview({
  submissions,
  candidateMatches,
  onApplyMatch,
  onPublish,
}: RecommendationReviewProps) {
  const [tab, setTab] = useState<SubmissionType>('doctor');
  const [selectedId, setSelectedId] = useState<string>();
  const [note, setNote] = useState('');
  const list = submissions.filter((submission) => submission.type === tab);
  const selected = list.find((submission) => submission.id === selectedId) ?? list[0];

  return (
    <div className="recommendation-review">
      <nav className="recommendation-review__tabs">
        {tabs.map((item) => (
          <button
            type="button"
            key={item.key}
            className={tab === item.key ? 'is-active' : ''}
            onClick={() => { setTab(item.key); setSelectedId(undefined); setNote(''); }}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="recommendation-review__body">
        <aside>
          {list.length ? list.map((submission) => (
            <button
              className="recommendation-review__item"
              type="button"
              key={submission.id}
              onClick={() => { setSelectedId(submission.id); setNote(''); }}
            >
              {submission.nickname || '匿名投稿'}
              <small>{submission.createdAt}</small>
            </button>
          )) : <EmptyState title="此類型沒有待審投稿" />}
        </aside>
        <main>
          {selected ? (
            <SubmissionDetail
              key={selected.id}
              submission={selected}
              matches={candidateMatches[selected.id] ?? []}
              note={note}
              onNote={setNote}
              onApply={onApplyMatch}
              onPublish={onPublish}
            />
          ) : <EmptyState title="請選擇投稿" />}
        </main>
      </div>
    </div>
  );
}

function SubmissionDetail({
  submission,
  matches,
  note,
  onNote,
  onApply,
  onPublish,
}: {
  submission: RecommendationSubmission;
  matches: Recommendation[];
  note: string;
  onNote: (note: string) => void;
  onApply: RecommendationReviewProps['onApplyMatch'];
  onPublish: RecommendationReviewProps['onPublish'];
}) {
  const [verified, setVerified] = useState(false);

  return (
    <div className="recommendation-review__detail">
      <WarmCard style={{ padding: '1rem' }}>
        <h3>投稿內容</h3>
        {Object.entries(submission.answers).map(([key, value]) => (
          <p key={key}><strong>{key}</strong>：{Array.isArray(value) ? value.join('、') : value}</p>
        ))}
      </WarmCard>

      {submission.type === 'correction' || submission.type === 'doctor_update' ? (
        <section>
          <h3>疑似對應舊資料</h3>
          {matches.length ? matches.map((match) => (
            <WarmCard key={match.id} style={{ padding: '1rem', marginBottom: '.7rem' }}>
              <strong>{match.hospital}／{match.doctorOrName}</strong>
              <p>{match.experience}</p>
              <WarmButton size="sm" icon={CopyCheck} onClick={() => onApply(submission, match)}>
                套用更新
              </WarmButton>
            </WarmCard>
          )) : <EmptyState title="沒有找到疑似對應資料" />}
        </section>
      ) : null}

      <section>
        <h3>核實工作區</h3>
        <label className="ui-choice">
          <input
            type="checkbox"
            checked={verified}
            onChange={(event) => setVerified(event.target.checked)}
          />
          已完成資料核實
        </label>
        <Textarea
          label="核實備註"
          name="verified-note"
          value={note}
          onChange={(event) => onNote(event.target.value)}
          helpText="請記錄核實來源或待追蹤事項。"
        />
        <WarmButton
          icon={Check}
          disabled={!verified}
          onClick={() => onPublish(submission, note)}
        >
          核實並上架
        </WarmButton>
      </section>
    </div>
  );
}
