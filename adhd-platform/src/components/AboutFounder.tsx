/**
 * 「關於發起人彥宇」區塊。
 *
 * 內容逐字取自 PeerGroupPage／ParentConsultPage／NavigatorConsultPage——那三頁各有
 * 一份結構完全相同的拷貝（差別只在各自檔案裡的 LINKS 常數命名不同，指向的是同樣
 * 三個網址）。專案已知病灶「改一頁忘了 grep 全站同款拷貝」已重演五次。
 *
 * **本次只讓新頁面用它，既有三頁不動**：新增兩個公開板塊時本來要再複製兩份，抽出來
 * 就不會有第 5、6 份；而改寫既有三頁屬於本次任務範圍外的重構，使用者的指定是
 * 「最小變動整個網站系統」，所以既有拷貝留待另案處理。
 */
import { ArrowUpRight, PlayCircle, Sparkles } from 'lucide-react';

const NEWS_URL = 'https://www.knews.com.tw/news/01CEE23784ECF429098274743517F227';
const VIDEO_PARENTS_URL = 'https://www.youtube.com/watch?v=q1UL5Kn51gc';
const VIDEO_SOCIAL_URL = 'https://www.youtube.com/watch?v=CsHqUIdz0W4';

export function AboutFounder() {
  return (
    <section className="max-w-4xl mx-auto px-4 mt-20 mb-12">
      <div className="bg-cream border-2 border-brown rounded-3xl p-6 md:p-10 shadow-warm relative">
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white border-2 border-brown px-8 py-2 rounded-full font-black shadow-sm text-[#006064] text-xl transform -rotate-2">
          關於發起人彥宇
        </div>
        <div className="space-y-8 mt-4">
          <div className="bg-white/70 p-6 md:p-8 rounded-2xl border-2 border-brown/10 backdrop-blur-sm shadow-sm">
            <div className="font-body text-brown leading-relaxed font-medium text-justify text-lg space-y-4">
              <p>我從小學三年級就診斷ADHD，一路跌跌撞撞成長到大。</p>
              <p>現在是社會工作者-身心障礙者服務中心 社工督導，同時也是受到社團法人台灣赤子心過動症協會總會鼓勵、栽培的倡議工作者。</p>
              <p className="text-xl font-bold text-[#006064] py-1">我希望可以幫助更多像我一樣的人！</p>
              <p>除了本職工作外，我利用下班時間及假日，正在創建各項服務。我相信 <span className="marker-highlight font-bold">從無到有本身就有價值</span>。希望能讓更多的 ADHD 家長、孩童、大A夥伴因此受益。</p>
              <div className="bg-[#FFF9C4]/60 p-4 rounded-xl border border-brown/10 mt-4 text-brown">
                以下是我的實踐，希望可以一路前行，替ADHD族群建構更多資源，獲得更好的環境與生活品質。<br /><span className="font-bold text-highlight mt-2 block">也衷心希望像我一樣的孩子，可以過得比我更好，這是我的初衷與祈願。</span>
              </div>
            </div>
          </div>
          <div className="bg-white/50 p-6 md:p-8 rounded-2xl border-2 border-brown/10 backdrop-blur-sm">
            <h3 className="font-heading text-xl font-bold text-brown mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent-orange" /> 更進一步認識我
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <a className="bg-white p-4 rounded-xl border-2 border-brown/20 hover:border-accent-teal hover:shadow-md transition-all group flex flex-col" href={NEWS_URL} target="_blank" rel="noopener noreferrer">
                <div className="flex justify-between items-start mb-2">
                  <span className="bg-[#B2EBF2] text-[#006064] text-xs font-bold px-2 py-1 rounded">新聞報導</span>
                  <ArrowUpRight className="w-4 h-4 text-brown group-hover:text-[#006064]" />
                </div>
                <div className="font-bold text-brown group-hover:text-[#006064]">ADHD長大成助人者</div>
              </a>
              <div className="space-y-3">
                <a className="flex items-center justify-between bg-white p-3 rounded-xl border-2 border-brown/20 hover:border-accent-pink hover:shadow-md transition-all group" href={VIDEO_PARENTS_URL} target="_blank" rel="noopener noreferrer">
                  <span className="text-sm font-bold text-brown">友善 ADHD 父母的環境</span>
                  <PlayCircle className="w-5 h-5 text-brown group-hover:text-[#C2185B]" />
                </a>
                <a className="flex items-center justify-between bg-white p-3 rounded-xl border-2 border-brown/20 hover:border-accent-pink hover:shadow-md transition-all group" href={VIDEO_SOCIAL_URL} target="_blank" rel="noopener noreferrer">
                  <span className="text-sm font-bold text-brown">跟人相處這麼難嗎？</span>
                  <PlayCircle className="w-5 h-5 text-brown group-hover:text-[#C2185B]" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
