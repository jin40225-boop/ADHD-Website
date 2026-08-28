import { Link } from 'react-router-dom';
import { Clock, Edit3, Info } from 'lucide-react';
import { UpcomingSessions } from '@/components/UpcomingSessions';
import { NavigatorSlotSummary } from '@/components/NavigatorSlotSummary';
import { SessionHistory } from '@/components/SessionHistory';
import { AboutFounder } from '@/components/AboutFounder';
import { RegisterCta } from '@/components/RegisterCta';
import { DonateFooter } from '@/components/DonateFooter';
import { LineContact } from '@/components/LineContact';
import { ActivityCarousel } from '@/components/ActivityCarousel';

export default function NavigatorConsultPage() {
  return (
    <div className="min-h-screen bg-cream text-brown font-body">
      {/* 海報放在最上面：從社群連過來的人是先看到海報才點進來的，第一眼要對得上。 */}
      <ActivityCarousel page="navigator" />
      <svg className="hidden" height="0" width="0"><filter id="hand-drawn"><feTurbulence baseFrequency="0.01" numOctaves="3" result="noise" type="fractalNoise"></feTurbulence><feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap></filter></svg><header className="hero-section pt-10 mb-16" id="about"><div className="absolute top-20 right-[-50px] w-96 h-96 opacity-40 animate-blob pointer-events-none"><svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><path d="M44.7,-76.4C58.9,-69.2,71.8,-59,79.6,-45.3C87.4,-31.7,90.2,-14.8,88.2,0.8C86.2,16.5,79.4,30.9,70.1,43.1C60.8,55.3,49,65.3,35.5,72.5C22,79.7,6.7,84.1,-8.9,83.9C-24.5,83.7,-40.4,78.9,-53.2,69.7C-66,60.5,-75.7,46.9,-81.3,31.8C-86.9,16.7,-88.4,0,-85.2,-15.2C-82,-30.4,-74.1,-44.1,-62.8,-52.9C-51.5,-61.7,-36.8,-65.7,-23.4,-73.1C-10,-80.5,2.1,-91.3,16.1,-90.8C30.1,-90.3,46,-83.5,44.7,-76.4Z" fill="#FFD6BA" transform="translate(100 100)"></path></svg></div><div className="max-w-4xl mx-auto px-4 flex flex-col items-center relative z-10"><div className="w-full space-y-8"><div className="text-center md:text-left"><div className="inline-block bg-white border-2 border-brown px-4 py-1 rounded-full text-sm font-bold shadow-warm transform -rotate-1 text-[#006064] mb-4">
                        ✨ 專屬單項服務介紹
                    </div><h1 className="font-heading text-4xl md:text-5xl font-black leading-tight text-brown">【ADHD 導航計畫】免費公益線上諮詢：大A彥宇 × 諮商心理師鏡子 🌿</h1></div>
<div className="bg-white/70 p-6 md:p-8 rounded-2xl border-2 border-brown/10 backdrop-blur-sm shadow-sm mt-8">
<div className="font-body text-brown text-lg space-y-4">
<p className="leading-relaxed text-lg font-medium text-justify">
                        今年，大A彥宇與諮商心理師宋致靜（鏡子）攜手合作，為 ADHD 族群推出專屬的免費公益諮詢服務。<br/><br/>
                        如果你覺得生活有些卡關，想釐清自己目前的心理狀態，或正在評估自己是否需要進一步的心理諮商，歡迎預約這項專屬服務，讓心理師陪你走一段內心的漫遊之旅。<br/>
</p>
</div>
</div>
</div>
</div>
</header><div className="max-w-4xl mx-auto px-4 mb-12"><Link to="/navigator/register" className="btn-warm w-full py-4 bg-base-yellow text-brown text-xl font-black flex items-center justify-center gap-2 border-2 border-brown shadow-warm">🖊️ 站內報名（額滿即時顯示）</Link></div><div className="max-w-4xl mx-auto px-4 space-y-20"><section id="groups">

<div className="bg-white border-2 border-brown rounded-3xl p-6 md:p-10 mb-10 relative shadow-[8px_8px_0_rgba(93,64,55,0.15)] flex flex-col gap-8">
<div className="space-y-4 text-brown">
</div>
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
<div className="bg-red-50 border-l-8 border-accent-pink p-6 rounded-r-2xl">
<h4 className="font-bold text-brown text-xl mb-3 flex items-center gap-2">
<Info className="w-6 h-6"></Info> 服務資訊
                        </h4>
<ul className="text-brown space-y-2 font-bold list-disc list-inside text-base">
<li><strong>共同策劃：</strong> 大A彥宇 × 諮商心理師 宋致靜（鏡子）</li>
<li><strong>服務內容：</strong> 單次免費公益線上諮詢（使用 Google Meet 進行）</li>
<li><strong>適合對象：</strong> 想釐清自身狀態與連結相關心理健康資源的 ADHD 族群</li>
</ul>
</div>
<NavigatorSlotSummary />
</div>
<div className="mt-8">
<h4 className="font-bold text-brown text-xl mb-3 flex items-center gap-2">
<Clock className="w-6 h-6"></Clock> 開放報名月份
                        </h4>
<UpcomingSessions projectSlug="navigator" registerPath="/navigator/register" />
</div>
<div className="bg-[#E0F7FA] border-2 border-brown p-6 rounded-2xl">
<h4 className="font-bold text-[#006064] text-xl mb-3 flex items-center gap-2">
<Edit3 className="w-6 h-6"></Edit3> 報名三步驟與重要規則
                    </h4>
<ul className="text-[#006064] space-y-2 font-bold list-decimal list-inside text-lg">
<li><strong>填寫表單：</strong> 採「提前一個月」預約。每月 20 日為下個月報名截止日。</li>
<li><strong>適性審核：</strong> 收到報名後，心理師將依據您填寫的困擾與背景進行「適性評估」，確認是否合適陪伴您。</li>
<li><strong>收取信件：</strong> 審核結果將於當月底前透過 Email 通知。</li>
</ul>
<div className="mt-4 p-3 bg-white border border-brown text-red-600 font-bold rounded text-sm">
                        ⚠️ 【重要提醒：這樣才算報名成功！】<br/>送出表單不等於預約成功！只有當您收到「確認邀約成功通知信」時，才算正式完成預約。請務必留意您的電子信箱（包含垃圾信件匣）。若未能安排，您也會收到婉拒或候補通知。
                    </div>
</div>
<div className="mt-2 w-full">
<RegisterCta slug="navigator" />
</div>
</div>
<SessionHistory projects={[{ slug: 'navigator' }]} title="👣 服務軌跡・已完成場次" description="已完成的導航計畫諮詢場次永久留存，讓新朋友看見這項服務的累積。" />
</section></div>

<AboutFounder variant="collapsed" />
<LineContact />
<DonateFooter />
    </div>
  );
}
