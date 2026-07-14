import { useState } from 'react';
import { Send, AlertCircle, Heart } from 'lucide-react';
import { isSupabaseReady } from '../../lib/supabase';
import { submitRecommendationSubmission } from '../../lib/api';

/** 表單分類 → DB type 白名單（community 不在白名單，歸入 other 並保留原值於 answers）。 */
const CATEGORY_TO_TYPE = {
  doctor: 'doctor',
  assessment: 'assessment',
  therapy: 'therapy',
  community: 'other',
  other: 'other',
} as const;

export default function SubmitRecommendationPage() {
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const category = String(data.get('category') ?? 'other') as keyof typeof CATEGORY_TO_TYPE;
    setSending(true);
    setErrorMsg('');
    try {
      if (!isSupabaseReady) {
        throw new Error('目前無法連線至資料庫，請稍後再試，或透過官方 LINE 告訴我們。');
      }
      await submitRecommendationSubmission({
        type: CATEGORY_TO_TYPE[category] ?? 'other',
        answers: {
          region: data.get('region'),
          category,
          hospital: data.get('hospital'),
          doctorOrName: data.get('doctorOrName'),
          audience: data.get('audience'),
          experience: data.get('experience'),
        },
        nickname: String(data.get('nickname') ?? '').trim() || undefined,
        email: String(data.get('email') ?? '').trim() || undefined,
      });
      form.reset();
      setSubmitted(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '送出失敗，請稍後再試。');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream text-brown py-12 px-4 md:px-8">
      <div className="max-w-2xl mx-auto bg-white border-2 border-brown rounded-3xl p-6 md:p-8 shadow-warm-lg space-y-6">
        <div>
          <span className="inline-flex items-center gap-1 bg-base-yellow text-brown font-bold text-xs px-3 py-1 rounded-full border border-brown mb-2">
            <Heart className="w-3.5 h-3.5 text-highlight" /> 社群共創
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold">推薦 ADHD 友善醫師 / 資源</h1>
          <p className="text-sm text-brown/80 mt-2">
            感謝您願意分享優質醫療與諮商資源。為營造信任共好的支持網絡，本資料庫採取「僅正向推薦」政策。
          </p>
        </div>

        <div className="bg-cream border-l-4 border-highlight p-4 rounded-r-xl text-sm leading-relaxed">
          <p className="font-bold text-highlight flex items-center gap-1">
            <AlertCircle className="w-4 h-4" /> 投稿須知
          </p>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>請填寫您親身看診、評估或參與的優質體驗。</li>
            <li>我們不會直接發布攻擊或不實評價，感謝您的理解與支持。</li>
          </ul>
        </div>

        {submitted ? (
          <div className="bg-[#F0FDF4] border-2 border-line-green rounded-2xl p-6 text-center space-y-3">
            <h3 className="text-xl font-bold text-line-green">感謝您的寶貴分享！</h3>
            <p className="text-sm">您的投稿內容已送至社群審核排程，經確認後將會同步至 ADHD 友善地圖。</p>
            <button
              onClick={() => setSubmitted(false)}
              className="mt-4 bg-base-yellow border-2 border-brown px-4 py-2 rounded-xl font-bold shadow-warm-sm"
            >
              繼續投稿另一筆
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 font-medium">
            <div>
              <label className="block text-sm font-bold mb-1">所在縣市地區 *</label>
              <select name="region" required className="w-full px-4 py-2.5 bg-cream border-2 border-brown rounded-xl">
                <option value="">請選擇縣市</option>
                {['台北市','新北市','基隆市','桃園市','新竹縣市','苗栗縣市','臺中市','彰化縣市','南投縣','雲林縣','嘉義縣市','臺南市','高雄市','屏東縣','宜蘭縣','花蓮縣','臺東縣','澎湖金馬','線上/其他'].map(region => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">資源分類 *</label>
              <select name="category" required className="w-full px-4 py-2.5 bg-cream border-2 border-brown rounded-xl">
                <option value="doctor">精神科/身心科診所與醫院</option>
                <option value="assessment">心理與特教評估</option>
                <option value="therapy">心理諮商與職能治療</option>
                <option value="community">支持社群與相關資源</option>
                <option value="other">其他資源</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-1">醫療院所/機構名稱 *</label>
                <input
                  type="text"
                  name="hospital"
                  required
                  placeholder="例如：台大醫院 / 某身心科診所"
                  className="w-full px-4 py-2.5 bg-cream border-2 border-brown rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">醫師/治療師姓名 *</label>
                <input
                  type="text"
                  name="doctorOrName"
                  required
                  placeholder="例如：王醫師 / 醫療團隊"
                  className="w-full px-4 py-2.5 bg-cream border-2 border-brown rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">適合對象</label>
              <select name="audience" className="w-full px-4 py-2.5 bg-cream border-2 border-brown rounded-xl">
                <option value="all">不限 / 兒童與成人皆適合</option>
                <option value="child">兒童與青少年</option>
                <option value="adult">成人 ADHD</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">推薦原因與看診心得 *</label>
              <textarea
                name="experience"
                rows={5}
                required
                placeholder="請分享看診風格、同理心表現、用藥討論方式或心理支持心得..."
                className="w-full px-4 py-2.5 bg-cream border-2 border-brown rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-1">匿名暱稱（選填）</label>
                <input
                  type="text"
                  name="nickname"
                  placeholder="顯示於資料庫的署名，可留空"
                  className="w-full px-4 py-2.5 bg-cream border-2 border-brown rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Email（選填，永不公開）</label>
                <input
                  type="email"
                  name="email"
                  placeholder="僅供查核疑問時聯繫"
                  className="w-full px-4 py-2.5 bg-cream border-2 border-brown rounded-xl"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="bg-[#FFF3F0] border-2 border-highlight rounded-xl p-3 text-sm font-bold text-highlight flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={sending}
              className="w-full py-3.5 bg-base-yellow border-2 border-brown rounded-2xl font-extrabold text-base shadow-warm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-warm-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:hover:translate-x-0 disabled:hover:translate-y-0"
            >
              <Send className="w-5 h-5" /> {sending ? '送出中…' : '送出推薦'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
