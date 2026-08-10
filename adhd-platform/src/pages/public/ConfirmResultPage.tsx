/**
 * 信中「✅ 我確認出席／🔁 我需要請假改期」按下之後的落地頁。
 *
 * 為什麼結果頁在站內、而不是由 confirm-attendance 直接回 HTML：Supabase Functions 的閘道會把
 * 回應強制成 `text/plain`（不帶 charset）並加上 `X-Content-Type-Options: nosniff`，函式自己設的
 * `text/html; charset=utf-8` 會被覆蓋。結果是家長看到一頁原始碼加中文亂碼——資料其實都記錄成功了，
 * 但畫面看起來像壞掉，很可能讓人改用回信、或乾脆放棄。
 *
 * 所以函式只回 302，把結果碼帶在網址上，由這一頁用站內既有的設計呈現。
 * **結果碼只作顯示用**：資料在函式那邊就已經寫完，改網址上的 r 只會改變這頁的字，不會動到任何資料。
 * token 不會出現在這個網址裡。
 */
import { Link, useSearchParams } from 'react-router-dom';
import { CONTACT_EMAIL } from '@/components/LineContact';

type Tone = 'ok' | 'warn';

/** 文案沿用原本函式裡的那幾句，家長讀到的內容不因為搬家而改變。 */
const RESULTS: Record<string, { title: string; message: string; tone: Tone }> = {
  attend: {
    title: '收到，感謝你的確認 🎉',
    message: '我們已經記錄你會出席。活動前我們會再寄一次提醒信給你。',
    tone: 'ok',
  },
  reschedule: {
    title: '收到，我們會再聯繫你 🔁',
    message: '已經記錄你需要請假或改期，我們會盡快與你聯繫安排新的時間。名額會先為你保留。',
    tone: 'ok',
  },
  duplicate: {
    title: '已經收到了',
    message: '你的回覆已經記錄下來了，不需要再操作一次。',
    tone: 'ok',
  },
  expired: {
    title: '連結已過期',
    message: '這個確認連結已經過期。請直接回覆信件告訴我們你的決定，我們會協助處理。',
    tone: 'warn',
  },
  invalid: {
    title: '連結無效',
    message: '這個連結看起來不完整或已失效。請直接回覆信件告訴我們你的決定。',
    tone: 'warn',
  },
  closed: {
    title: '這筆報名已經結案',
    message: '這筆報名目前不在安排中，信裡的按鈕不會再更動它。如果你想重新安排，請直接回覆這封信告訴我們，我們會協助處理。',
    tone: 'warn',
  },
  error: {
    title: '系統忙碌中',
    message: '記錄的時候出了點狀況。請直接回覆信件告訴我們你的決定，我們會手動處理。',
    tone: 'warn',
  },
};

export default function ConfirmResultPage() {
  const [params] = useSearchParams();
  // 認不得的碼一律當成「連結無效」，不要顯示空白卡片。
  const result = RESULTS[params.get('r') ?? ''] ?? RESULTS.invalid;

  return (
    <div className="min-h-screen bg-cream text-brown font-body flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg bg-white border-2 border-brown rounded-3xl p-8 md:p-10 shadow-warm-lg text-center">
        <h1 className={`font-heading text-2xl md:text-3xl font-black mb-4 ${result.tone === 'ok' ? 'text-[#006064]' : 'text-accent-orange'}`}>
          {result.title}
        </h1>
        <p className="leading-loose text-lg">{result.message}</p>
        <p className="text-sm text-brown/70 mt-8">
          如有其他問題，直接回覆那封信，或來信 <a className="font-bold underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> 都可以。
        </p>
        <Link to="/" className="btn-warm inline-flex items-center justify-center gap-2 mt-8 px-6 py-3 bg-base-yellow text-brown font-black border-2 border-brown shadow-warm">
          回到首頁
        </Link>
      </div>
    </div>
  );
}
