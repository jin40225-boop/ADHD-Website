import { Link } from 'react-router-dom';
import { Clock, Edit3, Info } from 'lucide-react';
import { UpcomingSessions } from '@/components/UpcomingSessions';
import { SessionHistory } from '@/components/SessionHistory';
import { AboutFounder } from '@/components/AboutFounder';
import { DonateFooter } from '@/components/DonateFooter';
import { LineContact } from '@/components/LineContact';

const BASE = import.meta.env.BASE_URL;
const LINKS = {
  LINK_1: `${BASE}parent/register`,
};

export default function ParentConsultPage() {
  return (
    <div className="min-h-screen bg-cream text-brown font-body">
      <svg className="hidden" height="0" width="0"><filter id="hand-drawn"><feTurbulence baseFrequency="0.01" numOctaves="3" result="noise" type="fractalNoise"></feTurbulence><feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap></filter></svg><header className="hero-section pt-10 mb-16" id="about"><div className="absolute top-20 right-[-50px] w-96 h-96 opacity-40 animate-blob pointer-events-none"><svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><path d="M44.7,-76.4C58.9,-69.2,71.8,-59,79.6,-45.3C87.4,-31.7,90.2,-14.8,88.2,0.8C86.2,16.5,79.4,30.9,70.1,43.1C60.8,55.3,49,65.3,35.5,72.5C22,79.7,6.7,84.1,-8.9,83.9C-24.5,83.7,-40.4,78.9,-53.2,69.7C-66,60.5,-75.7,46.9,-81.3,31.8C-86.9,16.7,-88.4,0,-85.2,-15.2C-82,-30.4,-74.1,-44.1,-62.8,-52.9C-51.5,-61.7,-36.8,-65.7,-23.4,-73.1C-10,-80.5,2.1,-91.3,16.1,-90.8C30.1,-90.3,46,-83.5,44.7,-76.4Z" fill="#FFD6BA" transform="translate(100 100)"></path></svg></div><div className="max-w-4xl mx-auto px-4 flex flex-col items-center relative z-10"><div className="w-full space-y-8"><div className="text-center md:text-left"><div className="inline-block bg-white border-2 border-brown px-4 py-1 rounded-full text-sm font-bold shadow-warm transform -rotate-1 text-[#006064] mb-4">
                        ✨ 專屬單項服務介紹
                    </div><h1 className="font-heading text-4xl md:text-5xl font-black leading-tight text-brown">【ADHD 家長諮詢服務】免費公益線上諮詢：前兒少社工陪你找出教養新解方 🌿</h1></div>
<div className="bg-white/70 p-6 md:p-8 rounded-2xl border-2 border-brown/10 backdrop-blur-sm shadow-sm mt-8">
<div className="font-body text-brown text-lg space-y-4">
<p className="leading-relaxed text-lg font-medium text-justify">
                        在陪伴 ADHD 孩子的路上，您是否時常感到心力交瘁，覺得沒有人懂您的無力感？<br/>
                        或您想問問「服藥是什麼感覺？」、「為什麼要這樣做？」這些問題我想長大後的成年ADHD可以回答！<br/><br/>
                        為了支持在教養路上感到疲憊的家長，我們特別推出專屬的免費公益諮詢服務。由<strong>大A社工督導 彥宇、心理師 鏡子、特教老師 Lisa</strong> 共同陪伴家長一個小時，提供專業與 ADHD 經驗親職建議！<br/>
                        我們將根據您的具體議題與需求，彈性邀請相關專業人員或其他大A夥伴共同參與，為您打造最貼近需求、最懂您的專屬對話空間。
                    </p>
<div className="text-center mt-2 py-2">
<span className="inline-block bg-[#FFF9C4] px-4 py-2 rounded-full font-black text-lg border border-brown shadow-sm text-highlight transform rotate-1">
                            ✨ 彥宇不是樣樣都懂，但大A臥虎藏龍！我會盡力回應前來的家長 ✨
                        </span>
</div>
</div>
</div>
</div>
</div>
</header><div className="max-w-4xl mx-auto px-4 mb-12"><Link to="/parent/register" className="btn-warm w-full py-4 bg-base-yellow text-brown text-xl font-black flex items-center justify-center gap-2 border-2 border-brown shadow-warm">🖊️ 站內報名（額滿即時顯示）</Link></div><div className="max-w-4xl mx-auto px-4 space-y-20"><section id="groups">

<div className="bg-white border-2 border-brown rounded-3xl p-6 md:p-10 mb-10 relative shadow-[8px_8px_0_rgba(93,64,55,0.15)] flex flex-col gap-8">
<div className="space-y-4 text-brown">
</div>
<div className="grid grid-cols-1 gap-6">
<div className="bg-blue-50 border-l-8 border-accent-blue p-6 rounded-r-2xl">
<h4 className="font-bold text-brown text-xl mb-3 flex items-center gap-2">
<Info className="w-6 h-6"></Info> 服務資訊
                        </h4>
<ul className="text-brown space-y-2 font-bold list-disc list-inside text-sm">
<li><strong>專屬團隊：</strong> 大A社工督導 彥宇 × 心理師 鏡子 × 特教老師 Lisa（視需求邀請其他專業人員或大A夥伴加入）</li>
<li><strong>服務內容：</strong> 單次一小時免費公益線上諮詢（Google Meet 進行）</li>
<li><strong>適合對象：</strong> 渴望理解 ADHD 孩子、需要教養策略討論或喘息支持的家長</li>
<li><strong>請填寫表單：</strong> 讓我們可以提前了解孩子狀況。</li>
</ul>
</div>
<div className="bg-[#FFF9C4] border-l-8 border-accent-orange p-6 rounded-r-2xl">
<h4 className="font-bold text-brown text-xl mb-3 flex items-center gap-2">
<Clock className="w-6 h-6"></Clock> 開放報名場次
                        </h4>
<p className="text-xs font-bold text-brown mb-2">每月限定3個名額，報名截止時間為該場次活動前一週的晚上 12 點。名額即時更新。</p>
<UpcomingSessions projectSlug="parent" registerPath="/parent/register" />
</div>
</div>
<div className="bg-[#E0F7FA] border-2 border-brown p-6 rounded-2xl">
<h4 className="font-bold text-[#006064] text-xl mb-3 flex items-center gap-2">
<Edit3 className="w-6 h-6"></Edit3> 報名三步驟與重要規則
                    </h4>
<ul className="text-[#006064] space-y-2 font-bold list-decimal list-inside text-lg">
<li><strong>填寫表單：</strong> 請於各場次截止期限前完成，逾期視為無效。</li>
<li><strong>需求評估：</strong> 收到表單後，檢視議題並媒合合適的大A夥伴。</li>
<li><strong>收取信件：</strong> 無論是否安排成功，都會寄發 Email 通知。</li>
</ul>
<div className="mt-4 p-3 bg-white border border-brown text-red-600 font-bold rounded text-sm">
                        ⚠️ 【重要提醒：這樣才算報名成功！】<br/>送出表單不等於預約成功！只有當您收到「確認邀約成功通知信」時，才算正式完成預約。若未能為您安排，您也會收到婉拒或候補通知。
                    </div>
</div>
<div className="mt-2 w-full">
<a className="btn-warm py-5 px-6 bg-accent-blue text-brown w-full text-2xl md:text-3xl shadow-warm animate-pulse-slow flex flex-col items-center justify-center border-4 border-brown" href={LINKS.LINK_1} target="_blank" rel="noopener noreferrer">
<span>📝 前往填寫報名表</span>
<span className="text-base font-bold mt-2 opacity-80 bg-white/40 px-3 py-1 rounded-full border border-brown/20">報名連結</span>
</a>
</div>
</div>
<SessionHistory projects={[{ slug: 'parent' }]} title="👣 服務軌跡・已完成場次" description="上半年度已完成的親職諮詢場次永久留存，讓新朋友看見這項服務的累積。" />
</section></div>

<AboutFounder />
<LineContact />
<DonateFooter />
    </div>
  );
}
