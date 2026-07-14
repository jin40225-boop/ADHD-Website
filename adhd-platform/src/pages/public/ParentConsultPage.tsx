import { Link } from 'react-router-dom';
import { ArrowUpRight, Clock, Copy, Edit3, Info, Mail, MessageCircle, PlayCircle, Sparkles } from 'lucide-react';

const BASE = import.meta.env.BASE_URL;
const TODO_LINKS = {
  LINK_1: `${BASE}parent/register`,
  LINK_2: 'https://www.knews.com.tw/news/01CEE23784ECF429098274743517F227',
  LINK_3: 'https://mountain-sail-ee8.notion.site/ADHD-2098b8084dad807d8c50f4d5c4221ace',
  LINK_4: 'https://mountain-sail-ee8.notion.site/2098b8084dad8089b914ef5f29bd3fea',
};

export default function ParentConsultPage() {
  return (
    <div className="min-h-screen bg-[#FFFDF5] text-[#5D4037] font-body">
      <svg className="hidden" height="0" width="0"><filter id="hand-drawn"><feTurbulence baseFrequency="0.01" numOctaves="3" result="noise" type="fractalNoise"></feTurbulence><feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap></filter></svg><header className="hero-section pt-10 px-4 mb-16" id="about"><div className="absolute top-20 right-[-50px] w-96 h-96 opacity-40 animate-blob pointer-events-none"><svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><path d="M44.7,-76.4C58.9,-69.2,71.8,-59,79.6,-45.3C87.4,-31.7,90.2,-14.8,88.2,0.8C86.2,16.5,79.4,30.9,70.1,43.1C60.8,55.3,49,65.3,35.5,72.5C22,79.7,6.7,84.1,-8.9,83.9C-24.5,83.7,-40.4,78.9,-53.2,69.7C-66,60.5,-75.7,46.9,-81.3,31.8C-86.9,16.7,-88.4,0,-85.2,-15.2C-82,-30.4,-74.1,-44.1,-62.8,-52.9C-51.5,-61.7,-36.8,-65.7,-23.4,-73.1C-10,-80.5,2.1,-91.3,16.1,-90.8C30.1,-90.3,46,-83.5,44.7,-76.4Z" fill="#FFD6BA" transform="translate(100 100)"></path></svg></div><div className="max-w-4xl mx-auto flex flex-col items-center relative z-10"><div className="w-full space-y-8"><div className="text-center md:text-left"><div className="inline-block bg-white border-2 border-[#5D4037] px-4 py-1 rounded-full text-sm font-bold shadow-comic transform -rotate-1 text-accent-teal mb-4">
                        ✨ 專屬單項服務介紹
                    </div><h1 className="font-heading text-4xl md:text-5xl font-black leading-tight text-[#5D4037]">【ADHD 家長諮詢服務】免費公益線上諮詢：前兒少社工陪你找出教養新解方 🌿</h1></div>
<div className="bg-white/70 p-6 md:p-8 rounded-2xl border-2 border-[#5D4037]/10 backdrop-blur-sm shadow-sm mt-8">
<div className="font-body text-[#5D4037] text-lg space-y-4">
<p className="leading-relaxed text-lg font-medium text-justify">
                        在陪伴 ADHD 孩子的路上，您是否時常感到心力交瘁，覺得沒有人懂您的無力感？<br/>
                        或您想問問「服藥是什麼感覺？」、「為什麼要這樣做？」這些問題我想長大後的成年ADHD可以回答！<br/><br/>
                        為了支持在教養路上感到疲憊的家長，我們特別推出專屬的免費公益諮詢服務。由身兼「成人 ADHD（大A）」與「前兒少社會工作者」雙重身分的專業工作者為您解答。<br/>
                        我們將根據您的具體議題與需求，彈性邀請相關專業人員或其他大A夥伴共同參與，為您打造最貼近需求、最懂您的專屬對話空間。
                    </p>
<div className="text-center mt-2 py-2">
<span className="inline-block bg-[#FFF9C4] px-4 py-2 rounded-full font-black text-lg border border-[#5D4037] shadow-sm text-[#D84315] transform rotate-1">
                            ✨ 彥宇不是樣樣都懂，但大A臥虎藏龍！我會盡力回應前來的家長 ✨
                        </span>
</div>
</div>
</div>
</div>
</div>
</header><div className="max-w-4xl mx-auto px-4 mb-12"><Link to="/parent/register" className="btn-warm w-full py-4 bg-[#FFEC8B] text-[#5D4037] text-xl font-black flex items-center justify-center gap-2 border-2 border-[#5D4037] shadow-comic">🖊️ 站內報名（額滿即時顯示）</Link></div><div className="max-w-6xl mx-auto px-4 space-y-20"><section id="groups">

<div className="bg-white border-2 border-[#5D4037] rounded-3xl p-6 md:p-10 mb-10 relative shadow-[8px_8px_0_rgba(93,64,55,0.15)] flex flex-col gap-8">
<div className="space-y-4 text-[#5D4037]">
</div>
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
<div className="bg-blue-50 border-l-8 border-accent-blue p-6 rounded-r-2xl">
<h4 className="font-bold text-[#5D4037] text-xl mb-3 flex items-center gap-2">
<Info className="w-6 h-6"></Info> 服務資訊
                        </h4>
<ul className="text-[#5D4037] space-y-2 font-bold list-disc list-inside text-sm">
<li><strong>專屬團隊：</strong> 成人 ADHD / 前兒少社工（視需求邀請夥伴加入）</li>
<li><strong>服務內容：</strong> 單次免費公益線上諮詢（Google Meet）</li>
<li><strong>適合對象：</strong> 渴望理解孩子、需教養策略或喘息支持的家長</li>
<li><strong>請填寫表單：</strong> 讓我們可以提前了解孩子狀況。</li>
</ul>
</div>
<div className="bg-green-50 border-l-8 border-line-green p-6 rounded-r-2xl">
<h4 className="font-bold text-[#5D4037] text-xl mb-3 flex items-center gap-2">
<Clock className="w-6 h-6"></Clock> 上半年度開放場次
                        </h4>
<p className="text-xs font-bold text-[#5D4037] mb-2">每月限定２個名額，報名截止時間為該場次活動前一週的晚上 12 點。</p>
<ul className="text-[#5D4037] space-y-2 font-bold text-sm">
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
<div className="bg-[#E0F7FA] border-2 border-[#5D4037] p-6 rounded-2xl">
<h4 className="font-bold text-[#006064] text-xl mb-3 flex items-center gap-2">
<Edit3 className="w-6 h-6"></Edit3> 報名三步驟與重要規則
                    </h4>
<ul className="text-[#006064] space-y-2 font-bold list-decimal list-inside text-lg">
<li><strong>填寫表單：</strong> 請於各場次截止期限前完成，逾期視為無效。</li>
<li><strong>需求評估：</strong> 收到表單後，檢視議題並媒合合適的大A夥伴。</li>
<li><strong>收取信件：</strong> 無論是否安排成功，都會寄發 Email 通知。</li>
</ul>
<div className="mt-4 p-3 bg-white border border-[#5D4037] text-red-600 font-bold rounded text-sm">
                        ⚠️ 【重要提醒：這樣才算報名成功！】<br/>送出表單不等於預約成功！只有當您收到「確認邀約成功通知信」時，才算正式完成預約。若未能為您安排，您也會收到婉拒或候補通知。
                    </div>
</div>
<div className="mt-2 w-full">
<a className="btn-warm py-5 px-6 bg-accent-blue text-[#5D4037] w-full text-2xl md:text-3xl shadow-comic animate-pulse-slow flex flex-col items-center justify-center border-4 border-[#5D4037]" href={TODO_LINKS.LINK_1} target="_blank">
<span>📝 前往填寫報名表</span>
<span className="text-base font-bold mt-2 opacity-80 bg-white/40 px-3 py-1 rounded-full border border-[#5D4037]/20">報名連結</span>
</a>
</div>
</div>
</section></div>

<section className="max-w-4xl mx-auto px-4 mt-20 mb-12">
<div className="bg-[#FFFDF5] border-2 border-[#5D4037] rounded-3xl p-6 md:p-10 shadow-comic relative">
<div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white border-2 border-[#5D4037] px-8 py-2 rounded-full font-black shadow-sm text-accent-teal text-xl transform -rotate-2">
            關於發起人彥宇
        </div>
<div className="space-y-8 mt-4">
<div className="bg-white/70 p-6 md:p-8 rounded-2xl border-2 border-[#5D4037]/10 backdrop-blur-sm shadow-sm"><div className="font-body text-[#5D4037] leading-relaxed font-medium text-justify text-lg space-y-4"><p>我從小學三年級就診斷ADHD，一路跌跌撞撞成長到大。</p><p>現在是社會工作者-身心障礙者服務中心 社工督導，同時也是受到社團法人台灣赤子心過動症協會總會鼓勵、栽培的倡議工作者。</p><p className="text-xl font-bold text-accent-teal py-1">我希望可以幫助更多像我一樣的人！</p><p>除了本職工作外，我利用下班時間及假日，正在創建各項服務。我相信 <span className="marker-highlight font-bold">從無到有本身就有價值</span>。希望能讓更多的 ADHD 家長、孩童、大A夥伴因此受益。</p><div className="bg-[#FFF9C4]/60 p-4 rounded-xl border border-[#5D4037]/10 mt-4 text-[#5D4037]">
                            以下是我的實踐，希望可以一路前行，替ADHD族群建構更多資源，獲得更好的環境與生活品質。<br/><span className="font-bold text-[#D84315] mt-2 block">也衷心希望像我一樣的孩子，可以過得比我更好，這是我的初衷與祈願。</span></div></div></div><div className="bg-white/50 p-6 md:p-8 rounded-2xl border-2 border-[#5D4037]/10 backdrop-blur-sm"><h3 className="font-heading text-xl font-bold text-[#5D4037] mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5 text-accent-orange"></Sparkles> 更進一步認識我
                    </h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><a className="bg-white p-4 rounded-xl border-2 border-[#5D4037]/20 hover:border-accent-teal hover:shadow-md transition-all group flex flex-col" href={TODO_LINKS.LINK_2} target="_blank"><div className="flex justify-between items-start mb-2"><span className="bg-[#B2EBF2] text-[#006064] text-xs font-bold px-2 py-1 rounded">新聞報導</span><ArrowUpRight className="w-4 h-4 text-[#5D4037] group-hover:text-accent-teal"></ArrowUpRight></div><div className="font-bold text-[#5D4037] group-hover:text-accent-teal">ADHD長大成助人者</div></a><div className="space-y-3"><a className="flex items-center justify-between bg-white p-3 rounded-xl border-2 border-[#5D4037]/20 hover:border-accent-pink hover:shadow-md transition-all group" href={TODO_LINKS.LINK_3} target="_blank"><span className="text-sm font-bold text-[#5D4037]">友善 ADHD 父母的環境</span><PlayCircle className="w-5 h-5 text-[#5D4037] group-hover:text-accent-pink"></PlayCircle></a><a className="flex items-center justify-between bg-white p-3 rounded-xl border-2 border-[#5D4037]/20 hover:border-accent-pink hover:shadow-md transition-all group" href={TODO_LINKS.LINK_4} target="_blank"><span className="text-sm font-bold text-[#5D4037]">跟人相處這麼難嗎？</span><PlayCircle className="w-5 h-5 text-[#5D4037] group-hover:text-accent-pink"></PlayCircle></a></div></div></div>
</div>
</div>
</section>
<div className="bg-[#F0FDF4] border-t border-[#06C755]/20 py-16 mt-20" id="line-contact"><div className="max-w-3xl mx-auto px-4 flex flex-col items-center text-center gap-6"><h4 className="text-3xl font-black text-[#5D4037] mb-2">加入官方 LINE</h4><p className="text-[#5D4037]/80 mb-4 text-lg">取得最新活動資訊、連結以及即時提醒！<br/>不錯過任何一場聚會。</p><a className="btn-warm py-4 px-12 bg-[#06C755] text-white hover:opacity-90 shadow-comic border-transparent text-xl w-full md:w-auto" href="https://line.me/R/ti/p/@823pawtr?oat_content=url&amp;ts=06051740" target="_blank"><MessageCircle className="w-6 h-6 mr-2"></MessageCircle> 立即加入好友
            </a></div></div><div className="bg-gray-100 border-t border-gray-200 py-6" id="donate"><div className="max-w-2xl mx-auto px-4 text-center"><h4 className="text-sm font-bold text-gray-500 mb-1">支持我的行動</h4><p className="text-[10px] text-gray-400 mb-3 leading-tight">服務均為無償進行。若認同理念，歡迎小額贊助維持營運。<br/>(不論是否打賞，都歡迎來信打氣！)</p><div className="inline-block text-left text-xs"><div className="flex items-center justify-center gap-2 text-gray-500"><span>005 土地銀行</span><span className="font-mono">016-212-34037-9</span><button className="text-[10px] bg-gray-200 hover:bg-gray-300 text-gray-600 py-1 px-2 rounded transition-colors flex items-center gap-1" id="copyButton"><Copy className="w-3 h-3"></Copy> 複製
                    </button></div></div><div className="text-[10px] text-green-500 font-bold mt-1 hidden" id="copyMessage">✓ 已複製</div><div className="flex justify-center gap-4 mt-4 text-[10px] text-gray-400"><a className="hover:text-gray-500 flex items-center gap-1" href="mailto:jin40225@gmail.com"><Mail className="w-3 h-3"></Mail> Email</a><span>© 2026 大A彥宇</span></div></div></div>
    </div>
  );
}
