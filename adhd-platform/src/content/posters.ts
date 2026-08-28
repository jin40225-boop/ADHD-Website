/**
 * 活動海報清單 —— 首頁與服務子頁輪播的唯一資料來源。
 *
 * 【為什麼是手寫在程式裡，不是資料庫欄位】
 * 站上的場次本來就在 Supabase（`sessions_public`），一開始的直覺是替場次加一個
 * `poster_url` 欄位讓輪播自動長出來。負責人明確選了「手寫清單」這條路，理由是：
 *   1. 海報不是每個場次都有。家長諮詢、導航計畫、職場諮詢的「場次」其實是諮詢時段、
 *      沒有講題，硬做海報會出現十張只差日期的圖，看起來像出錯；能做成海報的只有
 *      同儕聚會與協辦活動。資料庫欄位會讓「有沒有海報」變成每一列都要照顧的狀態。
 *   2. 這裡的五張服務海報（svc-*）在資料庫裡根本沒有對應的列——它們是服務本身，
 *      不是場次。要進資料庫得先為它們造一張表，成本遠高於這份清單。
 *   3. 負責人的原話是「我請你處理就好了」：新增活動由開發者代改，不需要後台。
 *
 * 【代價，講在前面】新增或修改一場活動 = 改這個檔 + 重新部署，沒有後台可以改。
 * 這是已經被接受的代價，不是還沒做完的功能。要加一場活動就：
 *   把 webp 放進 `public/assets/posters/<id>.webp`（640×960），在下面 POSTERS 加一列，
 *   `id` 必須和檔名一致（元件直接用 id 組圖片路徑），然後部署。
 *
 * 過期場次不從這裡刪：元件會依 Asia/Taipei 的今天標「已結束」、排到最後，
 * 並且只留當年度的場次——跨年後舊的自然消失，這份清單不會無限長。
 */

export type PosterKind = 'session' | 'service';
export type ServiceSlug = 'parent' | 'navigator' | 'career' | 'peer-group' | 'co-host';

export interface PosterItem {
  /** 同時是 `public/assets/posters/<id>.webp` 的檔名主幹，兩邊必須一致。 */
  id: string;
  kind: PosterKind;
  service: ServiceSlug;
  /** 場次是 'YYYY-MM-DD'；服務海報沒有日期，用 null 明講「不參與年度與過期判斷」。 */
  date: string | null;
  /**
   * 場次的結束時間，台北當地時間、`YYYY-MM-DDTHH:mm`，沒有時區後綴。
   *
   * 為什麼需要它：判斷「結束了沒」如果只看日期，活動當天下午結束到午夜之前這幾個小時，
   * 海報還會寫著「前往報名 →」並連到報名頁——而報名頁用 `ends_at >= now` 過濾，
   * 那一場早就不在清單裡了。點過去看不到自己要報名的那場，是最容易讓人以為網站壞掉的情況。
   * 存成字串、和同格式的字串比大小，全程不做時區換算。
   */
  endsAt: string | null;
  title: string;
  meta: string;
  /** 只有協辦場次有：協辦活動本站不受理報名，點下去改捲到該場的段落。 */
  anchor?: string;
}

export const POSTERS: PosterItem[] = [
  {
    id: 'peer-0906',
    kind: 'session',
    service: 'peer-group',
    date: '2026-09-06',
    endsAt: '2026-09-06T16:00',
    title: '我獨自工作',
    meta: '9/6（日）14:00 線上',
  },
  {
    id: 'cohost-0915',
    kind: 'session',
    service: 'co-host',
    date: '2026-09-15',
    endsAt: '2026-09-15T21:30',
    title: '孩子該跟誰？',
    meta: '9/15（二）19:00 實體',
    anchor: 'event-0915',
  },
  {
    id: 'cohost-0919',
    kind: 'session',
    service: 'co-host',
    date: '2026-09-19',
    endsAt: '2026-09-19T16:00',
    title: '保健食品怎麼吃？',
    meta: '9/19（六）14:00 線上',
    anchor: 'event-0919',
  },
  {
    id: 'peer-1011',
    kind: 'session',
    service: 'peer-group',
    date: '2026-10-11',
    endsAt: '2026-10-11T16:00',
    title: '從興趣走向事業',
    meta: '10/11（日）14:00 線上',
  },
  {
    id: 'cohost-1024',
    kind: 'session',
    service: 'co-host',
    date: '2026-10-24',
    endsAt: '2026-10-24T16:00',
    title: 'IEP 一百個問題',
    meta: '10/24（六）14:00 線上',
    anchor: 'event-1024',
  },
  {
    id: 'peer-1108',
    kind: 'session',
    service: 'peer-group',
    date: '2026-11-08',
    endsAt: '2026-11-08T16:00',
    title: '握緊方向盤的自信',
    meta: '11/8（日）14:00 線上',
  },
  {
    id: 'peer-1220',
    kind: 'session',
    service: 'peer-group',
    date: '2026-12-20',
    endsAt: '2026-12-20T16:00',
    title: '聊聊理財這件事',
    meta: '12/20（日）14:00 線上',
  },
  {
    id: 'cohost-1226',
    kind: 'session',
    service: 'co-host',
    date: '2026-12-26',
    endsAt: '2026-12-26T16:00',
    title: '按下教養的暫停鍵',
    meta: '12/26（六）14:00 線上',
    anchor: 'event-1226',
  },
  {
    id: 'svc-parent',
    kind: 'service',
    service: 'parent',
    date: null,
    endsAt: null,
    title: '家長諮詢服務',
    meta: '免費公益・每月 2 個名額',
  },
  {
    id: 'svc-navigator',
    kind: 'service',
    service: 'navigator',
    date: null,
    endsAt: null,
    title: '導航計畫',
    meta: '申請制・每月 1 位',
  },
  {
    id: 'svc-career',
    kind: 'service',
    service: 'career',
    date: null,
    endsAt: null,
    title: '職場與生活適應',
    meta: '成人專屬・每兩個月一場',
  },
  {
    id: 'svc-peer-group',
    kind: 'service',
    service: 'peer-group',
    date: null,
    endsAt: null,
    title: '線上同儕聚會',
    meta: '每月一場・週日下午',
  },
  {
    id: 'svc-co-host',
    kind: 'service',
    service: 'co-host',
    date: null,
    endsAt: null,
    title: '協辦活動',
    meta: '講座・座談・工作坊',
  },
];
