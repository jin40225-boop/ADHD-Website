import { Link } from 'react-router-dom';
import { Video } from 'lucide-react';
import { UpcomingSessions } from '@/components/UpcomingSessions';
import { SessionHistory } from '@/components/SessionHistory';
import { AboutFounder } from '@/components/AboutFounder';
import { RegisterCta } from '@/components/RegisterCta';
import { DonateFooter } from '@/components/DonateFooter';
import { LineContact } from '@/components/LineContact';
import { ActivityCarousel } from '@/components/ActivityCarousel';

export default function PeerGroupPage() {
  return (
    <div className="min-h-screen bg-cream text-brown font-body">
      {/* 海報放在最上面：從社群連過來的人是先看到海報才點進來的，第一眼要對得上。 */}
      <ActivityCarousel page="peer-group" />
      <svg className="hidden" height="0" width="0"><filter id="hand-drawn"><feTurbulence baseFrequency="0.01" numOctaves="3" result="noise" type="fractalNoise"></feTurbulence><feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap></filter></svg><header className="hero-section pt-10 mb-16" id="about"><div className="absolute top-20 right-[-50px] w-96 h-96 opacity-40 animate-blob pointer-events-none"><svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><path d="M44.7,-76.4C58.9,-69.2,71.8,-59,79.6,-45.3C87.4,-31.7,90.2,-14.8,88.2,0.8C86.2,16.5,79.4,30.9,70.1,43.1C60.8,55.3,49,65.3,35.5,72.5C22,79.7,6.7,84.1,-8.9,83.9C-24.5,83.7,-40.4,78.9,-53.2,69.7C-66,60.5,-75.7,46.9,-81.3,31.8C-86.9,16.7,-88.4,0,-85.2,-15.2C-82,-30.4,-74.1,-44.1,-62.8,-52.9C-51.5,-61.7,-36.8,-65.7,-23.4,-73.1C-10,-80.5,2.1,-91.3,16.1,-90.8C30.1,-90.3,46,-83.5,44.7,-76.4Z" fill="#FFD6BA" transform="translate(100 100)"></path></svg></div><div className="max-w-4xl mx-auto px-4 flex flex-col items-center relative z-10"><div className="w-full space-y-8"><div className="text-center md:text-left"><div className="inline-block bg-white border-2 border-brown px-4 py-1 rounded-full text-sm font-bold shadow-warm transform -rotate-1 text-[#006064] mb-4">
                        ✨ 專屬單項服務介紹
                    </div><h1 className="font-heading text-4xl md:text-5xl font-black leading-tight text-brown">【大A彥宇】115年度成人ADHD線上互助聚會</h1></div>
<div className="bg-white/70 p-6 md:p-8 rounded-2xl border-2 border-brown/10 backdrop-blur-sm shadow-sm mt-8">
<div className="font-body text-brown text-lg space-y-4">
<p className="leading-relaxed text-lg font-medium text-justify">
                        各位大A夥伴大家好，我是彥宇！👋<br/>
                        這是我自辦的線上聚會，歡迎各位嗨咖一起同樂，害羞的朋友也不必擔心，我們邀請了很有特色的來賓，讓大家有玩又有學習！<br/>
                        來賓們都是對我們ADHD生活很有幫助的專業人員，但這絕對不是嚴肅的講座，而是開心快樂的ADHD分享聚會~<br/><br/>
                        給我個機會，來參加一次吧！讓我能認識更多的大A夥伴！<br/>
                        新的一年（115年）到來，很開心又能與大家繼續前行。今年邀請了幾位專業的講師好朋友，準備了一系列貼近我們生活的主題。<br/></p><div className="text-center mt-6 py-4"><span className="inline-block bg-[#FFF9C4] px-6 py-3 rounded-full font-black text-xl border-2 border-brown shadow-sm transform -rotate-1 text-highlight">✨ 無需準備、不必讀書、帶著好奇心就能參加！ ✨</span></div>
</div>
</div>
</div>
</div>
</header><div className="max-w-4xl mx-auto px-4 mb-12"><Link to="/peer-group/register" className="btn-warm w-full py-4 bg-base-yellow text-brown text-xl font-black flex items-center justify-center gap-2 border-2 border-brown shadow-warm">🖊️ 站內報名（額滿即時顯示）</Link></div><div className="max-w-4xl mx-auto px-4 space-y-20"><section id="groups">
<div className="bg-white border-2 border-brown rounded-3xl p-6 md:p-10 mb-10 relative shadow-[8px_8px_0_rgba(93,64,55,0.15)] flex flex-col gap-8"><div className="space-y-4 text-brown"></div><div className="bg-[#E0F7FA] border-l-8 border-accent-teal p-6 rounded-r-2xl"><h4 className="font-bold text-[#006064] text-xl mb-3 flex items-center gap-2"><Video className="w-6 h-6"></Video> 參加須知
                    </h4><ul className="text-[#006064] space-y-2 font-bold list-disc list-inside text-lg"><li>一律採用 <strong className="text-[#004D40] bg-[#B2EBF2] px-1 rounded">GOOGLE MEET 視訊</strong></li><li>可<strong className="text-[#004D40] bg-[#B2EBF2] px-1 rounded">不開鏡頭</strong>，害羞的朋友也不用擔心喔！</li><li>表單是預先統計人數用的！沒報名也可以當天直接參加！</li></ul></div><div className="mt-2 w-full"><RegisterCta slug="peer-group" /></div></div>
<div className="border-t-4 border-dashed border-brown/20 pt-8"><div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6"><div className="space-y-1"><h3 className="text-2xl font-bold text-brown flex items-center gap-2"><span className="bg-accent-teal text-brown px-2 py-1 rounded text-lg border border-brown">辦理</span>
                            ADHD 成人同儕線上團體-場次說明
                        </h3><p className="text-gray-600 font-medium">(點開有詳細介紹喔！)</p></div></div><UpcomingSessions includeUnpublished showTopic />
</div>
<SessionHistory />
</section></div>

<AboutFounder variant="collapsed" />
<LineContact />
<DonateFooter />
    </div>
  );
}
