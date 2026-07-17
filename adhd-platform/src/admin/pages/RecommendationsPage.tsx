/**
 * 推薦資料庫審核路由頁。【CLAUDE 整合層】
 * 投稿佇列讀取 Supabase recommendation_submissions（RLS 限系統擁有者）；
 * 核實上架／退回／套用對應皆寫回 DB。Supabase 未設定時退回本地假資料（DemoDataNotice）。
 * 注意：上架僅更新投稿狀態；前台地圖仍讀 recommendations.json，正式收錄需另行同步（JSON／種子／DB 三處）。
 * 「疑似對應舊資料」以公開的 recommendations.json 做本地比對。
 */
import { useEffect, useMemo, useState } from 'react';
import type { Recommendation, RecommendationSubmission } from '@contracts/types';
import { RecommendationReview, mockSubmissions } from '@/features/recommendation-review';
import { ApiError, adminListSubmissions, adminReviewSubmission } from '@/lib/api';
import { LoadingState } from '@/components/ui/LoadingState';
import recommendationsData from '@/data/recommendations.json';
import DemoDataNotice from '../DemoDataNotice';

const published = recommendationsData as Recommendation[];

export default function RecommendationsPage() {
  const [submissions, setSubmissions] = useState<RecommendationSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(undefined);
      try {
        const rows = await adminListSubmissions();
        if (cancelled) return;
        setSubmissions(rows.filter((row) => row.status === 'pending'));
        setDemoMode(false);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === 'NOT_READY') {
          setSubmissions(mockSubmissions);
          setDemoMode(true);
        } else {
          setLoadError(err instanceof Error ? err.message : '讀取投稿佇列失敗');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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

  const handleApplyMatch = async (submission: RecommendationSubmission, recommendation: Recommendation) => {
    const label = `${recommendation.hospital}／${recommendation.doctorOrName}`;
    if (demoMode) {
      setNotice(`（示意）已標記「${submission.nickname || '匿名投稿'}」對應至 ${label}。`);
      return;
    }
    try {
      const updated = await adminReviewSubmission(submission.id, {
        relatedRecommendationId: recommendation.id,
      });
      setSubmissions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setNotice(`已將「${submission.nickname || '匿名投稿'}」標記對應至 ${label}，審核時可據此更新舊資料。`);
    } catch (err) {
      setNotice(`標記對應失敗：${err instanceof Error ? err.message : '未知錯誤'}`);
    }
  };

  const handlePublish = async (submission: RecommendationSubmission, note: string) => {
    if (demoMode) {
      setSubmissions((prev) => prev.filter((item) => item.id !== submission.id));
      setNotice(`（示意）投稿「${submission.nickname || '匿名投稿'}」已核實並移出佇列。`);
      return;
    }
    try {
      await adminReviewSubmission(submission.id, { status: 'published', reviewNote: note });
      setSubmissions((prev) => prev.filter((item) => item.id !== submission.id));
      setNotice(
        `投稿「${submission.nickname || '匿名投稿'}」已核實上架（狀態 published）。` +
        '提醒：前台地圖收錄需另行同步 recommendations.json。',
      );
    } catch (err) {
      setNotice(`核實上架失敗：${err instanceof Error ? err.message : '未知錯誤'}`);
    }
  };

  const handleReject = async (submission: RecommendationSubmission, note: string) => {
    if (demoMode) {
      setSubmissions((prev) => prev.filter((item) => item.id !== submission.id));
      setNotice(`（示意）投稿「${submission.nickname || '匿名投稿'}」已退回。`);
      return;
    }
    try {
      await adminReviewSubmission(submission.id, { status: 'rejected', reviewNote: note });
      setSubmissions((prev) => prev.filter((item) => item.id !== submission.id));
      setNotice(`投稿「${submission.nickname || '匿名投稿'}」已退回（狀態 rejected），紀錄保留於資料庫。`);
    } catch (err) {
      setNotice(`退回失敗：${err instanceof Error ? err.message : '未知錯誤'}`);
    }
  };

  if (loading) return <LoadingState label="讀取投稿佇列中…" />;

  return (
    <div>
      {demoMode ? <DemoDataNotice /> : null}
      {loadError ? (
        <p role="alert" className="mb-4 rounded-xl border-2 border-highlight bg-accent-orange/25 px-4 py-2.5 text-sm font-bold">
          讀取投稿佇列失敗：{loadError}（請確認已以系統擁有者帳號登入後重新整理）
        </p>
      ) : null}
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
        onReject={handleReject}
      />
    </div>
  );
}
