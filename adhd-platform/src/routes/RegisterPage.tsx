/**
 * 站內報名頁（通用，依專案 slug 驅動）。【CLAUDE 整合層】
 * 表單定義與場次來自 Supabase（form_schemas / sessions）；
 * 送出寫入 registrations，額滿由 DB 觸發器保證並回報友善訊息。
 * 若 DB 有場次資料，會以「場次選擇」欄位取代 schema 內的 preferredSlots 靜態選項。
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { FormField, FormSchema, Project, SessionSlot } from '@contracts/types';
import { SchemaForm } from '@/features/form-engine';
import type { FormAnswers } from '@/features/form-engine';
import {
  ApiError,
  getFormSchema,
  getProjectBySlug,
  getUpcomingSessions,
  submitRegistration,
} from '@/lib/api';
import { isSupabaseReady } from '@/lib/supabase';

const SESSION_FIELD_KEY = 'sessionIds';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function formatSlot(s: SessionSlot) {
  const st = new Date(s.startsAt);
  const en = new Date(s.endsAt);
  if (Number.isNaN(+st) || Number.isNaN(+en)) return `${s.startsAt} ～ ${s.endsAt}`;
  return `${st.getFullYear()}/${pad(st.getMonth() + 1)}/${pad(st.getDate())} ${pad(st.getHours())}:${pad(st.getMinutes())}–${pad(en.getHours())}:${pad(en.getMinutes())}`;
}

export default function RegisterPage({ slug }: { slug: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [project, setProject] = useState<Project | null>(null);
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [sessions, setSessions] = useState<SessionSlot[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isSupabaseReady) {
      setState('unavailable');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const p = await getProjectBySlug(slug);
        if (cancelled) return;
        if (!p) {
          setState('unavailable');
          return;
        }
        const [s, ss] = await Promise.all([getFormSchema(p.id), getUpcomingSessions(p.id)]);
        if (cancelled) return;
        setProject(p);
        setSchema(s);
        setSessions(ss);
        setState(s ? 'ready' : 'unavailable');
      } catch {
        if (!cancelled) setState('unavailable');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, reloadKey]);

  // DB 有場次 → 以真場次欄位取代 schema 的 preferredSlots 靜態選項
  const effectiveSchema = useMemo<FormSchema | null>(() => {
    if (!schema) return null;
    if (sessions.length === 0) return schema;
    const sessionField: FormField = {
      key: SESSION_FIELD_KEY,
      label: '選擇場次',
      type: 'multiselect',
      required: true,
      helpText: '可複選；額滿場次無法勾選，名額即時更新。',
      options: sessions.map((s) => ({
        value: s.id,
        label: `${s.title}｜${formatSlot(s)}（剩 ${Math.max(0, s.capacity - s.bookedCount)} 名）`,
        disabled: s.status !== 'open',
        disabledLabel: '（額滿）',
      })),
    };
    const withoutStatic = schema.fields.filter(
      (f) => f.key !== 'preferredSlots' && f.key !== SESSION_FIELD_KEY,
    );
    const insertAt = schema.fields.findIndex((f) => f.key === 'preferredSlots');
    const fields = [...withoutStatic];
    fields.splice(insertAt >= 0 ? insertAt : fields.length, 0, sessionField);
    return { ...schema, fields };
  }, [schema, sessions]);

  const handleSubmit = async (answers: FormAnswers) => {
    if (!project || !schema) return;
    setError(undefined);
    const raw = answers[SESSION_FIELD_KEY];
    const sessionIds = Array.isArray(raw) ? raw : [];
    const emailKey = schema.fields.find((f) => f.type === 'email')?.key ?? 'email';
    const email = String(answers[emailKey] ?? '').trim();
    try {
      await submitRegistration({ projectId: project.id, sessionIds, answers, email });
      setDone(true);
      window.scrollTo(0, 0);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SESSION_FULL') {
        setError(err.message);
        setReloadKey((k) => k + 1); // 重新載入場次的最新額滿狀態
      } else {
        setError(err instanceof Error ? err.message : '送出失敗，請稍後再試。');
      }
      window.scrollTo(0, 0);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF5] text-[#5D4037] py-12 px-4 md:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {state === 'loading' ? (
          <div className="warm-card p-10 text-center text-brown/60">載入報名資料中…</div>
        ) : state === 'unavailable' ? (
          <div className="warm-card p-10 text-center space-y-3">
            <h1 className="text-2xl font-extrabold">報名系統暫時無法使用</h1>
            <p className="text-sm text-[#5D4037]/80">
              請稍後再試，或改用該服務頁面上的外部報名連結。
            </p>
            <Link to="/" className="btn-warm inline-block">回首頁</Link>
          </div>
        ) : done ? (
          <div className="warm-card p-10 text-center space-y-4 border-[#06C755]">
            <h1 className="text-2xl font-extrabold text-[#06C755]">報名已送出！</h1>
            <p className="text-sm leading-relaxed">
              感謝您的報名。我們收到後會進行審核，
              <strong>審核結果將以 Email 通知</strong>（請留意垃圾信件匣）。
              <br />
              收到「確認成功通知信」才算正式完成預約喔！
            </p>
            <Link to="/" className="btn-warm inline-block">回首頁</Link>
          </div>
        ) : (
          <>
            <div className="bg-[#FFEC8B] border-2 border-[#5D4037] rounded-3xl p-6 md:p-8 shadow-[4px_4px_0px_0px_#5D4037]">
              <span className="inline-block bg-white border border-[#5D4037] text-xs font-bold px-3 py-1 rounded-full mb-2">
                站內報名
              </span>
              <h1 className="text-2xl md:text-3xl font-extrabold">{project?.name}</h1>
              {project?.description ? (
                <p className="mt-2 text-sm text-[#5D4037]/90">{project.description}</p>
              ) : null}
            </div>

            {error ? (
              <p
                role="alert"
                className="rounded-xl border-2 border-alert-red bg-alert-red/10 px-4 py-3 text-sm font-bold"
              >
                {error}
              </p>
            ) : null}

            <div className="bg-white border-2 border-[#5D4037] rounded-3xl p-6 md:p-8 shadow-[6px_6px_0px_0px_#5D4037]">
              {effectiveSchema ? (
                <SchemaForm
                  key={reloadKey}
                  schema={effectiveSchema}
                  onSubmit={handleSubmit}
                  submitLabel="送出報名"
                />
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
