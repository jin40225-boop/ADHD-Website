/**
 * 推薦資料庫審核路由頁。【CLAUDE 整合層】
 * 投稿佇列用假資料；「疑似對應舊資料」以公開的 recommendations.json 做本地比對示意。
 * 核實上架的實際寫入之後接 Supabase（K1）。
 */
import { useMemo, useState } from 'react';
import type { Recommendation, RecommendationSubmission } from '@contracts/types';
import { RecommendationReview, mockSubmissions } from '@/features/recommendation-review';
import recommendationsData from '@/data/recommendations.json';
import DemoDataNotice from '../DemoDataNotice';

const published = recommendationsData as Recommendation[];

export default function RecommendationsPage() {
  const [submissions, setSubmissions] = useState<RecommendationSubmission[]>(mockSubmissions);
  const [notice, setNotice] = useState<string>();

  const candidateMatches = useMemo(() => {
    const matches: Record<string, Recommendation[]> = {};
    for (const submission of submissions) {
      if (submission.type !== 'correction' && submission.type !== 'doctor_update') continue;
      const text = Object.values(submission.answers).flat().join(' ');
      matches[submission.id] = published
        .filter(
          (rec) =>
            (rec.doctorOrName && text.includes(rec.doctorOrName)) ||
            (rec.hospital && text.includes(rec.hospital)),
        )
        .slice(0, 5);
    }
    return matches;
  }, [submissions]);

  const handleApplyMatch = (submission: RecommendationSubmission, recommendation: Recommendation) => {
    setNotice(
      `已標記將「${submission.nickname || '匿名投稿'}」的內容套用至 ${recommendation.hospital}／${recommendation.doctorOrName}；實際資料更新由後端（K1）執行。`,
    );
  };

  const handlePublish = (submission: RecommendationSubmission, note: string) => {
    setSubmissions((prev) => prev.filter((item) => item.id !== submission.id));
    setNotice(
      `投稿「${submission.nickname || '匿名投稿'}」已核實並移出佇列（示意）${note ? `，核實備註：${note}` : ''}。正式流程將寫入 Supabase 並同步前台資料庫。`,
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
      <RecommendationReview
        submissions={submissions}
        candidateMatches={candidateMatches}
        onApplyMatch={handleApplyMatch}
        onPublish={handlePublish}
      />
    </div>
  );
}
