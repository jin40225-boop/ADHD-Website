/**
 * 活動海報輪播 —— 首頁放在動畫首頁下方，服務子頁放在頁面最上方。
 *
 * 【分層連結，這是整個元件存在的理由】
 * 報名表裡沒有活動的整體說明，所以首頁不能把人直接丟進報名表：
 *   - 首頁：不管點哪一張，一律先進服務子頁，看完說明再自己決定要不要報名。
 *   - 服務子頁：人已經看過說明了，單場次才直接進報名表。
 *   - 協辦活動例外：本站不受理協辦報名（海報上寫「報名洽主辦單位」），
 *     所以捲到該場在協辦頁的段落，而不是送進一個不存在的報名表。
 *
 * 【已結束的場次留著，不下架】標「已結束」、灰階、排到最後、連結退回服務子頁。
 * 這和 SessionHistory 的判斷一致：累積本身就是內容，看得到才知道社群一直在動。
 *
 * 行為（可暫停的自動輪播、只有主角能被 Tab 到、說明層預設藏起來）沿用已驗收的
 * 原型 `首頁活動跑馬燈_樣板與決策_v2.html`，那份的 27 項測試是這個元件的規格。
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { POSTERS, type PosterItem, type ServiceSlug } from '@/content/posters';
import './activity-carousel.css';

export type CarouselPage = 'home' | ServiceSlug;

/** 每一頁的標題。同儕與協辦有自己的場次，其餘三頁只放別的服務，講法要誠實。 */
const HEADINGS: Record<CarouselPage, string> = {
  home: '推行中的活動',
  'peer-group': '近期聚會場次',
  'co-host': '近期協辦活動',
  parent: '也可以看看這些服務',
  navigator: '也可以看看這些服務',
  career: '也可以看看這些服務',
};

/** 沒有任何場次可放時的標題。標題必須跟著實際內容走，不能是寫死的謊。 */
const NO_SESSION_HEADING = '也可以看看這些服務';

/**
 * 標題要看「這一次實際挑出了什麼」，不能只看在哪一頁。
 *
 * 2027-01-01 那天會發生什麼：年度過濾會把 115 年的場次全部濾掉，而
 * `/peer-group` 又刻意不放自己的服務海報——於是「近期聚會場次」這個標題底下，
 * 會是家長諮詢／導航／職場／協辦四張別人的海報，一場聚會都沒有。
 * 這個專案沒有後台可以改標題，新增明年的海報要重新部署，所以它會自己發生。
 */
function headingFor(page: CarouselPage, items: PosterItem[]): string {
  if (page === 'home') return HEADINGS.home;
  return items.some((item) => item.kind === 'session') ? HEADINGS[page] : NO_SESSION_HEADING;
}

const AUTOPLAY_MS = 6000;
const REDUCE_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * 今天（Asia/Taipei）的 'YYYY-MM-DD'。
 *
 * 為什麼不用 `new Date()` 直接比：讀者在台灣，但瀏覽器時區是使用者說了算，
 * 資料庫存的又是 UTC。這個專案已經被「天真的日期比較」咬過一次——UTC 的
 * 「還沒到隔天」在台灣早就過了，場次會晚一個時段才消失。
 * 所以把時區釘死在 Asia/Taipei，取出字串再和同樣格式的字串比大小，
 * 全程不做時區換算，也就沒有換算錯的空間。en-CA 的日期格式剛好就是 YYYY-MM-DD。
 */
function todayInTaipei(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * 現在（Asia/Taipei）的 'YYYY-MM-DDTHH:mm'，和 `endsAt` 同格式，可以直接比大小。
 * 一樣不做任何時區換算——只是把「現在」用台北時區印出來。
 */
function nowInTaipei(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/**
 * 結束了沒。
 *
 * 有 `endsAt` 就比到分鐘——這樣才和報名頁那邊的 `ends_at >= now` 是同一條線。
 * 只比日期的話，活動當天結束後到午夜之前，海報會寫著「前往報名 →」，
 * 但點過去那一場已經從清單裡消失了。
 * 沒填 endsAt 時退回比日期，至少不會因為漏填一個欄位就整張卡的狀態全錯。
 */
function isEnded(item: PosterItem, today: string, now: string): boolean {
  if (item.kind !== 'session' || item.date === null) return false;
  return item.endsAt ? now >= item.endsAt : item.date < today;
}

/** 排序用的日期鍵：服務海報沒有日期，給一個永遠排在最後的哨兵值（＝原型的 9999-12-31）。 */
function sortKey(item: PosterItem): string {
  return item.date ?? '9999-12-31';
}

function pickPosters(page: CarouselPage, today: string, now: string): PosterItem[] {
  const year = today.slice(0, 4);
  const own = page === 'home' ? null : page;

  const picked = POSTERS.filter((item) => {
    if (item.kind === 'session') {
      // 只留當年度：跨年後自動換成新一年的活動，清單不會越長越長。
      if (item.date === null || item.date.slice(0, 4) !== year) return false;
      // 子頁只放自己的場次，不放別人的單場次（那是別人子頁的事）。
      return own === null || item.service === own;
    }
    // 服務海報：子頁不放自己那張，人已經在這一頁了。
    return own === null || item.service !== own;
  });

  // 排序鍵的順序：先看有沒有結束，再看是場次還是服務，最後才比日期。
  // 因為「已結束」是第一順位，實際排出來是
  //   還能報名的場次 → 服務海報 → 已結束的場次
  // 也就是**墊底的是已結束的場次，不是服務海報**。這符合「已結束排到最後」的要求。
  return picked.sort((a, b) => {
    const endedGap = (isEnded(a, today, now) ? 1 : 0) - (isEnded(b, today, now) ? 1 : 0);
    if (endedGap !== 0) return endedGap;
    const kindGap = (a.kind === 'service' ? 1 : 0) - (b.kind === 'service' ? 1 : 0);
    if (kindGap !== 0) return kindGap;
    return sortKey(a).localeCompare(sortKey(b));
  });
}

/** 點下去去哪。注意不要帶 BASE_URL，basename 由 router 統一處理（見 src/router.tsx）。 */
function linkTo(item: PosterItem, page: CarouselPage, today: string, now: string): string {
  if (page === 'home') return `/${item.service}`;
  if (item.kind === 'service') return `/${item.service}`;
  if (isEnded(item, today, now)) return `/${item.service}`;
  // 沒有 anchor 就退回協辦頁本身。原本寫成 `#${anchor ?? ''}`，少填一個欄位就會產出
  // `/co-host#`——點下去什麼都不會發生，而且從畫面上看不出是資料漏填。
  if (item.service === 'co-host') return item.anchor ? `/co-host#${item.anchor}` : '/co-host';
  return `/${item.service}/register`;
}

function ctaText(item: PosterItem, page: CarouselPage, today: string, now: string): string {
  if (page === 'home') return '看服務說明 →';
  if (item.kind === 'service') return '前往這個服務 →';
  if (isEnded(item, today, now)) return '活動已結束・看服務說明 →';
  if (item.service === 'co-host') return '看這場的詳細說明 →';
  return '前往報名 →';
}

function altText(item: PosterItem): string {
  return item.kind === 'session'
    ? `${item.title}活動海報，${item.meta}`
    : `${item.title}服務海報`;
}

export function ActivityCarousel({ page }: { page: CarouselPage }) {
  // 今天只在掛載時算一次：頁面停在瀏覽器裡跨過午夜是罕見情境，
  // 為它掛一個定時器換來的是每天多一次無謂的重排。重新整理就會更新。
  const [today] = useState(todayInTaipei);
  const [now] = useState(nowInTaipei);
  const items = useMemo(() => pickPosters(page, today, now), [page, today, now]);

  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false); // 使用者按了暫停鈕
  const [hovered, setHovered] = useState(false); // 游標或焦點停在輪播上
  const [reduceMotion, setReduceMotion] = useState(false);
  const [inView, setInView] = useState(false);
  const [shift, setShift] = useState(0);

  const titleId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);

  // 換頁時回到第一張，順便避免舊的 index 超出新清單長度。
  useEffect(() => {
    setIndex(0);
  }, [items]);

  // 系統偏好可能在使用期間被改（作業系統的無障礙設定就在旁邊），所以要訂閱 change，
  // 不能只在掛載時讀一次。初值放在 effect 裡讀，避免 SSR／測試環境沒有 matchMedia 就爆掉。
  useEffect(() => {
    const mq = window.matchMedia(REDUCE_MOTION);
    const sync = (event: MediaQueryListEvent) => setReduceMotion(event.matches);
    setReduceMotion(mq.matches);
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // 主角置中：量出它的中心與舞台中心的差，整條軌道位移過去。
  // 用 layout effect 是因為要在瀏覽器畫之前算完，否則第一幀會看到軌道從最左邊滑進來。
  useLayoutEffect(() => {
    const measure = () => {
      const stage = stageRef.current;
      const active = slideRefs.current[index];
      if (!stage || !active) return;
      setShift(active.offsetLeft + active.offsetWidth / 2 - stage.clientWidth / 2);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [index, items]);

  // 捲到看得見才開始自動播放。
  //
  // 首頁的輪播落在第一屏下緣（375×812 的手機上起點約 y=814，剛好在摺線下 2px），
  // 多數訪客根本沒捲到它。若一掛載就開始跑，一輪 72 秒會把 13 張海報共約 1.35 MB
  // 全部抓下來——在行動網路上，為了一個沒被看到的區塊付流量。
  // 順帶也讓「暫停」這件事更誠實：畫面外的東西本來就不該在動。
  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true); // 環境不支援就照舊播，不要因為偵測不到而整個不會動
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => setInView(entries.some((entry) => entry.isIntersecting)),
      { rootMargin: '0px 0px -20% 0px' },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [items.length]);

  // 自動換頁。任一條件成立就停：按了暫停、游標/焦點停在上面、系統要求減少動態效果、
  // 或整個區塊還沒進入視野。
  useEffect(() => {
    if (held || hovered || reduceMotion || !inView || items.length < 2) return undefined;
    const timer = window.setInterval(
      () => setIndex((value) => (value + 1) % items.length),
      AUTOPLAY_MS,
    );
    return () => window.clearInterval(timer);
  }, [held, hovered, reduceMotion, inView, items.length]);

  if (items.length === 0) return null;

  const heading = headingFor(page, items);

  const step = (delta: number) =>
    setIndex((value) => (value + delta + items.length) % items.length);

  return (
    <section
      className="ac"
      ref={sectionRef}
      aria-labelledby={titleId}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      // 焦點的暫停必須掛在整個區塊上，不能只掛在圖片軌道上：上一張／下一張／暫停
      // 與 13 顆圓點都在軌道之外。原本只掛在軌道上，鍵盤使用者在圓點之間 Tab 時，
      // 圖片仍每 6 秒換一次，連 aria-current 和「哪一個連結可被 Tab」都跟著跳。
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <div className="ac-head">
        {/* 這裡刻意不用 <h2>：輪播排在服務頁的最上方，用標題標籤會讓文件出現
            「h2 在 h1 之前」的錯誤層級。改用段落＋aria-labelledby，區塊照樣有名字，
            也不會和 <section aria-label> 重複念一次。 */}
        <p className="ac-title" id={titleId}>
          <span className="ac-dot" aria-hidden="true" />
          {heading}
        </p>
        <div className="ac-ctl">
          <span className="ac-count">
            {index + 1} / {items.length}
          </span>
          <button type="button" aria-label="上一張" onClick={() => step(-1)}>
            ‹
          </button>
          <button type="button" aria-label="下一張" onClick={() => step(1)}>
            ›
          </button>
          {/* 暫停鈕是 WCAG 2.2 SC 2.2.2 的硬性要求：自動播放超過五秒就必須有明確的
              暫停方式。「移到上面就停」不算——觸控裝置根本沒有 hover。
              只有在「完全不會自動播放」（減少動態效果）時才可以拿掉，因為沒有東西可暫停。 */}
          {!reduceMotion && (
            <button type="button" aria-pressed={held} onClick={() => setHeld((value) => !value)}>
              {held ? '繼續' : '暫停'}
            </button>
          )}
        </div>
      </div>

      <div className="ac-stage" ref={stageRef}>
        <div
          className={`ac-rail${reduceMotion ? ' ac-rail--still' : ''}`}
          style={{ transform: `translateX(${-shift}px)` }}
        >
          {items.map((item, i) => {
            const active = i === index;
            const ended = isEnded(item, today, now);
            return (
              <div
                key={item.id}
                ref={(node) => {
                  slideRefs.current[i] = node;
                }}
                className={`ac-slide${active ? ' is-active' : ''}${ended ? ' is-ended' : ''}`}
              >
                <Link
                  to={linkTo(item, page, today, now)}
                  // 只有主角可以被 Tab 到。焦點若落在畫面外的卡片上，瀏覽器會自己去捲
                  // 那個被 transform 推出去的容器，整條軌道就歪掉了。
                  tabIndex={active ? 0 : -1}
                >
                  <img
                    src={`${import.meta.env.BASE_URL}assets/posters/${item.id}.webp`}
                    alt={altText(item)}
                    loading={active ? 'eager' : 'lazy'}
                    width={640}
                    height={960}
                  />
                  {ended && <span className="ac-ended">已結束</span>}
                  <div className="ac-chrome">
                    <span className={`ac-kind${item.kind === 'service' ? ' ac-kind--svc' : ''}`}>
                      {item.kind === 'service' ? '服務' : '場次'}
                    </span>
                    <div className="ac-name">{item.title}</div>
                    <div className="ac-when">{item.meta}</div>
                    <div className="ac-go">{ctaText(item, page, today, now)}</div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      <div className="ac-dots">
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            aria-label={`第 ${i + 1} 張，共 ${items.length} 張`}
            aria-current={i === index}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </section>
  );
}
