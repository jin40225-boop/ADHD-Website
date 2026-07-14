-- ============================================================================
-- ADHD 專管系統 K1 種子：就醫推薦資料庫 134 筆（公開資料）
-- 由 scripts/gen-recommendations-migration.mjs 自 src/data/recommendations.json 產生，勿手改。
-- ============================================================================

insert into public.recommendations
  (id, category, audience, region, hospital, doctor_or_name, urls, experience, recommender, verified, verified_note, updated_at)
values
('rec-001','doctor','child','彰化縣市','彰化基督教醫療財團法人鹿港基督教醫院 / 鹿東基督教醫院','江瑞豐(鹿港分院)',array['http://www.rc.cch.org.tw/opd/opd/service-e.aspx?id=0501&Page=11&zone=D&#p']::text[],'耐心聽家長的需求，也會同理家長的感受，並且給予情緒支持。','朱小姐',false,'已核實-1141110彥宇備註',null),
('rec-002','doctor','all','台北市','萬芳醫院 / 木柵身心診所','張勝傑',array['https://www.facebook.com/muzhapsy/?locale=zh_TW','https://www.wanfang.gov.tw/departments/team/cb18756decbeffdd']::text[],'萬芳醫院只有禮拜六的診，很滿!  張醫師另有在木柵身心診所服務(禮拜三、禮拜五)。','雯',true,null,null),
('rec-003','doctor','all','新竹縣市','國立臺灣大學醫學院附設醫院新竹臺大分院','王彥欽',array['https://www.ntuh.gov.tw/PSY/Vcard.action?q_type=A02&q_itemCode=2580']::text[],'有耐心且問診很仔細','北極熊',true,'1140318彥宇驗證與補充。
我也與王醫師打過數次照面，王醫師很溫和、細心，也願意和患者深談。推薦者北極熊有補充，王醫師後續會調院區，屆時再請各位夥伴協助更新。',null),
('rec-004','doctor','all','苗栗縣市','吳四維診所','吳四維','{}'::text[],'',null,true,'柯柯已查核。',null),
('rec-005','doctor','all','臺南市','嘉南療養院','李吉特',array['https://www.cnpc.mohw.gov.tw/?aid=51&pid=34']::text[],'',null,true,'0929柯柯已查核。',null),
('rec-006','other','all','臺南市','安南醫院','黃雪婷',array['https://www.tmanh.org.tw/Doctor/Department?detail=27&current=3']::text[],'介紹','小慧',true,'兒童發展諮詢及評估。0929柯柯已查核。',null),
('rec-007','doctor','all','臺南市','誼仁診所','李姿誼',array['https://tncomu-news.com/tag/%E5%8D%97%E9%83%A8%E7%A7%91%E5%AD%B8%E5%9C%92%E5%8D%80/']::text[],'醫生很細心','丫丫',true,'0929柯柯已查核。',null),
('rec-008','doctor','all','臺南市','柳營奇美醫院','劉俊宏',array['http://sub.chimei.org.tw/77790/index.php/members/13-2023-04-11-03-39-00/6-2023-04-19-08-11-27']::text[],'醫師很溫和友善傾聽並給予建議。','毛毛',true,'0929柯柯已查核。',null),
('rec-009','doctor','all','臺南市','樂行診所','李吉特',array['https://www.cjclinic.com.tw/doctor.html']::text[],'原嘉南療養院精神科醫師，去年在台南仁德開業，目前仍有在嘉療掛職。','谷',true,'0929柯柯已查核。',null),
('rec-010','doctor','all','臺南市','嘉南療養院','李冠瑩',array['https://www.cnpc.mohw.gov.tw/?aid=51&pid=34']::text[],'細心，耐心，','PP',true,'0929柯柯已查核。',null),
('rec-011','doctor','child','臺東縣','台東基督教醫院','黃懷德',array['https://www.tch.org.tw/']::text[],'因孩子課表無法與翁菁菁醫師門診時間配合，故經同為職能治療的家長推薦，轉診至黃醫師，對孩子友善，目前孩子固定回診拿藥','Aloe',true,'0929柯柯已查核。',null),
('rec-012','doctor','all','臺東縣','台東基督教醫院','翁菁菁',array['https://www.tch.org.tw/']::text[],'從北部來的專科醫師，印象中隔週週四才有診，上午門診開放2名現場掛號名額，醫師很專業有耐心。','Aloe',true,'0929柯柯已查核。',null),
('rec-013','other','all','台北市','臺北市立聯合醫院中興院區','鄒國蘇','{}'::text[],'會提供額外資訊協助治療
    好溝通','Jane',true,'0929柯柯已查核。',null),
('rec-014','doctor','child','台北市','馬偕兒童醫院','劉恵青','{}'::text[],'劉醫師是唯一一位用心為我孩子看診時間超過半小時的（非評估）很感動也很感謝','Ryan媽媽',true,'0929柯柯已查核。',null),
('rec-015','doctor','all','台北市','振興醫療財團法人振興醫院','陳麗淇',array['https://reg.chgh.org.tw/registd_cload2.aspx?pidm=8B851A78CE5BD1E7']::text[],'看陳醫師好幾年了，從以前在北榮就剛好掛到她，陳醫師很親切也很有耐心，不會只開藥，有很多方法與說明來讓我了解孩子到底是哪裡有問題，畢竟有時候不只是注意力，就這樣一直陪伴我們家哥哥到現在進步很多到國中了（前面中年級時有一段時間確實很不穩定），媽媽我自己都要憂鬱了，幸好都度過了。說真的，其實這樣的醫師應該也不少，只是我自己特別跟她聊的來，小孩也很聽她的話。帶小孩做評估看醫生真的很辛苦，我覺得我剛好是幸運的遇到陳醫師，現在她病人很多，但兒子相對也穩定，有時候我只會拿藥門口打個招呼就離開了，希望把醫師的時間留給更需要的人。','黃媽媽',true,'已確認-1131019彥宇備註',null),
('rec-016','doctor','all','台北市','開馨診所 / 臺北市立聯合醫院松德院區','黃彥勳',array['https://webreg.tpech.gov.tw/RegOnline1_2.aspx?ChaId=A105&tab=1&ZCode=K&DeptCode=1301&deptname=%E5%85%92%E7%AB%A5%E9%9D%92%E5%B0%91%E5%B9%B4%E7%B2%BE%E7%A5%9E%E7%A7%91&thidname=%E6%9D%BE%E5%BE%B7%E9%99%A2%E5%8D%80&rom_dr=DAF28']::text[],'醫師很有耐心，可以帶評鑑報告加速治療。剛開始會安排密集回診調整藥物，流程比醫院快速。在診所治療成效良好','Mimi',true,'松德院區兒童青少年精神科兼任醫師、並有在開馨診所看診，原推荐推薦開馨診所，搜尋過程中補上臺北市立聯合醫院松德院區。已確認-1131019彥宇備註',null),
('rec-017','doctor','child','台北市','馬偕兒童醫院','李宗翰','{}'::text[],'李醫師非常有耐心也很細心，除了在診間觀察和孩子的互動外，若有提供心理師的報告或是老師的意見、問卷等，都會很仔細的看過再下診斷。針對家長對於用藥的疑慮，也會不厭其煩地提出科學佐證。-小薰


李醫師很有耐心，很仔細的問診他看診時間都很長孩子很信任李醫師，因為他看診時間很長所以要耐心等待，他的診不好掛，建議看診時間去詢問並預約就診時間-lóusìng mǎrì','小薰、lóusìng mǎrì',true,'0929柯柯已查核。1140430再次查核-彥宇',null),
('rec-018','doctor','all','台北市','三總醫院松山分院','莊偉辰',array['https://wwwv.tsgh.ndmctsgh.edu.tw/docdet/193/20081/28114/2821']::text[],'中規中矩的醫生，蠻有處理ADHD患者的經驗，會配合心理師做諮商和進一步測驗診斷','落星子',true,'已核實-1131019彥宇備註',null),
('rec-019','doctor','adult','台北市','夏凱納身心診所','劉鴻徽',array['https://g.co/kgs/6dGSPjQ']::text[],'因憂鬱症狀經朋友介紹，初診後診斷憂鬱為ADHD共病症狀；
    劉醫師以成人型ADHD為主要專長看診項目之一。','阿紹',true,'已核實-1131019彥宇備註',null),
('rec-020','doctor','child','台北市','台北馬偕紀念醫院','劉珣瑛',array['https://www.mmh.org.tw/register_single_doctor3.php?depid=21&did=603&area=ts']::text[],'以前是看青少年，現在看老年，我是給她看才知道我有注意力不足的問題，她很有耐心，對於這類的疾病也很了解，有時也會給病人擁抱。是一位非常資深的精神科女醫師，但現在都不太接初診，需要透過介紹才能看她。','太空人',true,'查核起來淡水也有，如原推薦註解。已核實-1131019彥宇備註',null),
('rec-021','doctor','child','臺中市','中國醫藥大學附設醫院','林秀縵',array['https://www.cmuh.cmu.edu.tw/Doctor/DoctorInfo?docId=D33767']::text[],'孩子小二開始看秀縵醫生，目前已國二，醫生會傾聽也會建議教養方針及建議改善過敏資訊。幫助很大-Kelly
細心耐心-魚','Kelly、魚',true,'已核實-1131019彥宇備註',null),
('rec-022','doctor','child','臺中市','中國醫藥大學附設醫院','廖伊鐸',array['https://www.cmuh.cmu.edu.tw/Doctor/DoctorInfo?docId=100745']::text[],'非常有耐心，對小孩或青年都有耐心的溝通','小瑜',true,'已核實-1131019彥宇備註',null),
('rec-023','doctor','all','臺中市','台中榮民總醫院','劉珈倩',array['https://www.vghtc.gov.tw/APIPage/DoctorInfoDetail?WebMenuID=DC264319-1D78-4AD8-A7BA-647440DBAD6B&InSect=PSY&InSectC=%E7%B2%BE%E7%A5%9E%E9%83%A8&DocNo=5497J']::text[],'女醫生說話溫柔有耐心、包容力大，有問題提出詢問能互相討論提供意見和方式。','咕咕霍',true,'已核實-1131019彥宇備註',null),
('rec-024','doctor','all','臺中市','潭子好晴天診所','鄭晴',array['https://sogoodday.com.tw/doctor/cheng/']::text[],'醫生有耐心講解且溫柔，可以針對提問給予回應，並適時的關心用藥情形。','何',true,'已核實-1131019彥宇備註',null),
('rec-025','doctor','all','彰化縣市','財團法人彰化基督教醫院','陳力源',array['https://dpt.cch.org.tw/layout/layout_1/doctor.aspx?ID=500&Key=1291']::text[],'大暖男醫生，就醫經驗非常舒服，很重視病人反應的狀態和需求','JJ',true,'已核實-1131019彥宇備註',null),
('rec-026','other','all','彰化縣市','彰化基督教醫院','張通銘',array['https://www1.cch.org.tw/opd/Service-e.aspx?id=4601&Page=11#ppp']::text[],'很專業、細心、耐心的對待每位病人及家人',null,true,'已核實-1131129家誠備註',null),
('rec-027','other','all','彰化縣市','彰化基督教醫院','張明裕',array['https://www1.cch.org.tw/opd/Service-e.aspx?id=4601&Page=11#ppp']::text[],'人還不錯，如果對心智科或身心科字眼敏感的話，看神經內科也一樣',null,true,'有開學障特別門診.
已核實-1131129家誠備註',null),
('rec-028','doctor','all','彰化縣市','彰化基督教醫院','江瑞豐',array['https://www1.cch.org.tw/opd/Service-e.aspx?id=4601&Page=11#ppp']::text[],'耐心跟孩子聊天，了解孩子想法，會給予建議，請孩子自己決定用藥。',null,true,'已核實-1131129家誠備註',null),
('rec-029','doctor','child','嘉義縣市','長庚醫院分院','陳錦宏',array['https://www.jah.org.tw/JCHReg/Department/J/J3600A']::text[],'經驗豐富、充滿愛心、英俊、細心，能與孩子交心。為台灣的ADHD孩子與家長費心衛教宣導，創立心動家族兒童青少年關懷協會。','魏良各',true,'目前在大里仁愛醫院
已核實-1131129家誠備註',null),
('rec-030','doctor','child','嘉義縣市','長庚醫院嘉義分院','蔡景淑',array['https://www.cgmh.org.tw/tw/Services/DoctorInfo/6247']::text[],'會用不同方式引導孩子說話，沒有醫生的架子，非常體諒家長與孩子的立場，非絕對必要，不會輕易用藥及增加劑量。','蔡惠華',true,'已核實-1131129家誠備註',null),
('rec-031','doctor','all','嘉義縣市','台中榮民總醫院嘉義分院','黃聖雲醫師',array['https://www.vghtc.gov.tw/APIPage/DoctorInfoDetail?WebMenuID=dc264319-1d78-4ad8-a7ba-647440dbad6b&InSect=PSYC&InSectC=%E5%85%92%E7%AB%A5%E5%BF%83%E6%99%BA&DocNo=5897D']::text[],'很細心的聆聽小朋友的感受並與做小朋友溝通','Venus',true,'已核實-1131129家誠備註',null),
('rec-032','doctor','all','新竹縣市','新竹台大生醫','林建亨',array['https://www.hch.gov.tw/?aid=51&pid=24&page_name=detail&iid=159']::text[],'專長
    1.兒童注意力不足過動症
    2.青少年心理疾患
    3.學習障礙
    4.自閉症
    5.一般成人精神疾患
    6.憂鬱症
    7.思覺失調症（長效針劑治療）
    8.早發型思覺失調症診斷及治療
    
    接觸經驗
    清楚說明醫療評估讓就診者理解，同時說明如何在生活中透過藥物外調整及每款用藥開立的原因','Q',true,'已核實-1131129家誠備註',null),
('rec-033','doctor','adult','新竹縣市','東元綜合醫院','張夢涵',array['https://w3.tyh.com.tw/WebRegList_Doct.aspx?dn=2416&d=24']::text[],'張醫生在東元的疾病介紹網頁中，有發表關於成人ADHD的文章，我也是因為這個文章去找她看的，張醫生本身還有在心裡診所接診(周伯翰身心醫學診所)，但我本身是在東元看的，所以就推薦東元。
    
   
  第一次去就診，張醫生很快就判斷我確實有ADHD的症狀，於是就開始吃藥，真正做ADHD檢測大約是半年之後(醫院要排隊)，之後有持續關心吃藥狀況與心情，人很溫和。','94',true,'已核實-1131129家誠備註',null),
('rec-034','doctor','child','新竹縣市','台大生醫','劉子瑜',array['https://www.hch.gov.tw/?aid=51&pid=24&page_name=detail&iid=457']::text[],'劉醫師看著小二的弟弟，診間跑來跑去，完全坐不住，雖然尚未完成心理衡鑑，但劉醫師願意積極給藥治療，控制弟弟過動的狀況。
    2024/10月，劉醫師從竹北台大轉至新竹台大看診。','Jessie',true,'已核實-1131129家誠備註',null),
('rec-035','doctor','all','新竹縣市','親禾身心診所','謝采燁',array['https://www.sproutpsyclinic.com.tw/']::text[],'謝醫師對ADHD的了解很深，除了兒童外，對成人ADHD也很清楚，且會花心思對症下藥，也很尊重患者特質的個體差異，超用心又有耐心，超級推薦！','荷豆',true,'已查核-1131019彥宇備註',null),
('rec-036','other','all','新竹縣市','中國醫藥大學附設醫院新竹分院','王明鈺',array['https://www.cmu-hch.cmu.edu.tw/Doctor/DoctorInfo/143']::text[],'　','Connie Lee',true,'已核實-1131129家誠備註',null),
('rec-037','other','child','新竹縣市','林正修診所','林正修',array['https://www.mainpi.com/query?i=699']::text[],'是新竹區精神科方面的前兩把交椅，經驗非常豐富(不過有時會忽略掉家長情緒)大體來說是非常為孩子著想的醫師。還有，他也是新竹區鑑輔會諮詢的精神科醫師，他診所的其他醫師也都不錯不過就不特別另外推薦','賴正瑋',true,'已核實-1131129家誠備註',null),
('rec-038','doctor','child','新竹縣市','中國醫藥大學附設醫院','王明鈺',array['https://www.cmuh.cmu.edu.tw/Doctor/DoctorInfo?docId=D16211']::text[],'家長推薦，忘記註明，我是看自閉，不是Adhd',null,true,'已核實-1131129家誠備註',null),
('rec-039','other','child','新北市','台北慈濟','蔡文心',array['https://taipei.tzuchi.com.tw/%E8%94%A1%E6%96%87%E5%BF%83-%E9%86%AB%E5%B8%AB/']::text[],'和藹可親好溝通，可以好好聆聽家長想法','Vanessa',true,'林口長庚
已核實-1131129家誠備註',null),
('rec-040','doctor','child','新北市','林口長庚','謝依璇',array['https://www.cgmh.org.tw/tw/Services/DoctorInfo/7436']::text[],'謝醫師看診時有耐性  也會詳細記錄父母回饋孩子的狀況','小米',true,'已核實-1131129家誠備註',null),
('rec-041','doctor','all','新北市','關渡','藍彣烜',array['https://www.gandau.gov.tw/%E8%AA%8D%E8%AD%98%E9%97%9C%E6%B8%A1/%E9%86%AB%E7%99%82%E5%9C%98%E9%9A%8A/%E9%86%AB%E5%8B%99%E9%83%A8/%E7%A7%91%E5%88%A5%E4%BB%8B%E7%B4%B9/%E8%BA%AB%E5%BF%83%E7%A7%91/']::text[],'初診和調藥量時有困擾會很仔細
    穩定沒事時速度很快
    覺得有效率有仔細 不錯','屁桃',true,'已核實-1131129家誠備註',null),
('rec-042','doctor','all','新北市','土城長庚','楊緯聖',array['https://www.cgmh.org.tw/tw/Services/DoctorInfo/0490']::text[],'很年前 觀念很新
  也不會限制很多
    很好溝通的醫生🧑‍⚕️','Tuna',true,'已核實-1131129家誠備註',null),
('rec-043','other','all','新北市','亞東醫院','施顯學',array['https://www.femh.org.tw/section/sectionDetail2.aspx?CID=0293&&DoctorID=98132']::text[],'以前在台大看adhd多年，看診會有耐心聽患者講話。','sherry chen',true,'原台大醫師
已核實-1131129家誠備註',null),
('rec-044','doctor','child','新北市','淡水馬偕醫院','陳苡芃',array['https://www.mmh.org.tw/doctor_view.php?depid=52&did=614']::text[],'幾乎每個人都談至少半小時。並且會馬上安排心理師。那時心理師評估就評估家長和孩子花了一個早上。並也有給老師一個量表。算很詳細哦','曹靈玉',true,'已核實-1131129家誠備註',null),
('rec-045','doctor','child','新北市','八里療養院','張介信',array['https://server.ttpc.mohw.gov.tw/OINetReg.WebRwd/Reg/Doctor']::text[],'很有耐心, 另外草療本身有很多課程.
  心理師團隊堅強.蔡佳芳媽媽特推','黃瑞佳',true,'原草屯療養院張院長已換到八里療養院.

（目前在草屯療養院）
已核實-1131129家誠備註',null),
('rec-046','doctor','child','台北市','內湖三總','葉啟斌',array['https://wwwv.tsgh.ndmctsgh.edu.tw/docdet/191/10058/25045/671']::text[],'溫和有耐心，尊重父母選擇，專業，助理也很棒','GILL YEN',true,'已核實-1131129家誠備註
已修改-1140419彥宇備註',null),
('rec-047','other','all','新北市','八里療養院蘆洲院區','馬景野','{}'::text[],'不用說了. 特別長於看亞斯. 可惜現在門診時間很少了. ','黃瑞佳',true,'現已擔任衛生局副局長
（目前沒有門診）
已核實-1131129家誠備註',null),
('rec-048','doctor','all','新北市','雙和醫院','張勝傑',array['https://old.wanfang.gov.tw/p5_team_specialty_detail.aspx?d=230&DeptCode=3600']::text[],'　','周麗雅',true,'萬芳醫院有診
已核實-1131129家誠備註',null),
('rec-049','doctor','child','新北市','慈濟醫院台北','王宗熙',array['https://taipei.tzuchi.com.tw/%E7%8E%8B%E5%AE%97%E7%86%99-%E9%86%AB%E5%B8%AB/']::text[],'願意花時間有耐心給家長和孩子時間說話的醫師','周麗雅',true,'已核實-1131129家誠備註',null),
('rec-050','doctor','child','新北市','亞東醫院','林育如',array['https://www.femh.org.tw/section/sectionDetail2.aspx?CID=0293&&DoctorID=88077']::text[],'願意花時間有耐心給家長和孩子時間說話的醫師','周麗雅',true,'已核實-1131129家誠備註',null),
('rec-051','doctor','child','新北市','雙和醫院','林宜正',array['https://www.shh.org.tw/page/TeamDocDetail.aspx?deptCode=13&docCode=63145']::text[],'願意花時間有耐心給家長和孩子時間說話的醫師','周麗雅',true,'已核實-1131129家誠備註',null),
('rec-052','other','all','新北市','愛家自然診所','陳惟華',array['http://drchenwh.blogspot.com/']::text[],'陳醫師是英國牛津大學自律神經博士...基隆海軍醫院前院長...有上過電視...採自然療法...吃食品膠囊...不吃藥品....我兒子有妥瑞加情緒障礙問題....看了一年多....現在妥瑞的外在症狀幾乎不見...情緒也很穩定...學習力很強...變得可愛許多....中班時確診....目前小一...個人親身經歷....','李秀連',true,'已核實-1131129家誠備註',null),
('rec-053','other','all','雲林縣','台大醫院','高維治',array['https://reg.ntuh.gov.tw/WebReg/WebReg/RegDoctorInfo?vHospCode=Y0&drID=Y04065']::text[],'人親切又專業','Second',true,'已核實-1131129家誠備註',null),
('rec-054','doctor','all','雲林縣','台大醫院雲林分院及虎尾分院','高維治',array['https://reg.ntuh.gov.tw/WebReg/WebReg/RegDoctorInfo?vHospCode=Y0&drID=Y04065']::text[],'這個醫生在該醫院看診多年，醫生會向病人解釋各項藥物的原理。','Sherry Chen',true,'醫生會視病人報到順序，調整看診順序，先報到但號碼後面者，有機會提前被叫號。
已核實-1131129家誠備註',null),
('rec-055','doctor','child','雲林縣','長庚醫院','蔡景淑',array['https://www.cgmh.org.tw/tw/Services/DoctorInfo/6247']::text[],'會用不同方式引導孩子說話，沒有醫生的架子，非常體諒家長與孩子的立場，非絕對必要，不會輕易用藥及增加劑量。',null,true,'嘉義長庚有診
已核實-1131129家誠備註',null),
('rec-056','doctor','all','高雄市','長庚','王亮人',array['https://www.cgmh.org.tw/tw/Services/DoctorInfo/3874']::text[],'醫師願意和孩子互動，有自己的研究團隊，助理會在候診區邀請家長加入ADHD注意力測驗、益生菌檢測','黃',true,'已核實-1131129家誠備註',null),
('rec-057','doctor','child','高雄市','榮總','李旻靜',array['https://webreg.vghks.gov.tw/RSMKS/onlineReg/2']::text[],'可以接住同理家長的情緒','熊之熊貓',true,'已核實-1131129家誠備註',null),
('rec-058','doctor','child','高雄市','長庚','王亮人',array['https://www.cgmh.org.tw/tw/Services/DoctorInfo/3874']::text[],'人很溫柔，很有耐心的聆聽家長和孩子說話並給予建議。','(=ﾟωﾟ)ﾉ',true,'已核實-1131129家誠備註',null),
('rec-059','other','child','高雄市','和誼診所','陳睿安',array['https://www.yehiclinic.com/the-clinic-1']::text[],'孩子願意接受的醫生，給照顧者信心的醫生。溫柔，專業。','LeS',true,'已核實-1131129家誠備註',null),
('rec-060','doctor','adult','高雄市','元和雅身心科診所','周妙純',array['https://www.5550056.com.tw/product_1620860.html']::text[],'會持續關心病患的用藥狀況跟副作用，針對生活或工作上的煩惱也會有耐心、溫柔的傾聽並給予建議
  (但不能講太久，因為還有很多病患🤣)','Egg',true,'已核實-1131129家誠備註',null),
('rec-061','doctor','all','高雄市','長庚醫院','周妙純',array['https://www.cgmh.org.tw/tw/Services/DoctorInfo/4953']::text[],'周醫師也有在元和雅身心科診所看診，若是平常只需拿藥可以在診所掛號領藥即可，可以省下很多去大醫院排隊等待的時間，還有昂貴的掛號費喔！','Lucy',true,'已核實-1131129家誠備註',null),
('rec-062','doctor','all','高雄市','長庚醫院','蔡景淑',array['https://www.cgmh.org.tw/tw/Services/DoctorInfo/6247']::text[],'親切有耐心在討論','Fan',true,'已核實-1131129家誠備註',null),
('rec-063','other','all','高雄市','長庚醫院','周妙純',array['https://www.cgmh.org.tw/tw/Services/DoctorInfo/4953']::text[],'　','任日昇',true,'已核實-1131129家誠備註',null),
('rec-064','other','all','高雄市','長庚醫院','周文君',array['https://www.cgmh.org.tw/tw/Services/DoctorInfo/4986']::text[],'　','任日昇',true,'已核實-1131129家誠備註',null),
('rec-065','doctor','child','高雄市','高醫附醫','楊品珍','{}'::text[],'很專業，會多方位考量孩子的情況，給予很實際適當的建議和處理。不會隨意用藥。較敏感的家長可能覺得醫師講話急，但楊醫師是很為兒童著想的好醫師。在兒科開的聯評門診常額滿',null,true,'已退休
已核實-1131129家誠備註',null),
('rec-066','doctor','child','高雄市','高雄醫學院附設醫院','顏正芳',array['https://www.kmuh.org.tw/Web/WebRegistration/DocIntro/DocDetail?lang=tw&doctorID=820222#scheduleBlock']::text[],'願意花時間與家長和小孩說話','張芸綺',true,'專長:網路/3c 成癮,
  這方面高醫做很多的研究
    顏醫師很擅長. 
已核實-1131129家誠備註',null),
('rec-067','doctor','all','高雄市','元和雅診所','王雅琴',array['https://www.5550056.com.tw/product_1620860.html']::text[],'PTT 鄉民推荐. 很有耐心回應. 舒緩了就醫者的焦慮',null,true,'高醫附醫也有診

（採電話預約制，電話：07-5550066）
已核實-1131129家誠備註',null),
('rec-068','doctor','child','高雄市','長庚醫院高雄分院','王亮人',array['https://register.cgmh.org.tw/Register/8']::text[],'細心,有愛心,會傾聽家長說明孩子狀況並且會討論在給予適當建議的良醫','Chang Yu Cheng',true,'已核實- 1131127家誠備註',null),
('rec-069','doctor','child','高雄市','柯偉恭診所','柯偉恭',array['https://kb.commonhealth.com.tw/hospitals/13207.html']::text[],'願意花時間與家長和小孩說話','張芸綺',true,'柯偉恭診所是位於 高雄市新興區的身心科診所，為衛福部核可之醫事機構，主要服務項目有注意力不集中、失眠、焦慮、憂鬱、頭痛、酒癮、藥癮、自律神經失調、神經衰弱、情緒障礙
已核實-1131019柯柯備註',null),
('rec-070','doctor','child','高雄市','高雄市立聯合醫院','陳億倖',array['https://www.kmuh.gov.tw/News_InformationContent.aspx?n=E5C0F6A40A13E849&sms=3AAAF95486579FCA&s=769E1FE88CFEAD57']::text[],' 
  會和孩子互動，傾聽家長的敘述','Jin Wu',true,'1.身心科:主治焦慮、失眠、腦神經衰弱、緊張性頭痛、身心症、憂鬱症、恐慌症、強迫症及各種精神官能症、精神疾患、妄想症、幻聽、老人失智症、婦女身心疾患、經前症候群、產後憂鬱、更年期情緒障礙。
2.兒童心智科:發展遲緩、注意力缺失、過動兒、自閉症、兒童青少年憂鬱症、焦慮症、適應障礙、學習障礙。 • 3.身心障礙鑑定:可依規定執行精神障礙、智能障礙、失智症
已核實-1131019柯柯備註',null),
('rec-071','doctor','child','桃園市','聖保祿醫院','黃琦棻',array['https://rms.sph.org.tw/RMSTimeTable.aspx?dpt=S3600B']::text[],'醫生很有經驗，和孩子交流無礙','涼夏',true,'週一上午、週二下午精神科門診，限十八歲以上掛號，未滿十八歲之身心或精神困擾請掛兒童青少年心智健康門診。　       已核實-1131019柯柯備註',null),
('rec-072','doctor','child','桃園市','聯新國際醫院','林博',array['https://www.landseedhospital.com.tw/tw/team/team_detail/%E7%B2%BE%E7%A5%9E%E7%A7%91%E8%BA%AB%E5%BF%83%E7%97%87%E9%96%80%E8%A8%BA/%E6%9E%97%E5%8D%9A']::text[],'孩子是給林醫師看診的！會先評估再給予建議，或是使用藥物，每兩週回診觀察用藥狀況有無進步，慢慢找到適合的藥物！我們目前也還在調藥階段，但孩子的確有在進步中，醫師建議孩子做對時多給孩子鼓勵讓她有成就感就會繼續努力。','Mina',true,'已核實-1131019柯柯備註',null),
('rec-073','doctor','child','桃園市','林口長庚醫院','黃玉書',array['https://www.cgmh.org.tw/tw/Services/DoctorInfo/2956']::text[],'醫師有耐心的傾聽做評估，因為小孩也有過敏症狀，造成睡眠呼吸中止，醫師也是這方面的專家','Summer',true,'週一下午診-竹北東元綜合醫院-精神科
週一晚上診-竹北東元綜合醫院-精神科
週二上午診-台北長庚醫院-精神科
週三下午診-林口長庚醫院-兒童心智科
週四上午診-林口長庚醫院-睡眠中心
週五下午診-林口長庚醫院-睡眠中心
週六下午診-桃園長庚醫院-睡眠中心
已核實-1131019柯柯備註',null),
('rec-074','doctor','child','台北市','台北市','許元彰',array['https://old.wanfang.gov.tw/p5_team_specialty_detail.aspx?d=898&DeptCode=3600']::text[],'青少年情緒障礙','王桓奇',true,'原推荐為桃園療養院，後核實已改為臺北市立萬芳醫院-委託臺北醫學大學辦理。限16歲以下看診，故不推薦成人ADHD就診。已核實-1131019彥宇備註',null),
('rec-075','doctor','child','桃園市','桃園療養院','宋成賢',array['https://www.typc.mohw.gov.tw/?aid=51&pid=42']::text[],'青少年情緒障礙','王桓奇',true,'已核實-1131019彥宇備註',null),
('rec-076','doctor','all','新竹縣市','新竹馬偕紀念醫院','吳洽明',array['https://www.hc.mmh.org.tw/doctor_view.php?depid=218&did=2675']::text[],'　','王桓奇',true,'原推荐為桃園療養院醫師，現已改於新竹馬偕醫院。已核實-1131019彥宇備註',null),
('rec-077','doctor','all','桃園市','桃園療養院','李國平',array['https://register.typc.mohw.gov.tw/OINetReg.WebRwd/Reg/DeptCalendar?DeptId=1302']::text[],'　','王桓奇',true,'已核實-1131019彥宇備註',null),
('rec-078','doctor','all','桃園市','林口長庚醫院','倪信章',array['https://www.cgmh.org.tw/tw/Services/DoctorInfo/0926']::text[],'　','李如梅',true,'已核實-1131019彥宇備註',null),
('rec-079','doctor','all','桃園市','林口長庚醫院','梁歆宜',array['https://cghdpt.cgmh.org.tw/branch/hel/doctor/detail/5142']::text[],'看診很有耐心,常看到很晚, 不好掛號','BABY HOME 討論區',true,'已核實-1131019彥宇備註',null),
('rec-080','doctor','child','桃園市','桃園療養院','陳質采','{}'::text[],'看診仔細，很受小朋友歡迎。

1140303日更新，感謝提供意見與回饋~
「桃療陳質采醫師還沒有退休，目前只看舊病患，如果要掛號，需打電話到桃療青少年精神科報到室，分機2216請報到室人工掛號，可能這些病患看完她就真的退休了」','李如梅',true,'陳錦宏醫師也大力推薦喔-原備註。
1131019彥宇註記-質采醫師是非常厲害的醫師，我在進行兒少相關工作時很仰賴她，有許多孩子都是由她診療，是至關重要的人物。但目前應該是已經退休狀態。我網路上找不太到怎麼掛號...…。
1140303日更新，感謝提供意見與回饋~
「桃療陳質采醫師還沒有退休，目前只看舊病患，如果要掛號，需打電話到桃療青少年精神科報到室，分機2216請報到室人工掛號，可能這些病患看完她就真的退休了」',null),
('rec-081','other','all','桃園市','迎旭診所 / 台齡身心診所','陳麗卿','{}'::text[],'新竹區精神科方面(特別是過動兒專長)的前兩把交椅，有跟醫師們聊過，它們說全新竹市資歷最深的幾個，就是陳麗卿和林正修(精神科醫師反正不多XD)但是非常難掛到號','賴正瑋',true,'原台大新竹分院醫師。原推荐者推薦桃園區，排查發現也有在新竹縣，可參考。-1131010彥宇備註',null),
('rec-082','doctor','child','桃園市','聯新國際醫療壢新醫院','林博',array['https://www.landseedhospital.com.tw/tw/team/team_detail/%E7%B2%BE%E7%A5%9E%E7%A7%91%E8%BA%AB%E5%BF%83%E7%97%87%E9%96%80%E8%A8%BA/%E6%9E%97%E5%8D%9A']::text[],'兒子在苗栗看了快二年了，林醫師希望家長可以常和醫師討論小孩的狀況，對孩子的行為提出有效的改善方法（行為治療），若家長有問題，醫師也會一一的回答，林博醫師１０７年８月起，林醫師會改到桃園的壢新醫院服務，從醫師那裡學到許多方法來教ADHD的孩子。','呂蓓蓓',true,'已確認-1131010彥宇備註',null),
('rec-083','doctor','child','苗栗縣市','吳四維診所','吳四維',array['https://g.co/kgs/LStjB15']::text[],'吳醫生原本在頭份為恭醫院看診，是頭份地區兒童精神科權威，在吳醫生自行開業前，曾經看吳醫生的診等到半夜11點多，吳醫生對於兒童精神非常有研究，看診時會著重於與孩子對話，而非單方面聽家長陳述。','佺',true,'已確認-1131010彥宇備註',null),
('rec-084','doctor','all','苗栗縣市','為恭醫院','梁珪瑜',array['https://www.weigong.org.tw/CMUHPagesDetail/%E7%B6%B2%E8%B7%AF%E6%8E%9B%E8%99%9F%E5%AD%90%E9%A0%81%E9%9D%A2/%E4%B8%80%E8%88%AC%E7%B2%BE%E7%A5%9E%E7%A7%91(%E5%88%9D%E8%A8%BA)']::text[],'醫生雖然主要專長是看老人醫學，但以前是研究孩童學習，所以都有看診，醫生非常和藹，親切。','佺小妞',true,'該醫師為老年精神科主任，但一般精神科也有看診。另該醫師於馬大元診所 有看診。(新竹市光復路一段544巷36號)-1131010彥宇備註',null),
('rec-085','doctor','all','屏東縣','衛生福利部屏東醫院','林懷道',array['https://netreg.pntn.mohw.gov.tw/OINetReg.WebRwd/Reg/DoctorCalendar?DrId=1324']::text[],'林懷道醫師看診詳細,為人和善,細心耐心,講解病情,十分專業',null,true,'推薦人遺失。-1131010彥宇備註',null),
('rec-086','doctor','all','南投縣','佑民醫療社團法人佑民醫院','王雅甄',array['https://web.yumin.com.tw/OReg/OpoDoctorsVisitListPage?sectcategory=%E8%BA%AB%E5%BF%83%E9%86%AB%E5%AD%B8%E7%A7%91&sectid=500&sectname=%E8%BA%AB%E5%BF%83%E7%A7%91&showcd=N']::text[],'　','蔡佳芳',true,'原推荐醫院-草屯療養院社區中心-1131010彥宇備註',null),
('rec-087','doctor','child','南投縣','埔里基督教醫院','趙若梅',array['https://www.pch.org.tw/department_doctor.php?depid=13&id=113']::text[],'不只是兒童心智科醫師,而且是薩提爾的講師，',null,true,'原推薦人遺失-1131010彥宇備註',null),
('rec-088','doctor','all','花蓮縣','同心診所','王春惠',array['https://g.co/kgs/371uCjt']::text[],'她是位非常有耐心的好醫生，兒子每回看診都會跟醫生聊內心困擾的事，她也是慈濟醫院精神科主治醫生，尤其在用藥方面很小心，目前我兒小六了，每次回診都會跟醫生討論自己用藥的感受與心事。','洪至韻',true,'同心診所資料較難查詢，但有找到王春惠醫師自113年7月13日起，於台北市的心禾診所(週六)提供兒童青少年之精神科門診服務。-1131010彥宇備註',null),
('rec-089','doctor','all','宜蘭縣','五餅二魚身心科診所','吳俊漢',array['https://g.co/kgs/cL3sGCN']::text[],'我是今年才在這邊看的，但經過這幾個月的接觸下來，比我之前在宜蘭遇到的身心科都更適合ADHD，相當有耐心的評估、了解狀況，每個看診的時間比較長，可以比較有系統的分享與調整用藥。','謙謙',true,'已核實-1131010彥宇備註',null),
('rec-090','other','all','宜蘭縣','羅東平和身心診所','陳建州',array['https://g.co/kgs/9u3AXFA']::text[],'兒童青少年專科醫師. 有朋友成人去看很有耐心.
  由於宜蘭醫師不多. 如要找診所可以選擇','黃瑞佳',true,'已經核實，推薦成人-1131008彥宇備註',null),
('rec-091','other','all','臺南市','以恩身心科診所','范家彰','{}'::text[],'台中家扶中心推建','高銘',true,'原備註：前中國附醫醫師。-1131008彥宇備註以恩診所查無資料，故暫不推薦。',null),
('rec-092','doctor','all','臺南市','衛生福利部嘉南療養院','李冠瑩',array['https://webreg.cnpc.gov.tw/OINetReg.WebRwd/Reg/DoctorCalendar?DrId=0613']::text[],'　','呂晴天',true,'已核實-1131008彥宇備註',null),
('rec-093','doctor','all','臺南市','奇美醫院樹林院區','林健禾',array['http://sub.chimei.org.tw/57790/index.php/members/members01/33-members-list-01/38-chien-ho-lin']::text[],'光看一個醫師願意去念特教碩博士, 這一點就讓我感動.
  網路上看過很多他好的文章.','黃瑞佳',true,'該醫師有特教背景，以及相關文章，供家長參考。-1131008彥宇備註',null),
('rec-094','doctor','all','臺南市','麻大新樓醫院','黃韋哲',array['https://www.sinlau.org.tw/times_dept.asp?da=2&num=50']::text[],'麻豆新樓黃韋哲醫生，醫生人很好有耐心','莊惠美',true,'已檢核完畢-1131008彥宇備註',null),
('rec-095','other','all','臺南市','成大附醫','陳永榮',array['https://tandem.hosp.ncku.edu.tw/Tandem/DocRegTimeUI.aspx?Lang=&skv=%2fUOk0negQqyN%2f4gxXAbKlw%3d%3d']::text[],'　','YR Chen',true,'家長或成人ADHD推薦，但未有相關推薦訊息。就診科目為小兒神經科，目前可確認該醫師確實在成大有小兒神經科門診，供家長參考。-1131005彥宇備註',null),
('rec-096','doctor','all','臺南市','誼仁診所','李姿誼',array['https://www.facebook.com/yijenclinic?locale=zh_CN']::text[],'很有耐心. ','薛晴方/黃郁銘',true,'原推荐醫院為成大附醫，但經目前更新核實，查無李姿誼門診資訊，故改為較明確之診所資訊。-1131005彥宇備註',null),
('rec-097','doctor','child','臺南市','心樂活診所 / 成大附醫','紀美宏',array['https://mind-yoho.com/medical-team/doctor/']::text[],'女醫師，
  溫和，看診過程感覺不會讓人感覺壓力，小孩在診間也很自在(有玩具)','Sheauchii Chen',true,'於兩處看診，已核實可參考-1131005彥宇備註',null),
('rec-098','doctor','all','臺南市','台灣台南市立醫院','胡慧芳',array['https://www.tmh.org.tw/tmh2016/RegCal.aspx?Key=aDVodTZ1L011YzAyNG9DMHBrNlN6dz09']::text[],'胡醫師也是正念的督導. 常於正念.','Wei Hsu',true,'已核實可參考-1131005彥宇備註',null),
('rec-099','doctor','adult','臺南市','奇美醫院樹林院區','黃隆正',array['http://sub.chimei.org.tw/57790/index.php/members/members01/33-members-list-01/44-%E9%BB%83%E9%9A%86%E6%AD%A3%E4%B8%BB%E4%BB%BB']::text[],'國內率先開辦成人ADHD特別門診，呼籲醫界重視成人ADHD(2014，中時)，在門診過程中，自己若有任何疑問都會給予意見','Ju Fun',true,'原推荐者備註：雖然查詢的資料還甚少，但他也是位國內研究ADHD醫師之一。

備註：
有多筆推薦可參考。
少數直接標榜看16歲以上、成年ADHD的醫師，建議成A可考慮。
• 1.每週五上午黃隆正主任--「成人ADHD特別門診」，針對年齡16歲以上者；及「rTMS特別門診(重複經顱磁刺激特別門診」。
• 看診地點:奇美醫院樹林院區
• 2.「網路成癮防治門診-每週一下午及每週三下午」
• 看診地點：奇美醫院樹林院區
• 3.「網路成癮防治門診-每週五上午」
• 看診地點:奇美醫院
已核實可參考-1131005彥宇備註',null),
('rec-100','other','all','台北市','夏凱納生活診所','劉鴻徽',array['https://g.co/kgs/v4gFQyt']::text[],'醫生
  人非常溫和有耐性，願意傾聽，也會回應病人的疑惑，說話也很中性','JJ CIN',true,'已核實-1131005彥宇備註',null),
('rec-101','doctor','adult','台北市','臺北市立萬芳醫院','張勝傑',array['https://old.wanfang.gov.tw/p3_register_e3.aspx?depttype=B&deptcode=3600&doccode=64961']::text[],'我是成人去看，會一個問題一個問題問最近狀況；當又要重大事情時，會關心你，問你問題，幫助你釐清思緒。','賴品妤(黃瑞佳代填)',true,'原推薦備註該醫師在雙和醫院亦有門診。本次僅查核萬芳醫院。-1131005彥宇備註',null),
('rec-102','doctor','all','台北市','台北馬階醫院','劉惠青',array['https://www.mmh.org.tw/register_single_doctor.php?depid=21&did=602&area=tp']::text[],'　',null,true,'已核實-1131005彥宇備註',null),
('rec-103','doctor','all','台北市','新佑泉診所','葉佐偉',array['http://www.wellspsy.com.tw/']::text[],'PTT網友心聲:他是專門看兒童跟青少年的 雖然成人也非常的多
  但是我覺得他對於青少年的問題真 的很有研究 他可以體諒你的家庭 你的爸媽 你的老師 偶而跟你一起幹譙他們 XD','陳錦宏醫師',true,'已核實-1131005彥宇備註',null),
('rec-104','doctor','all','台北市','台北市立聯合醫院陽明分院','楊逸鴻',array['https://webreg.tpech.gov.tw/RegOnline1_2.aspx?ZCode=M&DeptCode=1300&deptname=%e7%b2%be%e7%a5%9e%e7%a7%91']::text[],'個人看了兩年多了~ 我的症狀:是位妥瑞兒~ 併有過動症 強迫症
  睡眠障礙 閱讀障礙 情緒障礙 擬身體化症 看了之後大幅改善!! 希望對大家有幫助~ 謝謝^"^','劉有哲',true,'妥瑞症互助會版主推薦。-1131005彥宇備註',null),
('rec-105','doctor','adult','台北市','三軍總醫院北投分院身心科 / 北辰身心醫學診所','楊立光','{}'::text[],'成人adhd，高醫師推薦，高淑芬醫師表示成人adhd可以找楊醫師-Amanda hsu
耐心謹慎診斷，建議方向明確，藥物處方劑量適宜~-傑克

1140318 比啾推薦

本來在其他醫院用心理衡鑑診斷是混合型ADHD，單純服用ADHD的藥物有效果但會造成其他情緒上的問題。但這個醫生在與我初診後，提出了我可能是躁鬱+偏ADD的狀況，所以加入治療躁鬱的藥物，在過程中可以感受到兩種藥在彼此影響，但撐過之後就明顯可以感受ADHD的藥物的效果（少了躁鬱的高度情緒起伏）
','Amanda hsu、傑克',true,'原推薦與備註修改：原推荐台大醫院，目前已查無該醫師資料。原備註：赤子心過動症總會前理事長何美華理事長推薦看成人ADHD。
已完成驗證，該名醫師在兩處任職，家長可以選擇比較好掛號的那邊。網址更新在醫院名稱裡，直接按下去就有超連結，希望可以讓家長感覺便利。-1130929彥宇備註

1140318更新夥伴 比啾 的推薦',null),
('rec-106','doctor','child','台北市','宇寧身心診所 / 林口長庚紀念醫院','吳佑佑','{}'::text[],'國內兒心科名醫之一，醫生人美又溫柔，會跟孩子聊天，會聽家長及孩子說話。','秦鳳雙',true,'原備註：林口長庚，聯合醫院松德院區也有少數門診。1130929日查詢林口長庚113年9月後停診，松德院區則查無該醫師掛號資訊。-1130929彥宇備註',null),
('rec-107','doctor','child','台北市','心禾診所','林亮吟','{}'::text[],'國內研究ADHD名醫之一，會跟孩子聊天。','吳迺慧',true,'原備註及推薦者著名該醫師於聯合醫院松德院區有看診，1130929日查詢已無該名醫師掛號資訊。-1130929彥宇備註',null),
('rec-108','doctor','child','台北市','台北市立關渡醫院 / 臺北榮民總醫院精神部','劉弘仁','{}'::text[],'對驚慌的家長超有耐心，願意陪伴半小時以上，對孩子也是正向鼓勵，極有愛心及醫德的好醫生，大推！！！','Amanda Wu',true,'已完成驗證，該名醫師在兩處任職，家長可以選擇比較好掛號的那邊。網址更新在醫院名稱裡，直接按下去就有超連結，希望可以讓家長感覺便利。-1130929彥宇備註',null),
('rec-109','doctor','child','台北市','遠東聯合診所 / 黃雅芬兒童心智診所','黃雅芬',array['https://www.xn--eh1ao52bmzf.tw/index-2_staff_Dr_Huang.html']::text[],'會跟小孩聊，會幫小孩備畫册和筆','台灣ADHD(注意力不足過動症)交流園地(家長匿名推薦)',true,'自費黃雅芬兒童心智診所。
黃醫師在兩處任職，診所部分是全自費診所，適合有經濟能力並需要快速得到幫助的家長-1130929彥宇備註',null),
('rec-110','doctor','all','台北市','國立臺灣大學醫學院附設醫院','高淑芬',array['https://reg.ntuh.gov.tw/webadministration/DoctorServiceQueryByDrName.aspx?HospCode=T0&QueryName=%E9%AB%98%E6%B7%91%E8%8A%AC']::text[],'目前不接受新病人','秦鳳雙/Amanda hsu',true,'僅接受初診，且113年的診已經全數停診。-1130929彥宇備註',null),
('rec-111','other','child','台北市','臺北榮民總醫院','陳牧宏',array['https://www.vghtpe.gov.tw/Index.action']::text[],'很專業. 很會找話跟孩子聊天, 對孩子很有耐心,
  門診時間也很願意開導家長, 
    讓家長理解小孩狀況, 且會跟家長討論治療方向, 非開藥為主的醫生
    會讓孩子家長了解現況.並給予家長方向

榮總兒童心理科的醫生都是精神科額外在經過訓練的醫生,
  在adhd 方面榮總醫師我覺得算是很專業
    若是第一次家長沒有方向的我會推薦去榮總
    避免走很多的冤枉路','sophia lee',true,'原備註：榮總兒童心理科的醫生都是精神科額外在經過訓練的醫生,
  在adhd 方面榮總醫師我覺得算是很專業
    若是第一次家長沒有方向的我會推薦去榮總
    避免走很多的冤枉路

已核實-1131104彥宇備註',null),
('rec-112','doctor','all','臺中市','大里仁愛醫院 / 嘉義長庚紀念醫院','陳錦宏',array['https://cghdpt.cgmh.org.tw/branch/jia']::text[],'　','黃瑞佳',true,'新病人可能需要醫師幫忙掛.',null),
('rec-113','doctor','child','臺中市','衛生福利部臺中醫院','章秉純',array['https://www03.taic.mohw.gov.tw/OINetReg.WebRwd/Reg/Dept']::text[],'聽過他與青少年的對話，真的是一位很棒有耐心與技巧的兒青科醫師。','tzuling
  huang',true,'原北榮醫師。衛生福利部臺中醫院有精神科及兒童青少年精神科，精神科需16歲以上才可掛號。目前查詢兒童精神科通常是掛號額滿狀態，但精神科比較好掛，因此成人ADHD可考慮。-1130929彥宇備註',null),
('rec-114','other','all','臺中市','新活力身心醫學診所','吳元欽',array['https://g.co/kgs/aZ3C7jv']::text[],'　','Rios Tsai',true,'已確認-1130929彥宇備註',null),
('rec-115','other','all','臺中市','佳樂身心診所','蔡佳叡',array['https://cheer-clinic.com/']::text[],'年輕新一代的身心科醫師.
  心動家族理事','黃瑞佳',true,'已確認-1130929彥宇備註',null),
('rec-116','doctor','child','臺中市','中山醫學大學附設醫院','朱柏全',array['https://www.csh.org.tw/']::text[],'家長推薦，問診有耐心','魏良各',true,'已確認-1130929彥宇備註',null),
('rec-117','other','child','臺中市','心森林身心診所','蕭亦伶',array['https://www.mindforest.com.tw/']::text[],'耐心的女醫師.
也常在台中心動家族演講. 社團媽媽推','黃瑞佳/王姝尹',true,'已確認-1130929彥宇備註',null),
('rec-118','doctor','all','臺中市','衛生福利部臺中醫院','蔡禮后',array['https://www03.taic.mohw.gov.tw/OINetReg.WebRwd/Reg/Dept']::text[],'很有耐心且細心問診，也讓孩子認識ADHD,讓我小孩悅納自己狀況，且評估後很尊重家長感受及提供良好建議供參考','台灣ADHD(注意力不足過動症)交流園地(家長匿名推薦)',true,'衛生福利部臺中醫院有精神科及兒童青少年精神科，精神科需16歲以上才可掛號。目前查詢兒童精神科通常是掛號額滿狀態，但精神科比較好掛，因此成人ADHD可考慮。-1130929彥宇備註',null),
('rec-119','doctor','child','臺中市','中山醫學大學附設醫院','廖尹鐸',array['https://www.csh.org.tw/']::text[],'陳錦宏醫師推薦，年輕、英俊、細心，能與孩子交心。可以成為ADHD孩子的哥兒們','魏良各',true,'已確認-1130929彥宇備註',null),
('rec-120','doctor','child','新竹縣市','中國醫藥大學新竹附設醫院','林洪異精神科醫師','{}'::text[],'願意先聽完孩子說，說完，機會教育，再最後問家長有無要補充，並確認孩子家長補充內容有出入或有想法之處，做家庭討論與溝通，並給予調整建議。','張00',true,'115年度最新版回報驗證（2026-02-23）','2026-02-23'),
('rec-121','doctor','all','臺中市','台安醫院（進化院區）','台安醫院（進化院區）陳錦宏醫師','{}'::text[],'醫師很有耐心（心動家族推動者）','Windy',true,'115年度最新版回報驗證（2026-02-23）','2026-02-23'),
('rec-122','therapy','child','新北市','米露谷心理諮商所（中和所）','吳翠殷臨床心理師',array['https://www.mirukupsy.com/3']::text[],'能精準的抓住自閉症光譜孩子的心理卡關的地方，也會一次次帶領孩子們突破自己的舒適圈。','Tracy',true,'115年度最新版回報驗證（2026-02-23）','2026-02-23'),
('rec-123','doctor','child','宜蘭縣','羅東聖母醫院','廖子賢主治醫師- 精神科',array['https://www.smh.org.tw/?aid=82&pid=83&page_name=detail&iid=252']::text[],'對孩子很有耐心、愛心、也會問的很詳細','慶齡',true,'115年度最新版回報驗證（2026-02-23）','2026-02-23'),
('rec-124','doctor','child','新竹縣市','能清安欣診所','余正元醫師',array['https://www.provenceclinic.com.tw/clinic.htm']::text[],'醫師具高度同理心，能耐心與家屬討論病情進行藥物調整，並給予照護建議。','捨眾',true,'115年度最新版回報驗證（2026-02-23）','2026-02-23'),
('rec-125','doctor','child','台北市','台大','高淑芬','{}'::text[],'願意陪孩子聊，以孩子的需求調整用藥','路卡',true,'115年度最新版回報驗證（2026-02-23）','2026-02-23'),
('rec-126','doctor','child','台北市','台北榮總','徐如維主任','{}'::text[],'徐如維主任溫柔的言語與眼神，聽得懂家長所說的話，判斷明確明快，回應家長摘要且明確，可再詢問其他問題','yaya',true,'115年度最新版回報驗證（2026-02-24）','2026-02-24'),
('rec-127','other','all','臺南市','成大醫院、心樂活診所/醫師','紀美紅',array['https://www.mindlohas.com.tw/doctor/%E5%BF%83%E6%A8%82%E6%B4%BB/detail/l1EP9V']::text[],'資料庫中的紀美紅醫師為誤植，應為紀美宏才對。','Silvia_K',true,'115年度最新版回報驗證（2026-02-24）','2026-02-24'),
('rec-128','doctor','all','台北市','亞東醫院','林育如','{}'::text[],'精神科醫師','深藍海豚',true,'115年度最新版回報驗證（2026-02-24）','2026-02-24'),
('rec-129','doctor','all','台北市','沐慕身心診所','陳宗杰醫師',array['https://www.lumosclinic.com.tw/']::text[],'陳醫師問診有耐心，溫和傾聽且鼓勵與肯定，對於成年後確診的ADHD討論用藥與身心狀況都很推薦。','鏡子',true,'115年度最新版回報驗證（2026-02-25）','2026-02-25'),
('rec-130','other','child','臺中市','中國醫','廖尹鐸醫師（異動）','{}'::text[],'目前廖醫師全面停診，不知道什麼時候會恢復','Luca',true,'115年度最新版回報驗證（2026-02-25）','2026-02-25'),
('rec-131','doctor','child','台北市','臺北市立聯合醫院中興院區兒童發展評估療育中心 何淑賢醫生','何淑賢','{}'::text[],'醫師很有耐心，幾乎每次問診都差不多在20分鐘，甚至醫生願意留email，若遇到緊急狀況寫信給醫生也很快能收到回信。','kt',true,'115年度最新版回報驗證（2026-03-06）','2026-03-06'),
('rec-132','doctor','child','臺南市','台南嘉南療養院','李冠瑩，謝建宏','{}'::text[],'有專業的心理資商師輔導','小米',true,'115年度最新版回報驗證（2026-03-06）','2026-03-06'),
('rec-133','therapy','adult','台北市','初色心理治療所','陳勁秀 心理師','{}'::text[],'除了諮商外，同時也是ADHD生活教練','milk',true,'115年度最新版回報驗證（2026-03-08）','2026-03-08'),
('rec-134','therapy','all','台北市','道南心理治療所','陳婉真/道南心理治療所所長',array['https://daonan.com.tw/index.aspx']::text[],'由政大心諮所新設立的道南心理治療所，所長陳婉真教授擁有多年臨床心理師經驗，非常溫柔、親切有耐心，每次諮商都能讓我放鬆、暢所欲言，每次諮商結束都像充電完畢，推薦！','Rosie',true,'115年度最新版回報驗證（2026-03-08）','2026-03-08')
on conflict (id) do update set
  category = excluded.category,
  audience = excluded.audience,
  region = excluded.region,
  hospital = excluded.hospital,
  doctor_or_name = excluded.doctor_or_name,
  urls = excluded.urls,
  experience = excluded.experience,
  recommender = excluded.recommender,
  verified = excluded.verified,
  verified_note = excluded.verified_note,
  updated_at = excluded.updated_at;
