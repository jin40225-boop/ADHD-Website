import { ArrowRight, ArrowUpRight, BookOpen, Calendar, CalendarClock, ChevronDown, Clock, Copy, Database, Edit3, Flag, Info, Mail, MapPin, MessageCircle, PlayCircle, Sparkles, User, Users, Video } from 'lucide-react';
import { useSessionCardToggle } from '@/hooks/useSessionCardToggle';

// Notion 停用（2026-07 中）連結替換：報名表單改站內報名頁、資料庫改站內地圖、
// 新聞報導改原始媒體連結。BASE 讓連結在 GitHub Pages 子路徑與本機 dev 都正確。
// LINK_2/LINK_3 影片頁為未備份的 Notion 嵌入頁，暫留原連結待 user 提供原始影片來源。
const BASE = import.meta.env.BASE_URL;
const TODO_LINKS = {
  LINK_1: 'https://www.knews.com.tw/news/01CEE23784ECF429098274743517F227',
  LINK_2: 'https://mountain-sail-ee8.notion.site/ADHD-2098b8084dad807d8c50f4d5c4221ace',
  LINK_3: 'https://mountain-sail-ee8.notion.site/2098b8084dad8089b914ef5f29bd3fea',
  LINK_4: `${BASE}map`,
  LINK_5: `${BASE}peer-group/register`,
  LINK_6: `${BASE}navigator/register`,
  LINK_7: `${BASE}parent/register`,
  LINK_8: `${BASE}peer-group/register`,
  LINK_9: `${BASE}navigator/register`,
  LINK_10: `${BASE}navigator/register`,
  LINK_11: `${BASE}navigator/register`,
  LINK_12: `${BASE}peer-group/register`,
  LINK_13: `${BASE}parent/register`,
  LINK_14: `${BASE}parent/register`,
  LINK_15: `${BASE}parent/register`,
  LINK_16: `${BASE}peer-group/register`,
  LINK_17: `${BASE}parent/register`,
  LINK_18: `${BASE}parent/register`,
  LINK_19: `${BASE}parent/register`,
  LINK_20: `${BASE}navigator/register`,
  LINK_21: `${BASE}peer-group/register`,
  LINK_22: `${BASE}parent/register`,
  LINK_23: `${BASE}parent/register`,
  LINK_24: `${BASE}peer-group/register`,
};

export default function HomePage() {
  const sessionCardsRef = useSessionCardToggle();
  return (
    <div className="min-h-screen bg-cream text-brown font-body" ref={sessionCardsRef}>
      <svg className="hidden" height="0" width="0"><filter id="hand-drawn"><feTurbulence baseFrequency="0.01" numOctaves="3" result="noise" type="fractalNoise"></feTurbulence><feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap></filter></svg>{/* 舊一頁式頁首整併：品牌列交給全站 NavBar，頁內錨點保留為「本頁快速前往」列 */}
      <nav className="w-full py-2.5 px-6 bg-base-yellow/60 border-b border-brown/20"><div className="max-w-6xl mx-auto flex flex-wrap items-center gap-2 font-bold text-brown text-sm"><span className="text-xs text-brown/70">本頁快速前往：</span><a className="nav-block bg-white text-sm" href="#about">關於彥宇</a><a className="nav-block bg-white text-sm" href="#actions">實踐項目</a><a className="nav-block bg-white text-sm" href="#groups">115年計畫</a><a className="nav-block bg-white text-sm" href="#line-contact">官方LINE</a></div></nav><header className="hero-section pt-10 px-4 mb-16" id="about"><div className="absolute top-20 right-[-50px] w-96 h-96 opacity-40 animate-blob pointer-events-none"><svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><path d="M44.7,-76.4C58.9,-69.2,71.8,-59,79.6,-45.3C87.4,-31.7,90.2,-14.8,88.2,0.8C86.2,16.5,79.4,30.9,70.1,43.1C60.8,55.3,49,65.3,35.5,72.5C22,79.7,6.7,84.1,-8.9,83.9C-24.5,83.7,-40.4,78.9,-53.2,69.7C-66,60.5,-75.7,46.9,-81.3,31.8C-86.9,16.7,-88.4,0,-85.2,-15.2C-82,-30.4,-74.1,-44.1,-62.8,-52.9C-51.5,-61.7,-36.8,-65.7,-23.4,-73.1C-10,-80.5,2.1,-91.3,16.1,-90.8C30.1,-90.3,46,-83.5,44.7,-76.4Z" fill="#FFD6BA" transform="translate(100 100)"></path></svg></div><div className="max-w-4xl mx-auto flex flex-col items-center relative z-10"><div className="w-full space-y-8"><div className="text-center md:text-left"><div className="inline-block bg-white border-2 border-brown px-4 py-1 rounded-full text-sm font-bold shadow-warm transform -rotate-1 text-accent-teal mb-4">
                        ✨ 1 永遠比 0 大
                    </div><h1 className="font-heading text-4xl md:text-5xl font-black leading-tight text-brown">
                        嗨，我是彥宇<br/><span className="text-xl md:text-2xl font-bold mt-2 block text-brown/80">可以叫我大A彥宇 <span className="text-sm font-medium">(羞)</span></span></h1></div><div className="bg-white/70 p-6 md:p-8 rounded-2xl border-2 border-brown/10 backdrop-blur-sm shadow-sm"><div className="font-body text-brown leading-relaxed font-medium text-justify text-lg space-y-4"><p>我從小學三年級就診斷ADHD，一路跌跌撞撞成長到大。</p><p>現在是社會工作者-身心障礙者服務中心 社工督導，同時也是受到社團法人台灣赤子心過動症協會總會鼓勵、栽培的倡議工作者。</p><p className="text-xl font-bold text-accent-teal py-1">我希望可以幫助更多像我一樣的人！</p><p>除了本職工作外，我利用下班時間及假日，正在創建各項服務。我相信 <span className="marker-highlight font-bold">從無到有本身就有價值</span>。希望能讓更多的 ADHD 家長、孩童、大A夥伴因此受益。</p><div className="bg-[#FFF9C4]/60 p-4 rounded-xl border border-brown/10 mt-4 text-brown">
                            以下是我的實踐，希望可以一路前行，替ADHD族群建構更多資源，獲得更好的環境與生活品質。<br/><span className="font-bold text-highlight mt-2 block">也衷心希望像我一樣的孩子，可以過得比我更好，這是我的初衷與祈願。</span></div></div></div><div className="bg-white/50 p-6 md:p-8 rounded-2xl border-2 border-brown/10 backdrop-blur-sm"><h3 className="font-heading text-xl font-bold text-brown mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5 text-accent-orange"></Sparkles> 更進一步認識我
                    </h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><a className="bg-white p-4 rounded-xl border-2 border-brown/20 hover:border-accent-teal hover:shadow-md transition-all group flex flex-col" href={TODO_LINKS.LINK_1} target="_blank"><div className="flex justify-between items-start mb-2"><span className="bg-[#B2EBF2] text-[#006064] text-xs font-bold px-2 py-1 rounded">新聞報導</span><ArrowUpRight className="w-4 h-4 text-brown group-hover:text-accent-teal"></ArrowUpRight></div><div className="font-bold text-brown group-hover:text-accent-teal">ADHD長大成助人者</div></a><div className="space-y-3"><a className="flex items-center justify-between bg-white p-3 rounded-xl border-2 border-brown/20 hover:border-accent-pink hover:shadow-md transition-all group" href={TODO_LINKS.LINK_2} target="_blank"><span className="text-sm font-bold text-brown">友善 ADHD 父母的環境</span><PlayCircle className="w-5 h-5 text-brown group-hover:text-accent-pink"></PlayCircle></a><a className="flex items-center justify-between bg-white p-3 rounded-xl border-2 border-brown/20 hover:border-accent-pink hover:shadow-md transition-all group" href={TODO_LINKS.LINK_3} target="_blank"><span className="text-sm font-bold text-brown">跟人相處這麼難嗎？</span><PlayCircle className="w-5 h-5 text-brown group-hover:text-accent-pink"></PlayCircle></a></div></div></div></div></div></header><div className="max-w-6xl mx-auto px-4 space-y-20"><section id="actions"><div className="flex items-center gap-3 mb-8 justify-center md:justify-start"><div className="w-12 h-12 bg-accent-teal rounded-full border-2 border-brown flex items-center justify-center text-brown shadow-warm"><Flag className="w-6 h-6"></Flag></div><h2 className="font-heading text-3xl font-black text-brown">我在114年開始實踐至今</h2></div><div className="grid grid-cols-1 md:grid-cols-2 gap-8"><div className="warm-card p-8 flex flex-col gap-6 bg-white hover:bg-[#F0FDF4] transition-colors"><div className="flex items-center gap-3 border-b-2 border-brown/10 pb-4"><Users className="w-8 h-8 text-accent-teal"></Users><h3 className="text-2xl font-bold text-brown">個人行動服務</h3></div><div className="space-y-4 flex-grow"><div className="bg-accent-teal/10 p-4 rounded-xl border border-accent-teal/20 relative"><div className="absolute -left-2 top-4 w-4 h-4 bg-accent-teal rounded-full border-2 border-brown"></div><strong className="block text-brown text-lg mb-1 pl-4">辦理 ADHD 成人同儕線上團體</strong><span className="text-sm text-gray-600 pl-4 block">定期聚會，建立支持網絡。</span></div><div className="bg-accent-teal/10 p-4 rounded-xl border border-accent-teal/20 relative"><div className="absolute -left-2 top-4 w-4 h-4 bg-accent-teal rounded-full border-2 border-brown"></div><strong className="block text-brown text-lg mb-1 pl-4">免費家長諮詢服務</strong><span className="text-sm text-gray-600 pl-4 block">一對一線上諮詢，提供專業建議。</span></div></div></div><div className="warm-card p-0 flex flex-col bg-white overflow-hidden" id="database"><div className="bg-gradient-to-r from-[#FFDFD3] to-white p-8 border-b-2 border-brown/10 flex-grow"><div className="flex items-center gap-3 mb-4"><Database className="w-8 h-8 text-[#FF9E80]"></Database><h3 className="text-2xl font-bold text-brown">ADHD 就醫家長推薦資料庫</h3></div><div className="inline-block bg-[#FF9E80] text-white text-xs font-bold px-3 py-1 rounded-full mb-4 border border-brown">
                            114年版．家長共同建構
                        </div><p className="text-brown leading-relaxed mb-6 font-medium text-lg">
                            承蒙 <span className="text-[#FF9E80]">台灣ADHD交流園地</span> 與 <span className="text-[#FF9E80]">赤子心社群</span> 信任。
                            延續舊有資料庫，這是一份由家長們親身經驗匯聚而成的珍貴地圖。
                        </p></div><div className="p-6 bg-[#FFF3E0]"><a className="btn-warm w-full py-4 bg-[#FF9E80] text-white hover:scale-[1.02] shadow-warm border-brown" href={TODO_LINKS.LINK_4} target="_blank">
                            前往資料庫查詢 <ArrowRight className="w-5 h-5 ml-2"></ArrowRight></a></div></div></div></section><section id="groups"><div className="text-center mb-12"><span className="inline-block bg-base-yellow border-2 border-brown px-8 py-4 rounded-full font-black text-brown text-4xl md:text-5xl shadow-warm transform -rotate-1 mb-4">
                    🚀 現在啟動 115 年計畫！
                </span></div><div className="bg-white border-2 border-brown rounded-3xl p-6 md:p-10 mb-10 relative shadow-[8px_8px_0_rgba(93,64,55,0.15)] flex flex-col gap-8"><div className="space-y-4 text-brown"><h3 className="text-2xl font-black mb-4">【大A彥宇】115年度成人ADHD線上互助聚會</h3><p className="leading-relaxed text-lg font-medium text-justify">
                        各位大A夥伴大家好，我是彥宇！👋<br/>
                        這是我自辦的線上聚會，歡迎各位嗨咖一起同樂，害羞的朋友也不必擔心，我們邀請了很有特色的來賓，讓大家有玩又有學習！<br/>
                        來賓們都是對我們ADHD生活很有幫助的專業人員，但這絕對不是嚴肅的講座，而是開心快樂的ADHD分享聚會~<br/><br/>
                        給我個機會，來參加一次吧！讓我能認識更多的大A夥伴！<br/>
                        新的一年（115年）到來，很開心又能與大家繼續前行。今年邀請了幾位專業的講師好朋友，準備了一系列貼近我們生活的主題。<br/></p><div className="text-center mt-6 py-4"><span className="inline-block bg-[#FFF9C4] px-6 py-3 rounded-full font-black text-xl border-2 border-brown shadow-sm transform -rotate-1 text-highlight">✨ 無需準備、不必讀書、帶著好奇心就能參加！ ✨</span></div></div><div className="bg-[#E0F7FA] border-l-8 border-accent-teal p-6 rounded-r-2xl"><h4 className="font-bold text-[#006064] text-xl mb-3 flex items-center gap-2"><Video className="w-6 h-6"></Video> 參加須知
                    </h4><ul className="text-[#006064] space-y-2 font-bold list-disc list-inside text-lg"><li>一律採用 <strong className="text-[#004D40] bg-[#B2EBF2] px-1 rounded">GOOGLE MEET 視訊</strong></li><li>可<strong className="text-[#004D40] bg-[#B2EBF2] px-1 rounded">不開鏡頭</strong>，害羞的朋友也不用擔心喔！</li><li>表單是預先統計人數用的！沒報名也可以當天直接參加！</li></ul></div><div className="mt-2 w-full"><a className="btn-warm py-5 px-6 bg-accent-orange text-brown w-full text-2xl md:text-3xl shadow-warm animate-pulse-slow flex flex-col items-center justify-center border-4 border-brown" href={TODO_LINKS.LINK_5} target="_blank"><span>📝 立即填寫報名表</span><span className="text-base font-bold mt-2 opacity-80 bg-white/40 px-3 py-1 rounded-full border border-brown/20">預先報名讓我們更好準備喔！</span></a></div></div>

<div className="bg-white border-2 border-brown rounded-3xl p-6 md:p-10 mb-10 relative shadow-[8px_8px_0_rgba(93,64,55,0.15)] flex flex-col gap-8">
<div className="space-y-4 text-brown">
<h3 className="text-2xl font-black mb-4">【ADHD 導航計畫】免費公益線上諮詢：大A彥宇 × 諮商心理師鏡子 🌿</h3>
<p className="leading-relaxed text-lg font-medium text-justify">
                        今年，大A彥宇與諮商心理師宋致靜（鏡子）攜手合作，為 ADHD 族群推出專屬的免費公益諮詢服務。<br/><br/>
                        如果你覺得生活有些卡關，想釐清自己目前的心理狀態，或正在評估自己是否需要進一步的心理諮商，歡迎預約這項專屬服務，讓心理師陪你走一段內心的漫遊之旅。<br/>
</p>
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
<div className="bg-[#FFF9C4] border-l-8 border-accent-orange p-6 rounded-r-2xl">
<h4 className="font-bold text-brown text-xl mb-3 flex items-center gap-2">
<Clock className="w-6 h-6"></Clock> 開放預約時段
                        </h4>
<p className="text-sm font-bold text-brown mb-2">每月僅開放 1 位專屬名額，請彈性勾選（可複選）：</p>
<ul className="text-brown space-y-1 font-bold list-disc list-inside text-sm">
<li>平日晚間：第二週 週一 20:00 - 21:00</li>
<li>週末晚間：第二、三週 週六 20:00 - 21:00</li>
<li>週末早晨：第二、三週 週日 09:00 - 10:00</li>
</ul>
<p className="text-xs text-brown mt-2">(註：實際確切日期將於報名表單中列出)</p>
</div>
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
<a className="btn-warm py-5 px-6 bg-accent-pink text-brown w-full text-2xl md:text-3xl shadow-warm animate-pulse-slow flex flex-col items-center justify-center border-4 border-brown" href={TODO_LINKS.LINK_6} target="_blank">
<span>📝 前往填寫報名表</span>
<span className="text-base font-bold mt-2 opacity-80 bg-white/40 px-3 py-1 rounded-full border border-brown/20">重要報名連結</span>
</a>
</div>
</div>

<div className="bg-white border-2 border-brown rounded-3xl p-6 md:p-10 mb-10 relative shadow-[8px_8px_0_rgba(93,64,55,0.15)] flex flex-col gap-8">
<div className="space-y-4 text-brown">
<h3 className="text-2xl font-black mb-4">【ADHD 家長諮詢服務】免費公益線上諮詢：前兒少社工陪你找出教養新解方 🌿</h3>
<p className="leading-relaxed text-lg font-medium text-justify">
                        在陪伴 ADHD 孩子的路上，您是否時常感到心力交瘁，覺得沒有人懂您的無力感？<br/>
                        或您想問問「服藥是什麼感覺？」、「為什麼要這樣做？」這些問題我想長大後的成年ADHD可以回答！<br/><br/>
                        為了支持在教養路上感到疲憊的家長，我們特別推出專屬的免費公益諮詢服務。由身兼「成人 ADHD（大A）」與「前兒少社會工作者」雙重身分的專業工作者為您解答。<br/>
                        我們將根據您的具體議題與需求，彈性邀請相關專業人員或其他大A夥伴共同參與，為您打造最貼近需求、最懂您的專屬對話空間。
                    </p>
<div className="text-center mt-2 py-2">
<span className="inline-block bg-[#FFF9C4] px-4 py-2 rounded-full font-black text-lg border border-brown shadow-sm text-highlight transform rotate-1">
                            ✨ 彥宇不是樣樣都懂，但大A臥虎藏龍！我會盡力回應前來的家長 ✨
                        </span>
</div>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
<div className="bg-blue-50 border-l-8 border-accent-blue p-6 rounded-r-2xl">
<h4 className="font-bold text-brown text-xl mb-3 flex items-center gap-2">
<Info className="w-6 h-6"></Info> 服務資訊
                        </h4>
<ul className="text-brown space-y-2 font-bold list-disc list-inside text-sm">
<li><strong>專屬團隊：</strong> 成人 ADHD / 前兒少社工（視需求邀請夥伴加入）</li>
<li><strong>服務內容：</strong> 單次免費公益線上諮詢（Google Meet）</li>
<li><strong>適合對象：</strong> 渴望理解孩子、需教養策略或喘息支持的家長</li>
<li><strong>請填寫表單：</strong> 讓我們可以提前了解孩子狀況。</li>
</ul>
</div>
<div className="bg-green-50 border-l-8 border-line-green p-6 rounded-r-2xl">
<h4 className="font-bold text-brown text-xl mb-3 flex items-center gap-2">
<Clock className="w-6 h-6"></Clock> 上半年度開放場次
                        </h4>
<p className="text-xs font-bold text-brown mb-2">每月限定２個名額，報名截止時間為該場次活動前一週的晚上 12 點。</p>
<ul className="text-brown space-y-2 font-bold text-sm">
<li className="border-b border-green-200 pb-1">
<strong>【四月場次】4/18</strong>：10:00-11:00 / 11:00-12:00
                                <div className="text-[10px] text-gray-500 font-normal">截止日：4/11 23:59</div>
</li>
<li className="border-b border-green-200 pb-1">
<strong>【五月場次】5/23</strong>：10:00-11:00 / 11:00-12:00
                                <div className="text-[10px] text-gray-500 font-normal">截止日：5/16 23:59</div>
</li>
<li>
<strong>【六月場次】6/6</strong>：10:00-11:00 / 11:00-12:00
                                <div className="text-[10px] text-gray-500 font-normal">截止日：5/30 23:59</div>
</li>
</ul>
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
<a className="btn-warm py-5 px-6 bg-accent-blue text-brown w-full text-2xl md:text-3xl shadow-warm animate-pulse-slow flex flex-col items-center justify-center border-4 border-brown" href={TODO_LINKS.LINK_7} target="_blank">
<span>📝 前往填寫報名表</span>
<span className="text-base font-bold mt-2 opacity-80 bg-white/40 px-3 py-1 rounded-full border border-brown/20">報名連結</span>
</a>
</div>
</div>
<div className="border-t-4 border-dashed border-brown/20 pt-8"><div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6"><div className="space-y-1"><h3 className="text-2xl font-bold text-brown flex items-center gap-2"><span className="bg-accent-teal text-white px-2 py-1 rounded text-lg border border-brown">辦理</span>
                            ADHD 成人同儕線上團體-場次說明
                        </h3><p className="text-gray-600 font-medium">(點開有詳細介紹喔！)</p></div></div><div className="session-card"><div className="session-header" ><div className="flex items-center gap-3"><span className="session-tag bg-accent-orange text-brown">7月場</span><span className="font-bold text-brown text-lg">釋放你的創意靈魂：創作不僅是專業，更是樂趣</span></div><ChevronDown className="w-5 h-5 text-brown transition-transform duration-300"></ChevronDown></div><div className="session-content"><div className="p-6 space-y-4"><div className="flex flex-wrap gap-4 text-sm font-bold text-gray-600 bg-white/50 p-3 rounded-lg border border-brown/10"><span className="flex items-center gap-1"><Calendar className="w-4 h-4"></Calendar> 7月 18日 (六)</span><span className="flex items-center gap-1"><Clock className="w-4 h-4"></Clock> 14:00 - 16:00</span><span className="flex items-center gap-1"><User className="w-4 h-4"></User> 客座嘉賓：Vtuber 殷緋</span></div><div><h4 className="font-bold text-brown mb-2 border-l-4 border-orange-300 pl-2">我們聊什麼：</h4><p className="text-gray-700 leading-relaxed text-justify">
                                    誰說創作一定要很專業？只要覺得好玩，就是最棒的創作！<br/>
                                    大家對創作有熱情嗎？不論是畫畫、寫小說、寫詩，或是裝置藝術，歡迎來到這裡大聊特聊你的創作世界。這次邀請 Vtuber 殷緋，和大家一起輕鬆聊天，分享創作過程中的樂趣與點滴，一起感受創作帶來的單純快樂。
                                </p></div><div className="flex gap-3 pt-2"><a className="btn-warm py-2 px-4 bg-white hover:bg-gray-100 text-sm" href="https://meet.google.com/fzy-kpwu-bcb" target="_blank"><Video className="w-4 h-4 mr-2"></Video> 視訊連結
                                </a><a className="btn-warm py-2 px-4 bg-accent-orange text-brown hover:bg-[#FFB74D] text-sm" href={TODO_LINKS.LINK_8} target="_blank">報名表單</a></div></div></div></div>

<div className="border-t-4 border-dashed border-brown/20 pt-8 mt-12 mb-6">
<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
<div className="space-y-1">
<h3 className="text-2xl font-bold text-gray-500 flex items-center gap-2">
<span className="bg-gray-400 text-white px-2 py-1 rounded text-lg border border-gray-500">歷史</span>
                                    已經完成辦理活動區
                                </h3>
<p className="text-gray-500 font-medium">這些是我們過去美好的回憶！</p>
</div>
</div>

<div className="session-card bg-gray-100 opacity-80">
<div className="session-header" >
<div className="flex items-center gap-3">
<span className="session-tag bg-gray-300 text-gray-500">導航計畫</span>
<span className="font-bold text-gray-500 text-lg">【ADHD 導航計畫】免費公益線上諮詢：諮商心理師鏡子 🌿</span>
</div>
<ChevronDown className="w-5 h-5 text-gray-500 transition-transform duration-300"></ChevronDown>
</div>
<div className="session-content">
<div className="p-6 space-y-4">
<div className="flex flex-wrap gap-4 text-sm font-bold text-gray-600 bg-white/50 p-3 rounded-lg border border-brown/10">
<span className="flex items-center gap-1"><Calendar className="w-4 h-4"></Calendar> 2026年8月3日 (一)</span>
<span className="flex items-center gap-1"><Clock className="w-4 h-4"></Clock> 20:00 - 21:00</span>
<span className="flex items-center gap-1"><User className="w-4 h-4"></User> 大A彥宇 × 諮商心理師宋致靜 (鏡子)</span>
</div>
<div>
<h4 className="font-bold text-gray-500 mb-2 border-l-4 border-accent-pink pl-2">我們聊什麼：</h4>
<p className="text-gray-700 leading-relaxed text-justify">今年，大A彥宇與諮商心理師宋致靜（鏡子）攜手合作，為 ADHD 族群推出專屬的免費公益諮詢服務。如果你覺得生活有些卡關，想釐清自己目前的心理狀態，或正在評估自己是否需要進一步的心理諮商，歡迎預約這項專屬服務，讓心理師陪你走一段內心的漫遊之旅。</p>
</div>
<div className="flex gap-3 pt-2">
<a className="btn-warm py-2 px-4 bg-accent-pink text-gray-500 hover:opacity-80 text-sm" href={TODO_LINKS.LINK_9} target="_blank">報名連結</a>
</div>
</div>
</div>
</div>

<div className="session-card bg-gray-100 opacity-80">
<div className="session-header" >
<div className="flex items-center gap-3">
<span className="session-tag bg-gray-300 text-gray-500">導航計畫</span>
<span className="font-bold text-gray-500 text-lg">【ADHD 導航計畫】免費公益線上諮詢：諮商心理師鏡子 🌿</span>
</div>
<ChevronDown className="w-5 h-5 text-gray-500 transition-transform duration-300"></ChevronDown>
</div>
<div className="session-content">
<div className="p-6 space-y-4">
<div className="flex flex-wrap gap-4 text-sm font-bold text-gray-600 bg-white/50 p-3 rounded-lg border border-brown/10">
<span className="flex items-center gap-1"><Calendar className="w-4 h-4"></Calendar> 2026年7月11日 (一)</span>
<span className="flex items-center gap-1"><Clock className="w-4 h-4"></Clock> 20:00 - 21:00</span>
<span className="flex items-center gap-1"><User className="w-4 h-4"></User> 大A彥宇 × 諮商心理師宋致靜 (鏡子)</span>
</div>
<div>
<h4 className="font-bold text-gray-500 mb-2 border-l-4 border-accent-pink pl-2">我們聊什麼：</h4>
<p className="text-gray-700 leading-relaxed text-justify">今年，大A彥宇與諮商心理師宋致靜（鏡子）攜手合作，為 ADHD 族群推出專屬的免費公益諮詢服務。如果你覺得生活有些卡關，想釐清自己目前的心理狀態，或正在評估自己是否需要進一步的心理諮商，歡迎預約這項專屬服務，讓心理師陪你走一段內心的漫遊之旅。</p>
</div>
<div className="flex gap-3 pt-2">
<a className="btn-warm py-2 px-4 bg-accent-pink text-gray-500 hover:opacity-80 text-sm" href={TODO_LINKS.LINK_10} target="_blank">報名連結</a>
</div>
</div>
</div>
</div>

<div className="session-card bg-gray-100 opacity-80">
<div className="session-header" >
<div className="flex items-center gap-3">
<span className="session-tag bg-gray-300 text-gray-500">導航計畫</span>
<span className="font-bold text-gray-500 text-lg">【ADHD 導航計畫】免費公益線上諮詢：諮商心理師鏡子 🌿</span>
</div>
<ChevronDown className="w-5 h-5 text-gray-500 transition-transform duration-300"></ChevronDown>
</div>
<div className="session-content">
<div className="p-6 space-y-4">
<div className="flex flex-wrap gap-4 text-sm font-bold text-gray-600 bg-white/50 p-3 rounded-lg border border-brown/10">
<span className="flex items-center gap-1"><Calendar className="w-4 h-4"></Calendar> 2026年6月8日 (一)</span>
<span className="flex items-center gap-1"><Clock className="w-4 h-4"></Clock> 20:00 - 21:00</span>
<span className="flex items-center gap-1"><User className="w-4 h-4"></User> 大A彥宇 × 諮商心理師宋致靜 (鏡子)</span>
</div>
<div>
<h4 className="font-bold text-gray-500 mb-2 border-l-4 border-accent-pink pl-2">我們聊什麼：</h4>
<p className="text-gray-700 leading-relaxed text-justify">今年，大A彥宇與諮商心理師宋致靜（鏡子）攜手合作，為 ADHD 族群推出專屬的免費公益諮詢服務。如果你覺得生活有些卡關，想釐清自己目前的心理狀態，或正在評估自己是否需要進一步的心理諮商，歡迎預約這項專屬服務，讓心理師陪你走一段內心的漫遊之旅。</p>
</div>
<div className="flex gap-3 pt-2">
<a className="btn-warm py-2 px-4 bg-accent-pink text-gray-500 hover:opacity-80 text-sm" href={TODO_LINKS.LINK_11} target="_blank">報名連結</a>
</div>
</div>
</div>
</div>

<div className="session-card bg-gray-100 opacity-80">
<div className="session-header" >
<div className="flex items-center gap-3">
<span className="session-tag bg-gray-300 text-gray-500">線上團體</span>
<span className="font-bold text-gray-500 text-lg">【ADHD 成人同儕線上團體】握緊方向盤的自信：行車安全與駕駛經驗</span>
</div>
<ChevronDown className="w-5 h-5 text-gray-500 transition-transform duration-300"></ChevronDown>
</div>
<div className="session-content">
<div className="p-6 space-y-4">
<div className="flex flex-wrap gap-4 text-sm font-bold text-gray-600 bg-white/50 p-3 rounded-lg border border-brown/10">
<span className="flex items-center gap-1"><Calendar className="w-4 h-4"></Calendar> 6月 6日 (六)</span>
<span className="flex items-center gap-1"><Clock className="w-4 h-4"></Clock> 14:00 - 16:00</span>
<span className="flex items-center gap-1"><User className="w-4 h-4"></User> 客座嘉賓：傑夫 (Jeff)</span>
</div>
<div>
<h4 className="font-bold text-gray-500 mb-2 border-l-4 border-green-400 pl-2">我們聊什麼：</h4>
<p className="text-gray-700 leading-relaxed text-justify">
                                            大家喜歡開車嗎？在駕駛的過程中，有沒有什麼獨特的習慣或趣事？<br/>
                                            無論你是享受駕駛樂趣，還是對於上路有些許緊張，都歡迎來交流。本次邀請專業的私人駕訓教練傑夫，他非常懂得如何引導駕駛，大家可以從他身上學到實用的行車安全知識與開車訣竅，讓我們上路更安全、更從容！
                                        </p>
</div>
<div className="flex gap-3 pt-2">
<a className="btn-warm py-2 px-4 bg-white hover:bg-gray-100 text-sm text-gray-500" href="https://meet.google.com/hkv-gudh-tks" target="_blank"><Video className="w-4 h-4 mr-2"></Video> 視訊連結</a>
<a className="btn-warm py-2 px-4 bg-[#A5D6A7] text-gray-500 hover:opacity-80 text-sm" href={TODO_LINKS.LINK_12} target="_blank">報名表單</a>
</div>
</div>
</div>
</div>

<div className="session-card bg-gray-100 opacity-80">
<div className="session-header" >
<div className="flex items-center gap-3">
<span className="session-tag bg-gray-300 text-gray-500">家長諮詢</span>
<span className="font-bold text-gray-500 text-lg">【ADHD 家長諮詢服務】免費公益線上諮詢 (六月場三)</span>
</div>
<ChevronDown className="w-5 h-5 text-gray-500 transition-transform duration-300"></ChevronDown>
</div>
<div className="session-content">
<div className="p-6 space-y-4">
<div className="flex flex-wrap gap-4 text-sm font-bold text-gray-600 bg-white/50 p-3 rounded-lg border border-brown/10">
<span className="flex items-center gap-1"><Calendar className="w-4 h-4"></Calendar> 2026年6月6日 (六)</span>
<span className="flex items-center gap-1"><Clock className="w-4 h-4"></Clock> 11:00 - 12:00</span>
<span className="flex items-center gap-1"><User className="w-4 h-4"></User> 大A彥宇 (前兒少社工)</span>
</div>
<div>
<h4 className="font-bold text-gray-500 mb-2 border-l-4 border-accent-blue pl-2">我們聊什麼：</h4>
<p className="text-gray-700 leading-relaxed text-justify">為了支持在教養路上感到疲憊的家長，我們特別推出專屬的免費公益諮詢服務。由身兼「成人 ADHD（大A）」與「前兒少社會工作者」雙重身分的專業工作者為您解答。我們將根據您的具體議題與需求，彈性邀請相關專業人員或其他大A夥伴共同參與，為您打造最貼近需求、最懂您的專屬對話空間。</p>
</div>
<div className="flex gap-3 pt-2">
<a className="btn-warm py-2 px-4 bg-accent-blue text-gray-500 hover:opacity-80 text-sm" href={TODO_LINKS.LINK_13} target="_blank">報名連結</a>
</div>
</div>
</div>
</div>

<div className="session-card bg-gray-100 opacity-80">
<div className="session-header" >
<div className="flex items-center gap-3">
<span className="session-tag bg-gray-300 text-gray-500">家長諮詢</span>
<span className="font-bold text-gray-500 text-lg">【ADHD 家長諮詢服務】免費公益線上諮詢 (六月場二)</span>
</div>
<ChevronDown className="w-5 h-5 text-gray-500 transition-transform duration-300"></ChevronDown>
</div>
<div className="session-content">
<div className="p-6 space-y-4">
<div className="flex flex-wrap gap-4 text-sm font-bold text-gray-600 bg-white/50 p-3 rounded-lg border border-brown/10">
<span className="flex items-center gap-1"><Calendar className="w-4 h-4"></Calendar> 2026年6月6日 (六)</span>
<span className="flex items-center gap-1"><Clock className="w-4 h-4"></Clock> 10:00 - 11:00</span>
<span className="flex items-center gap-1"><User className="w-4 h-4"></User> 大A彥宇 (前兒少社工)</span>
</div>
<div>
<h4 className="font-bold text-gray-500 mb-2 border-l-4 border-accent-blue pl-2">我們聊什麼：</h4>
<p className="text-gray-700 leading-relaxed text-justify">為了支持在教養路上感到疲憊的家長，我們特別推出專屬的免費公益諮詢服務。由身兼「成人 ADHD（大A）」與「前兒少社會工作者」雙重身分的專業工作者為您解答。我們將根據您的具體議題與需求，彈性邀請相關專業人員或其他大A夥伴共同參與，為您打造最貼近需求、最懂您的專屬對話空間。</p>
</div>
<div className="flex gap-3 pt-2">
<a className="btn-warm py-2 px-4 bg-accent-blue text-gray-500 hover:opacity-80 text-sm" href={TODO_LINKS.LINK_14} target="_blank">報名連結</a>
</div>
</div>
</div>
</div>

<div className="session-card bg-gray-100 opacity-80">
<div className="session-header" >
<div className="flex items-center gap-3">
<span className="session-tag bg-gray-300 text-gray-500">家長諮詢</span>
<span className="font-bold text-gray-500 text-lg">【ADHD 家長諮詢服務】免費公益線上諮詢 (六月場一)</span>
</div>
<ChevronDown className="w-5 h-5 text-gray-500 transition-transform duration-300"></ChevronDown>
</div>
<div className="session-content">
<div className="p-6 space-y-4">
<div className="flex flex-wrap gap-4 text-sm font-bold text-gray-600 bg-white/50 p-3 rounded-lg border border-brown/10">
<span className="flex items-center gap-1"><Calendar className="w-4 h-4"></Calendar> 2026年6月6日 (六)</span>
<span className="flex items-center gap-1"><Clock className="w-4 h-4"></Clock> 09:00 - 10:00</span>
<span className="flex items-center gap-1"><User className="w-4 h-4"></User> 大A彥宇 (前兒少社工)</span>
</div>
<div>
<h4 className="font-bold text-gray-500 mb-2 border-l-4 border-accent-blue pl-2">我們聊什麼：</h4>
<p className="text-gray-700 leading-relaxed text-justify">為了支持在教養路上感到疲憊的家長，我們特別推出專屬的免費公益諮詢服務。由身兼「成人 ADHD（大A）」與「前兒少社會工作者」雙重身分的專業工作者為您解答。我們將根據您的具體議題與需求，彈性邀請相關專業人員或其他大A夥伴共同參與，為您打造最貼近需求、最懂您的專屬對話空間。</p>
</div>
<div className="flex gap-3 pt-2">
<a className="btn-warm py-2 px-4 bg-accent-blue text-gray-500 hover:opacity-80 text-sm" href={TODO_LINKS.LINK_15} target="_blank">報名連結</a>
</div>
</div>
</div>
</div>

<div className="session-card bg-gray-100 opacity-80">
<div className="session-header" >
<div className="flex items-center gap-3">
<span className="session-tag bg-gray-300 text-gray-500">線上團體</span>
<span className="font-bold text-gray-500 text-lg">【ADHD 成人同儕線上團體】尋找心靈的平靜：多元的調適與自我照顧</span>
</div>
<ChevronDown className="w-5 h-5 text-gray-500 transition-transform duration-300"></ChevronDown>
</div>
<div className="session-content">
<div className="p-6 space-y-4">
<div className="flex flex-wrap gap-4 text-sm font-bold text-gray-600 bg-white/50 p-3 rounded-lg border border-brown/10">
<span className="flex items-center gap-1"><Calendar className="w-4 h-4"></Calendar> 5月 23日 (六)</span>
<span className="flex items-center gap-1"><Clock className="w-4 h-4"></Clock> 14:00 - 16:00</span>
<span className="flex items-center gap-1"><User className="w-4 h-4"></User> 客座嘉賓：鏡子 (Mirror)</span>
</div>
<div>
<h4 className="font-bold text-gray-500 mb-2 border-l-4 border-purple-300 pl-2">我們聊什麼：</h4>
<p className="text-gray-700 leading-relaxed text-justify">心情低落或感到壓力時，大家都用什麼方式來陪伴自己？<br/>是尋求專業諮商、冥想運動，還是透過命理占卜來尋求安定的力量？一起來聊聊各種調適心情的方法吧！本次邀請大A夥伴鏡子，她將分享心理自我照顧的技巧，以及成年ADHD在面對憂鬱、焦慮時的調適建議，陪大家找回內心的平衡。</p>
</div>
<div className="flex gap-3 pt-2">
<a className="btn-warm py-2 px-4 bg-white hover:bg-gray-100 text-sm text-gray-500" href="https://meet.google.com/bux-htfd-ief" target="_blank"><Video className="w-4 h-4 mr-2"></Video> 視訊連結</a><a className="btn-warm py-2 px-4 bg-[#E1BEE7] text-gray-500 hover:opacity-80 text-sm" href={TODO_LINKS.LINK_16} target="_blank">報名表單</a>
</div>
</div>
</div>
</div>

<div className="session-card bg-gray-100 opacity-80">
<div className="session-header" >
<div className="flex items-center gap-3">
<span className="session-tag bg-gray-300 text-gray-500">家長諮詢</span>
<span className="font-bold text-gray-500 text-lg">【ADHD 家長諮詢服務】免費公益線上諮詢 (五月場三)</span>
</div>
<ChevronDown className="w-5 h-5 text-gray-500 transition-transform duration-300"></ChevronDown>
</div>
<div className="session-content">
<div className="p-6 space-y-4">
<div className="flex flex-wrap gap-4 text-sm font-bold text-gray-600 bg-white/50 p-3 rounded-lg border border-brown/10">
<span className="flex items-center gap-1"><Calendar className="w-4 h-4"></Calendar> 2026年5月23日 (六)</span>
<span className="flex items-center gap-1"><Clock className="w-4 h-4"></Clock> 11:00 - 12:00</span>
<span className="flex items-center gap-1"><User className="w-4 h-4"></User> 大A彥宇 (前兒少社工)</span>
</div>
<div>
<h4 className="font-bold text-gray-500 mb-2 border-l-4 border-accent-blue pl-2">我們聊什麼：</h4>
<p className="text-gray-700 leading-relaxed text-justify">為了支持在教養路上感到疲憊的家長，我們特別推出專屬的免費公益諮詢服務。由身兼「成人 ADHD（大A）」與「前兒少社會工作者」雙重身分的專業工作者為您解答。我們將根據您的具體議題與需求，彈性邀請相關專業人員或其他大A夥伴共同參與，為您打造最貼近需求、最懂您的專屬對話空間。</p>
</div>
<div className="flex gap-3 pt-2">
<a className="btn-warm py-2 px-4 bg-accent-blue text-gray-500 hover:opacity-80 text-sm" href={TODO_LINKS.LINK_17} target="_blank">報名連結</a>
</div>
</div>
</div>
</div>

<div className="session-card bg-gray-100 opacity-80">
<div className="session-header" >
<div className="flex items-center gap-3">
<span className="session-tag bg-gray-300 text-gray-500">家長諮詢</span>
<span className="font-bold text-gray-500 text-lg">【ADHD 家長諮詢服務】免費公益線上諮詢 (五月場二)</span>
</div>
<ChevronDown className="w-5 h-5 text-gray-500 transition-transform duration-300"></ChevronDown>
</div>
<div className="session-content">
<div className="p-6 space-y-4">
<div className="flex flex-wrap gap-4 text-sm font-bold text-gray-600 bg-white/50 p-3 rounded-lg border border-brown/10">
<span className="flex items-center gap-1"><Calendar className="w-4 h-4"></Calendar> 2026年5月23日 (六)</span>
<span className="flex items-center gap-1"><Clock className="w-4 h-4"></Clock> 10:00 - 11:00</span>
<span className="flex items-center gap-1"><User className="w-4 h-4"></User> 大A彥宇 (前兒少社工)</span>
</div>
<div>
<h4 className="font-bold text-gray-500 mb-2 border-l-4 border-accent-blue pl-2">我們聊什麼：</h4>
<p className="text-gray-700 leading-relaxed text-justify">為了支持在教養路上感到疲憊的家長，我們特別推出專屬的免費公益諮詢服務。由身兼「成人 ADHD（大A）」與「前兒少社會工作者」雙重身分的專業工作者為您解答。我們將根據您的具體議題與需求，彈性邀請相關專業人員或其他大A夥伴共同參與，為您打造最貼近需求、最懂您的專屬對話空間。</p>
</div>
<div className="flex gap-3 pt-2">
<a className="btn-warm py-2 px-4 bg-accent-blue text-gray-500 hover:opacity-80 text-sm" href={TODO_LINKS.LINK_18} target="_blank">報名連結</a>
</div>
</div>
</div>
</div>

<div className="session-card bg-gray-100 opacity-80">
<div className="session-header" >
<div className="flex items-center gap-3">
<span className="session-tag bg-gray-300 text-gray-500">家長諮詢</span>
<span className="font-bold text-gray-500 text-lg">【ADHD 家長諮詢服務】免費公益線上諮詢 (五月場一)</span>
</div>
<ChevronDown className="w-5 h-5 text-gray-500 transition-transform duration-300"></ChevronDown>
</div>
<div className="session-content">
<div className="p-6 space-y-4">
<div className="flex flex-wrap gap-4 text-sm font-bold text-gray-600 bg-white/50 p-3 rounded-lg border border-brown/10">
<span className="flex items-center gap-1"><Calendar className="w-4 h-4"></Calendar> 2026年5月23日 (六)</span>
<span className="flex items-center gap-1"><Clock className="w-4 h-4"></Clock> 09:00 - 10:00</span>
<span className="flex items-center gap-1"><User className="w-4 h-4"></User> 大A彥宇 (前兒少社工)</span>
</div>
<div>
<h4 className="font-bold text-gray-500 mb-2 border-l-4 border-accent-blue pl-2">我們聊什麼：</h4>
<p className="text-gray-700 leading-relaxed text-justify">為了支持在教養路上感到疲憊的家長，我們特別推出專屬的免費公益諮詢服務。由身兼「成人 ADHD（大A）」與「前兒少社會工作者」雙重身分的專業工作者為您解答。我們將根據您的具體議題與需求，彈性邀請相關專業人員或其他大A夥伴共同參與，為您打造最貼近需求、最懂您的專屬對話空間。</p>
</div>
<div className="flex gap-3 pt-2">
<a className="btn-warm py-2 px-4 bg-accent-blue text-gray-500 hover:opacity-80 text-sm" href={TODO_LINKS.LINK_19} target="_blank">報名連結</a>
</div>
</div>
</div>
</div>

<div className="session-card bg-gray-100 opacity-80">
<div className="session-header" >
<div className="flex items-center gap-3">
<span className="session-tag bg-gray-300 text-gray-500">導航計畫</span>
<span className="font-bold text-gray-500 text-lg">【ADHD 導航計畫】免費公益線上諮詢：諮商心理師鏡子 🌿</span>
</div>
<ChevronDown className="w-5 h-5 text-gray-500 transition-transform duration-300"></ChevronDown>
</div>
<div className="session-content">
<div className="p-6 space-y-4">
<div className="flex flex-wrap gap-4 text-sm font-bold text-gray-600 bg-white/50 p-3 rounded-lg border border-brown/10">
<span className="flex items-center gap-1"><Calendar className="w-4 h-4"></Calendar> 2026年5月9日 (六)</span>
<span className="flex items-center gap-1"><Clock className="w-4 h-4"></Clock> 20:00 - 21:00</span>
<span className="flex items-center gap-1"><User className="w-4 h-4"></User> 大A彥宇 × 諮商心理師宋致靜 (鏡子)</span>
</div>
<div>
<h4 className="font-bold text-gray-500 mb-2 border-l-4 border-accent-pink pl-2">我們聊什麼：</h4>
<p className="text-gray-700 leading-relaxed text-justify">今年，大A彥宇與諮商心理師宋致靜（鏡子）攜手合作，為 ADHD 族群推出專屬的免費公益諮詢服務。如果你覺得生活有些卡關，想釐清自己目前的心理狀態，或正在評估自己是否需要進一步的心理諮商，歡迎預約這項專屬服務，讓心理師陪你走一段內心的漫遊之旅。</p>
</div>
<div className="flex gap-3 pt-2">
<a className="btn-warm py-2 px-4 bg-accent-pink text-gray-500 hover:opacity-80 text-sm" href={TODO_LINKS.LINK_20} target="_blank">報名連結</a>
</div>
</div>
</div>
</div>

<div className="session-card bg-gray-100 opacity-80">
<div className="session-header" >
<div className="flex items-center gap-3">
<span className="session-tag bg-gray-300 text-gray-500">線上團體</span>
<span className="font-bold text-gray-500 text-lg">【ADHD 成人同儕線上團體】營養品怎麼選？成為自己的健康管理師</span>
</div>
<ChevronDown className="w-5 h-5 text-gray-500 transition-transform duration-300"></ChevronDown>
</div>
<div className="session-content">
<div className="p-6 space-y-4">
<div className="flex flex-wrap gap-4 text-sm font-bold text-gray-600 bg-white/50 p-3 rounded-lg border border-brown/10">
<span className="flex items-center gap-1"><Calendar className="w-4 h-4"></Calendar> 4月 18日 (六)</span>
<span className="flex items-center gap-1"><Clock className="w-4 h-4"></Clock> 14:00 - 16:00</span>
<span className="flex items-center gap-1"><User className="w-4 h-4"></User> 客座嘉賓：食品「魏」管師</span>
</div>
<div>
<h4 className="font-bold text-gray-500 mb-2 border-l-4 border-accent-blue pl-2">我們聊什麼：</h4>
<p className="text-gray-700 leading-relaxed text-justify">魚油、B群、鋅......面對琳瑯滿目的營養品，大家平常都怎麼選擇與補充呢？<br/>歡迎大家帶著自己手邊的「罐罐」上線展示，分享你的使用經驗或疑問。這次特別邀請具備食品安全與營養專業的「魏」管師參與討論，若你對成分標示或如何攝取有任何好奇，都可以直接請教專家，讓我們吃得更安心、更精準！</p>
</div>
<div className="flex gap-3 pt-2">
<a className="btn-warm py-2 px-4 bg-white hover:bg-gray-100 text-sm text-gray-500" href="https://meet.google.com/kwh-qyhy-ckh" target="_blank"><Video className="w-4 h-4 mr-2"></Video> 視訊連結</a><a className="btn-warm py-2 px-4 bg-accent-blue text-gray-500 hover:opacity-80 text-sm" href={TODO_LINKS.LINK_21} target="_blank">報名表單</a>
</div>
</div>
</div>
</div>

<div className="session-card bg-gray-100 opacity-80">
<div className="session-header" >
<div className="flex items-center gap-3">
<span className="session-tag bg-gray-300 text-gray-500">家長諮詢</span>
<span className="font-bold text-gray-500 text-lg">【ADHD 家長諮詢服務】免費公益線上諮詢 (四月場二)</span>
</div>
<ChevronDown className="w-5 h-5 text-gray-500 transition-transform duration-300"></ChevronDown>
</div>
<div className="session-content">
<div className="p-6 space-y-4">
<div className="flex flex-wrap gap-4 text-sm font-bold text-gray-600 bg-white/50 p-3 rounded-lg border border-brown/10">
<span className="flex items-center gap-1"><Calendar className="w-4 h-4"></Calendar> 2026年4月18日 (六)</span>
<span className="flex items-center gap-1"><Clock className="w-4 h-4"></Clock> 11:00 - 12:00</span>
<span className="flex items-center gap-1"><User className="w-4 h-4"></User> 大A彥宇 (前兒少社工)</span>
</div>
<div>
<h4 className="font-bold text-gray-500 mb-2 border-l-4 border-accent-blue pl-2">我們聊什麼：</h4>
<p className="text-gray-700 leading-relaxed text-justify">為了支持在教養路上感到疲憊的家長，我們特別推出專屬的免費公益諮詢服務。由身兼「成人 ADHD（大A）」與「前兒少社會工作者」雙重身分的專業工作者為您解答。我們將根據您的具體議題與需求，彈性邀請相關專業人員或其他大A夥伴共同參與，為您打造最貼近需求、最懂您的專屬對話空間。</p>
</div>
<div className="flex gap-3 pt-2">
<a className="btn-warm py-2 px-4 bg-accent-blue text-gray-500 hover:opacity-80 text-sm" href={TODO_LINKS.LINK_22} target="_blank">報名連結</a>
</div>
</div>
</div>
</div>

<div className="session-card bg-gray-100 opacity-80">
<div className="session-header" >
<div className="flex items-center gap-3">
<span className="session-tag bg-gray-300 text-gray-500">家長諮詢</span>
<span className="font-bold text-gray-500 text-lg">【ADHD 家長諮詢服務】免費公益線上諮詢 (四月場一)</span>
</div>
<ChevronDown className="w-5 h-5 text-gray-500 transition-transform duration-300"></ChevronDown>
</div>
<div className="session-content">
<div className="p-6 space-y-4">
<div className="flex flex-wrap gap-4 text-sm font-bold text-gray-600 bg-white/50 p-3 rounded-lg border border-brown/10">
<span className="flex items-center gap-1"><Calendar className="w-4 h-4"></Calendar> 2026年4月18日 (六)</span>
<span className="flex items-center gap-1"><Clock className="w-4 h-4"></Clock> 10:00 - 11:00</span>
<span className="flex items-center gap-1"><User className="w-4 h-4"></User> 大A彥宇 (前兒少社工)</span>
</div>
<div>
<h4 className="font-bold text-gray-500 mb-2 border-l-4 border-accent-blue pl-2">我們聊什麼：</h4>
<p className="text-gray-700 leading-relaxed text-justify">為了支持在教養路上感到疲憊的家長，我們特別推出專屬的免費公益諮詢服務。由身兼「成人 ADHD（大A）」與「前兒少社會工作者」雙重身分的專業工作者為您解答。我們將根據您的具體議題與需求，彈性邀請相關專業人員或其他大A夥伴共同參與，為您打造最貼近需求、最懂您的專屬對話空間。</p>
</div>
<div className="flex gap-3 pt-2">
<a className="btn-warm py-2 px-4 bg-accent-blue text-gray-500 hover:opacity-80 text-sm" href={TODO_LINKS.LINK_23} target="_blank">報名連結</a>
</div>
</div>
</div>
</div>
<div className="session-card bg-gray-100 opacity-80"><div className="session-header" ><div className="flex items-center gap-3"><span className="session-tag bg-gray-300 text-gray-500">線上團體</span><span className="font-bold text-gray-500 text-lg">【ADHD 成人同儕線上團體】聊聊理財這件事：從經驗分享到專業建議</span></div><ChevronDown className="w-5 h-5 text-gray-500 transition-transform duration-300"></ChevronDown></div><div className="session-content"><div className="p-6 space-y-4"><div className="flex flex-wrap gap-4 text-sm font-bold text-gray-600 bg-white/50 p-3 rounded-lg border border-brown/10"><span className="flex items-center gap-1"><Calendar className="w-4 h-4"></Calendar> 3月 14日 (六)</span><span className="flex items-center gap-1"><Clock className="w-4 h-4"></Clock> 14:00 - 16:00</span><span className="flex items-center gap-1"><User className="w-4 h-4"></User> 客座嘉賓：博那 (Bona)</span></div><div><h4 className="font-bold text-gray-500 mb-2 border-l-4 border-accent-orange pl-2">我們聊什麼：</h4><p className="text-gray-700 leading-relaxed text-justify">
                                    大家對於管理財務有什麼獨特的心得嗎？或是曾在理財路上遇過什麼難忘的經驗？<br/>
                                    這次讓我們輕鬆聚在一起，分享彼此的理財故事。不管是你發現的好方法，或是希望能改進的地方，都歡迎提出來交流。我們邀請了好朋友博那，除了聽聽大家的故事，若有需要，她也能提供專業的理財觀點與建議喔！
                                </p></div><div className="flex gap-3 pt-2"><a className="btn-warm py-2 px-4 bg-white hover:bg-gray-100 text-sm" href="https://meet.google.com/mvz-zyww-sgp" target="_blank"><Video className="w-4 h-4 mr-2"></Video> 視訊連結
                                </a><a className="btn-warm py-2 px-4 bg-accent-orange text-gray-500 hover:bg-[#FFD180] text-sm" href={TODO_LINKS.LINK_24} target="_blank">報名表單</a></div></div></div></div>
</div>
<div className="relative flex items-center py-8"><div className="flex-grow border-t-2 border-dashed border-brown/30"></div><span className="flex-shrink-0 mx-4 text-gray-500 font-bold bg-[#FFFDE7] px-2">籌備中與即將推出</span><div className="flex-grow border-t-2 border-dashed border-brown/30"></div></div><div className="construction-card"><div className="construction-badge"><MapPin className="w-3 h-3"></MapPin> 場地確認中
                    </div><div className="flex items-start gap-4"><div className="w-12 h-12 bg-[#FFCCBC] rounded-full flex items-center justify-center border-2 border-brown flex-shrink-0"><Users className="w-6 h-6 text-brown"></Users></div><div className="flex-grow"><h3 className="text-xl font-bold text-brown mb-3">成人ADHD實體活動 <span className="text-sm font-normal text-gray-500">(預計兩場)</span></h3><div className="space-y-4"><div className="bg-white p-3 rounded-lg border border-brown/10"><h4 className="font-bold text-brown mb-1">🐣 新手大A場</h4><p className="text-gray-600 text-xs leading-relaxed">
                                        你是近年來診斷ADHD的大A嗎？是否有很多疑問或是徬徨，嘿！我們有一群「老」A也走過很多挫折，累積了一些經驗。歡迎來報名大A新手場，讓我們老手帶新手，一起成為A咖！
                                        <br/><span className="text-[#FF9E80] font-bold">欸！資深大A也別走啊，一起來啦~</span></p></div><div className="bg-white p-3 rounded-lg border border-brown/10"><h4 className="font-bold text-brown mb-1">🎭 大A實驗室-一人一故事劇場演出過動人生</h4><p className="text-gray-600 text-xs leading-relaxed">
                                        目前正在跟團隊接洽與商議費用，並尋找經濟支持，盡量以不收費為前提，找到贊助者或是單位輔助，時間地點正在喬定中。
                                    </p></div></div></div></div></div><div className="construction-card"><div className="construction-badge"><CalendarClock className="w-3 h-3"></CalendarClock> 預計11月
                    </div><div className="flex items-start gap-4"><div className="w-12 h-12 bg-[#C5E1A5] rounded-full flex items-center justify-center border-2 border-brown flex-shrink-0"><BookOpen className="w-6 h-6 text-brown"></BookOpen></div><div><h3 className="text-xl font-bold text-brown mb-2">家長向-親職教育講座</h3><p className="text-gray-600 text-sm leading-relaxed">
                                預計11月會有一場，地點待訂。
                            </p></div></div></div></div></section></div><div className="bg-[#F0FDF4] border-t border-line-green/20 py-16 mt-20" id="line-contact"><div className="max-w-3xl mx-auto px-4 flex flex-col items-center text-center gap-6"><h4 className="text-3xl font-black text-brown mb-2">加入官方 LINE</h4><p className="text-brown/80 mb-4 text-lg">取得最新活動資訊、連結以及即時提醒！<br/>不錯過任何一場聚會。</p><a className="btn-warm py-4 px-12 bg-line-green text-white hover:opacity-90 shadow-warm border-transparent text-xl w-full md:w-auto" href="https://line.me/R/ti/p/@823pawtr?oat_content=url&amp;ts=06051740" target="_blank"><MessageCircle className="w-6 h-6 mr-2"></MessageCircle> 立即加入好友
            </a></div></div><div className="bg-gray-100 border-t border-gray-200 py-6" id="donate"><div className="max-w-2xl mx-auto px-4 text-center"><h4 className="text-sm font-bold text-gray-500 mb-1">支持我的行動</h4><p className="text-[10px] text-gray-400 mb-3 leading-tight">服務均為無償進行。若認同理念，歡迎小額贊助維持營運。<br/>(不論是否打賞，都歡迎來信打氣！)</p><div className="inline-block text-left text-xs"><div className="flex items-center justify-center gap-2 text-gray-500"><span>005 土地銀行</span><span className="font-mono">016-212-34037-9</span><button className="text-[10px] bg-gray-200 hover:bg-gray-300 text-gray-600 py-1 px-2 rounded transition-colors flex items-center gap-1" id="copyButton"><Copy className="w-3 h-3"></Copy> 複製
                    </button></div></div><div className="text-[10px] text-green-500 font-bold mt-1 hidden" id="copyMessage">✓ 已複製</div><div className="flex justify-center gap-4 mt-4 text-[10px] text-gray-400"><a className="hover:text-gray-500 flex items-center gap-1" href="mailto:jin40225@gmail.com"><Mail className="w-3 h-3"></Mail> Email</a><span>© 2026 大A彥宇</span></div></div></div>
    </div>
  );
}
