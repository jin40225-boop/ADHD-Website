import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, CheckCircle2, ExternalLink, PlusCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { Recommendation } from '@contracts/types';
import { ApiError, getPublicRecommendations } from '../../lib/api';
import recommendationsData from '../../data/recommendations.json';


const CATEGORY_LABELS: Record<string, string> = {
  all: '全部類型',
  doctor: '精神科/身心科診所與醫院',
  assessment: '心理與特教評估',
  therapy: '心理諮商與職能治療',
  community: '支持社群與相關資源',
  other: '其他資源'
};

const AUDIENCE_LABELS: Record<string, string> = {
  all: '不限對象',
  child: '兒童/青少年 ADHD',
  adult: '成人 ADHD'
};

/** 一次顯示幾家機構；其餘由「載入更多」逐批補上。 */
const GROUP_PAGE_SIZE = 20;
/** 推薦內容短於此長度者，收成一行顯示，不與長篇經驗爭卡片高度。 */
const SHORT_EXPERIENCE_LIMIT = 30;

/** 機構名稱結尾若是這些字樣，才允許用「前綴包含」判定為同一家。 */
const ORG_NAME_SUFFIX = /(醫院|診所|療養院|治療所|諮商所|醫學中心|附醫)$/;

/**
 * 機構名稱正規化：去空白、臺/台一致、去除法人與主管機關前綴、
 * 「紀念醫院」視同「醫院」、去掉尾端的「◯◯分院／院區」。
 * 只做寫法層級的統一，不推測任何未寫在資料裡的資訊。
 */
function normalizeHospital(raw: string): string {
  const original = (raw || '').trim();
  if (!original) return '';
  let s = original.replace(/\s+/g, '').replace(/臺/g, '台');
  s = s.replace(/^.*?(?:醫療|社團|財團)法人/, '');
  s = s.replace(/^衛生福利部/, '');
  s = s.replace(/紀念醫院/g, '醫院');
  const branch = s.match(/^(.*(?:醫院|療養院|診所))(.{0,4}(?:分院|院區))$/);
  if (branch) s = branch[1];
  return s || original;
}

/**
 * 同一地區內解析簡寫：「長庚」→「長庚醫院」、「台大醫院」→「台大醫院雲林分院及虎尾分院」。
 * 只有在唯一對應時才合併；有兩個以上候選就保持原樣，寧可不合併也不合併錯。
 */
function resolveAliases(keys: string[]): Map<string, string> {
  const keySet = new Set(keys);
  const direct = new Map<string, string>();
  for (const key of keys) {
    let target = key;
    if (keySet.has(`${key}醫院`)) {
      target = `${key}醫院`;
    } else if (key.length >= 4 && ORG_NAME_SUFFIX.test(key)) {
      const longer = keys.filter(other => other !== key && other.startsWith(key));
      if (longer.length === 1) target = longer[0];
    }
    direct.set(key, target);
  }
  // 解開 A→B→C 這種鏈；最多三跳，並防環。
  const resolved = new Map<string, string>();
  for (const key of keys) {
    let cur = key;
    for (let i = 0; i < 3; i += 1) {
      const next = direct.get(cur) ?? cur;
      if (next === cur) break;
      cur = next;
    }
    resolved.set(key, cur);
  }
  return resolved;
}

interface InstitutionGroup {
  key: string;
  region: string;
  /** 卡片標題：取該群組裡出現最多次（同票取最完整）的原始機構名稱。 */
  displayName: string;
  items: Recommendation[];
}

/** 先篩選、後彙整：篩選邏輯完全不變，這裡只改變同一批結果的呈現方式。 */
function groupByInstitution(items: Recommendation[]): InstitutionGroup[] {
  const perRegion = new Map<string, Map<string, Recommendation[]>>();

  for (const item of items) {
    const region = item.region || '未填寫地區';
    const norm = normalizeHospital(item.hospital) || `__id__${item.id}`;
    if (!perRegion.has(region)) perRegion.set(region, new Map());
    const bucket = perRegion.get(region)!;
    if (!bucket.has(norm)) bucket.set(norm, []);
    bucket.get(norm)!.push(item);
  }

  const merged = new Map<string, InstitutionGroup>();
  const finalOrder: string[] = [];

  for (const [region, bucket] of perRegion) {
    const aliases = resolveAliases(Array.from(bucket.keys()));
    for (const [norm, rows] of bucket) {
      const canonical = aliases.get(norm) ?? norm;
      const key = `${region}||${canonical}`;
      if (!merged.has(key)) {
        merged.set(key, { key, region, displayName: '', items: [] });
        finalOrder.push(key);
      }
      merged.get(key)!.items.push(...rows);
    }
  }

  // 依「地區首次出現、機構首次出現」的順序輸出，維持與原始資料一致的閱讀動線。
  const groups = finalOrder.map(key => merged.get(key)!);

  for (const group of groups) {
    const tally = new Map<string, number>();
    for (const item of group.items) {
      const name = (item.hospital || '').trim();
      if (!name) continue;
      tally.set(name, (tally.get(name) ?? 0) + 1);
    }
    // 有些登錄把醫師姓名寫進了院所欄位，這種寫法不適合當卡片標題。
    const doctorNames = group.items
      .map(i => (i.doctorOrName || '').trim())
      .filter(n => n.length >= 2);
    const candidates = Array.from(tally.keys());
    const clean = candidates.filter(name => !doctorNames.some(d => d !== name && name.includes(d)));
    const pool = clean.length > 0 ? clean : candidates;

    let best = '';
    let bestCount = -1;
    for (const name of pool) {
      const count = tally.get(name) ?? 0;
      if (count > bestCount || (count === bestCount && name.length > best.length)) {
        best = name;
        bestCount = count;
      }
    }
    group.displayName = best || '未填寫院所';
  }

  return groups;
}

export default function RecommendationMapPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>(recommendationsData as Recommendation[]);
  const [sourceLabel, setSourceLabel] = useState('內建備份（2026-07-11）');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAudience, setSelectedAudience] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await getPublicRecommendations();
        if (!cancelled && rows.length > 0) {
          setRecommendations(rows);
          setSourceLabel('線上資料庫');
        }
      } catch (err) {
        if (!cancelled && !(err instanceof ApiError && err.code === 'NOT_READY')) {
          setSourceLabel('內建備份（線上同步暫時失敗）');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const regions = useMemo(() => {
    const set = new Set(recommendations.map(r => r.region));
    return ['all', ...Array.from(set)];
  }, [recommendations]);

  const filtered = useMemo(() => {
    return recommendations.filter(item => {
      if (selectedRegion !== 'all' && item.region !== selectedRegion) return false;
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (selectedAudience !== 'all' && item.audience !== selectedAudience && item.audience !== 'all') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchHospital = item.hospital?.toLowerCase().includes(q);
        const matchDoctor = item.doctorOrName?.toLowerCase().includes(q);
        const matchExp = item.experience?.toLowerCase().includes(q);
        if (!matchHospital && !matchDoctor && !matchExp) return false;
      }
      return true;
    });
  }, [recommendations, selectedRegion, selectedCategory, selectedAudience, searchQuery]);

  const groups = useMemo(() => groupByInstitution(filtered), [filtered]);

  // 卡片標題以「全部資料」算出，篩選前後才不會忽長忽短。
  const stableNames = useMemo(
    () => new Map(groupByInstitution(recommendations).map(g => [g.key, g.displayName])),
    [recommendations]
  );

  const [visibleGroups, setVisibleGroups] = useState(GROUP_PAGE_SIZE);
  useEffect(() => {
    setVisibleGroups(GROUP_PAGE_SIZE);
  }, [selectedRegion, selectedCategory, selectedAudience, searchQuery, recommendations]);

  const shownGroups = groups.slice(0, visibleGroups);
  const shownCount = shownGroups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <div className="min-h-screen bg-cream text-brown py-12 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-base-yellow border-2 border-brown rounded-3xl p-6 md:p-8 shadow-warm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="inline-block bg-teal text-brown font-bold text-xs px-3 py-1 rounded-full border border-brown mb-2">
              ADHD 就醫與支援資料庫
            </span>
            <h1 className="text-3xl md:text-4xl font-extrabold text-brown">就醫與專業支持地圖</h1>
            <p className="mt-2 text-brown/90 text-sm md:text-base">
              彙整由大A與家長親身推薦的友善醫師、心理師與機構經驗。本資料庫堅持正向推薦政策。
            </p>
          </div>
          <Link
            to="/map/submit"
            className="inline-flex items-center gap-2 bg-white border-2 border-brown px-5 py-3 rounded-2xl font-bold shadow-warm-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-warm transition-all"
          >
            <PlusCircle className="w-5 h-5 text-highlight" />
            投稿推薦醫師/資源
          </Link>
        </div>

        {/* Filter Bar */}
        <div className="bg-white border-2 border-brown rounded-2xl p-6 shadow-warm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search Box */}
            <div className="md:col-span-2 relative">
              <Search className="w-5 h-5 text-brown/50 absolute left-3 top-3.5" />
              <input
                type="text"
                placeholder="搜尋醫院名稱、醫師姓名或經驗關鍵字..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-cream border-2 border-brown rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-teal"
              />
            </div>

            {/* Region Select */}
            <div>
              <select
                value={selectedRegion}
                onChange={e => setSelectedRegion(e.target.value)}
                className="w-full px-4 py-2.5 bg-cream border-2 border-brown rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-teal"
              >
                <option value="all">全地區選擇</option>
                {regions.filter(r => r !== 'all').map(reg => (
                  <option key={reg} value={reg}>{reg}</option>
                ))}
              </select>
            </div>

            {/* Audience Select */}
            <div>
              <select
                value={selectedAudience}
                onChange={e => setSelectedAudience(e.target.value)}
                className="w-full px-4 py-2.5 bg-cream border-2 border-brown rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-teal"
              >
                {Object.entries(AUDIENCE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-brown/10">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
              const active = selectedCategory === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key)}
                  className={`px-4 py-1.5 rounded-xl text-sm font-bold border-2 border-brown transition-all ${
                    active
                      ? 'bg-base-yellow shadow-warm-sm translate-y-[-1px]'
                      : 'bg-white hover:bg-cream'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results count */}
        <div className="flex flex-wrap justify-between items-center gap-2 text-sm font-bold">
          <span>
            符合條件推薦紀錄：共 {filtered.length} 筆，彙整為 {groups.length} 家機構
            {groups.length > shownGroups.length && (
              <span className="font-medium text-brown/70">
                （目前顯示前 {shownGroups.length} 家 / {shownCount} 筆）
              </span>
            )}
          </span>
          <span className="text-brown/70">資料來源：{sourceLabel}</span>
        </div>

        {/* Cards Grid */}
        {filtered.length === 0 ? (
          <div className="bg-white border-2 border-brown rounded-2xl p-12 text-center shadow-warm">
            <p className="text-lg font-bold">沒有符合搜尋條件的推薦資料</p>
            <p className="text-sm text-brown/70 mt-1">建議放寬篩選條件或清除搜尋關鍵字</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {shownGroups.map(group => {
                const displayName = stableNames.get(group.key) ?? group.displayName;
                return (
                <div
                  key={group.key}
                  className="bg-white border-2 border-brown rounded-2xl p-6 shadow-warm space-y-4 hover:translate-y-[-2px] transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 bg-teal/30 border border-brown text-xs font-bold px-2.5 py-0.5 rounded-md">
                        <MapPin className="w-3 h-3" />
                        {group.region}
                      </span>
                      {group.items.length > 1 && (
                        <span className="bg-base-yellow border border-brown text-xs font-bold px-2.5 py-0.5 rounded-md">
                          {group.items.length} 則推薦
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-extrabold text-brown">{displayName}</h3>
                  </div>

                  <div className="divide-y divide-brown/10">
                    {group.items.map(item => {
                      const isExpanded = expandedId === item.id;
                      const experience = (item.experience || '').replace(/　/g, ' ').trim();
                      const isShort = experience.length <= SHORT_EXPERIENCE_LIMIT;
                      const variantName = (item.hospital || '').trim();
                      const showVariant = variantName !== '' && variantName !== displayName;
                      return (
                        <div key={item.id} className="py-3 first:pt-0 last:pb-0 space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <p className="text-base font-bold text-highlight">
                                {item.doctorOrName || '醫療/諮商團隊'}
                              </p>
                              {showVariant && (
                                <p className="text-xs text-brown/60 mt-0.5">登錄名稱：{variantName}</p>
                              )}
                            </div>
                            {item.verified && (
                              <span className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-line-green bg-[#F0FDF4] px-2 py-0.5 rounded border border-line-green">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                家長認證
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            <span className="bg-accent-orange/40 border border-brown text-xs font-bold px-2.5 py-0.5 rounded-md">
                              {CATEGORY_LABELS[item.category] || item.category}
                            </span>
                            <span className="bg-pink/30 border border-brown text-xs font-bold px-2.5 py-0.5 rounded-md">
                              {AUDIENCE_LABELS[item.audience] || item.audience}
                            </span>
                          </div>

                          {experience === '' ? (
                            <p className="text-sm text-brown/60 italic">僅推薦未附說明</p>
                          ) : isShort ? (
                            <p className="text-sm leading-relaxed text-brown/90">{experience}</p>
                          ) : (
                            <div className="bg-cream border border-brown/20 rounded-xl p-4 text-sm leading-relaxed">
                              <p className={isExpanded ? '' : 'line-clamp-4'}>{item.experience}</p>
                              {experience.length > 100 && (
                                <button
                                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                  className="inline-flex items-center gap-1 text-xs font-bold text-highlight mt-2 hover:underline"
                                >
                                  {isExpanded ? (
                                    <>
                                      收合經驗 <ChevronUp className="w-3.5 h-3.5" />
                                    </>
                                  ) : (
                                    <>
                                      展開閱讀完整經驗 <ChevronDown className="w-3.5 h-3.5" />
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          )}

                          <div className="flex justify-between items-center gap-2 text-xs text-brown/70 font-medium">
                            <span>推薦人：{item.recommender || '社群夥伴'}</span>
                            {item.urls && item.urls.length > 0 && (
                              <a
                                href={item.urls[0]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-brown font-bold hover:text-highlight"
                              >
                                相關網址 <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                );
              })}
            </div>

            {groups.length > shownGroups.length && (
              <div className="flex justify-center">
                <button
                  onClick={() => setVisibleGroups(n => n + GROUP_PAGE_SIZE)}
                  className="inline-flex items-center gap-2 bg-white border-2 border-brown px-6 py-3 rounded-2xl font-bold shadow-warm-sm hover:translate-y-[-2px] hover:shadow-warm transition-all"
                >
                  載入更多（還有 {groups.length - shownGroups.length} 家機構 / {filtered.length - shownCount} 筆推薦）
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
