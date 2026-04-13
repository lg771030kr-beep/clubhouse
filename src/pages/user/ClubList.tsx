import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ChevronRight, Users, MapPin,
  Search, Sparkles,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { BackButton } from '../../components/common/BackButton';
import { useAuth } from '../../context/AuthContext';

interface ClubSummary {
  id: number;
  name: string;
  emoji: string;
  field: string;
  members: number;
  founded: string;
  location: string;
  description: string;
  isRecruiting: boolean;
  techStack?: string[];
}

const ALL_CLUBS: ClubSummary[] = [
  {
    id: 1, name: 'Club DX 개발팀', emoji: '💻', field: '개발',
    members: 42, founded: '2021년 3월', location: '공학관 302호',
    description: '실전 프로젝트 경험을 쌓고 싶은 개발자들이 모여 웹·앱 서비스를 기획·구현하는 팀. 매주 정기 세션 + 해커톤 진행.',
    isRecruiting: true, techStack: ['React', 'TypeScript', 'Node.js', 'Supabase'],
  },
  {
    id: 2, name: '크리에이티브 디자인', emoji: '🎨', field: '디자인',
    members: 28, founded: '2020년 9월', location: '예술관 B104',
    description: 'UI/UX, 브랜딩, 모션 그래픽을 탐구하는 동아리. 포트폴리오 리뷰 & 실전 Figma 워크숍 중심.',
    isRecruiting: true, techStack: ['Figma', 'Adobe XD', 'After Effects'],
  },
  {
    id: 3, name: '마케팅 보이즈', emoji: '📣', field: '마케팅',
    members: 19, founded: '2022년 3월', location: '경영관 201호',
    description: '브랜드 전략, SNS 마케팅, 데이터 분석을 직접 실행하며 배우는 동아리.',
    isRecruiting: false, techStack: [],
  },
  {
    id: 4, name: '알고리즘 스터디', emoji: '🧠', field: '개발',
    members: 15, founded: '2023년 3월', location: '공학관 204호',
    description: '코딩테스트와 알고리즘 실력을 함께 키우는 스터디 동아리.',
    isRecruiting: true, techStack: ['Python', 'C++', 'Java'],
  },
  {
    id: 5, name: '창업 스타터', emoji: '🚀', field: '창업',
    members: 22, founded: '2021년 9월', location: '혁신관 101호',
    description: '아이디어를 실제 사업으로 만들어가는 창업 동아리.',
    isRecruiting: false, techStack: [],
  },
  {
    id: 6, name: '게임 크리에이터', emoji: '🎮', field: '개발',
    members: 31, founded: '2019년 3월', location: '공학관 501호',
    description: 'Unity·Unreal 기반 인디 게임을 제작하는 동아리. 연 2회 게임 전시회 및 글로벌 게임잼 참가.',
    isRecruiting: true, techStack: ['Unity', 'C#', 'Unreal Engine'],
  },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapClub(c: any): ClubSummary {
  return {
    id:          c.id,
    name:        c.name ?? '알 수 없음',
    emoji:       '🏢',
    field:       c.category             ?? '기타',
    members:     c.member_count         ?? 0,
    founded:     c.founded_at           ?? '-',
    location:    c.location             ?? '-',
    description: c.description          ?? c.name ?? '',
    isRecruiting: c.is_recruiting       ?? false,
    techStack:   Array.isArray(c.tech_stack) ? c.tech_stack : [],
  };
}

const CATEGORIES = ['전체', '개발', '디자인', '마케팅', '창업'];

export function ClubList() {
  const navigate = useNavigate();
  const { isAdminMode } = useAuth();
  const [query,    setQuery]    = useState('');
  const [category, setCategory] = useState('전체');
  const [clubs, setClubs]       = useState<ClubSummary[]>(ALL_CLUBS);

  // ── 테마 토큰 ──────────────────────────────────────────
  const bg         = isAdminMode ? 'bg-white'         : 'bg-black';
  const headerBg   = isAdminMode ? 'bg-white border-black/10' : 'bg-black border-white/10';
  const textPri    = isAdminMode ? 'text-black'        : 'text-white';
  const textSec    = isAdminMode ? 'text-black/50'     : 'text-white/50';
  const textFaint  = isAdminMode ? 'text-black/40'     : 'text-white/40';
  const iconColor  = isAdminMode ? 'text-black'        : 'text-white';
  const cardBg     = isAdminMode ? 'bg-white border-black/10 hover:border-black/30' : 'bg-black border-white/10 hover:border-white/30';
  const avatarBg   = isAdminMode ? 'bg-black/5 border-black/10'  : 'bg-white/5 border-white/10';
  const tagBg      = isAdminMode ? 'bg-black/5 border-black/10 text-black/60'  : 'bg-white/5 border-white/10 text-white/50';
  const fieldBadge = isAdminMode ? 'bg-black/8 border-black/15 text-black/80'  : 'bg-white/8 border-white/15 text-white/80';
  const searchBar  = isAdminMode ? 'bg-white border-black/15'    : 'bg-black border-white/20';
  const searchIcon = isAdminMode ? 'text-black/40'    : 'text-white/50';
  const searchText = isAdminMode ? 'text-black placeholder:text-black/30' : 'text-white placeholder:text-white/30';
  const filterActive   = isAdminMode ? 'bg-black text-white border-black'            : 'bg-white text-black border-white';
  const filterInactive = isAdminMode ? 'bg-white text-black/50 border-black/15 hover:border-black/40 hover:text-black'
                                     : 'bg-black text-white/50 border-white/15 hover:border-white/40 hover:text-white';
  const emptyBg    = isAdminMode ? 'bg-white border-black/10' : 'bg-black border-white/10';
  const chevron    = isAdminMode ? 'text-black/25'    : 'text-white/30';

  useEffect(() => {
    async function loadClubs() {
      const { data, error } = await supabase
        .from('clubs')
        .select('id, name, category, logo_url, is_recruiting, description, member_count, location, tech_stack')
        .order('created_at', { ascending: false });
      if (!error && data && data.length > 0) setClubs(data.map(mapClub));
    }
    loadClubs();
  }, []);

  const filtered = clubs.filter(c => {
    const matchCat = category === '전체' || c.field === category;
    const matchQ   = !query || c.name.includes(query) || c.field.includes(query) || c.description.includes(query);
    return matchCat && matchQ;
  });

  return (
    <div className={`min-h-screen ${bg} pb-24`}>

      {/* ── 헤더 ── */}
      <div className={`${headerBg} border-b px-6 pt-12 pb-16`}>
        <div className="max-w-5xl mx-auto">
          <BackButton onClick={() => navigate(-1)} className="mb-8" />

          <div className="flex items-center gap-3 mb-2">
            <Sparkles className={`w-6 h-6 ${iconColor}`} />
            <h1 className={`text-3xl sm:text-4xl font-black tracking-tight ${textPri}`}>
              동아리 살펴보기
            </h1>
          </div>
          <p className={`${textSec} text-sm font-medium pl-1`}>
            {clubs.length}개 동아리 · 지금 바로 찾아보세요
          </p>
        </div>
      </div>

      {/* ── 검색 + 필터 바 ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-8 relative z-10 space-y-3">

        {/* 검색창 */}
        <div className={`${searchBar} rounded-3xl border flex items-center gap-3 px-4 py-3.5`}>
          <Search className={`w-4 h-4 ${searchIcon} shrink-0`} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="동아리 이름·카테고리로 검색..."
            className={`flex-1 text-sm ${searchText} outline-none bg-transparent font-medium`}
          />
          {query && (
            <button onClick={() => setQuery('')} className={`${textFaint} hover:${textPri} text-lg leading-none transition-colors`}>×</button>
          )}
        </div>

        {/* 카테고리 필터 칩 */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`shrink-0 px-4 py-2 rounded-full text-xs font-black border transition-all
                ${category === cat ? filterActive : filterInactive}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 결과 수 */}
        <p className={`text-xs font-bold ${textFaint} px-1`}>{filtered.length}개의 동아리</p>

        {/* ── 동아리 카드 리스트 ── */}
        {filtered.length === 0 ? (
          <div className={`${emptyBg} rounded-3xl border py-16 text-center`}>
            <p className="text-3xl mb-3">🔍</p>
            <p className={`${textPri} font-bold text-sm`}>검색 결과가 없습니다</p>
            <p className={`${textFaint} text-xs mt-1`}>다른 키워드로 검색해 보세요</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((club, i) => (
              <motion.div
                key={club.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => navigate(`/club/${club.id}`)}
                className={`${cardBg} rounded-3xl border overflow-hidden cursor-pointer transition-all`}
              >
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    {/* 이모지 아바타 */}
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 ${avatarBg} border`}>
                      {club.emoji}
                    </div>

                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <h3 className={`text-base font-black ${textPri} tracking-tight leading-tight`}>
                          {club.name}
                        </h3>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${fieldBadge} border`}>
                          {club.field}
                        </span>
                        {club.isRecruiting && (
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isAdminMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
                            모집중
                          </span>
                        )}
                      </div>

                      <p className={`text-sm ${textSec} font-medium leading-relaxed line-clamp-2 mb-3`}>
                        {club.description}
                      </p>

                      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold ${textFaint}`}>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> {club.members}명
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {club.location}
                        </span>
                      </div>

                      {club.techStack && club.techStack.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {club.techStack.slice(0, 3).map(t => (
                            <span
                              key={t}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tagBg} border`}
                            >
                              {t}
                            </span>
                          ))}
                          {club.techStack.length > 3 && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tagBg} border`}>
                              +{club.techStack.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <ChevronRight className={`w-5 h-5 ${chevron} shrink-0 mt-1`} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
