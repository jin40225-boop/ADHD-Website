/**
 * 推薦資料庫審核：投稿佇列與公開 recommendations 都以 Supabase 為正式來源。
 * 未設定 Supabase 時使用去識別示意投稿與版本化 JSON 後援。
 */
import { useEffect, useMemo, useState } from 'react';
import type { Recommendation, RecommendationSubmission } from '@contracts/types';
import { RecommendationReview, mockSubmissions } from '@/features/recommendation-review';
import {
  ApiError,
  adminListSubmissions,
  adminReviewSubmission,
  adminSaveRecommendation,
  getPublicRecommendations,
} from '@/lib/api';
import { LoadingState } from '@/components/ui/LoadingState';
import recommendationsData from '@/data/recommendations.json';
import DemoDataNotice from '../DemoDataNotice';

const fallbackPublished = recommendationsData as Recommendation[];
const validCategories = new Set<Recommendation['category']>(['doctor', 'assessment', 'therapy', 'community', 'other']);
const validAudiences = new Set<Recommendation['audience']>(['child', 'adult', 'all']);
const validRegions = new Set<Recommendation['region']>([
  '台北市', '新北市', '基隆市', '桃園市', '新竹縣市', '苗栗縣市', '臺中市', '彰化縣市',
  '南投縣', '雲林縣', '嘉義縣市', '臺南市', '高雄市', '屏東縣', '宜蘭縣', '花蓮縣',
  '臺東縣', '澎湖金馬', '線上/其他',
]);

function answerText(submission: RecommendationSubmission, key: string): string {
  const value = submission.answers[key];
  return Array.isArray(value) ? value.join('、').trim() : (value ?? '').trim();
}

function toRecommendation(
  submission: RecommendationSubmission,
  note: string,
  published: Recommendation[],
): Recommendation | null {
  const current = submission.relatedRecommendationId
    ? published.find((item) => item.id === submission.relatedRecommendationId)
    : undefined;
  const categoryText = answerText(submission, 'category');
  const audienceText = answerText(submission, 'audience');
  const regionText = answerText(submission, 'region');
  const category = validCategories.has(categoryText as Recommendation['category'])
    ? categoryText as Recommendation['category']
    : current?.category;
  const audience = validAudiences.has(audienceText as Recommendation['audience'])
    ? audienceText as Recommendation['audience']
    : current?.audience ?? 'all';
  const region = validRegions.has(regionText as Recommendation['region'])
    ? regionText as Recommendation['region']
    : current?.region;
  const hospital = answerText(submission, 'hospital') || current?.hospital || '';
  const doctorOrName = answerText(submission, 'doctorOrName') || current?.doctorOrName || '';
  const experience = answerText(submission, 'experience') || current?.experience || '';

  if (!category || !region || !hospital || !doctorOrName || !experience) return null;
  if ((submission.type === 'correction' || submission.type === 'doctor_update') && !current) return null;
  if (submission.type === 'feature') return null;

  return {
    id: current?.id ?? `submission-${submission.id}`,
    category,
    audience,
    region,
    hospital,
    doctorOrName,
    urls: current?.urls ?? [],
    experience,
    recommender: current?.recommender ?? submission.nickname ?? '匿名投稿',
    verified: true,
    verifiedNote: note.trim() || `審核上架 ${new Date().toISOString().slice(0, 10)}`,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
}

export default function RecommendationsPage() {
  const [submissions, setSubmissions] = useState<RecommendationSubmission[]>([]);
  const [published, setPublished] = useState<Recommendation[]>(fallbackPublished);
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
        const [rows, livePublished] = await Promise.all([
          adminListSubmissions(),
          getPublicRecommendations(),
        ]);
        if (cancelled) return;
        setSubmissions(rows.filter((row) => row.status === 'pending'));
        setPublished(livePublished.length ? livePublished : fallbackPublished);
        setDemoMode(false);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === 'NOT_READY') {
          setSubmissions(mockSubmissions);
          setPublished(fallbackPublished);
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
  }, [published, submissions]);

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
      setNotice(`已將「${submission.nickname || '匿名投稿'}」標記對應至 ${label}。`);
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

    const recommendation = toRecommendation(submission, note, published);
    if (!recommendation) {
      setNotice('無法上架：必要欄位不完整；糾錯／動態投稿須先套用對應資料，專題投稿不會直接進入就醫地圖。');
      return;
    }

    try {
      const saved = await adminSaveRecommendation(recommendation);
      setPublished((prev) => [...prev.filter((item) => item.id !== saved.id), saved]);
      try {
        await adminReviewSubmission(submission.id, {
          status: 'published',
          reviewNote: note,
          relatedRecommendationId: saved.id,
        });
      } catch (reviewErr) {
        setNotice(`推薦資料已上架，但投稿狀態更新失敗，請保留本頁並重試：${reviewErr instanceof Error ? reviewErr.message : '未知錯誤'}`);
        return;
      }
      setSubmissions((prev) => prev.filter((item) => item.id !== submission.id));
      setNotice(`投稿「${submission.nickname || '匿名投稿'}」已寫入正式推薦資料庫；前台地圖將直接讀取這筆資料。`);
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
      setNotice(`投稿「${submission.nickname || '匿名投稿'}」已退回，紀錄保留於資料庫。`);
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