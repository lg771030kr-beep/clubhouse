import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Rocket, ChevronRight, Loader2, Tag } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { AdminCreateProjectModal } from '../../components/admin/AdminCreateProjectModal';

interface Project {
  id: string;
  title: string;
  emoji: string;
  status: string;
}

export function AdminActivity() {
  const navigate = useNavigate();
  const { activeClubId } = useAuth();

  const [projects,        setProjects]        = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [isCreateOpen,    setIsCreateOpen]    = useState(false);

  useEffect(() => {
    if (activeClubId) fetchProjects();
  }, [activeClubId]);

  const fetchProjects = async () => {
    if (!activeClubId) return;
    setProjectsLoading(true);
    try {
      const { data } = await supabase
        .from('projects')
        .select('id, title, emoji, status')
        .eq('club_id', activeClubId)
        .order('created_at', { ascending: false });
      setProjects(data ?? []);
    } finally {
      setProjectsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">

      {/* 헤더 */}
      <div className="bg-white border-b border-black/8 px-4 md:px-6 pt-14 pb-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-black text-black tracking-tight">관련 기관 및 활동</h1>
          <p className="text-xs text-black/40 font-medium mt-0.5">연결된 기관과 팀 프로젝트를 관리하세요</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 md:px-6 py-4 space-y-4">

        {/* ── 관련 기관 ── */}
        <section className="rounded-3xl border border-black/12 bg-white overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-black/6">
            <div className="w-8 h-8 rounded-xl bg-black/6 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-black/50" />
            </div>
            <h2 className="text-sm font-black text-black">관련 기관</h2>
          </div>

          {/* 빈 상태 */}
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-black/[0.04] flex items-center justify-center mb-3">
              <Building2 className="w-6 h-6 text-black/15" />
            </div>
            <p className="text-sm font-black text-black/35">관련 기관이 없어요</p>
            <p className="text-xs text-black/22 font-medium mt-1">
              연결된 외부 기관이나 파트너가 없습니다
            </p>
          </div>
        </section>

        {/* ── 관련 팀(프로젝트) ── */}
        <section className="rounded-3xl border border-black/12 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-black/6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-black/6 flex items-center justify-center shrink-0">
                <Rocket className="w-4 h-4 text-black/50" />
              </div>
              <h2 className="text-sm font-black text-black">관련 팀(프로젝트)</h2>
            </div>
            {projects.length > 0 && (
              <button
                onClick={() => navigate('/admin/projects')}
                className="flex items-center gap-0.5 text-xs font-black text-black/40 hover:text-black transition-colors"
              >
                전체 <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 프로젝트 목록 */}
          <div className="px-4 py-3">
            {projectsLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-black/30">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs font-black">불러오는 중...</span>
              </div>
            ) : projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-2xl bg-black/[0.04] flex items-center justify-center mb-3">
                  <Rocket className="w-6 h-6 text-black/15" />
                </div>
                <p className="text-sm font-black text-black/35">아직 등록된 프로젝트가 없습니다</p>
                <p className="text-xs text-black/22 font-medium mt-1">첫 번째 팀 프로젝트를 만들어보세요!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {projects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/admin/projects/${p.id}`)}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl border border-black/8
                               hover:bg-black/[0.02] transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-black/6 flex items-center justify-center text-lg shrink-0">
                      {p.emoji || '🚀'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-black text-sm truncate">{p.title}</p>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                      p.status === 'active'  ? 'bg-black text-white' :
                      p.status === 'closed'  ? 'bg-black/12 text-black/45' :
                      'bg-black/6 text-black/45 border border-black/15'
                    }`}>
                      {p.status === 'active' ? '진행 중' : p.status === 'closed' ? '완료' : '준비 중'}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-black/20 shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {/* 팀 프로젝트 등록하기 버튼 */}
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-3 w-full py-3.5 rounded-2xl bg-black text-white text-sm font-black
                         flex items-center justify-center gap-2
                         hover:bg-black/85 active:scale-[0.99] transition-all"
            >
              <Tag className="w-4 h-4" />
              팀 프로젝트 등록하기
            </button>
          </div>
        </section>

      </div>

      <AdminCreateProjectModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => { setIsCreateOpen(false); fetchProjects(); }}
        clubId={activeClubId}
      />
    </div>
  );
}
