import re
import os

with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Insert new blocks before '<!-- 活動列表 -->'
new_blocks = '''
            <!-- Intro Block for 公益諮詢服務 -->
            <div class="bg-white border-2 border-[#5D4037] rounded-3xl p-6 md:p-10 mb-10 relative shadow-[8px_8px_0_rgba(93,64,55,0.15)] flex flex-col gap-8">
                <div class="space-y-4 text-[#5D4037]">
                    <h3 class="text-2xl font-black mb-4">【ADHD 導航計畫】免費公益線上諮詢：大A彥宇 × 諮商心理師鏡子 🌿</h3>
                    <p class="leading-relaxed text-lg font-medium text-justify">
                        今年，大A彥宇與諮商心理師宋致靜（鏡子）攜手合作，為 ADHD 族群推出專屬的免費公益諮詢服務。<br><br>
                        如果你覺得生活有些卡關，想釐清自己目前的心理狀態，或正在評估自己是否需要進一步的心理諮商，歡迎預約這項專屬服務，讓心理師陪你走一段內心的漫遊之旅。<br>
                    </p>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="bg-red-50 border-l-8 border-accent-pink p-6 rounded-r-2xl">
                        <h4 class="font-bold text-[#5D4037] text-xl mb-3 flex items-center gap-2">
                            <i data-lucide="info" class="w-6 h-6"></i> 服務資訊
                        </h4>
                        <ul class="text-[#5D4037] space-y-2 font-bold list-disc list-inside text-base">
                            <li><strong>共同策劃：</strong> 大A彥宇 × 諮商心理師 宋致靜（鏡子）</li>
                            <li><strong>服務內容：</strong> 單次免費公益線上諮詢（使用 Google Meet 進行）</li>
                            <li><strong>適合對象：</strong> 想釐清自身狀態與連結相關心理健康資源的 ADHD 族群</li>
                        </ul>
                    </div>
                    <div class="bg-[#FFF9C4] border-l-8 border-accent-orange p-6 rounded-r-2xl">
                        <h4 class="font-bold text-[#5D4037] text-xl mb-3 flex items-center gap-2">
                            <i data-lucide="clock" class="w-6 h-6"></i> 開放預約時段
                        </h4>
                        <p class="text-sm font-bold text-[#5D4037] mb-2">每月僅開放 1 位專屬名額，請彈性勾選（可複選）：</p>
                        <ul class="text-[#5D4037] space-y-1 font-bold list-disc list-inside text-sm">
                            <li>平日晚間：第二週 週一 20:00 - 21:00</li>
                            <li>週末晚間：第二、三週 週六 20:00 - 21:00</li>
                            <li>週末早晨：第二、三週 週日 09:00 - 10:00</li>
                        </ul>
                        <p class="text-xs text-[#5D4037] mt-2">(註：實際確切日期將於報名表單中列出)</p>
                    </div>
                </div>

                <div class="bg-[#E0F7FA] border-2 border-[#5D4037] p-6 rounded-2xl">
                    <h4 class="font-bold text-[#006064] text-xl mb-3 flex items-center gap-2">
                        <i data-lucide="edit-3" class="w-6 h-6"></i> 報名三步驟與重要規則
                    </h4>
                    <ul class="text-[#006064] space-y-2 font-bold list-decimal list-inside text-lg">
                        <li><strong>填寫表單：</strong> 採「提前一個月」預約。每月 20 日為下個月報名截止日。</li>
                        <li><strong>適性審核：</strong> 收到報名後，心理師將依據您填寫的困擾與背景進行「適性評估」，確認是否合適陪伴您。</li>
                        <li><strong>收取信件：</strong> 審核結果將於當月底前透過 Email 通知。</li>
                    </ul>
                    <div class="mt-4 p-3 bg-white border border-[#5D4037] text-red-600 font-bold rounded text-sm">
                        ⚠️ 【重要提醒：這樣才算報名成功！】<br>送出表單不等於預約成功！只有當您收到「確認邀約成功通知信」時，才算正式完成預約。請務必留意您的電子信箱（包含垃圾信件匣）。若未能安排，您也會收到婉拒或候補通知。
                    </div>
                </div>

                <div class="mt-2 w-full">
                    <a href="https://mountain-sail-ee8.notion.site/1f6ffa2c66cc471899275a62db2e8d05?pvs=105" target="_blank" class="btn-warm py-5 px-6 bg-accent-pink text-[#5D4037] w-full text-2xl md:text-3xl shadow-comic animate-pulse-slow flex flex-col items-center justify-center border-4 border-[#5D4037]">
                        <span>📝 前往填寫報名表</span>
                        <span class="text-base font-bold mt-2 opacity-80 bg-white/40 px-3 py-1 rounded-full border border-[#5D4037]/20">重要報名連結</span>
                    </a>
                </div>
            </div>

            <!-- Intro Block for 家長諮詢服務 -->
            <div class="bg-white border-2 border-[#5D4037] rounded-3xl p-6 md:p-10 mb-10 relative shadow-[8px_8px_0_rgba(93,64,55,0.15)] flex flex-col gap-8">
                <div class="space-y-4 text-[#5D4037]">
                    <h3 class="text-2xl font-black mb-4">【ADHD 家長諮詢服務】免費公益線上諮詢：前兒少社工陪你找出教養新解方 🌿</h3>
                    <p class="leading-relaxed text-lg font-medium text-justify">
                        在陪伴 ADHD 孩子的路上，您是否時常感到心力交瘁，覺得沒有人懂您的無力感？<br>
                        或您想問問「服藥是什麼感覺？」、「為什麼要這樣做？」這些問題我想長大後的成年ADHD可以回答！<br><br>
                        為了支持在教養路上感到疲憊的家長，我們特別推出專屬的免費公益諮詢服務。由身兼「成人 ADHD（大A）」與「前兒少社會工作者」雙重身分的專業工作者為您解答。<br>
                        我們將根據您的具體議題與需求，彈性邀請相關專業人員或其他大A夥伴共同參與，為您打造最貼近需求、最懂您的專屬對話空間。
                    </p>
                    <div class="text-center mt-2 py-2">
                        <span class="inline-block bg-[#FFF9C4] px-4 py-2 rounded-full font-black text-lg border border-[#5D4037] shadow-sm text-[#D84315] transform rotate-1">
                            ✨ 彥宇不是樣樣都懂，但大A臥虎藏龍！我會盡力回應前來的家長 ✨
                        </span>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="bg-blue-50 border-l-8 border-accent-blue p-6 rounded-r-2xl">
                        <h4 class="font-bold text-[#5D4037] text-xl mb-3 flex items-center gap-2">
                            <i data-lucide="info" class="w-6 h-6"></i> 服務資訊
                        </h4>
                        <ul class="text-[#5D4037] space-y-2 font-bold list-disc list-inside text-sm">
                            <li><strong>專屬團隊：</strong> 成人 ADHD / 前兒少社工（視需求邀請夥伴加入）</li>
                            <li><strong>服務內容：</strong> 單次免費公益線上諮詢（Google Meet）</li>
                            <li><strong>適合對象：</strong> 渴望理解孩子、需教養策略或喘息支持的家長</li>
                            <li><strong>請填寫表單：</strong> 讓我們可以提前了解孩子狀況。</li>
                        </ul>
                    </div>
                    <div class="bg-green-50 border-l-8 border-line-green p-6 rounded-r-2xl">
                        <h4 class="font-bold text-[#5D4037] text-xl mb-3 flex items-center gap-2">
                            <i data-lucide="clock" class="w-6 h-6"></i> 上半年度開放場次
                        </h4>
                        <p class="text-xs font-bold text-[#5D4037] mb-2">每月限定２個名額，報名截止時間為該場次活動前一週的晚上 12 點。</p>
                        <ul class="text-[#5D4037] space-y-2 font-bold text-sm">
                            <li class="border-b border-green-200 pb-1">
                                <strong>【四月場次】4/18</strong>：10:00-11:00 / 11:00-12:00
                                <div class="text-[10px] text-gray-500 font-normal">截止日：4/11 23:59</div>
                            </li>
                            <li class="border-b border-green-200 pb-1">
                                <strong>【五月場次】5/23</strong>：10:00-11:00 / 11:00-12:00
                                <div class="text-[10px] text-gray-500 font-normal">截止日：5/16 23:59</div>
                            </li>
                            <li>
                                <strong>【六月場次】6/6</strong>：10:00-11:00 / 11:00-12:00
                                <div class="text-[10px] text-gray-500 font-normal">截止日：5/30 23:59</div>
                            </li>
                        </ul>
                    </div>
                </div>

                <div class="bg-[#E0F7FA] border-2 border-[#5D4037] p-6 rounded-2xl">
                    <h4 class="font-bold text-[#006064] text-xl mb-3 flex items-center gap-2">
                        <i data-lucide="edit-3" class="w-6 h-6"></i> 報名三步驟與重要規則
                    </h4>
                    <ul class="text-[#006064] space-y-2 font-bold list-decimal list-inside text-lg">
                        <li><strong>填寫表單：</strong> 請於各場次截止期限前完成，逾期視為無效。</li>
                        <li><strong>需求評估：</strong> 收到表單後，檢視議題並媒合合適的大A夥伴。</li>
                        <li><strong>收取信件：</strong> 無論是否安排成功，都會寄發 Email 通知。</li>
                    </ul>
                    <div class="mt-4 p-3 bg-white border border-[#5D4037] text-red-600 font-bold rounded text-sm">
                        ⚠️ 【重要提醒：這樣才算報名成功！】<br>送出表單不等於預約成功！只有當您收到「確認邀約成功通知信」時，才算正式完成預約。若未能為您安排，您也會收到婉拒或候補通知。
                    </div>
                </div>

                <div class="mt-2 w-full">
                    <a href="https://mountain-sail-ee8.notion.site/97c41d5530d145b18d7d8739f572d64d?pvs=105" target="_blank" class="btn-warm py-5 px-6 bg-accent-blue text-[#5D4037] w-full text-2xl md:text-3xl shadow-comic animate-pulse-slow flex flex-col items-center justify-center border-4 border-[#5D4037]">
                        <span>📝 前往填寫報名表</span>
                        <span class="text-base font-bold mt-2 opacity-80 bg-white/40 px-3 py-1 rounded-full border border-[#5D4037]/20">報名連結</span>
                    </a>
                </div>
            </div>

            <!-- 活動列表 -->'''
text = re.sub(r'<!-- 活動列表 -->', new_blocks, text, count=1)

# 2. Extract and remove the '3月場' block.
match = re.search(r'(<!-- 3月場 -->.*?)<!-- 4月場 -->', text, re.DOTALL)
if match:
    march_session = match.group(1).strip()
    march_session = re.sub(r'bg-\[\#FFB6B9\]', 'bg-gray-300', march_session)
    march_session = re.sub(r'text-\[\#5D4037\]', 'text-gray-500', march_session)
    march_session = re.sub(r'(<span class="font-bold text-\[\#5D4037\] text-lg">)(.*?)(</span>)', r'\1[辦理成功] \2\3', march_session)
    # Safely replace main card class
    march_session = march_session.replace('class="session-card"', 'class="session-card bg-gray-100 opacity-80"')

    # Remove the original block perfectly
    text = re.sub(r'<!-- 3月場 -->.*?<!-- 4月場 -->', '<!-- 4月場 -->', text, flags=re.DOTALL)
    
    # 3. Create the completed section
    completed_section = f'''
                    <!-- 已經完成辦理活動區 -->
                    <div class="border-t-4 border-dashed border-[#5D4037]/20 pt-8 mt-12 mb-6">
                        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                            <div class="space-y-1">
                                <h3 class="text-2xl font-bold text-gray-500 flex items-center gap-2">
                                    <span class="bg-gray-400 text-white px-2 py-1 rounded text-lg border border-gray-500">歷史</span>
                                    已經完成辦理活動區
                                </h3>
                                <p class="text-gray-500 font-medium">這些是我們過去美好的回憶！</p>
                            </div>
                        </div>
                        
                        {march_session}
                    </div>

                    <!-- 分隔線：籌備中區塊 -->'''
    text = re.sub(r'<!-- 分隔線：籌備中區塊 -->', completed_section, text, count=1)

# 4. Remove '籌備中：家長諮詢服務'
text = re.sub(r'<!-- 籌備中：家長諮詢服務 -->.*?</div>\s*</div>\s*</div>', '', text, flags=re.DOTALL)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(text)

# -----------------
# Create Split Pages
# -----------------

# Define block patterns we created
block1_regex = r'(<!-- Intro Block for Google Meet Info -->.*?)(?=<!-- Intro Block for 公益諮詢服務 -->)'
block2_regex = r'(<!-- Intro Block for 公益諮詢服務 -->.*?)(?=<!-- Intro Block for 家長諮詢服務 -->)'
block3_regex = r'(<!-- Intro Block for 家長諮詢服務 -->.*?)(?=<!-- 活動列表 -->)'
activities_regex = r'(<div class="border-t-4 border-dashed border-\[\#5D4037\]/20 pt-8">.*?)?(?=<!-- 分隔線：籌備中區塊 -->)'

b1 = re.search(block1_regex, text, re.DOTALL).group(1)
b2 = re.search(block2_regex, text, re.DOTALL).group(1)
b3 = re.search(block3_regex, text, re.DOTALL).group(1)
acts = re.search(activities_regex, text, re.DOTALL).group(1)

def create_page(filename, content_to_remove):
    # Start from full index text
    page_text = text
    # Remove all the specific blocks we DO NOT WANT in this file
    for r in content_to_remove:
        page_text = page_text.replace(r, "")
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(page_text)

# Peer group: we want block1 + acts. So remove block2 and block3.
create_page('peer-group.html', [b2, b3])

# Welfare consultation: we want block2. So remove block1, block3, acts.
create_page('welfare-consultation.html', [b1, b3, acts])

# Parent consultation: we want block3. So remove block1, block2, acts.
create_page('parent-consultation.html', [b1, b2, acts])

print("Finished generation")
