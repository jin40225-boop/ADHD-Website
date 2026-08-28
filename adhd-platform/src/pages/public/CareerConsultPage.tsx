/**
 * 成人職場及生活適應專業諮詢。
 *
 * 版面仿照家長諮詢頁；場次做法沿用家長諮詢（同一天多個時段、各自名額，報名者直接
 * 勾時段），報名表與審核流程沿用導航計畫（**成人自己填，不問孩子資料**）——這是
 * 使用者 2026-08-10 的裁決。
 *
 * 場次日期與報名期限刻意不寫在這裡：`scripts/check-admin-operations.mjs` 把寫死的
 * 場次表字樣列為禁用，立法理由是「寫死的場次表會悄悄過期，而且同一份常被複製到多個
 * 頁面」。場次一律由 UpcomingSessions 讀 sessions_public，確切的報名期限由報名頁從
 * registration_deadline 讀出來顯示。
 */
import { Link } from 'react-router-dom';
import { Clock, Edit3, Info } from 'lucide-react';
import { UpcomingSessions } from '@/components/UpcomingSessions';
import { SessionHistory } from '@/components/SessionHistory';
import { AboutFounder } from '@/components/AboutFounder';
import { RegisterCta } from '@/components/RegisterCta';
import { DonateFooter } from '@/components/DonateFooter';
import { LineContact } from '@/components/LineContact';
import { ActivityCarousel } from '@/components/ActivityCarousel';

export default function CareerConsultPage() {
  return (
    <div className="min-h-screen bg-cream text-brown font-body">
      {/* 海報放在最上面：從社群連過來的人是先看到海報才點進來的，第一眼要對得上。 */}
      <ActivityCarousel page="career" />
      <header className="hero-section pt-10 mb-16" id="about">
        <div className="absolute top-20 right-[-50px] w-96 h-96 opacity-40 animate-blob pointer-events-none">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><path d="M44.7,-76.4C58.9,-69.2,71.8,-59,79.6,-45.3C87.4,-31.7,90.2,-14.8,88.2,0.8C86.2,16.5,79.4,30.9,70.1,43.1C60.8,55.3,49,65.3,35.5,72.5C22,79.7,6.7,84.1,-8.9,83.9C-24.5,83.7,-40.4,78.9,-53.2,69.7C-66,60.5,-75.7,46.9,-81.3,31.8C-86.9,16.7,-88.4,0,-85.2,-15.2C-82,-30.4,-74.1,-44.1,-62.8,-52.9C-51.5,-61.7,-36.8,-65.7,-23.4,-73.1C-10,-80.5,2.1,-91.3,16.1,-90.8C30.1,-90.3,46,-83.5,44.7,-76.4Z" fill="#FFD6BA" transform="translate(100 100)"></path></svg>
        </div>
        <div className="max-w-4xl mx-auto px-4 flex flex-col items-center relative z-10">
          <div className="w-full space-y-8">
            <div className="text-center md:text-left">
              <div className="inline-block bg-white border-2 border-brown px-4 py-1 rounded-full text-sm font-bold shadow-warm transform -rotate-1 text-[#006064] mb-4">
                ✨ 專屬單項服務介紹
              </div>
              <h1 className="font-heading text-4xl md:text-5xl font-black leading-tight text-brown">
                【成人職場及生活適應專業諮詢】免費公益線上諮詢：把卡住的地方，一起拆成可以開始的步驟 🌿
              </h1>
            </div>
            <div className="bg-white/70 p-6 md:p-8 rounded-2xl border-2 border-brown/10 backdrop-blur-sm shadow-sm mt-8">
              <div className="font-body text-brown text-lg space-y-4">
                <p className="leading-relaxed text-lg font-medium text-justify">
                  成人 ADHD 夥伴在整體的智力、工作知能與功能上，往往與一般人無異，甚至在許多領域展現出極高天賦。<br /><br />
                  然而，常常會在特定情境卡住——<strong>高度行政事務的處理、生活作息的轉換、個人生活與時間結構的建立</strong>。這種「局部障礙」與「整體優秀能力」之間的不對稱，極易被外人誤解為「不夠認真」、「找藉口」或「態度消極」。<br /><br />
                  這種無法被理解的處境，常迫使人陷入焦慮、強烈自我懷疑，並在持續的挫敗中退縮至負面循環。<br /><br />
                  這項服務就是為了回應這個缺口：由專業夥伴陪你討論當前的職場或生活適應困擾，一起建立「結構化」的策略，引導你跨越特定情境的關卡，<strong>找到可以立刻開始嘗試的方向</strong>。
                </p>
                <div className="text-center mt-2 py-2">
                  <span className="inline-block bg-[#FFF9C4] px-4 py-2 rounded-full font-black text-lg border border-brown shadow-sm text-highlight transform rotate-1">
                    ✨ 不是要你更努力，是幫你把結構搭起來 ✨
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 mb-12">
        <Link to="/career/register" className="btn-warm w-full py-4 bg-base-yellow text-brown text-xl font-black flex items-center justify-center gap-2 border-2 border-brown shadow-warm">
          🖊️ 站內報名（額滿即時顯示）
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-4 space-y-20">
        <section id="groups">
          <div className="bg-white border-2 border-brown rounded-3xl p-6 md:p-10 mb-10 relative shadow-[8px_8px_0_rgba(93,64,55,0.15)] flex flex-col gap-8">
            <div className="grid grid-cols-1 gap-6">
              <div className="bg-blue-50 border-l-8 border-accent-blue p-6 rounded-r-2xl">
                <h4 className="font-bold text-brown text-xl mb-3 flex items-center gap-2">
                  <Info className="w-6 h-6" /> 服務資訊
                </h4>
                <ul className="text-brown space-y-2 font-bold list-disc list-inside text-sm">
                  <li><strong>專屬團隊：</strong> 大A社工督導 彥宇 × 諮商心理師 宋致靜（鏡子） × 職能治療師 況況</li>
                  <li><strong>服務內容：</strong> 單次一小時免費公益線上諮詢（Google Meet 進行，多對一）</li>
                  <li><strong>服務頻率：</strong> 每兩個月辦理一次，固定雙月場次</li>
                  <li><strong>場次時段：</strong> 每場開放數個 1 小時時段，每個時段 1 位</li>
                  <li><strong>適合對象：</strong> 在職場或生活適應上有<strong>特定情境</strong>卡關、想建立可執行結構的成人 ADHD 夥伴</li>
                  <li><strong>諮詢目標：</strong> 聚焦單次性討論當前困擾，一起建立結構化策略，提供可立即開始嘗試的方向</li>
                </ul>
              </div>

              <div className="bg-[#FFF9C4] border-l-8 border-accent-orange p-6 rounded-r-2xl">
                <h4 className="font-bold text-brown text-xl mb-3 flex items-center gap-2">
                  <Clock className="w-6 h-6" /> 開放報名場次
                </h4>
                <p className="text-xs font-bold text-brown mb-2">
                  每兩個月一場，每個時段最後會安排 1 位。<strong>同一個時段可以多人報名</strong>——我們會從報名的人之中評估後安排，所以看到時段還開著就可以報，不用擔心被別人先搶走。各場次的報名截止時間會顯示在報名表上。
                </p>
                <UpcomingSessions projectSlug="career" registerPath="/career/register" />
              </div>
            </div>

            <div className="bg-[#E0F7FA] border-2 border-brown p-6 rounded-2xl">
              <h4 className="font-bold text-[#006064] text-xl mb-3 flex items-center gap-2">
                <Edit3 className="w-6 h-6" /> 報名三步驟與重要規則
              </h4>
              <ul className="text-[#006064] space-y-2 font-bold list-decimal list-inside text-lg">
                <li><strong>填寫表單：</strong> <strong>由你本人填寫</strong>——這是成人自己報名的諮詢，表單問的是你自己的職場與生活狀況，<strong>不需要填寫孩子的資料</strong>。請於各場次的期限前完成，逾期視為無效。</li>
                <li><strong>需求初評與媒合：</strong> 收到報名後，由社工進行第一線需求初評，釐清你的核心困擾，並媒合合適的專業夥伴。<strong>同一個時段若有多人報名，會在這一步評估後安排</strong>——沒有被安排到的，我們會提供候補或改期。</li>
                <li><strong>收取信件：</strong> 無論是否安排成功，審核結果都會透過 Email 通知。</li>
              </ul>
              <div className="mt-4 p-3 bg-white border border-brown text-red-600 font-bold rounded text-sm">
                ⚠️ 【重要提醒：這樣才算報名成功！】<br />送出表單不等於預約成功！只有當您收到「確認邀約成功通知信」時，才算正式完成預約。請務必留意您的電子信箱（包含垃圾信件匣）。若未能安排，您也會收到婉拒或候補通知。
              </div>
            </div>

            <div className="bg-red-50 border-l-8 border-accent-pink p-6 rounded-r-2xl">
              <h4 className="font-bold text-brown text-xl mb-3 flex items-center gap-2">🔒 你的資料會怎麼被使用</h4>
              <ul className="text-brown space-y-2 font-bold list-disc list-inside text-sm">
                <li>報名後由社工（大A彥宇）進行前置初評，釐清你的核心困擾。</li>
                <li>諮詢前，我會把你的求助脈絡整理成<strong>去識別化</strong>的「行前資料包」交給專業夥伴，讓對方在諮詢前就精準掌握狀況——<strong>資料包內不含姓名等可辨識身分的資訊</strong>。</li>
                <li>視訊連結建立、時間管理、諮詢後的滿意度與回饋收集，都由我負責，不需要你額外處理。</li>
              </ul>
            </div>

            <div className="bg-[#FFF9C4] border-2 border-brown p-6 rounded-2xl">
              <h4 className="font-bold text-brown text-xl mb-3 flex items-center gap-2">🤝 持續邀請專業夥伴加入</h4>
              <p className="leading-relaxed font-medium text-justify text-brown">
                如果你具備諮商心理、臨床心理、職能治療、生涯輔導或精神健康服務的實務經驗，誠摯邀請你捐出一點專業時間——<strong>每兩個月 1 至 3 小時</strong>，擔任本服務的專業志工。
              </p>
              <p className="leading-relaxed font-medium text-justify text-brown mt-3">
                所有行政後盾由我承擔：平台與報名機制、個案招募與初步篩選、去識別化的行前資料包、視訊連結與時間管理、諮詢後的回饋收集。你只需要專注在專業引導上。
              </p>
              <div className="mt-4">
                <a className="btn-warm py-3 px-6 bg-accent-orange text-brown font-bold border-2 border-brown shadow-warm" href="mailto:jin40225@gmail.com">
                  ✉️ 來信聊聊（jin40225@gmail.com）
                </a>
              </div>
            </div>

            <div className="mt-2 w-full">
              <RegisterCta slug="career" />
            </div>
          </div>

          <SessionHistory
            projects={[{ slug: 'career' }]}
            title="👣 服務軌跡・已完成場次"
            description="已完成的職場生活諮詢場次永久留存，讓新朋友看見這項服務的累積。"
          />
        </section>
      </div>

      <AboutFounder variant="collapsed" />
      <LineContact />
      <DonateFooter />
    </div>
  );
}
