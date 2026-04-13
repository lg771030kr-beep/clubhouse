import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Rocket, Search, ChevronRight, Users,
  Globe, Github, Sparkles, Loader2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { BackButton } from '../../components/common/BackButton';

/* ── 타입 ── */
interface ProjectCard {
  id: string | number;
  title: string;
  description: string;
  clubName: string;
  clubEmoji: string;
  status: 'ongoing' | 'completed' | 'planning';
  techStack: string[];
  memberCount: number;
  link?: string;
  githubUrl?: string;
  imageUrl?: string;
}

/* ── 목 데이터 (Supabase 폴백) ── */
const MOCK_PROJECTS: ProjectCard[] = [
  {
    id: 'm1', title: '캠퍼스 맛집 지도', description: '학교 주변 맛집을 공유하고 리뷰를 남기는 웹 서비스. React + Supabase로 구현.',
    clubName: 'Club DX 개발팀', clubEmoji: '💻', status: 'ongoing',
    techStack: ['React', 'TypeScript', 'Supabase'], memberCount: 5,
    githubUrl: 'https://github.com',
  },
  {
    id: 'm2', title: '동아리 홍보 리플렛 시스템', description: 'Figma 기반 자동 홍보물 생성 도구. 템플릿 선택 후 정보를 입력하면 PDF로 출력.',
    clubName: '크리에이티브 디자인', clubEmoji: '🎨', status: 'completed',
    techStack: ['Figma', 'Framer'], memberCount: 3,
  },
  {
    id: 'm3', title: '인디 RPG 게임', description: 'Unity로 제작 중인 2D 픽셀 RPG. 스토리 기반 퀘스트 시스템과 멀티플레이 지원 예정.',
    clubName: '게임 크리에이터', clubEmoji: '🎮', status: 'ongoing',
    techStack: ['Unity', 'C#'], memberCount: 8,
    githubUrl: 'https://github.com',
  },
  {
    id: 'm4', title: 'SNS 마케팅 대시보드', description: '인스타그램·트위터 계정 통합 분석 툴. 클릭 수, 노출 수, 전환율을 시각화.',
    clubName: '마케팅 보이즈', clubEmoji: '📣', status: 'planning',
    techStack: ['Python', 'Streamlit'], memberCount: 4,
  },
  {
    id: 'm5', title: '알고리즘 스터디 플랫폼', description: '문제 풀이 현황 공유 + 코드 리뷰 게시판. 백준·프로그래머스 API 연동.',
    clubName: '알고리즘 스터디', clubEmoji: '🧠', status: 'ongoing',
    techStack: ['Next.js', 'PostgreSQL'], memberCount: 6,
    link: 'https://example.com',
  },
  {
    id: 'm6', title: '창업 아이디어 공유 앱', description: '팀원 모집부터 MVP 검증까지. 아이디어 피드 + 투표 기능 탑재.',
    clubName: '창업 스타터', clubEmoji: '🚀', status: 'completed',
    techStack: ['Flutter', 'Firebase'], memberCount: 7,
  },
];

/* ── 상태 배지 ── */
const statusInfo: Record<ProjectCard['status'], { label: string; cls: string }> = {
  ongoing:   { label: '진행중',   cls: 'bg-white text-black' },
  completed: { label: '완료',     cls: 'bg-white/20 text-white border border-white/30' },
  planning:  { label: '기획중',   cls: 'bg-white/10 text-white/60 border border-white/20' },
};

const STATUS_FILTERS = ['전체', '진행중', '완료', '기획중'] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProject(p: any): ProjectCard {
  const statusMap: Record<string, ProjectCard['status']> = {
    ONGOING: 'ongoing', COMPLETED: 'completed', PLANNING: 'planning',
    ongoing: 'ongoing', completed: 'completed', planning: 'planning',
  };
  return {
    id:          p.id,
    title:       p.title        ?? '이름 없음',
    description: p.description  ?? '',
    clubName:    p.clubs?.name  ?? '동아리',
    clubEmoji:   '🏢',
    status:      statusMap[p.status ?? 'ongoing'] ?? 'ongoing',
    techStack:   Array.isArray(p.tech_stack) ? p.tech_stack : [],
    memberCount: p.member_count ?? 0,
    link:        p.link         ?? p.demo_url    ?? undefined,
    githubUrl:   p.github_url   ?? undefined,
    imageUrl:    p.image_url    ?? undefined,
  };
}

/* ═══════════════════════════════════════════════
   Component
════════════════════════════════════════════════ */
export function Projects() {
  const navigate = useNavigate();
  const [projects,  setProjects]  = useState<ProjectCard[]>(MOCK_PROJECTS);
  const [loading,   setLoading]   = useState(true);
  const [query,     setQuery]     = useState('');
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>('전체');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('id, title, description, status, tech_stack, member_count, link, github_url, demo_url, image_url, clubs(name)')
          .order('created_at', { ascending: false });
        if (!error && data && data.length > 0) {
          setProjects(data.map(mapProject));
        }
      } catch { /* 목 데이터 유지 */ } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = projects.filter(p => {
    const statusLabel = statusInfo[p.status].label;
    const matchStatus = statusFilter === '전체' || statusLabel === statusFilter;
    const matchQ = !query ||
      p.title.includes(query) ||
      p.clubName.includes(query) ||
      p.description.includes(query) ||
      p.techStack.some(t => t.toLowerCase().includes(query.toLowerCase()));
    return matchStatus && matchQ;
  });

  return (
    <div className="min-h-screen bg-black pb-24">

      {/* ── 헤더 ── */}
      <div className="bg-black border-b border-white/10 px-6 pt-12 pb-16">
        <div className="max-w-5xl mx-auto">
          <BackButton onClick={() => navigate(-1)} className="mb-8" />
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-6 h-6 text-white" />
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              프로젝트 둘러보기
            </h1>
          </div>
          <p className="text-white/50 text-sm font-medium pl-1">
            {loading ? '...' : `${projects.length}개 프로젝트 · 동아리별 작업물을 탐색해보세요`}
          </p>
        </div>
      </div>

      {/* ── 검색 + 필터 ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-8 relative z-10 space-y-3">

        {/* 검색창 */}
        <div className="bg-black rounded-3xl border border-white/20 flex items-center gap-3 px-4 py-3.5">
          <Search className="w-4 h-4 text-white/50 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="프로젝트·동아리·기술스택으로 검색..."
            className="flex-1 text-sm text-white placeholder:text-white/30 outline-none bg-transparent font-medium"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-white/40 hover:text-white text-lg leading-none transition-colors">×</button>
          )}
        </div>

        {/* 상태 필터 칩 */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {STATUS_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`shrink-0 px-4 py-2 rounded-full text-xs font-black border transition-all
                ${statusFilter === f
                  ? 'bg-white text-black border-white'
                  : 'bg-black text-white/50 border-white/15 hover:border-white/40 hover:text-white'}`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* 결과 수 */}
        <p className="text-xs font-bold text-white/40 px-1">{filtered.length}개의 프로젝트</p>

        {/* ── 로딩 ── */}
        {loading && (
          <div className="flex items-center justify-center py-20 gap-3 text-white/40">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm font-black">불러오는 중...</span>
          </div>
        )}

        {/* ── 결과 없음 ── */}
        {!loading && filtered.length === 0 && (
          <div className="bg-black rounded-3xl border border-white/10 py-16 text-center">
            <p className="text-3xl mb-3">🔍</p>
            <p className="text-white font-bold text-sm">검색 결과가 없습니다</p>
            <p className="text-white/40 text-xs mt-1">다른 키워드로 검색해 보세요</p>
          </div>
        )}

        {/* ── 카드 목록 ── */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((proj, i) => {
              const si = statusInfo[proj.status];
              return (
                <motion.div
                  key={proj.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.055, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => navigate(`/project/${proj.id}`)}
                  className="bg-black rounded-3xl border border-white/10 overflow-hidden cursor-pointer hover:border-white/30 transition-all"
                >
                  {/* 이미지 (있을 때만) */}
                  {proj.imageUrl && (
                    <div className="h-36 overflow-hidden">
                      <img src={proj.imageUrl} alt={proj.title} className="w-full h-full object-cover opacity-60" />
                    </div>
                  )}

                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      {/* 클럽 이모지 아바타 */}
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 bg-white/5 border border-white/10">
                        {proj.clubEmoji}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* 제목 + 배지 */}
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <h3 className="text-base font-black text-white tracking-tight leading-tight">
                            {proj.title}
                          </h3>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${si.cls}`}>
                            {si.label}
                          </span>
                        </div>

                        {/* 동아리 */}
                        <p className="text-xs text-white/40 font-semibold mb-2">{proj.clubName}</p>

                        {/* 설명 */}
                        <p className="text-sm text-white/60 font-medium leading-relaxed line-clamp-2 mb-3">
                          {proj.description}
                        </p>

                        {/* 메타 */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-white/40 mb-3">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" /> {proj.memberCount}명
                          </span>
                          {proj.link && (
                            <span className="flex items-center gap-1">
                              <Globe className="w-3 h-3" /> 데모
                            </span>
                          )}
                          {proj.githubUrl && (
                            <span className="flex items-center gap-1">
                              <Github className="w-3 h-3" /> GitHub
                            </span>
                          )}
                        </div>

                        {/* 기술 스택 */}
                        {proj.techStack.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {proj.techStack.slice(0, 4).map(t => (
                              <span
                                key={t}
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-white/50 border border-white/10"
                              >
                                {t}
                              </span>
                            ))}
                            {proj.techStack.length > 4 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10">
                                +{proj.techStack.length - 4}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <ChevronRight className="w-5 h-5 text-white/30 shrink-0 mt-1" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* 하단 여백 */}
      <div className="h-8" />
    </div>
  );
}
