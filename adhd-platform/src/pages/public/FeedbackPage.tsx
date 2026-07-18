/**
 * 公開活動回饋單。【CLAUDE】
 * 簡易留言板：姓名（必填）＋信箱（選填、永不公開）＋回饋（必填）＋活動名稱（選填）。
 * 送出寫入 event_feedback；沿用報名頁的暖色卡片風格與送出成功畫面。
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { TextInput, Textarea } from '@/components/ui';
import { submitFeedback } from '@/lib/api';
import { isSupabaseReady } from '@/lib/supabase';

export default function FeedbackPage() {
  // 可用 ?event=活動名稱 預先帶入活動名稱（宣傳連結／LINE 選單可各活動客製）
  const [params] = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [eventName, setEventName] = useState(params.get('event') ?? '');
  const [errors, setErrors] = useState<{ name?: string; message?: string; email?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  const validate = () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = '請填寫姓名或稱呼';
    if (!message.trim()) next.message = '請寫下您的回饋';
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = '信箱格式看起來不太對，請再確認';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(undefined);
    if (!validate()) return;
    if (!isSupabaseReady) {
      setError('回饋系統暫時無法使用，請稍後再試。');
      return;
    }
    setSubmitting(true);
    try {
      await submitFeedback({
        name,
        message,
        email: email || undefined,
        eventName: eventName || undefined,
      });
      setDone(true);
      window.scrollTo(0, 0);
    } catch {
      setError('送出失敗，請稍後再試，或直接來信告訴我們。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream text-brown py-12 px-4 md:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {done ? (
          <div className="warm-card p-10 text-center space-y-4 border-line-green">
            <h1 className="text-2xl font-extrabold text-line-green">回饋已送出！</h1>
            <p className="text-sm leading-relaxed">
              謝謝您撥空給我們回饋，每一則留言我們都會看。
              <br />
              您的意見會幫助我們把活動辦得更好 🌱
            </p>
            <Link to="/" className="btn-warm inline-block">回首頁</Link>
          </div>
        ) : (
          <>
            <div className="bg-base-yellow border-2 border-brown rounded-3xl p-6 md:p-8 shadow-warm">
              <span className="inline-block bg-white border border-brown text-xs font-bold px-3 py-1 rounded-full mb-2">
                活動回饋
              </span>
              <h1 className="text-2xl md:text-3xl font-extrabold">活動回饋單</h1>
              <p className="mt-2 text-sm text-brown/90">
                {eventName ? (
                  <>關於「{eventName}」，您的感想是我們最重要的養分。</>
                ) : (
                  <>參加活動後有任何想法、建議或鼓勵，都歡迎在這裡留言。</>
                )}
                <br />
                填寫大約只要一分鐘，信箱為選填、我們絕不對外公開。
              </p>
            </div>

            {error ? (
              <p
                role="alert"
                className="rounded-xl border-2 border-alert-red bg-alert-red/10 px-4 py-3 text-sm font-bold"
              >
                {error}
              </p>
            ) : null}

            <div className="bg-white border-2 border-brown rounded-3xl p-6 md:p-8 shadow-warm-lg">
              <form className="grid gap-5" noValidate onSubmit={handleSubmit}>
                {params.get('event') ? null : (
                  <TextInput
                    label="活動名稱"
                    name="eventName"
                    helpText="選填。若您記得參加的活動或場次名稱，填上可幫我們對應。"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                  />
                )}
                <TextInput
                  label="姓名／稱呼"
                  name="name"
                  required
                  error={errors.name}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <TextInput
                  label="電子信箱"
                  name="email"
                  type="email"
                  helpText="選填、永不公開；若希望我們回覆您可留下。"
                  error={errors.email}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Textarea
                  label="回饋留言"
                  name="message"
                  required
                  rows={6}
                  helpText="想到什麼都可以寫，一句話也很珍貴。"
                  error={errors.message}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <div className="flex justify-end mt-2">
                  <button type="submit" className="btn-warm" disabled={submitting}>
                    {submitting ? '送出中…' : '送出回饋'}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
