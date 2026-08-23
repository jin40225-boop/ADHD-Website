import { ChevronLeft, ChevronRight, ExternalLink, Menu, Pause, Play, Route, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './journey-integration.css';

const BASE = import.meta.env.BASE_URL;

const SLIDES = [
  {
    image: `${BASE}assets/journey/hero-stones.webp`,
    alt: '眾人一起鋪設踏石，陪伴家庭走向支持圈的水彩場景',
    kicker: '從一個人的經驗出發',
    title: '我們一起走到這裡',
    copy: '這不是一個人的成果。是一群人把經驗、專業與信任，一塊一塊接成可以同行的路。',
  },
  {
    image: `${BASE}assets/journey/hero-map.webp`,
    alt: '家庭與工作者共同把經驗整理成支持地圖的水彩場景',
    kicker: '把走過的路整理成入口',
    title: '讓需要的人，少繞一點路',
    copy: '家長支持、成人同儕、心理師導航、職場生活與合作活動，都能從這裡直接開始。',
  },
  {
    image: `${BASE}assets/journey/hero-network.webp`,
    alt: '不同專業伸出協作線，交織成支持網的水彩場景',
    kicker: '謝謝每一次同行',
    title: '一個網站，也是一張支持網',
    copy: '完整歷程是選配，網站功能永遠在旁邊。你可以看故事，也可以現在就去需要的地方。',
  },
] as const;

const SERVICES = [
  { to: '/parent', mark: '家', label: '家長支持', note: '親職諮詢與陪伴' },
  { to: '/peer-group', mark: '伴', label: '成人同儕', note: '大A線上互助聚會' },
  { to: '/navigator', mark: '航', label: '心理師導航', note: '釐清狀態與下一步' },
  { to: '/career', mark: '職', label: '職場與生活', note: '任務、人際與適應' },
  { to: '/co-host', mark: '聚', label: '協辦活動', note: '社群與合作活動' },
] as const;

const RESOURCES = [
  { to: '/map', label: '推薦地圖' },
  { to: '/guide', label: '新手指南' },
  { to: '/articles', label: '文章與社群' },
  { to: '/instructors', label: '合作講師' },
] as const;

type PreviewRouteMessage = { type?: string; path?: string };

export function JourneyIntegrationHero() {
  const navigate = useNavigate();
  const [slide, setSlide] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const launchRef = useRef<HTMLButtonElement>(null);
  const exitRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!playing || reduceMotion || journeyOpen) return undefined;
    const timer = window.setInterval(() => setSlide((value) => (value + 1) % SLIDES.length), 6200);
    return () => window.clearInterval(timer);
  }, [journeyOpen, playing]);

  useEffect(() => {
    if (!journeyOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => exitRef.current?.focus(), 40);

    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (menuOpen) setMenuOpen(false);
      else setJourneyOpen(false);
    };
    const handleMessage = (event: MessageEvent<PreviewRouteMessage>) => {
      if (event.data?.type !== 'adhd-preview-route' || typeof event.data.path !== 'string') return;
      setJourneyOpen(false);
      setMenuOpen(false);
      navigate(event.data.path);
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('message', handleMessage);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('message', handleMessage);
    };
  }, [journeyOpen, menuOpen, navigate]);

  const closeJourney = () => {
    setJourneyOpen(false);
    setMenuOpen(false);
    window.setTimeout(() => launchRef.current?.focus(), 40);
  };

  const changeSlide = (direction: number) => {
    setPlaying(false);
    setSlide((value) => (value + direction + SLIDES.length) % SLIDES.length);
  };

  return (
    <>
      <section className="jh-hero" aria-labelledby="jh-title">
        <div className="jh-scenes" aria-live="polite">
          {SLIDES.map((item, index) => (
            <figure className={`jh-scene ${index === slide ? 'is-active' : ''}`} key={item.image} aria-hidden={index !== slide}>
              <img src={item.image} alt={index === slide ? item.alt : ''} width="1600" height="1000" />
            </figure>
          ))}
        </div>
        <div className="jh-shade" aria-hidden="true" />

        <div className="jh-inner">
          <div className="jh-meta-row">
            <span className="jh-preview-mark">歷程與謝誌 · 一路同行</span>
            <span className="jh-count" aria-label={`第 ${slide + 1} 張，共 ${SLIDES.length} 張`}>
              {String(slide + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
            </span>
          </div>

          <div className="jh-copy" key={slide}>
            <p className="jh-kicker">{SLIDES[slide].kicker}</p>
            <h1 id="jh-title">{SLIDES[slide].title}</h1>
            <p className="jh-lead">{SLIDES[slide].copy}</p>
            <div className="jh-actions">
              <button ref={launchRef} className="jh-primary" type="button" onClick={() => setJourneyOpen(true)}>
                <Route aria-hidden="true" /> 走進完整歷程
              </button>
              <a className="jh-secondary" href="#actions">直接使用網站功能</a>
            </div>
          </div>

          <div className="jh-controls" aria-label="首頁暖場控制">
            <button type="button" onClick={() => changeSlide(-1)} aria-label="上一張"><ChevronLeft /></button>
            <div className="jh-dots" role="group" aria-label="選擇暖場畫面">
              {SLIDES.map((item, index) => (
                <button
                  type="button"
                  className={index === slide ? 'is-active' : ''}
                  aria-label={`顯示第 ${index + 1} 張：${item.title}`}
                  aria-current={index === slide ? 'true' : undefined}
                  onClick={() => { setSlide(index); setPlaying(false); }}
                  key={item.title}
                />
              ))}
            </div>
            <button type="button" onClick={() => changeSlide(1)} aria-label="下一張"><ChevronRight /></button>
            <button type="button" className="jh-play" onClick={() => setPlaying((value) => !value)} aria-pressed={playing}>
              {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
              <span>{playing ? '暫停' : '播放'}</span>
            </button>
          </div>

          <nav className="jh-service-deck" aria-label="快速前往正式站服務">
            {SERVICES.map((service) => (
              <Link to={service.to} className="jh-service" key={service.to}>
                <span className="jh-service-mark" aria-hidden="true">{service.mark}</span>
                <span><b>{service.label}</b><small>{service.note}</small></span>
                <ExternalLink aria-hidden="true" />
              </Link>
            ))}
          </nav>
        </div>
      </section>

      {journeyOpen ? (
        <div className="jh-overlay" role="dialog" aria-modal="true" aria-label="ADHD 歷程與謝誌完整導覽">
          <header className="jh-overlay-bar">
            <div className="jh-overlay-brand">
              <span>1</span>
              <div><b>ADHD 家長支持平台</b><small>歷程與謝誌 · 完整導覽</small></div>
            </div>
            <nav className="jh-overlay-links" aria-label="導覽中的正式站功能">
              {SERVICES.slice(0, 4).map((service) => <Link to={service.to} onClick={closeJourney} key={service.to}>{service.label}</Link>)}
            </nav>
            <div className="jh-overlay-actions">
              <button type="button" onClick={() => setMenuOpen(true)} aria-expanded={menuOpen} aria-controls="jh-site-menu"><Menu /> <span>網站功能</span></button>
              <button ref={exitRef} className="is-exit" type="button" onClick={closeJourney}><X /> <span>退出歷程</span></button>
            </div>
          </header>
          <iframe className="jh-frame" src={`${BASE}journey-integration-v4.html#journey`} title="我們一起走到這裡：ADHD 歷程與謝誌" />

          <button className={`jh-menu-backdrop ${menuOpen ? 'is-open' : ''}`} type="button" aria-label="關閉網站功能選單" onClick={() => setMenuOpen(false)} />
          <aside className={`jh-menu ${menuOpen ? 'is-open' : ''}`} id="jh-site-menu" aria-hidden={!menuOpen}>
            <div className="jh-menu-head"><div><small>不必看完整導覽</small><h2>現在就去你需要的地方</h2></div><button type="button" onClick={() => setMenuOpen(false)} aria-label="關閉"><X /></button></div>
            <p>這裡連到正式站原有路由；離開後會回到一般網站操作，不會被留在導覽裡。</p>
            <div className="jh-menu-services">
              {SERVICES.map((service) => (
                <Link to={service.to} onClick={closeJourney} key={service.to}><i>{service.mark}</i><span><b>{service.label}</b><small>{service.note}</small></span><strong>→</strong></Link>
              ))}
            </div>
            <h3>資源入口</h3>
            <div className="jh-menu-resources">
              {RESOURCES.map((resource) => <Link to={resource.to} onClick={closeJourney} key={resource.to}>{resource.label}</Link>)}
            </div>
            <button className="jh-menu-home" type="button" onClick={() => { closeJourney(); navigate('/'); }}>回到整合首頁</button>
          </aside>
        </div>
      ) : null}
    </>
  );
}
