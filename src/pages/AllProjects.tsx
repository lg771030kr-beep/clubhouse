import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ChevronRight, Search, Flame,
  Eye, Clock, CheckCircle2, XCircle, Layers, Zap,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { BackButton } from '../components/common/BackButton';

/* ══════════════════════════════════════════
   Types
══════════════════════════════════════════ */
interface Project {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'closed' | 'draft';
  views: number;
  tech_stack: string[];
  member_count: number;
  created_at: string;
  clubName: string;
  participants: { name: string }[];
}

type SortKey = 'views' | 'created_at' | 'title';

/* ══════════════════════════════════════════
   Status Badge
══════════════════════════════════════════ */
const STATUS_ADMIN = {
  active: { label: '진행중', icon: CheckCircle2, cls: 'bg-black text-white' },
  closed: { label: '완료',   icon: XCircle,      cls: 'bg-black/8 border border-black/15 text-black/60' },
  draft:  { label: '준비중', icon: Clock,         cls: 'bg-black/8 border border-black/15 text-black/60' },
} as const;

const STATUS_USER = {
  active: { label: '진행중', icon: CheckCircle2, cls: 'bg-white text-black' },
  closed: { label: '완료',   icon: XCircle,      cls: 'bg-white/10 border border-white/15 text-white/50' },
  draft:  { label: '준비중', icon: Clock,         cls: 'bg-white/10 border border-white/15 text-white/50' },
} as const;

function StatusBadge({ status, isAdmin }: { status: Project['status']; isAdmin: boolean }) {
  const map = isAdmin ? STATUS_ADMIN : STATUS_USER;
  const { label, icon: Icon, cls } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black ${cls}`}>
      <Icon size={10} />{label}
    </span>
  );
}

/* ══════════════════════════════════════════
   Mock fallback
══════════════════════════════════════════ */
const MOCK: Project[] = [
  {
    id: '1', title: 'Club DX 메인 앱 개발', description: '동아리 멤버 관리, 출석 체크, 일정 공유 등을 하나로 통합한 올인원 동아리 앱.',
    status: 'active', views: 1240, tech_stack: ['React', 'TypeScript', 'Supabase', 'Tailwind CSS'],
    member_count: 6, created_at: '2026-03-01', clubName: 'Club DX 개발팀',
    participants: [{ name: '김철수' }, { name: '이영희' }, { name: '박민준' }, { name: '최지은' }],
  },
  {
    id: '2', title: '브랜딩 리뉴얼 프로젝트', description: '동아리 전체 비주얼 아이덴티티(VI) 재정립 프로젝트.',
    status: 'closed', views: 873, tech_stack: ['Figma', 'Adobe Illustrator', 'After Effects'],
    member_count: 4, created_at: '2026-01-15', clubName: '크리에이티브 디자인',
    participants: [{ name: '윤서연' }, { name: '한소희' }],
  },
  {
    id: '3', title: '신입 온보딩 자동화', description: '신입 부원 환영 키트 자동 발송, 멘토 매칭, OT 일정 안내를 자동화하는 봇 시스템.',
    status: 'draft', views: 542, tech_stack: ['Python', 'Slack API', 'Google Sheets'],
    member_count: 3, created_at: '2026-02-10', clubName: '마케팅 보이즈',
    participants: [{ name: '정현우' }],
  },
  {
    id: '4', title: '캠퍼스 마케팅 캠페인', description: '교내 스타트업과 협업한 SNS 바이럴 마케팅 캠페인.',
    status: 'active', views: 410, tech_stack: ['Canva', 'Meta Ads', 'Google Analytics'],
    member_count: 5, created_at: '2026-02-20', clubName: '마케팅 보이즈',
    participants: [{ name: '이수진' }, { name: '김도원' }],
  },
  {
    id: '5', title: '인디 게임 "스페이스 리프트"', description: '2D 픽셀 아트 기반 우주 탈출 게임. 글로벌 게임잼 72시간 챌린지 출품작.',
    status: 'closed', views: 690, tech_stack: ['Unity', 'C#', 'Aseprite', 'FMOD'],
    member_count: 7, created_at: '2025-12-01', clubName: '게임 크리에이터',
    participants: [{ name: '박준혁' }, { name: '오지민' }, { name: '강태경' }],
  },
  {
    id: '6', title: '알고리즘 문제 풀이 플랫폼', description: '스터디원끼리 풀이를 공유하고 리뷰하는 코드 리뷰 전용 플랫폼.',
    status: 'active', views: 320, tech_stack: ['Next.js', 'PostgreSQL', 'Judge0 API'],
    member_count: 4, created_at: '2026-03-05', clubName: '알고리즘 스터디',
    participants: [{ name: '한지원' }, { name: '최민서' }],
  },
];

/* ══════════════════════════════════════════
   Mask name
══════════════════════════════════════════ */
const mask = (name: string) => name.length > 0 ? name[0] + 'ㅇㅇ' : '멤버';

/* ══════════════════════════════════════════
   Sort options
══════════════════════════════════════════ */
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'views',      label: '조회수순' },
  { key: 'created_at', label: '최신순'  },
  { key: 'title',      label: '이름순'  },
];

const STATUS_FILTERS = ['전체', '진행중', '완료', '준비중'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

const STATUS_MAP: Record<StatusFilter, Project['status'] | null> = {
  '전체': null, '진행중': 'active', '완료': 'closed', '준비중': 'draft',
};

/* ══════════════════════════════════════════
   Main Component
══════════════════════════════════════════ */
export function AllProjects() {
  const navigate = useNavigate();
  const { isAdminMode } = useAuth();

  const [projects, setProjects] = useState<Project[]>(MOCK);
  const [query,    setQuery]    = useState('');
  const [sort,     setSort]     = useState<SortKey>('views');
  const [filter,   setFilter]   = useState<StatusFilter>('전체');

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('id, title, description, status, views, tech_stack, member_count, created_at, clubs(id, name)');
        if (!error && data && data.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setProjects(data.map((p: any) => ({
            id:           String(p.id),
            title:        p.title        ?? '제목 없음',
            description:  p.description  ?? '',
            status:       (p.status as Project['status']) ?? 'draft',
            views:        p.views        ?? 0,
            tech_stack:   Array.isArray(p.tech_stack) ? p.tech_stack : [],
            member_count: p.member_count ?? 0,
            created_at:   p.created_at   ?? '',
            clubName:     (Array.isArray(p.clubs) ? p.clubs[0]?.name : p.clubs?.name) ?? '알 수 없음',
            participants: [],
          })));
        }
      } catch { /* mock 유지 */ }
    }
    load();
  }, []);

  /* ── 필터 + 정렬 ── */
  const filtered = projects
    .filter(p => {
      const matchStatus = filter === '전체' || p.status === STATUS_MAP[filter];
      const q = query.toLowerCase();
      const matchQ = !q || p.title.toLowerCase().includes(q) || p.clubName.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      return matchStatus && matchQ;
    })
    .sort((a, b) => {
      if (sort === 'views')      return b.views - a.views;
      if (sort === 'created_at') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return a.title.localeCompare(b.title, 'ko');
    });

  /* ── 테마 헬퍼 ── */
  const bg        = isAdminMode ? 'bg-white'           : 'bg-black';
  const border    = isAdminMode ? 'border-black/10'    : 'border-white/10';
  const cardBg    = isAdminMode ? 'bg-white'           : 'bg-black';
  const cardBorder= isAdminMode ? 'border-black/20'    : 'border-white/15';
  const textPri   = isAdminMode ? 'text-black'         : 'text-white';
  const textMuted = isAdminMode ? 'text-black/50'      : 'text-white/50';
  const textDim   = isAdminMode ? 'text-black/40'      : 'text-white/40';
  const iconColor = isAdminMode ? 'text-black'         : 'text-white';
  const divider   = isAdminMode ? 'bg-black/10'        : 'bg-white/10';

  const filterActive   = isAdminMode
    ? 'bg-black text-white border-black'
    : 'bg-white text-black border-white';
  const filterInactive = isAdminMode
    ? 'bg-white text-black/50 border-black/20 hover:border-black hover:text-black'
    : 'bg-black text-white/50 border-white/20 hover:border-white hover:text-white';

  const searchBg       = isAdminMode ? 'bg-white border-black/20' : 'bg-black border-white/20';
  const searchText     = isAdminMode ? 'text-black placeholder:text-black/30' : 'text-white placeholder:text-white/30';
  const searchIcon     = isAdminMode ? 'text-black/40' : 'text-white/40';
  const searchClear    = isAdminMode ? 'text-black/30 hover:text-black' : 'text-white/30 hover:text-white';

  const avatarBg       = isAdminMode ? 'bg-black text-white border-white' : 'bg-white text-black border-black';
  const avatarEmpty    = isAdminMode ? 'bg-black/8 border-white'          : 'bg-white/8 border-black';
  const hotBadge       = isAdminMode
    ? 'text-black bg-black/8 border border-black/15'
    : 'text-white bg-white/10 border border-white/15';
  const techBadge      = isAdminMode
    ? 'bg-black/5 text-black/60 border border-black/10'
    : 'bg-white/8 text-white/60 border border-white/10';
  const iconAvatarBg   = isAdminMode ? 'bg-black/5 border-black/10' : 'bg-white/8 border-white/10';


  return (
    <div className={`min-h-screen ${bg} pb-24`}>

      {/* ── 헤더 ── */}
      <div className={`${bg} border-b ${border} px-6 pt-12 pb-16`}>
        <div className="max-w-5xl mx-auto">
          <BackButton onClick={() => navigate(-1)} className="mb-8" />

          <div className="flex items-center gap-3 mb-2">
            <Layers className={`w-6 h-6 ${iconColor}`} />
            <h1 className={`text-3xl sm:text-4xl font-black tracking-tight ${textPri}`}>
              프로젝트 살펴보기
            </h1>
          </div>
          <p className={`${textMuted} text-sm font-medium pl-1`}>
            {projects.length}개 프로젝트 · 지금 진행 중인 프로젝트를 구경해보세요
          </p>
        </div>
      </div>

      {/* ── 검색 + 필터 ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-8 relative z-10 space-y-3">

        {/* 검색창 */}
        <div className={`${searchBg} rounded-3xl border flex items-center gap-3 px-4 py-3.5 shadow-sm`}>
          <Search className={`w-4 h-4 ${searchIcon} shrink-0`} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="프로젝트·동아리명으로 검색..."
            className={`flex-1 text-sm ${searchText} outline-none bg-transparent font-medium`}
          />
          {query && (
            <button onClick={() => setQuery('')} className={`${searchClear} text-lg leading-none transition-colors`}>×</button>
          )}
        </div>

        {/* 정렬 + 상태 필터 */}
        <div className="flex gap-2 flex-wrap">
          {/* 정렬 버튼 */}
          <div className="flex gap-1.5 mr-2">
            {SORTS.map(s => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-black border transition-all
                  ${sort === s.key ? filterActive : filterInactive}`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* 구분선 */}
          <div className={`w-px ${divider} self-stretch`} />

          {/* 상태 필터 */}
          <div className="flex gap-1.5">
            {STATUS_FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-black border transition-all
                  ${filter === f ? filterActive : filterInactive}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <p className={`text-xs font-bold ${textDim} px-1`}>{filtered.length}개의 프로젝트</p>

        {/* ── 카드 리스트 ── */}
        {filtered.length === 0 ? (
          <div className={`${cardBg} rounded-3xl border ${cardBorder} py-16 text-center`}>
            <p className="text-3xl mb-3">🔍</p>
            <p className={`${textPri} font-bold text-sm`}>검색 결과가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => navigate(`/project/${project.id}`)}
                className={`${cardBg} rounded-3xl border ${cardBorder} ${isAdminMode ? 'hover:border-black/40' : 'hover:border-white/35'} cursor-pointer transition-all overflow-hidden`}
              >
                <div className="p-5">
                  {/* 상단 행 */}
                  <div className="flex items-start gap-4 mb-3">
                    {/* 이모지 아바타 */}
                    <div className={`w-14 h-14 rounded-2xl ${iconAvatarBg} border flex items-center justify-center text-2xl shrink-0`}>
                      📁
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* 배지 행 */}
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <StatusBadge status={project.status} isAdmin={isAdminMode} />
                        {project.views >= 500 && (
                          <span className={`inline-flex items-center gap-0.5 text-[10px] font-black px-2.5 py-1 rounded-full ${hotBadge}`}>
                            <Flame className="w-2.5 h-2.5" /> HOT
                          </span>
                        )}
                      </div>

                      {/* 제목 */}
                      <h3 className={`text-base font-black ${textPri} tracking-tight leading-tight`}>
                        {project.title}
                      </h3>
                      <p className={`text-xs font-semibold ${textMuted} mt-0.5`}>📁 {project.clubName}</p>
                    </div>

                    <ChevronRight className={`w-5 h-5 ${textDim} shrink-0 mt-1`} />
                  </div>

                  {/* 설명 */}
                  <p className={`text-sm ${isAdminMode ? 'text-black/60' : 'text-white/60'} font-medium leading-relaxed line-clamp-2 mb-3`}>
                    {project.description}
                  </p>

                  {/* 기술 스택 */}
                  {project.tech_stack.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {project.tech_stack.slice(0, 4).map(t => (
                        <span key={t} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${techBadge}`}>
                          <Zap className="w-2.5 h-2.5 inline mr-0.5" />{t}
                        </span>
                      ))}
                      {project.tech_stack.length > 4 && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${techBadge}`}>
                          +{project.tech_stack.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {/* 하단 행: 조회수 + 참가자 아바타 */}
                  <div className="flex items-center justify-between">
                    <span className={`flex items-center gap-1 text-xs font-semibold ${textDim}`}>
                      <Eye className="w-3 h-3" /> {project.views.toLocaleString()}회
                    </span>

                    {/* 참가자 아바타 스택 */}
                    {(project.participants.length > 0 || project.member_count > 0) && (
                      <div className="flex items-center gap-2">
                        {project.participants.length > 0 ? (
                          <div className="flex -space-x-2">
                            {project.participants.slice(0, 4).map((p, idx) => (
                              <div
                                key={idx}
                                title={mask(p.name)}
                                className={`w-7 h-7 rounded-full ${avatarBg} text-[10px] font-black
                                           flex items-center justify-center border-2 shrink-0`}
                              >
                                {p.name[0]}
                              </div>
                            ))}
                            {project.participants.length > 4 && (
                              <div className={`w-7 h-7 rounded-full ${isAdminMode ? 'bg-black/10 text-black/50 border-white' : 'bg-white/10 text-white/50 border-black'} text-[10px] font-black
                                              flex items-center justify-center border-2 shrink-0`}>
                                +{project.participants.length - 4}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex -space-x-2">
                            {Array.from({ length: Math.min(project.member_count, 4) }).map((_, idx) => (
                              <div
                                key={idx}
                                className={`w-7 h-7 rounded-full ${avatarEmpty} border-2 shrink-0`}
                              />
                            ))}
                          </div>
                        )}
                        <span className={`text-xs ${textDim} font-semibold`}>
                          {project.participants.length || project.member_count}명
                        </span>
                      </div>
                    )}
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
