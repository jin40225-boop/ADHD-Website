import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, CheckCircle2, ExternalLink, PlusCircle, ChevronDown, ChevronUp } from 'lucide-react';
import recommendationsData from '../../data/recommendations.json';

interface Recommendation {
  id: string;
  category: 'doctor' | 'assessment' | 'therapy' | 'community' | 'other';
  audience: 'child' | 'adult' | 'all';
  region: string;
  hospital: string;
  doctorOrName: string;
  urls: string[];
  experience: string;
  recommender?: string;
  verified: boolean;
  verifiedNote?: string;
  updatedAt?: string;
}

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

export default function RecommendationMapPage() {
  const recommendations = recommendationsData as Recommendation[];
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAudience, setSelectedAudience] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-[#FFFDF5] text-[#5D4037] py-12 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-[#FFEC8B] border-2 border-[#5D4037] rounded-3xl p-6 md:p-8 shadow-[4px_4px_0px_0px_#5D4037] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="inline-block bg-[#80CBC4] text-[#5D4037] font-bold text-xs px-3 py-1 rounded-full border border-[#5D4037] mb-2">
              ADHD 就醫與支援資料庫
            </span>
            <h1 className="text-3xl md:text-4xl font-extrabold text-[#5D4037]">就醫與專業支持地圖</h1>
            <p className="mt-2 text-[#5D4037]/90 text-sm md:text-base">
              彙整由大A與家長親身推薦的友善醫師、心理師與機構經驗。本資料庫堅持正向推薦政策。
            </p>
          </div>
          <Link
            to="/map/submit"
            className="inline-flex items-center gap-2 bg-white border-2 border-[#5D4037] px-5 py-3 rounded-2xl font-bold shadow-[2px_2px_0px_0px_#5D4037] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_#5D4037] transition-all"
          >
            <PlusCircle className="w-5 h-5 text-[#D84315]" />
            投稿推薦醫師/資源
          </Link>
        </div>

        {/* Filter Bar */}
        <div className="bg-white border-2 border-[#5D4037] rounded-2xl p-6 shadow-[4px_4px_0px_0px_#5D4037] space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search Box */}
            <div className="md:col-span-2 relative">
              <Search className="w-5 h-5 text-[#5D4037]/50 absolute left-3 top-3.5" />
              <input
                type="text"
                placeholder="搜尋醫院名稱、醫師姓名或經驗關鍵字..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#FFFDF5] border-2 border-[#5D4037] rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-[#80CBC4]"
              />
            </div>

            {/* Region Select */}
            <div>
              <select
                value={selectedRegion}
                onChange={e => setSelectedRegion(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#FFFDF5] border-2 border-[#5D4037] rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-[#80CBC4]"
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
                className="w-full px-4 py-2.5 bg-[#FFFDF5] border-2 border-[#5D4037] rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-[#80CBC4]"
              >
                {Object.entries(AUDIENCE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-[#5D4037]/10">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
              const active = selectedCategory === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key)}
                  className={`px-4 py-1.5 rounded-xl text-sm font-bold border-2 border-[#5D4037] transition-all ${
                    active
                      ? 'bg-[#FFEC8B] shadow-[2px_2px_0px_0px_#5D4037] translate-y-[-1px]'
                      : 'bg-white hover:bg-[#FFFDF5]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results count */}
        <div className="flex justify-between items-center text-sm font-bold">
          <span>符合條件推薦紀錄：共 {filtered.length} 筆</span>
          <span className="text-[#5D4037]/70">最後資料同步日期：2026-07-11</span>
        </div>

        {/* Cards Grid */}
        {filtered.length === 0 ? (
          <div className="bg-white border-2 border-[#5D4037] rounded-2xl p-12 text-center shadow-[4px_4px_0px_0px_#5D4037]">
            <p className="text-lg font-bold">沒有符合搜尋條件的推薦資料</p>
            <p className="text-sm text-[#5D4037]/70 mt-1">建議放寬篩選條件或清除搜尋關鍵字</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filtered.map(item => {
              const isExpanded = expandedId === item.id;
              return (
                <div
                  key={item.id}
                  className="bg-white border-2 border-[#5D4037] rounded-2xl p-6 shadow-[4px_4px_0px_0px_#5D4037] flex flex-col justify-between space-y-4 hover:translate-y-[-2px] transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center gap-1 bg-[#80CBC4]/30 border border-[#5D4037] text-xs font-bold px-2.5 py-0.5 rounded-md">
                          <MapPin className="w-3 h-3" />
                          {item.region}
                        </span>
                        <span className="bg-[#FFCC80]/40 border border-[#5D4037] text-xs font-bold px-2.5 py-0.5 rounded-md">
                          {CATEGORY_LABELS[item.category] || item.category}
                        </span>
                        <span className="bg-[#FFB6B9]/30 border border-[#5D4037] text-xs font-bold px-2.5 py-0.5 rounded-md">
                          {AUDIENCE_LABELS[item.audience] || item.audience}
                        </span>
                      </div>
                      {item.verified && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#06C755] bg-[#F0FDF4] px-2 py-0.5 rounded border border-[#06C755]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          家長認證
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-xl font-extrabold text-[#5D4037]">{item.hospital || '未填寫院所'}</h3>
                      <p className="text-base font-bold text-[#D84315] mt-0.5">
                        {item.doctorOrName || '醫療/諮商團隊'}
                      </p>
                    </div>

                    <div className="bg-[#FFFDF5] border border-[#5D4037]/20 rounded-xl p-4 text-sm leading-relaxed">
                      <p className={isExpanded ? '' : 'line-clamp-4'}>{item.experience || '無填寫詳細經驗...'}</p>
                      {item.experience && item.experience.length > 100 && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#D84315] mt-2 hover:underline"
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
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-[#5D4037]/10 text-xs text-[#5D4037]/70 font-medium">
                    <span>推薦人：{item.recommender || '社群夥伴'}</span>
                    {item.urls && item.urls.length > 0 && (
                      <a
                        href={item.urls[0]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#5D4037] font-bold hover:text-[#D84315]"
                      >
                        相關網址 <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
