/**
 * 站內報名頁（通用，依專案 slug 驅動）。【CLAUDE 整合層】
 * 表單定義與場次來自 Supabase（form_schemas / sessions）；
 * 送出寫入 registrations，額滿由 DB 觸發器保證並回報友善訊息。
 * 報名只接受資料庫正式場次，不再以靜態時段建立無法追蹤的報名。
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { FormField, FormFieldOption, FormSchema, Project, SessionSlot } from '@contracts/types';
import { SchemaForm } from '@/features/form-engine';
import type { FormAnswers } from '@/features/form-engine';
import { CopyButton } from '@/components/CopyButton';
import { CONTACT_EMAIL } from '@/components/LineContact';
import {
  ApiError,
  getFormSchema,
  getPastSessions,
  getProjectBySlug,
  getUpcomingSessions,
  submitRegistration,
} from '@/lib/api';
import { isSupabaseReady } from '@/lib/supabase';

const SESSION_FIELD_KEY = 'sessionIds';
/** 記錄使用者勾選的確切時段（可讀標籤），供後台審核時直接閱讀。 */
const EXACT_SLOT_KEY = 'preferredExactSlots';
/** 候選時段的選項值格式：`<sessionId>::<slotIndex>`。 */
const SLOT_SEP = '::';
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** 欄位目前可勾選的選項（字串選項一律可選；物件選項排除 disabled）。 */
function enabledOptions(field: FormField) {
  return (field.options ?? []).filter((o) => typeof o === 'string' || !o.disabled);
}

function formatSlot(s: SessionSlot) {
  const st = new Date(s.startsAt);
  const en = new Date(s.endsAt);
  if (Number.isNaN(+st) || Number.isNaN(+en)) return `${s.startsAt} ～ ${s.endsAt}`;
  return `${st.getFullYear()}/${pad(st.getMonth() + 1)}/${pad(st.getDate())} ${pad(st.getHours())}:${pad(st.getMinutes())}–${pad(en.getHours())}:${pad(en.getMinutes())}`;
}

function monthLabel(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(+d) ? '' : `${d.getMonth() + 1} 月`;
}

function formatDeadline(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return '';
  return `${d.getMonth() + 1}/${d.getDate()}（${WEEKDAYS[d.getDay()]}）${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 把一筆場次攤成可勾選的選項。
 *
 * 一般場次＝一個選項。導航計畫的「每月 1 位」場次帶有 `slotOptions`（5 個確切候選
 * 時段共用當月唯一名額），攤成 5 個選項並以月份分組，避免把整個月的時間窗
 * render 成「9/12 20:00–10:00」這種看起來跨日的怪值。
 */
function optionsForSession(s: SessionSlot): FormFieldOption[] {
  const remaining = Math.max(0, s.capacity - s.bookedCount);
  const unavailable = s.status !== 'open' || remaining === 0;
  if (!s.slotOptions?.length) {
    return [{
      value: s.id,
      label: `${s.title}｜${formatSlot(s)}（剩 ${remaining} 名）`,
      disabled: unavailable,
      disabledLabel: '（額滿）',
    }];
  }
  const groupNote = [
    unavailable ? '已額滿' : '開放中',
    s.registrationDeadline ? `報名截止 ${formatDeadline(s.registrationDeadline)}` : '',
  ].filter(Boolean).join('・');
  return s.slotOptions.map((slot, index) => ({
    value: `${s.id}${SLOT_SEP}${index}`,
    label: slot.label,
    note: slot.note,
    group: monthLabel(s.startsAt),
    groupNote,
    disabled: unavailable,
    disabledLabel: '（額滿）',
  }));
}

export default function RegisterPage({ slug, showPastSessions = false }: { slug: string; showPastSessions?: boolean }) {
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [project, setProject] = useState<Project | null>(null);
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [sessions, setSessions] = useState<SessionSlot[]>([]);
  const [pastSessions, setPastSessions] = useState<SessionSlot[]>([]);
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
        const [s, ss, past] = await Promise.all([
          getFormSchema(p.id),
          getUpcomingSessions(p.id),
          showPastSessions ? getPastSessions(p.id) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setProject(p);
        setSchema(s);
        setSessions(ss);
        setPastSessions(past);
        setState(s ? 'ready' : 'unavailable');
      } catch {
        if (!cancelled) setState('unavailable');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, reloadKey, showPastSessions]);

  /** 任一場次帶候選時段＝本專案採「每月 1 位、5 個確切時段」模型（導航計畫）。 */
  const slotMode = useMemo(() => sessions.some((s) => s.slotOptions?.length), [sessions]);

  // DB 有場次 → 以真場次欄位取代 schema 的 preferredSlots 靜態選項
  const effectiveSchema = useMemo<FormSchema | null>(() => {
    if (!schema) return null;
    const sessionField: FormField = {
      key: SESSION_FIELD_KEY,
      label: slotMode ? '勾選可配合的確切時段' : '選擇場次',
      type: 'multiselect',
      required: true,
      helpText: slotMode
        ? '可跨月複選。每月僅 1 位名額，最終將由團隊與您確認其中一個時段。'
        : '可複選；額滿場次無法勾選，名額即時更新。',
      options: sessions.flatMap(optionsForSession),
    };
    // 舊的靜態候選時段欄位（preferredExactSlots）已由上面的真實候選時段取代
    const withoutStatic = schema.fields.filter(
      (f) => f.key !== 'preferredSlots' && f.key !== SESSION_FIELD_KEY && f.key !== EXACT_SLOT_KEY,
    );
    // 定稿一律是「先挑場次／時段、再填基本資料」；schema 若留有 preferredSlots 就沿用它的位置，
    // 沒有的話放在最前面（原本是接在最後，使用者得先填完資料才看到要選哪一場）。
    const anchor = schema.fields.findIndex((f) => f.key === 'preferredSlots');
    const fields = [...withoutStatic];
    fields.splice(slotMode || anchor < 0 ? 0 : anchor, 0, sessionField);
    return { ...schema, fields };
  }, [schema, sessions, slotMode]);

  // 必填時段欄無任何可選項＝報名不可能完成 → 改顯示防呆卡（後台建立新場次後自動恢復表單）
  const noOpenSlots = useMemo(() => {
    if (!effectiveSchema) return false;
    const slotField = effectiveSchema.fields.find(
      (f) => f.key === SESSION_FIELD_KEY || f.key === 'preferredSlots',
    );
    if (!slotField?.required) return false;
    return enabledOptions(slotField).length === 0;
  }, [effectiveSchema]);

  /** 把 `<sessionId>::<slotIndex>` 還原成後台可直接閱讀的「9 月｜9/14（一）20:00–21:00」。 */
  const describeSlot = (value: string) => {
    const [sessionId, index] = value.split(SLOT_SEP);
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return value;
    const slot = index === undefined ? undefined : session.slotOptions?.[Number(index)];
    return slot ? `${monthLabel(session.startsAt)}｜${slot.label}` : session.title;
  };

  const handleSubmit = async (answers: FormAnswers) => {
    if (!project || !schema) return;
    setError(undefined);
    const raw = answers[SESSION_FIELD_KEY];
    const picked = Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : [];
    // 勾選值可能是 `<sessionId>::<slotIndex>`；場次名額以 sessionId 為單位。
    const pickedSessionIds = new Set(picked.map((value) => value.split(SLOT_SEP)[0]));
    const orderedSessionIds = sessions.filter((s) => pickedSessionIds.has(s.id)).map((s) => s.id);
    // 「每月 1 位」模型下，跨月複選只讓最早的月份佔用名額，其餘僅記錄為偏好；
    // 否則一位報名者送出時就會同時吃掉好幾個月各自唯一的名額。
    const sessionIds = slotMode ? orderedSessionIds.slice(0, 1) : orderedSessionIds;
    // slotMode 下改存可讀標籤：原始值是 `<uuid>::<index>`，對審核者沒有意義，
    // 而佔名額的場次本身已經記在 registrations.session_ids 欄位。
    const payload: FormAnswers = { ...answers };
    if (slotMode) {
      delete payload[SESSION_FIELD_KEY];
      payload[EXACT_SLOT_KEY] = picked.map(describeSlot);
    }
    const emailKey = schema.fields.find((f) => f.type === 'email')?.key ?? 'email';
    const email = String(answers[emailKey] ?? '').trim();
    try {
      await submitRegistration({ projectId: project.id, sessionIds, answers: payload, email });
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
    <div className="min-h-screen bg-cream text-brown py-12 px-4 md:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {state === 'loading' ? (
          <div className="warm-card p-10 text-center text-brown/60">載入報名資料中…</div>
        ) : state === 'unavailable' ? (
          <div className="warm-card p-10 text-center space-y-3">
            <h1 className="text-2xl font-extrabold">報名系統暫時無法使用</h1>
            <p className="text-sm text-brown/80">
              請稍後再試，或改用該服務頁面上的外部報名連結。
            </p>
            <Link to="/" className="btn-warm inline-block">回首頁</Link>
          </div>
        ) : done ? (
          <div className="warm-card p-10 text-center space-y-4 border-line-green">
            <h1 className="text-2xl font-extrabold text-line-green">報名已送出！</h1>
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
            <div className="bg-base-yellow border-2 border-brown rounded-3xl p-6 md:p-8 shadow-warm">
              <span className="inline-block bg-white border border-brown text-xs font-bold px-3 py-1 rounded-full mb-2">
                站內報名
              </span>
              <h1 className="text-2xl md:text-3xl font-extrabold">{project?.name}</h1>
              {project?.description ? (
                <p className="mt-2 text-sm text-brown/90">{project.description}</p>
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

            {pastSessions.length ? (
              <details className="bg-white border-2 border-brown rounded-2xl px-5 py-4 shadow-warm">
                <summary className="cursor-pointer font-bold">
                  📂 已完成月份（{pastSessions.length} 場）——服務軌跡留存
                </summary>
                <p className="flex flex-wrap gap-2 mt-3">
                  {pastSessions.map((s) => (
                    <span key={s.id} className="inline-block bg-gray-200 text-gray-600 text-xs font-bold px-3 py-1 rounded-full border border-brown/20">
                      {monthLabel(s.startsAt)}・已完成
                    </span>
                  ))}
                </p>
              </details>
            ) : null}

            {noOpenSlots ? (
              <div className="warm-card p-10 text-center space-y-4">
                <h2 className="text-2xl font-extrabold">
                  {sessions.length > 0 ? '目前場次皆已額滿' : '目前無開放場次'}
                </h2>
                <p className="text-sm text-brown/80 leading-relaxed">
                  新場次公布後會在此開放報名，歡迎過陣子再回來看看；
                  <br />
                  有任何問題也歡迎來信詢問。
                </p>
                <div className="flex flex-wrap gap-3 justify-center">
                  <a href="mailto:jin40225@gmail.com" className="btn-warm">來信詢問</a>
                  <Link to="/" className="nav-block">回首頁</Link>
                </div>
              </div>
            ) : (
              <div className="bg-white border-2 border-brown rounded-3xl p-6 md:p-8 shadow-warm-lg">
                {effectiveSchema ? (
                  <SchemaForm
                    key={reloadKey}
                    schema={effectiveSchema}
                    onSubmit={handleSubmit}
                    submitLabel="送出報名"
                  />
                ) : null}
              </div>
            )}

            {/* 04_v4 頁尾：信箱明示＋可用的複製鈕，不要只留一個 mailto: */}
            <footer className="text-center text-sm text-brown/70 space-y-2 pt-2">
              <p>有任何問題，歡迎直接來信：</p>
              <span className="inline-flex items-center gap-2 bg-white border-2 border-brown/20 rounded-full py-2 px-4">
                <span className="font-mono text-brown">{CONTACT_EMAIL}</span>
                <CopyButton
                  value={CONTACT_EMAIL}
                  label="複製信箱"
                  className="text-[11px] bg-gray-200 hover:bg-gray-300 text-gray-600 py-1 px-2 rounded transition-colors flex items-center gap-1"
                />
              </span>
              <p className="text-xs text-brown/50">© 2026 大A彥宇</p>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
