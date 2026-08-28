/**
 * 協辦活動綜合專欄。
 *
 * 這一頁刻意「很薄」：頁面本身只有專欄的說明與通則，**每個合作案的內容全部來自
 * 資料庫**（`activities_public` 的 name／public_summary／cohost_info ＋ 掛在該活動
 * 底下的場次）。新增第三、第四個合作案時是在後台建一筆活動，不必改這個檔案。
 *
 * 對方的報名表單網址一律不寫在這裡：`scripts/check-site.mjs` 禁止公開頁原始碼出現
 * 外部表單網域，而那條守門的立法理由（寫死的外部資訊會悄悄過期）本來就適用於協辦
 * 活動——細節是對方決定的，我們沒有權限也沒有義務跟著改程式。
 */
import { CoHostActivities } from '@/components/CoHostActivities';
import { AboutFounder } from '@/components/AboutFounder';
import { DonateFooter } from '@/components/DonateFooter';
import { LineContact } from '@/components/LineContact';
import { ActivityCarousel } from '@/components/ActivityCarousel';

export default function CoHostPage() {
  return (
    <div className="min-h-screen bg-cream text-brown font-body">
      {/* 海報放在最上面：從社群連過來的人是先看到海報才點進來的，第一眼要對得上。 */}
      <ActivityCarousel page="co-host" />
      <header className="hero-section pt-10 mb-16" id="about">
        <div className="absolute top-20 right-[-50px] w-96 h-96 opacity-40 animate-blob pointer-events-none">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><path d="M44.7,-76.4C58.9,-69.2,71.8,-59,79.6,-45.3C87.4,-31.7,90.2,-14.8,88.2,0.8C86.2,16.5,79.4,30.9,70.1,43.1C60.8,55.3,49,65.3,35.5,72.5C22,79.7,6.7,84.1,-8.9,83.9C-24.5,83.7,-40.4,78.9,-53.2,69.7C-66,60.5,-75.7,46.9,-81.3,31.8C-86.9,16.7,-88.4,0,-85.2,-15.2C-82,-30.4,-74.1,-44.1,-62.8,-52.9C-51.5,-61.7,-36.8,-65.7,-23.4,-73.1C-10,-80.5,2.1,-91.3,16.1,-90.8C30.1,-90.3,46,-83.5,44.7,-76.4Z" fill="#FFD6BA" transform="translate(100 100)"></path></svg>
        </div>
        <div className="max-w-4xl mx-auto px-4 flex flex-col items-center relative z-10">
          <div className="w-full space-y-8">
            <div className="text-center md:text-left">
              <div className="inline-block bg-white border-2 border-brown px-4 py-1 rounded-full text-sm font-bold shadow-warm transform -rotate-1 text-[#006064] mb-4">
                🤝 協辦活動
              </div>
              <h1 className="font-heading text-4xl md:text-5xl font-black leading-tight text-brown">協辦活動</h1>
              <p className="text-xl md:text-2xl font-bold mt-3 text-brown/80">與各單位合作的講座、座談與活動</p>
            </div>

            <div className="bg-white/70 p-6 md:p-8 rounded-2xl border-2 border-brown/10 backdrop-blur-sm shadow-sm mt-8">
              <div className="font-body text-brown text-lg space-y-4">
                <p className="leading-relaxed text-lg font-medium text-justify">
                  這裡收錄<strong>大A彥宇個人、以及大A團隊與其他單位合作的活動</strong>——不論我是協辦、擔任講師，或是擔任主持人與工作人員。這些活動都<strong>由主辦單位辦理</strong>，我把它們整理在這裡，是希望需要的人不會錯過。
                </p>
                <p className="leading-relaxed text-lg font-bold text-justify">
                  注意：本頁活動的報名管道與詳細事項，一律<span className="marker-highlight">依照主辦單位公告為準</span>。
                </p>
                <div className="bg-[#E0F7FA] p-5 rounded-xl border-2 border-brown text-[#006064]">
                  <p className="font-bold text-lg mb-2">⚠️ 這一頁的活動，報名都不在本站</p>
                  <ul className="space-y-1 font-bold list-disc list-inside">
                    <li>報名一律在<strong>各主辦單位自己的報名表單</strong>完成。</li>
                    <li>報名資訊、名額、時間與細節<strong>由主辦單位決定與公布</strong>；本頁為轉載，如有出入<strong>一律以主辦單位公告為準</strong>。</li>
                    <li>本站不受理報名、不保留名額，也無法查詢你的報名狀態。</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4">
        <CoHostActivities />
      </div>

      <AboutFounder variant="collapsed" />
      <LineContact />
      <DonateFooter />
    </div>
  );
}
