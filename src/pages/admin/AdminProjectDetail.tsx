import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, Rocket, CheckCircle2, XCircle, Clock,
  Users, Calendar, Layers, Zap, Loader2,
  GitBranch, ExternalLink, Pencil, X, Plus,
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

/* ══════════════════════════════════════════
   Types
══════════════════════════════════════════ */
interface Participant {
  id: string;
  full_name: string;
  role?: string;
  avatar_url?: string;
}

interface ProjectDetail {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'closed' | 'draft';
  start_date: string;
  end_date: string;
  thumbnail_url?: string;
  tech_stack?: string[];
  github_url?: string;
  demo_url?: string;
  participants: Participant[];
  created_at: string;
}

/* ══════════════════════════════════════════
   Mock fallback
══════════════════════════════════════════ */
const MOCK: Record<string, Omit<ProjectDetail, 'id'>> = {
  '1': {
    title: 'Club DX 메인 앱 개발',
    description: '동아리 관리 올인원 앱을 자체 개발합니다. 회원 관리, 출결, 과제, 일정, 모집 공고 등 모든 운영 업무를 하나의 앱에서 처리할 수 있도록 설계된 풀스택 웹 서비스입니다.',
    status: 'active',
    start_date: '2026-03-01',
    end_date: '2026-06-30',
    tech_stack: ['React', 'TypeScript', 'Supabase', 'Tailwind CSS'],
    participants: [
      { id: 'a', full_name: '김철수', role: 'Lead Developer' },
      { id: 'b', full_name: '이영희', role: 'Frontend Dev' },
      { id: 'c', full_name: '박민준', role: 'UI/UX Designer' },
    ],
    created_at: '2026-03-01',
  },
  '2': {
    title: '브랜딩 리뉴얼 프로젝트',
    description: '동아리 BI/CI 아이덴티티를 새롭게 정의합니다. 로고, 컬러 시스템, 타이포그래피를 전면 리뉴얼합니다.',
    status: 'closed',
    start_date: '2026-01-15',
    end_date: '2026-02-28',
    tech_stack: ['Figma', 'Adobe Illustrator'],
    participants: [
      { id: 'b', full_name: '이영희', role: 'Brand Designer' },
    ],
    created_at: '2026-01-15',
  },
};

const STATUS_LABELS: Record<ProjectDetail['status'], string> = {
  active: '진행중', closed: '완료', draft: '준비중',
};

/* ══════════════════════════════════════════
   Status Badge
══════════════════════════════════════════ */
function StatusBadge({ status }: { status: ProjectDetail['status'] }) {
  const map = {
    active: { label: '진행중', cls: 'bg-black text-white',                             icon: CheckCircle2 },
    closed: { label: '완료',   cls: 'bg-black/8 text-black/60 border border-black/15', icon: XCircle      },
    draft:  { label: '준비중', cls: 'bg-black/8 text-black/60 border border-black/15', icon: Clock        },
  } as const;
  const { label, cls, icon: Icon } = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${cls}`}>
      <Icon size={13} />{label}
    </span>
  );
}

/* ══════════════════════════════════════════
   Avatar
══════════════════════════════════════════ */
function Avatar({ member }: { member: Participant }) {
  return (
    <div className="w-10 h-10 rounded-2xl bg-black text-white font-bold flex items-center justify-center text-sm shrink-0 overflow-hidden border-2 border-white">
      {member.avatar_url
        ? <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
        : member.full_name.slice(0, 1)
      }
    </div>
  );
}

function fmtDate(d: string) {
  try { return format(new Date(d), 'yyyy년 M월 d일', { locale: ko }); }
  catch { return d; }
}

/* ══════════════════════════════════════════
   Edit Modal
══════════════════════════════════════════ */
function EditModal({
  open, onClose, project, onSave,
}: {
  open: boolean;
  onClose: () => void;
  project: ProjectDetail;
  onSave: (updated: Partial<ProjectDetail>) => void;
}) {
  const [title,      setTitle]      = useState(project.title);
  const [description, setDescription] = useState(project.description);
  const [status,     setStatus]     = useState<ProjectDetail['status']>(project.status);
  const [startDate,  setStartDate]  = useState(project.start_date);
  const [endDate,    setEndDate]    = useState(project.end_date);
  const [githubUrl,  setGithubUrl]  = useState(project.github_url ?? '');
  const [demoUrl,    setDemoUrl]    = useState(project.demo_url ?? '');
  const [tags,       setTags]       = useState<string[]>(project.tech_stack ?? []);
  const [tagInput,   setTagInput]   = useState('');
  const [saving,     setSaving]     = useState(false);
  const tagRef = useRef<HTMLInputElement>(null);

  /* 모달 열릴 때 데이터 동기화 */
  useEffect(() => {
    if (open) {
      setTitle(project.title);
      setDescription(project.description);
      setStatus(project.status);
      setStartDate(project.start_date);
      setEndDate(project.end_date);
      setGithubUrl(project.github_url ?? '');
      setDemoUrl(project.demo_url ?? '');
      setTags(project.tech_stack ?? []);
      setTagInput('');
    }
  }, [open, project]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
    tagRef.current?.focus();
  };

  const handleTagKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
    if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags(prev => prev.slice(0, -1));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    setSaving(true);
    const payload = {
      title, description, status,
      start_date: startDate, end_date: endDate,
      github_url: githubUrl || null,
      demo_url:   demoUrl   || null,
      tech_stack: tags,
    };
    try {
      await supabase.from('projects').update(payload).eq('id', project.id);
    } catch { /* mock 환경에서는 무시 */ }
    onSave(payload);
    setSaving(false);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* 오버레이 */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 모달 */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="relative w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto
                   bg-white rounded-t-[2rem] sm:rounded-3xl shadow-2xl border border-black/10"
        onClick={e => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          {/* 헤더 */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-5
                          border-b border-black/8 bg-white">
            <div>
              <h2 className="text-lg font-black text-black">✨ 프로젝트 수정하기</h2>
              <p className="text-xs text-black/40 font-medium mt-0.5">PROJECT EDIT · 운영진 전용</p>
            </div>
            <button type="button" onClick={onClose}
              className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors">
              <X size={16} className="text-black/60" />
            </button>
          </div>

          <div className="px-6 py-6 space-y-6">

            {/* 프로젝트 제목 */}
            <div className="space-y-2">
              <label className="text-sm font-black text-black">
                프로젝트 제목 <span className="text-black/30">*</span>
              </label>
              <input
                required value={title} onChange={e => setTitle(e.target.value)}
                placeholder="예: 2026 앱 개발 프로젝트"
                className="w-full px-4 py-3.5 rounded-2xl bg-black/3 text-black text-sm font-medium
                           placeholder:text-black/25 outline-none focus:bg-black/5 transition-colors"
              />
            </div>

            {/* 프로젝트 설명 */}
            <div className="space-y-2">
              <label className="text-sm font-black text-black">프로젝트 설명</label>
              <textarea
                value={description} onChange={e => setDescription(e.target.value)}
                placeholder="프로젝트 목표, 기대 결과물, 기술 스택 등을 입력하세요."
                rows={4}
                className="w-full px-4 py-3.5 rounded-2xl bg-black/3 text-black text-sm font-medium
                           placeholder:text-black/25 outline-none focus:bg-black/5 transition-colors resize-none"
              />
            </div>

            {/* 상태 */}
            <div className="space-y-2">
              <label className="text-sm font-black text-black">프로젝트 상태</label>
              <div className="flex gap-2">
                {(['active', 'closed', 'draft'] as const).map(s => (
                  <button
                    key={s} type="button"
                    onClick={() => setStatus(s)}
                    className={`flex-1 py-2.5 rounded-full text-xs font-black border transition-all
                      ${status === s
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-black/50 border-black/20 hover:border-black hover:text-black'
                      }`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* 기간 */}
            <div className="space-y-2">
              <label className="text-sm font-black text-black">
                프로젝트 기간 <span className="text-black/30">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-black/40">시작일</p>
                  <input
                    type="date" value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-black/3 text-black text-sm font-medium
                               outline-none focus:bg-black/5 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-black/40">종료일</p>
                  <input
                    type="date" value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-black/3 text-black text-sm font-medium
                               outline-none focus:bg-black/5 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* 기술 스택 태그 */}
            <div className="space-y-2">
              <label className="text-sm font-black text-black">기술 스택</label>
              <div className="flex flex-wrap gap-1.5 px-4 py-3 rounded-2xl bg-black/3 min-h-[52px]
                              focus-within:bg-black/5 transition-colors cursor-text"
                onClick={() => tagRef.current?.focus()}>
                {tags.map(t => (
                  <span key={t}
                    className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1
                               rounded-full bg-black text-white">
                    {t}
                    <button type="button" onClick={e => { e.stopPropagation(); setTags(prev => prev.filter(x => x !== t)); }}
                      className="ml-0.5 text-white/60 hover:text-white transition-colors">
                      <X size={10} />
                    </button>
                  </span>
                ))}
                <input
                  ref={tagRef}
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleTagKey}
                  onBlur={addTag}
                  placeholder={tags.length === 0 ? 'React, TypeScript 입력 후 Enter...' : ''}
                  className="flex-1 min-w-[120px] text-sm font-medium text-black placeholder:text-black/25
                             outline-none bg-transparent"
                />
              </div>
              <p className="text-xs text-black/30 font-medium px-1">Enter 또는 , 로 태그 추가</p>
            </div>

            {/* 링크 */}
            <div className="space-y-3">
              <label className="text-sm font-black text-black">관련 링크</label>
              <div className="space-y-2">
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-black/3 focus-within:bg-black/5 transition-colors">
                  <GitBranch size={14} className="text-black/40 shrink-0" />
                  <input
                    value={githubUrl} onChange={e => setGithubUrl(e.target.value)}
                    placeholder="GitHub URL"
                    className="flex-1 text-sm font-medium text-black placeholder:text-black/25 outline-none bg-transparent"
                  />
                </div>
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-black/3 focus-within:bg-black/5 transition-colors">
                  <ExternalLink size={14} className="text-black/40 shrink-0" />
                  <input
                    value={demoUrl} onChange={e => setDemoUrl(e.target.value)}
                    placeholder="데모 URL"
                    className="flex-1 text-sm font-medium text-black placeholder:text-black/25 outline-none bg-transparent"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* 푸터 */}
          <div className="sticky bottom-0 border-t border-black/8 bg-white px-6 py-4 flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-3.5 rounded-full border border-black/20 text-sm font-bold text-black/60
                         hover:bg-black/5 hover:text-black transition-colors">
              취소
            </button>
            <button type="submit" disabled={saving || !title}
              className="flex-[2] py-3.5 rounded-full bg-black text-white font-black text-sm
                         hover:bg-black/90 disabled:opacity-40 disabled:cursor-not-allowed
                         transition-all active:scale-[0.98] flex items-center justify-center gap-2">
              {saving
                ? <><Loader2 size={15} className="animate-spin" /> 저장 중...</>
                : <><Plus size={15} /> 🏃 수정 완료</>
              }
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

/* ══════════════════════════════════════════
   Main Component
══════════════════════════════════════════ */
export function AdminProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project,    setProject]    = useState<ProjectDetail | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [notFound,   setNotFound]   = useState(false);
  const [editOpen,   setEditOpen]   = useState(false);

  useEffect(() => {
    if (!projectId) { setNotFound(true); setLoading(false); return; }

    async function load() {
      setLoading(true);
      try {
        const { data: row } = await supabase
          .from('projects')
          .select('id, title, description, status, start_date, end_date, thumbnail_url, tech_stack, github_url, demo_url, created_at')
          .eq('id', projectId)
          .maybeSingle();

        let participants: Participant[] = [];
        try {
          const { data: members } = await supabase
            .from('project_members')
            .select('id, role, profiles(id, full_name, avatar_url)')
            .eq('project_id', projectId);
          if (members && members.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            participants = members.map((m: any) => ({
              id:         m.profiles?.id ?? m.id,
              full_name:  m.profiles?.full_name ?? '멤버',
              role:       m.role ?? '팀원',
              avatar_url: m.profiles?.avatar_url,
            }));
          }
        } catch { /* skip */ }

        if (row) {
          setProject({ ...row, participants } as ProjectDetail);
        } else {
          const mock = MOCK[projectId];
          if (mock) setProject({ id: projectId, ...mock });
          else setNotFound(true);
        }
      } catch {
        const mock = MOCK[projectId];
        if (mock) setProject({ id: projectId, ...mock });
        else setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [projectId]);

  const handleSave = (updated: Partial<ProjectDetail>) => {
    setProject(prev => prev ? { ...prev, ...updated } : prev);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-black/30 animate-spin mx-auto" />
          <p className="text-black/40 font-medium text-sm">프로젝트 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-black/50 font-bold">프로젝트를 찾을 수 없습니다</p>
          <button onClick={() => navigate('/admin/projects')}
            className="mt-4 text-black font-bold text-sm underline underline-offset-2">
            ← 목록으로
          </button>
        </div>
      </div>
    );
  }

  const totalDays = project.start_date && project.end_date
    ? Math.max(1, Math.ceil((new Date(project.end_date).getTime() - new Date(project.start_date).getTime()) / 86400000))
    : null;
  const elapsedDays = project.start_date
    ? Math.min(totalDays ?? 0, Math.max(0, Math.ceil((Date.now() - new Date(project.start_date).getTime()) / 86400000)))
    : 0;
  const progress = totalDays ? Math.round((elapsedDays / totalDays) * 100) : 0;

  return (
    <>
      <div className="bg-white min-h-screen pb-16">
        <div className="max-w-5xl mx-auto px-4 pt-6 space-y-6">

          <button
            onClick={() => navigate('/admin/projects')}
            className="flex items-center gap-1.5 text-black font-bold text-sm
                       hover:text-black/60 transition-colors group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            프로젝트 목록
          </button>

          {/* ── 헤더 카드 ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-black/20 overflow-hidden"
          >
            {project.thumbnail_url && (
              <div className="w-full h-48 overflow-hidden bg-black/5">
                <img src={project.thumbnail_url} alt="" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-2 flex-1 min-w-0">
                  <StatusBadge status={project.status} />
                  <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight leading-tight">
                    {project.title}
                  </h1>
                  <p className="text-sm text-black/60 font-medium leading-relaxed">
                    {project.description}
                  </p>
                </div>
                {/* ★ 편집 버튼 */}
                <button
                  onClick={() => setEditOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-black/20
                             text-sm font-bold text-black hover:bg-black hover:text-white transition-all shrink-0"
                >
                  <Pencil size={13} /> 편집
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-black/10 border border-black/10 rounded-2xl overflow-hidden">
                <div className="px-4 py-3">
                  <p className="text-[10px] font-black text-black/40 uppercase tracking-wider mb-1">시작일</p>
                  <p className="text-sm font-bold text-black">{fmtDate(project.start_date)}</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[10px] font-black text-black/40 uppercase tracking-wider mb-1">종료일</p>
                  <p className="text-sm font-bold text-black">{fmtDate(project.end_date)}</p>
                </div>
                <div className="px-4 py-3 col-span-2 sm:col-span-1 border-t sm:border-t-0 border-black/10">
                  <p className="text-[10px] font-black text-black/40 uppercase tracking-wider mb-1">팀원</p>
                  <p className="text-sm font-bold text-black">{project.participants.length}명</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── 진행률 ── */}
          {project.status === 'active' && totalDays !== null && (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 }}
              className="bg-white rounded-3xl border border-black/20 p-6 space-y-3"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-black" />
                <h3 className="font-black text-black">프로젝트 진행률</h3>
                <span className="ml-auto text-sm font-black text-black">{progress}%</span>
              </div>
              <div className="w-full h-2.5 bg-black/8 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full bg-black rounded-full"
                />
              </div>
              <p className="text-xs text-black/40 font-medium">
                {elapsedDays}일 경과 / 총 {totalDays}일
              </p>
            </motion.div>
          )}

          {/* ── 기술 스택 ── */}
          {project.tech_stack && project.tech_stack.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.09 }}
              className="bg-white rounded-3xl border border-black/20 p-6 space-y-4"
            >
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-black" />
                <h3 className="font-black text-black">기술 스택</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {project.tech_stack.map(t => (
                  <span key={t}
                    className="text-xs font-bold px-3 py-1.5 rounded-full bg-black/5 border border-black/10 text-black">
                    <Zap className="w-2.5 h-2.5 inline mr-1" />{t}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── 팀원 ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="bg-white rounded-3xl border border-black/20 overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-black/10 flex items-center gap-2.5">
              <Users className="w-4 h-4 text-black" />
              <h3 className="font-black text-black">팀원 현황</h3>
              <span className="text-xs bg-black text-white font-bold px-2 py-0.5 rounded-full ml-1">
                {project.participants.length}명
              </span>
            </div>
            {project.participants.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <Rocket className="w-8 h-8 text-black/15 mx-auto mb-2" />
                <p className="text-sm text-black/40 font-medium">등록된 팀원이 없습니다</p>
              </div>
            ) : (
              <ul className="divide-y divide-black/8">
                {project.participants.map((member, i) => (
                  <motion.li
                    key={member.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + i * 0.04 }}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-black/3 transition-colors"
                  >
                    <Avatar member={member} />
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-black text-sm">{member.full_name}</p>
                      <p className="text-xs text-black/50 font-medium mt-0.5">{member.role ?? '팀원'}</p>
                    </div>
                  </motion.li>
                ))}
              </ul>
            )}
          </motion.div>

          {/* ── 링크 ── */}
          {(project.github_url || project.demo_url) && (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="bg-white rounded-3xl border border-black/20 p-6 space-y-4"
            >
              <h3 className="font-black text-black">관련 링크</h3>
              <div className="flex gap-3 flex-wrap">
                {project.github_url && (
                  <a href={project.github_url} target="_blank" rel="noreferrer"
                     className="flex items-center gap-1.5 text-sm font-bold text-black
                                hover:bg-black hover:text-white bg-white border border-black/20
                                px-4 py-2 rounded-full transition-colors">
                    <GitBranch size={14} /> GitHub
                  </a>
                )}
                {project.demo_url && (
                  <a href={project.demo_url} target="_blank" rel="noreferrer"
                     className="flex items-center gap-1.5 text-sm font-bold text-black
                                hover:bg-black hover:text-white bg-white border border-black/20
                                px-4 py-2 rounded-full transition-colors">
                    <ExternalLink size={14} /> 데모 보기
                  </a>
                )}
              </div>
            </motion.div>
          )}

          {/* ── 하단 액션 ── */}
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/admin/projects')}
              className="flex-1 py-3.5 rounded-full border border-black/20 font-bold text-sm text-black/60 hover:bg-black/5 hover:text-black transition-colors"
            >
              목록으로
            </button>
            <button
              onClick={() => setEditOpen(true)}
              className="flex-[2] py-3.5 rounded-full bg-black text-white font-bold text-sm hover:bg-black/90 transition-colors flex items-center justify-center gap-2"
            >
              <Pencil size={15} /> 프로젝트 편집하기
            </button>
          </div>

        </div>
      </div>

      {/* ══ 편집 모달 ══ */}
      <AnimatePresence>
        {editOpen && (
          <EditModal
            open={editOpen}
            onClose={() => setEditOpen(false)}
            project={project}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>
    </>
  );
}
