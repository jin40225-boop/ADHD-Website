import { useCallback, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { AvailabilityPoll } from '@contracts/types';
import { getAvailabilityPoll, saveAvailabilityReply } from '@/lib/api';
import { useAuth } from '@/lib/auth';

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(+date)
    ? value
    : new Intl.DateTimeFormat('zh-TW', {
        dateStyle: 'full',
        timeStyle: 'short',
      }).format(date);
}

export default function InstructorAvailabilityPage() {
  const [searchParams] = useSearchParams();
  const pollId = searchParams.get('poll') ?? '';
  const { user } = useAuth();
  const [poll, setPoll] = useState<AvailabilityPoll>();
  const [loading, setLoading] = useState(true);
  const [savingSlotId, setSavingSlotId] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  const reload = useCallback(async () => {
    if (!pollId) {
      setError('邀請連結缺少 poll 參數。');
      setLoading(false);
      return;
    }
    try {
      const nextPoll = await getAvailabilityPoll(pollId);
      if (!nextPoll) setError('找不到這份邀約，可能已取消或移除。');
      setPoll(nextPoll ?? undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '載入邀約失敗');
    } finally {
      setLoading(false);
    }
  }, [pollId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const canRespond = Boolean(user && poll?.instructorIds.includes(user.id));

  const handleReply = async (slotId: string, answer: 'yes' | 'no') => {
    if (!user || !poll || !canRespond) return;
    setSavingSlotId(slotId);
    setNotice(undefined);
    setError(undefined);
    try {
      await saveAvailabilityReply({ pollId: poll.id, slotId, instructorId: user.id, answer });
      await reload();
      setNotice('回覆已儲存，可隨時回來修改。');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '儲存回覆失敗');
    } finally {
      setSavingSlotId(undefined);
    }
  };

  if (loading) return <p className="p-10 text-center text-brown/60">載入邀約中…</p>;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-8">
      <header className="mb-6 rounded-xl border-2 border-brown bg-base-yellow p-6 shadow-warm">
        <span className="mb-2 inline-block rounded-md border border-brown/40 bg-white px-2.5 py-1 text-xs font-bold">講師時段確認</span>
        <h1 className="text-2xl font-extrabold md:text-3xl">請回覆可配合的候選時段</h1>
        <p className="mt-2 text-sm text-brown/70">每個時段都可獨立選擇，可以之後再回來修改。</p>
      </header>

      {notice ? <p role="status" className="mb-4 rounded-xl border-2 border-brown/40 bg-accent-blue/30 px-4 py-3 text-sm">{notice}</p> : null}
      {error ? <p role="alert" className="mb-4 rounded-xl border-2 border-alert-red bg-alert-red/10 px-4 py-3 text-sm font-bold">{error}</p> : null}

      {poll && !canRespond ? (
        <div className="rounded-xl border-2 border-highlight bg-white p-6 text-center shadow-warm-sm">
          <p className="font-bold">目前登入帳號不在這份邀約的講師名單中。</p>
          <p className="mt-1 text-sm text-brown/60">請改用收到邀請的 Google 帳號登入，或聯繫管理者更新名單。</p>
        </div>
      ) : null}

      {poll && canRespond ? (
        <div className="grid gap-4">
          {poll.candidateSlots.map((slot) => {
            const currentAnswer = poll.replies.find((reply) => (
              reply.instructorId === user?.id && reply.slotId === slot.id
            ))?.answer ?? 'pending';
            return (
              <article key={slot.id} className="rounded-xl border-2 border-brown bg-white p-5 shadow-warm-sm">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="text-lg font-extrabold">{slot.title}</h2>
                    <p className="mt-1 text-sm text-brown/70">{formatTime(slot.startsAt)} 至 {formatTime(slot.endsAt)}</p>
                    <p className="mt-1 text-xs font-bold text-brown/55">目前回覆：{currentAnswer === 'yes' ? '可以' : currentAnswer === 'no' ? '不行' : '待回覆'}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      className={`inline-flex min-h-11 items-center gap-2 rounded-lg border-2 border-brown px-4 py-2 font-bold ${currentAnswer === 'yes' ? 'bg-accent-teal' : 'bg-white hover:bg-accent-teal/25'}`}
                      onClick={() => void handleReply(slot.id, 'yes')}
                      disabled={savingSlotId === slot.id || poll.status !== 'open'}
                    >
                      <Check className="size-4" /> 可以
                    </button>
                    <button
                      type="button"
                      className={`inline-flex min-h-11 items-center gap-2 rounded-lg border-2 border-brown px-4 py-2 font-bold ${currentAnswer === 'no' ? 'bg-accent-pink' : 'bg-white hover:bg-accent-pink/25'}`}
                      onClick={() => void handleReply(slot.id, 'no')}
                      disabled={savingSlotId === slot.id || poll.status !== 'open'}
                    >
                      <X className="size-4" /> 不行
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          {poll.status !== 'open' ? (
            <p className="rounded-xl border-2 border-brown/30 bg-cream p-4 text-center text-sm font-bold">這份邀約已結束，回覆目前為唯讀。</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
