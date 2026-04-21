import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ChevronLeft, ChevronRight, Search,
  Eye, Flame, Users, Layers, CheckCircle2, Clock, Zap, Loader2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Project {
  id: number | string;
  title: string;
  clubName: string;
  clubEmoji: string;
  emoji: string;
  description: string;
  techStack: string[];
  status: '진행중' | '완료' | '준비중';
  views: number;
  isHot: boolean;
  members: number;
}


const STATUS_ICON: Record<Project['status'], React.FC<{ className?: string }>> = {
  '진행중': ({ className }) => <span className={`inline-block w-1.5 h-1.5 rounded-full bg-white ${className}`} />,
  '완료':   ({ className }) => <CheckCircle2 className={`w-3 h-3 ${className}`} />,
  '준비중': ({ className }) => <Clock className={`w-3 h-3 ${className}`} />,
};

const FILTER_TABS = ['전체', '진행중', '완료', '준비중'] as const;

interface ProjectRow {
  id: number | string;
  title: string | null;
  description: string | null;
  image_url?: string | null;
  views?: number | null;
  status: string | null;
  tech_stack?: string[] | null;
  member_count?: number | null;
  clubs: { id: string; name: string; category?: string | null } | { id: string; name: string; category?: string | null }[] | null;
}

function mapProject(p: ProjectRow): Project {
  return {
    id:          p.id,
    title:       p.title ?? '제목 없음',
    clubName:    (Array.isArray(p.clubs) ? p.clubs[0]?.name : p.clubs?.name) ?? '알 수 없음',
    clubEmoji:   '📁',
    emoji:       '📁',
    description: p.description ?? '',
    techStack:   Array.isArray(p.tech_stack) ? p.tech_stack : [],
    status:      (p.status as Project['status']) ?? '진행중',
    views:       p.views ?? 0,
    isHot:       (p.views ?? 0) >= 500,
    members:     p.member_count ?? 0,
  };
}

export function UserProjects() {
  const navigate = useNavigate();
  const [query,    setQuery]    = useState('');
  const [status,   setStatus]   = useState<'전체' | Project['status']>('전체');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    async function loadProjects() {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('id, title, description, image_url, views, status, tech_stack, member_count, clubs(id, name, category)')
          .order('views', { ascending: false });
        if (!error && data) setProjects((data as ProjectRow[]).map(mapProject));
      } finally {
        setLoading(false);
      }
    }
    loadProjects();
  }, []);

  const filtered = projects.filter(p => {
    const matchStatus = status === '전체' || p.status === status;
    const matchQ = !query || p.title.includes(query) || p.clubName.includes(query) || p.description.includes(query);
    return matchStatus && matchQ;
  });

  return (
    <div className="min-h-screen bg-black pb-24">

      {/* ── 헤더 ── */}
      <div className="bg-black border-b border-white/10 px-6 pt-12 pb-16">
        <div className="max-w-5xl mx-auto">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 text-white font-bold mb-8
                       hover:text-white/70 active:opacity-60 group text-sm transition-colors"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            뒤로가기
          </button>
          <div className="flex items-center gap-3 mb-2">
            <Layers className="w-6 h-6 text-white" />
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">프로젝트 탐색</h1>
          </div>
          <p className="text-white/50 text-sm font-medium pl-1">
            {projects.length}개 프로젝트 · 지금 진행 중인 프로젝트를 구경해보세요
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
            placeholder="프로젝트·동아리명으로 검색..."
            className="flex-1 text-sm text-white placeholder:text-white/40 outline-none bg-transparent font-medium"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-white/40 hover:text-white text-lg leading-none transition-colors">×</button>
          )}
        </div>

        {/* 상태 필터 */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {FILTER_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setStatus(tab)}
              className={`shrink-0 px-4 py-2 rounded-full text-xs font-black border transition-all
                ${status === tab
                  ? 'bg-white text-black border-white'
                  : 'bg-black text-white/60 border-white/20 hover:border-white hover:text-white'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <p className="text-xs font-bold text-white/50 px-1">{filtered.length}개의 프로젝트</p>

        {/* ── 프로젝트 카드 ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-white/40">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-bold">불러오는 중...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-black rounded-3xl border border-white/20 py-16 text-center">
            <p className="text-3xl mb-3">{query || status !== '전체' ? '🔍' : '📭'}</p>
            <p className="text-white font-bold text-sm">
              {query || status !== '전체' ? '검색 결과가 없습니다' : '등록된 프로젝트가 없습니다'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((project, i) => {
              const StatusIcon = STATUS_ICON[project.status];
              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => navigate(`/project/${project.id}`)}
                  className="bg-black rounded-3xl border border-white/15 overflow-hidden cursor-pointer hover:border-white/30 transition-all"
                >
                  <div className="p-5">
                    <div className="flex items-start gap-4 mb-3">
                      {/* 이모지 아바타 */}
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 bg-white/5 border border-white/10">
                        {project.emoji}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-white/8 border border-white/15 text-white">
                            <StatusIcon />
                            {project.status}
                          </span>
                          {project.isHot && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-black
                                             text-black bg-white px-2 py-0.5 rounded-full">
                              <Flame className="w-2.5 h-2.5" /> HOT
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-black text-white tracking-tight leading-tight">{project.title}</h3>
                        <p className="text-xs font-semibold text-white/50 mt-0.5">{project.clubEmoji} {project.clubName}</p>
                      </div>

                      <ChevronRight className="w-5 h-5 text-white/30 shrink-0 mt-1" />
                    </div>

                    <p className="text-sm text-white/60 font-medium leading-relaxed line-clamp-2 mb-3">
                      {project.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {project.techStack.map(t => (
                        <span key={t} className="text-[10px] font-bold px-2 py-0.5 rounded-full
                                                  bg-white/5 text-white/60 border border-white/10">
                          <Zap className="w-2.5 h-2.5 inline mr-0.5" />{t}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-4 text-xs font-semibold text-white/50">
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {project.views.toLocaleString()}회</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {project.members}명</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
