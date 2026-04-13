import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  Eye, Flame, Users, Calendar,
  ExternalLink, Send, X, CheckCircle2,
  Layers, GitBranch, Zap, MessageSquare, Shield, Loader2,
} from 'lucide-react';
import { BackButton } from '../../components/common/BackButton';

/* ══════════════════════════════════════════
   Types
══════════════════════════════════════════ */
type ProjectStatus = '진행중' | '완료' | '준비중';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  clubName: string;
  isLeader?: boolean;
  avatar_url?: string;
}

interface ProjectData {
  id: string;
  clubName: string;
  clubEmoji: string;
  title: string;
  emoji: string;
  status: ProjectStatus;
  views: number;
  isHot: boolean;
  description: string;
  detail: string;
  tags: string[];
  team: TeamMember[];
  startDate: string;
  endDate?: string;
  githubUrl?: string;
  demoUrl?: string;
  leaderEmail?: string;
}

/* ══════════════════════════════════════════
   Utils
══════════════════════════════════════════ */
const maskName = (name: string): string => {
  if (!name || name.length === 0) return '**';
  return name[0] + '**';
};

const STATUS_MAP: Record<string, ProjectStatus> = {
  active: '진행중',
  closed: '완료',
  draft:  '준비중',
};

/* ══════════════════════════════════════════
   Mock fallback
══════════════════════════════════════════ */
const MOCK_PROJECTS: Record<string, Omit<ProjectData, 'id'>> = {
  '1': {
    clubName: 'Club DX 개발팀', clubEmoji: '💻',
    title: '메인 앱 개발', emoji: '📱',
    status: '진행중', views: 1240, isHot: true,
    description: '동아리 운영을 위한 올인원 플랫폼 개발 프로젝트입니다.',
    detail: `Club DX 메인 앱은 동아리 회원 관리, 출결, 과제, 일정, 모집 공고 등 모든 운영 업무를 하나의 앱에서 처리할 수 있도록 설계된 풀스택 웹 서비스입니다.\n\nReact + TypeScript 프론트엔드, Supabase 백엔드를 기반으로 개발 중이며, 현재 관리자 대시보드와 멤버 포털을 구현하고 있습니다.`,
    tags: ['React', 'TypeScript', 'Supabase', 'Tailwind CSS', 'Framer Motion'],
    team: [
      { id: 'a', name: '김철수', role: 'Lead Developer',  clubName: 'Club DX 개발팀', isLeader: true },
      { id: 'b', name: '이영희', role: 'Frontend Dev',    clubName: 'Club DX 개발팀' },
      { id: 'c', name: '박민준', role: 'UI/UX Designer',  clubName: '크리에이티브 디자인' },
    ],
    startDate: '2025.09',
    githubUrl: 'https://github.com/example/clubdx',
    demoUrl: 'https://clubdx.app',
    leaderEmail: 'lead@clubdx.app',
  },
  '2': {
    clubName: '크리에이티브 디자인', clubEmoji: '🎨',
    title: '브랜딩 리뉴얼', emoji: '🎯',
    status: '완료', views: 873, isHot: true,
    description: '동아리 전체 브랜드 아이덴티티를 새롭게 설계한 프로젝트입니다.',
    detail: `Club DX의 로고, 컬러 시스템, 타이포그래피를 전면 리뉴얼한 브랜딩 프로젝트입니다.\n\n기존의 복잡한 디자인 요소를 정리하고, 개발팀과 디자인팀이 함께 협업하여 일관성 있는 Design Token 시스템을 구축했습니다.`,
    tags: ['Figma', 'Brand Design', 'Design System', 'Illustration'],
    team: [
      { id: 'd', name: '윤서연', role: 'Brand Designer', clubName: '크리에이티브 디자인', isLeader: true },
      { id: 'e', name: '한소희', role: 'UI Designer',    clubName: '크리에이티브 디자인' },
    ],
    startDate: '2025.06', endDate: '2025.12',
    demoUrl: 'https://figma.com/example',
    leaderEmail: 'design@clubdx.app',
  },
  '3': {
    clubName: '마케팅 보이즈', clubEmoji: '📣',
    title: '신입 온보딩 자동화', emoji: '🤖',
    status: '준비중', views: 542, isHot: false,
    description: '신입 부원 온보딩 프로세스를 자동화하는 시스템 개발 프로젝트입니다.',
    detail: `매 기수마다 반복되는 신입 부원 안내 메시지, 자료 배포, OT 일정 공유 등의 작업을 자동화하는 프로젝트입니다.\n\nSlack Bot + Notion API + Supabase를 연동해 구현할 예정입니다.`,
    tags: ['Slack API', 'Notion API', 'Node.js', 'Automation'],
    team: [
      { id: 'f', name: '정현우', role: 'Project Lead', clubName: '마케팅 보이즈', isLeader: true },
    ],
    startDate: '2026.04',
    leaderEmail: 'onboard@clubdx.app',
  },
};

/* ══════════════════════════════════════════
   DB row → ProjectData
══════════════════════════════════════════ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFromDB(row: any, participants: TeamMember[]): ProjectData {
  const mock = MOCK_PROJECTS[String(row.id)];
  const clubsData = row.clubs;
  const clubName = (Array.isArray(clubsData) ? clubsData[0]?.name : clubsData?.name) ?? mock?.clubName ?? '알 수 없음';
  const status: ProjectStatus = STATUS_MAP[row.status] ?? mock?.status ?? '진행중';

  return {
    id:          String(row.id),
    clubName,
    clubEmoji:   mock?.clubEmoji ?? '📁',
    title:       row.title       ?? mock?.title       ?? '프로젝트',
    emoji:       mock?.emoji     ?? '📁',
    status,
    views:       row.views       ?? mock?.views       ?? 0,
    isHot:       (row.views      ?? 0) >= 500,
    description: row.description ?? mock?.description ?? '',
    detail:      mock?.detail    ?? row.description   ?? '',
    tags:        Array.isArray(row.tech_stack) && row.tech_stack.length > 0
                   ? row.tech_stack
                   : mock?.tags ?? [],
    team:        participants.length > 0 ? participants : mock?.team ?? [],
    startDate:   row.start_date  ? row.start_date.slice(0, 7).replace('-', '.') : (mock?.startDate ?? ''),
    endDate:     row.end_date    ? row.end_date.slice(0, 7).replace('-', '.')   : mock?.endDate,
    githubUrl:   row.github_url  ?? mock?.githubUrl,
    demoUrl:     row.demo_url    ?? mock?.demoUrl,
    leaderEmail: row.leader_email ?? mock?.leaderEmail,
  };
}

/* ══════════════════════════════════════════
   Component
══════════════════════════════════════════ */
export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate      = useNavigate();
  const { isAdminMode } = useAuth();

  const [contactOpen, setContactOpen] = useState(false);
  const [msg,  setMsg]  = useState('');
  const [sent, setSent] = useState(false);
  const [project,  setProject]  = useState<ProjectData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!projectId) { setNotFound(true); setLoading(false); return; }

    async function loadProject() {
      setLoading(true);
      try {
        const { data: row, error } = await supabase
          .from('projects')
          .select('id, title, description, image_url, views, status, tech_stack, start_date, end_date, github_url, demo_url, leader_email, clubs(id, name, category)')
          .eq('id', projectId)
          .maybeSingle();

        if (error) console.error('project fetch error:', error);

        let participants: TeamMember[] = [];
        try {
          const { data: members } = await supabase
            .from('project_members')
            .select('id, role, is_leader, profiles(id, full_name, avatar_url, univ_name)')
            .eq('project_id', projectId);

          if (members && members.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            participants = members.map((m: any) => ({
              id:        m.profiles?.id        ?? m.id,
              name:      m.profiles?.full_name ?? '멤버',
              role:      m.role                ?? '팀원',
              clubName:  m.profiles?.univ_name ?? '',
              isLeader:  m.is_leader           ?? false,
              avatar_url: m.profiles?.avatar_url,
            }));
          }
        } catch { /* project_members 테이블이 없을 수도 있음 */ }

        if (row) {
          setProject(buildFromDB(row, participants));
        } else {
          const mock = MOCK_PROJECTS[projectId];
          if (mock) setProject({ id: projectId, ...mock });
          else setNotFound(true);
        }
      } catch (err) {
        console.error(err);
        const mock = MOCK_PROJECTS[projectId];
        if (mock) setProject({ id: projectId, ...mock });
        else setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    loadProject();
  }, [projectId]);

  /* ── 테마 헬퍼 ── */
  const bg          = isAdminMode ? 'bg-white'             : 'bg-black';
  const border      = isAdminMode ? 'border-black/10'      : 'border-white/10';
  const cardBg      = isAdminMode ? 'bg-white'             : 'bg-black';
  const cardBorder  = isAdminMode ? 'border-black/15'      : 'border-white/15';
  const textPri     = isAdminMode ? 'text-black'           : 'text-white';
  const textMuted   = isAdminMode ? 'text-black/60'        : 'text-white/60';
  const textDim     = isAdminMode ? 'text-black/40'        : 'text-white/40';
  const textFaint   = isAdminMode ? 'text-black/50'        : 'text-white/50';
  const iconColor   = isAdminMode ? 'text-black'           : 'text-white';
  const divider     = isAdminMode ? 'divide-black/8'       : 'divide-white/8';
  const hoverBg     = isAdminMode ? 'hover:bg-black/3'     : 'hover:bg-white/3';
  const statusBadgeBg = isAdminMode ? 'border-black/20 bg-black/5 text-black' : 'border-white/20 bg-white/5 text-white';
  const statusDot   = isAdminMode ? 'bg-black'             : 'bg-white';
  const hotBadge    = isAdminMode ? 'bg-black text-white'  : 'bg-white text-black';
  const primaryBtn  = isAdminMode ? 'bg-black text-white hover:bg-black/90'  : 'bg-white text-black hover:bg-white/90';
  const techBadge   = isAdminMode ? 'bg-black/5 border-black/15 text-black'  : 'bg-white/5 border-white/15 text-white';
  const linkBtn     = isAdminMode
    ? 'text-black hover:bg-black hover:text-white bg-white border-black/20'
    : 'text-white hover:bg-white hover:text-black bg-black border-white/20';
  const teamCountBadge = isAdminMode ? 'bg-black text-white' : 'bg-white text-black';
  const memberBadge = isAdminMode ? 'border-black/15 bg-black/5 text-black' : 'border-white/15 bg-white/5 text-white';
  const leaderBadge = isAdminMode ? 'bg-black text-white'  : 'bg-white text-black';
  const memberAvatar= isAdminMode ? 'bg-black/10 text-black' : 'bg-white/10 text-white';
  const privacyRow  = isAdminMode ? 'bg-black/3 border-black/10' : 'bg-white/3 border-white/10';

  /* 모달 */
  const modalBg     = isAdminMode ? 'bg-white border-black/15'  : 'bg-black border-white/15';
  const modalBorder = isAdminMode ? 'border-black/10'           : 'border-white/10';
  const inputCls    = isAdminMode
    ? 'bg-black/5 border-black/15 text-black placeholder:text-black/30 focus:border-black/40 focus:ring-black/10'
    : 'bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-white/40 focus:ring-white/10';
  const closeBtn    = isAdminMode ? 'bg-black/8 hover:bg-black/15' : 'bg-white/8 hover:bg-white/15';
  const closeBtnIcon= isAdminMode ? 'text-black/60'               : 'text-white/60';
  const labelCls    = isAdminMode ? 'text-black/60'               : 'text-white/60';

  /* ── 로딩 ── */
  if (loading) {
    return (
      <div className={`min-h-screen ${bg} flex items-center justify-center`}>
        <div className="text-center space-y-3">
          <Loader2 className={`w-8 h-8 ${textDim} animate-spin mx-auto`} />
          <p className={`${textDim} font-medium text-sm`}>프로젝트 불러오는 중...</p>
        </div>
      </div>
    );
  }

  /* ── 없음 ── */
  if (notFound || !project) {
    return (
      <div className={`min-h-screen ${bg} flex items-center justify-center p-6`}>
        <div className="text-center space-y-4 max-w-sm">
          <div className={`w-20 h-20 rounded-3xl mx-auto flex items-center justify-center text-4xl
                          ${isAdminMode ? 'bg-black/5 border border-black/10' : 'bg-white/5 border border-white/10'}`}>
            🔍
          </div>
          <div>
            <p className={`text-xl font-black ${textPri}`}>존재하지 않는 프로젝트</p>
            <p className={`text-sm ${textFaint} mt-1.5 font-medium`}>
              URL을 확인하거나 목록으로 돌아가서 다시 선택해 주세요.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={() => navigate(-1)}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-full font-black text-sm
                       ${primaryBtn} transition-colors`}
          >
            ← 목록으로 돌아가기
          </motion.button>
        </div>
      </div>
    );
  }

  const handleSend = () => {
    setSent(true);
    setTimeout(() => { setContactOpen(false); setSent(false); setMsg(''); }, 1600);
  };

  return (
    <div className={`min-h-screen ${bg} pb-24`}>

      {/* ══ 헤더 ══ */}
      <div className={`${bg} border-b ${border} px-6 pt-10 pb-20`}>
        <div className="max-w-5xl mx-auto">
          <BackButton onClick={() => navigate(-1)} className="mb-8" />

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 text-[10px] font-black
                               px-2.5 py-1 rounded-full border ${statusBadgeBg}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                {project.status}
              </span>
              {project.isHot && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-black
                                 px-2.5 py-1 rounded-full ${hotBadge}`}>
                  <Flame className="w-3 h-3" /> HOT
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-3xl">{project.clubEmoji}</span>
              <h1 className={`text-4xl sm:text-5xl font-black tracking-tight leading-none ${textPri}`}>
                {project.clubName}
              </h1>
            </div>

            <p className={`text-lg sm:text-xl font-semibold ${textMuted} tracking-tight pl-1`}>
              {project.emoji} {project.title}
            </p>

            <div className={`flex items-center gap-5 pt-1 ${textFaint} text-sm font-medium`}>
              <span className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> {project.views.toLocaleString()}회
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {project.startDate}{project.endDate ? ` ~ ${project.endDate}` : ' ~'}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> {project.team.length}명
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ══ 콘텐츠 ══ */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-8 relative z-10 space-y-5">

        {/* ── CTA 카드 ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className={`${cardBg} rounded-3xl border ${cardBorder} p-6
                     flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
        >
          <div>
            <p className={`font-black ${textPri} text-base leading-snug`}>
              {project.description}
            </p>
            {project.team.length > 0 && (
              <p className={`text-sm ${textFaint} mt-1 font-medium`}>
                {maskName(project.team[0].name)} ({project.team[0].role}) 이 주도하고 있어요.
              </p>
            )}
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={() => setContactOpen(true)}
            className={`flex items-center justify-center gap-2 px-6 py-3.5
                       ${primaryBtn} rounded-full font-black text-sm
                       transition-colors shrink-0 whitespace-nowrap`}
          >
            <MessageSquare className="w-4 h-4" /> 🚀 프로젝트 컨택하기
          </motion.button>
        </motion.div>

        {/* ── 프로젝트 상세 ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.07 }}
          className={`${cardBg} rounded-3xl border ${cardBorder} p-6 space-y-5`}
        >
          <div className="flex items-center gap-2">
            <Layers className={`w-4 h-4 ${iconColor}`} />
            <h3 className={`font-black ${textPri}`}>프로젝트 상세</h3>
          </div>
          <p className={`text-sm ${isAdminMode ? 'text-black/70' : 'text-white/70'} leading-relaxed whitespace-pre-line`}>
            {project.detail || project.description}
          </p>

          {project.tags.length > 0 && (
            <div>
              <p className={`text-xs font-black ${textFaint} uppercase tracking-wider mb-2.5`}>
                기술 스택
              </p>
              <div className="flex flex-wrap gap-2">
                {project.tags.map(tag => (
                  <span key={tag}
                    className={`text-xs ${techBadge} font-bold px-3 py-1.5 rounded-full border`}>
                    <Zap className="w-2.5 h-2.5 inline mr-1" />{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(project.githubUrl || project.demoUrl) && (
            <div className="flex gap-3 flex-wrap pt-1">
              {project.githubUrl && (
                <a href={project.githubUrl} target="_blank" rel="noreferrer"
                   className={`flex items-center gap-1.5 text-sm font-bold
                              ${linkBtn} px-4 py-2 rounded-full border transition-colors`}>
                  <GitBranch size={14} /> GitHub
                </a>
              )}
              {project.demoUrl && (
                <a href={project.demoUrl} target="_blank" rel="noreferrer"
                   className={`flex items-center gap-1.5 text-sm font-bold
                              ${linkBtn} px-4 py-2 rounded-full border transition-colors`}>
                  <ExternalLink size={14} /> 데모 보기
                </a>
              )}
            </div>
          )}
        </motion.div>

        {/* ── 함께하는 팀원 ── */}
        {project.team.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className={`${cardBg} rounded-3xl border ${cardBorder} overflow-hidden`}
          >
            <div className={`px-6 py-4 border-b ${border} flex items-center gap-2.5`}>
              <Users className={`w-4 h-4 ${iconColor}`} />
              <h3 className={`font-black ${textPri}`}>함께하는 팀원</h3>
              <span className={`text-xs ${teamCountBadge} font-bold px-2 py-0.5 rounded-full ml-1`}>
                {project.team.length}명
              </span>
              <span className={`ml-auto flex items-center gap-1 text-[10px] ${textDim} font-medium`}>
                <Shield className="w-3 h-3" /> 개인정보 보호
              </span>
            </div>

            <ul className={`divide-y ${divider}`}>
              {project.team.map((member, i) => (
                <motion.li
                  key={member.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.16 + i * 0.05 }}
                  className={`flex items-center gap-4 px-6 py-4 ${hoverBg} transition-colors`}
                >
                  <div className={`w-11 h-11 rounded-2xl ${memberAvatar} overflow-hidden
                                   flex items-center justify-center text-base font-black shrink-0`}>
                    {member.avatar_url
                      ? <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                      : member.name[0]
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-black ${textPri} text-sm tracking-wide`}>
                        {maskName(member.name)}
                      </span>
                      {member.clubName && (
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full
                                          border ${memberBadge} whitespace-nowrap`}>
                          {member.clubName}
                        </span>
                      )}
                      {member.isLeader && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${leaderBadge}`}>
                          리더
                        </span>
                      )}
                    </div>
                    <p className={`text-xs ${textFaint} font-medium mt-0.5`}>{member.role}</p>
                  </div>
                </motion.li>
              ))}
            </ul>

            <div className={`px-6 py-3 border-t ${privacyRow}`}>
              <p className={`text-[11px] ${textDim} font-medium flex items-center gap-1.5`}>
                <Shield className="w-3 h-3 shrink-0" />
                팀원 성명은 개인정보 보호를 위해 성(姓)만 표시됩니다.
              </p>
            </div>
          </motion.div>
        )}

        {/* ── 하단 컨택 버튼 ── */}
        <motion.button
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
          onClick={() => setContactOpen(true)}
          className={`w-full py-4 ${primaryBtn} rounded-full font-black text-base
                     flex items-center justify-center gap-2.5 transition-colors`}
        >
          <Zap className="w-5 h-5" /> 🚀 프로젝트 컨택하기
        </motion.button>

      </div>

      {/* ══ 컨택 모달 ══ */}
      <AnimatePresence>
        {contactOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setContactOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              className={`relative ${modalBg} w-full max-w-md rounded-3xl shadow-2xl border overflow-hidden`}
            >
              {!sent ? (
                <>
                  <div className={`px-7 pt-7 pb-5 border-b ${modalBorder} flex items-center justify-between`}>
                    <div>
                      <h3 className={`text-lg font-black ${textPri}`}>프로젝트 컨택하기</h3>
                      <p className={`text-xs ${textFaint} mt-0.5`}>
                        {project.clubName} · {project.title}
                      </p>
                    </div>
                    <button
                      onClick={() => setContactOpen(false)}
                      className={`w-8 h-8 ${closeBtn} rounded-full flex items-center justify-center transition-colors`}
                    >
                      <X size={15} className={closeBtnIcon} />
                    </button>
                  </div>
                  <div className="px-7 py-6 space-y-5">
                    <div>
                      <label className={`text-xs font-bold ${labelCls} uppercase tracking-wider block mb-2`}>
                        문의 내용
                      </label>
                      <textarea
                        value={msg}
                        onChange={e => setMsg(e.target.value)}
                        placeholder="참여 의향, 질문 사항 등을 자유롭게 적어주세요..."
                        rows={4}
                        className={`w-full px-4 py-3 rounded-2xl border text-sm outline-none
                                   focus:ring-2 resize-none transition-all ${inputCls}`}
                      />
                    </div>
                    <p className={`text-xs ${textDim} font-medium -mt-2`}>
                      문의는 {project.leaderEmail ?? '프로젝트 리더'} 에게 전달됩니다
                    </p>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleSend}
                      className={`w-full py-3.5 ${primaryBtn} rounded-full font-black text-sm
                                 transition-colors flex items-center justify-center gap-2`}
                    >
                      <Send size={16} /> 문의 보내기
                    </motion.button>
                  </div>
                </>
              ) : (
                <div className="px-7 py-14 text-center">
                  <CheckCircle2 className={`w-14 h-14 ${iconColor} mx-auto mb-4`} />
                  <p className={`text-xl font-black ${textPri}`}>전송 완료! 🚀</p>
                  <p className={`text-sm ${textFaint} mt-2`}>리더에게 전달됐어요. 곧 연락이 올 거예요!</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
