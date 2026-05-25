import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, Loader2, Users, CalendarDays,
  TrendingUp, MoreHorizontal, Megaphone, School,
  Trophy, PartyPopper, ArrowRight, Check,
  Mail, Phone, FileText, X, ChevronDown,
  Globe, Lock, Pencil, Trash2, AlertCircle,
  CheckCircle2, Clock, XCircle, HelpCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { OrgProgram, ProgramType, ProgramPhase } from './OrgDashboard';

/* ════════════════════════ 타입 ════════════════════════ */
interface Application {
  id: string;
  program_id: string;
  user_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  answers: Record<string, string> | null;
  status: 'PENDING' | 'REVIEWING' | 'ACCEPTED' | 'REJECTED' | 'WAITLISTED';
  note: string | null;
  applied_at: string;
}

interface ProgramMember {
  id: string;
  program_id: string;
  user_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  joined_at: string;
}

/* ════════════════════════ 상수 ════════════════════════ */
const TYPE_META: Record<ProgramType, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
  CLUB:     { label: '동아리',    icon: <School      className="w-3.5 h-3.5" />, color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-100' },
  CAMPAIGN: { label: '서포터즈',  icon: <Megaphone   className="w-3.5 h-3.5" />, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
  CONTEST:  { label: '공모전',    icon: <Trophy      className="w-3.5 h-3.5" />, color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-100' },
  EVENT:    { label: '이벤트',    icon: <PartyPopper className="w-3.5 h-3.5" />, color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-100' },
};

const PHASE_META: Record<ProgramPhase, { label: string; dot: string; badge: string }> = {
  DRAFT:      { label: '임시저장', dot: 'bg-gray-300',    badge: 'bg-gray-100   text-gray-500   border-gray-200' },
  RECRUITING: { label: '모집중',   dot: 'bg-blue-500',    badge: 'bg-blue-50    text-blue-600   border-blue-100' },
  REVIEWING:  { label: '검토중',   dot: 'bg-orange-400',  badge: 'bg-orange-50  text-orange-600 border-orange-100' },
  OPERATING:  { label: '운영중',   dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  COMPLETED:  { label: '수료',     dot: 'bg-gray-400',    badge: 'bg-gray-100   text-gray-400   border-gray-200' },
};

const PHASE_NEXT: Partial<Record<ProgramPhase, { next: ProgramPhase; label: string; confirm: string }>> = {
  DRAFT:      { next: 'RECRUITING', label: '모집 시작',  confirm: '모집을 시작하면 플랫폼에 공개됩니다. 시작하시겠습니까?' },
  RECRUITING: { next: 'REVIEWING',  label: '모집 마감',  confirm: '모집을 마감합니다. 이후 지원은 받지 않습니다.' },
  REVIEWING:  { next: 'OPERATING',  label: '운영 시작',  confirm: '합격자 선발을 완료하고 프로그램 운영을 시작합니다.' },
  OPERATING:  { next: 'COMPLETED',  label: '수료 처리',  confirm: '프로그램을 수료 처리합니다. 되돌릴 수 없습니다.' },
};

const APP_STATUS_META: Record<Application['status'], { label: string; icon: React.ReactNode; badge: string }> = {
  PENDING:    { label: '검토 대기', icon: <HelpCircle  className="w-3.5 h-3.5" />, badge: 'bg-gray-100   text-gray-500   border-gray-200' },
  REVIEWING:  { label: '검토중',   icon: <Clock       className="w-3.5 h-3.5" />, badge: 'bg-orange-50  text-orange-600 border-orange-100' },
  ACCEPTED:   { label: '합격',     icon: <CheckCircle2 className="w-3.5 h-3.5" />, badge: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  REJECTED:   { label: '불합격',   icon: <XCircle     className="w-3.5 h-3.5" />, badge: 'bg-red-50     text-red-500    border-red-100' },
  WAITLISTED: { label: '대기',     icon: <Clock       className="w-3.5 h-3.5" />, badge: 'bg-amber-50   text-amber-600  border-amber-100' },
};

/* ════════════════════════ 탭 정의 ════════════════════════ */
function getTabs(type: ProgramType, phase: ProgramPhase): string[] {
  switch (type) {
    case 'CLUB':     return ['개요', '부원', '일정', '과제', '회비'];
    case 'CAMPAIGN': return phase === 'OPERATING' || phase === 'COMPLETED'
      ? ['개요', '공고', '참여자', '미션', '통계']
      : ['개요', '공고', '지원자', '참여자', '통계'];
    case 'CONTEST':  return ['개요', '공고', '출품작', '심사', '결과'];
    case 'EVENT':    return ['개요', '공고', '참가자', '통계'];
  }
}

/* ════════════════════════ 공통 배지 컴포넌트 ════════════════════════ */
function PhaseBadge({ phase }: { phase: ProgramPhase }) {
  const m = PHASE_META[phase];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${m.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot} ${phase === 'RECRUITING' || phase === 'OPERATING' ? 'animate-pulse' : ''}`} />
      {m.label}
    </span>
  );
}

/* ════════════════════════ 지원자 상태 배지 ════════════════════════ */
function AppStatusBadge({ status }: { status: Application['status'] }) {
  const m = APP_STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${m.badge}`}>
      {m.icon}{m.label}
    </span>
  );
}

/* ════════════════════════ 메인 컴포넌트 ════════════════════════ */
export function OrgProgramDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [program,     setProgram]     = useState<OrgProgram | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState(0);
  const [phaseModal,  setPhaseModal]  = useState(false);
  const [phaseLoading,setPhaseLoading]= useState(false);

  /* 탭 데이터 */
  const [applications, setApplications] = useState<Application[]>([]);
  const [members,      setMembers]      = useState<ProgramMember[]>([]);
  const [dataLoaded,   setDataLoaded]   = useState<Record<string, boolean>>({});

  /* ── 프로그램 로드 ── */
  useEffect(() => {
    if (!id) return;
    void (async () => {
      setLoading(true);
      const { data } = await supabase.from('org_programs').select('*').eq('id', id).single();
      setProgram(data as OrgProgram ?? null);
      setLoading(false);
    })();
  }, [id]);

  /* ── 탭별 데이터 lazy load ── */
  const tabs = program ? getTabs(program.type, program.phase) : [];
  const currentTab = tabs[activeTab] ?? '';

  const loadTabData = useCallback(async (tab: string) => {
    if (!id || dataLoaded[tab]) return;
    setDataLoaded(prev => ({ ...prev, [tab]: true }));

    if (tab === '지원자' || tab === '출품작' || tab === '참가자') {
      const { data } = await supabase.from('org_applications')
        .select('*').eq('program_id', id).order('applied_at', { ascending: false });
      setApplications((data ?? []) as Application[]);
    }
    if (tab === '부원' || tab === '참여자') {
      const { data } = await supabase.from('org_program_members')
        .select('*').eq('program_id', id).order('joined_at', { ascending: false });
      setMembers((data ?? []) as ProgramMember[]);
    }
  }, [id, dataLoaded]);

  useEffect(() => {
    if (currentTab) void loadTabData(currentTab);
  }, [currentTab, loadTabData]);

  /* ── 단계 전환 ── */
  const handlePhaseTransition = async () => {
    if (!program || !id) return;
    const next = PHASE_NEXT[program.phase];
    if (!next) return;
    setPhaseLoading(true);
    try {
      await supabase.from('org_programs').update({ phase: next.next }).eq('id', id);
      setProgram(prev => prev ? { ...prev, phase: next.next } : prev);
      setPhaseModal(false);
    } finally {
      setPhaseLoading(false);
    }
  };

  /* ── 로딩 ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }
  if (!program) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <p className="text-gray-400 font-medium">프로그램을 찾을 수 없습니다</p>
      </div>
    );
  }

  const tm  = TYPE_META[program.type];
  const pm  = PHASE_META[program.phase];
  const nxt = PHASE_NEXT[program.phase];

  return (
    <div className="min-h-screen bg-[#f5f5f5]">

      {/* ── 헤더 ── */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4">

          {/* 상단 바 */}
          <div className="flex items-center justify-between py-4">
            <button onClick={() => navigate('/org')}
              className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-2">
              <button className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                <Pencil className="w-4 h-4 text-gray-500" />
              </button>
              <button className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                <MoreHorizontal className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* 프로그램 정보 */}
          <div className="pb-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${tm.bg} ${tm.border} ${tm.color}`}>
                {tm.icon}{tm.label}
              </span>
              <PhaseBadge phase={program.phase} />
              {program.field && (
                <span className="text-[10px] font-bold text-gray-400 px-2 py-0.5 rounded-full bg-gray-100">
                  {program.field}
                </span>
              )}
            </div>
            <h1 className="text-xl font-black text-gray-900 leading-tight">{program.name}</h1>

            {/* 통계 요약 */}
            <div className="flex items-center gap-4 text-xs text-gray-400 font-medium">
              {program.capacity && (
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />모집 {program.capacity}명</span>
              )}
              {program.recruit_end && (
                <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />마감 {program.recruit_end}</span>
              )}
              {program.start_date && (
                <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />활동 {program.start_date}</span>
              )}
              <span className="flex items-center gap-1">
                {program.is_public ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                {program.is_public ? '공개' : '비공개'}
              </span>
            </div>

            {/* 단계 전환 버튼 */}
            {nxt && (
              <button
                onClick={() => setPhaseModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white font-black text-xs
                           hover:bg-gray-800 transition-colors"
              >
                {nxt.label} <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 탭 바 */}
          <div className="flex gap-0 overflow-x-auto scrollbar-hide -mx-4 px-4">
            {tabs.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                className={`shrink-0 px-4 py-3 text-xs font-black transition-colors relative whitespace-nowrap
                  ${activeTab === i ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {tab}
                {activeTab === i && (
                  <motion.span layoutId="tab-indicator"
                    className="absolute bottom-0 left-2 right-2 h-0.5 bg-gray-900 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 탭 콘텐츠 ── */}
      <div className="max-w-2xl mx-auto px-4 py-5 pb-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {currentTab === '개요' && <TabOverview program={program} />}
            {(currentTab === '지원자' || currentTab === '출품작' || currentTab === '참가자') &&
              <TabApplicants applications={applications} programType={program.type} onStatusChange={(appId, status) => {
                setApplications(prev => prev.map(a => a.id === appId ? { ...a, status } : a));
              }} />
            }
            {(currentTab === '부원' || currentTab === '참여자') && <TabMembers members={members} />}
            {currentTab === '공고' && <TabAnnouncement program={program} />}
            {currentTab === '일정' && <TabPlaceholder icon={<CalendarDays className="w-8 h-8" />} label="일정 관리" desc="일정을 추가하고 출석을 관리하세요" />}
            {currentTab === '과제' && <TabPlaceholder icon={<FileText className="w-8 h-8" />} label="과제 관리" desc="과제를 부여하고 제출 현황을 확인하세요" />}
            {currentTab === '회비' && <TabPlaceholder icon={<TrendingUp className="w-8 h-8" />} label="회비 관리" desc="회비 내역을 관리하세요" />}
            {currentTab === '미션' && <TabPlaceholder icon={<Check className="w-8 h-8" />} label="미션 관리" desc="참여자에게 미션을 부여하고 완료를 확인하세요" />}
            {currentTab === '심사' && <TabPlaceholder icon={<Trophy className="w-8 h-8" />} label="심사 관리" desc="출품작을 심사하고 점수를 입력하세요" />}
            {currentTab === '결과' && <TabPlaceholder icon={<Trophy className="w-8 h-8" />} label="결과 발표" desc="수상자를 선정하고 결과를 발표하세요" />}
            {currentTab === '통계' && <TabStats program={program} applications={applications} members={members} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── 단계 전환 확인 모달 ── */}
      <AnimatePresence>
        {phaseModal && nxt && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
              onClick={() => setPhaseModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="fixed inset-x-4 bottom-8 z-50 bg-white rounded-3xl p-6 shadow-2xl max-w-sm mx-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="font-black text-gray-900 text-sm">{nxt.label}</p>
                  <p className="text-xs text-gray-500 font-medium mt-1 leading-relaxed">{nxt.confirm}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPhaseModal(false)}
                  className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-black text-gray-500 hover:bg-gray-50 transition-colors">
                  취소
                </button>
                <button onClick={handlePhaseTransition} disabled={phaseLoading}
                  className="flex-[2] py-3 rounded-2xl bg-gray-900 text-white font-black text-sm
                             disabled:opacity-40 hover:bg-gray-800 transition-all flex items-center justify-center gap-2">
                  {phaseLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  {nxt.label}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════
   TAB: 개요
══════════════════════════════════════ */
function TabOverview({ program }: { program: OrgProgram }) {
  const tm = TYPE_META[program.type];
  return (
    <div className="space-y-4">
      {/* 소개 */}
      {program.description && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">프로그램 소개</p>
          <p className="text-sm text-gray-700 font-medium leading-relaxed whitespace-pre-wrap">{program.description}</p>
        </div>
      )}

      {/* 기간 정보 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">기간</p>
        {program.recruit_start && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-400 font-medium">모집 기간</span>
            <span className="text-gray-900 font-black">{program.recruit_start} ~ {program.recruit_end ?? '미정'}</span>
          </div>
        )}
        {program.start_date && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-400 font-medium">활동 기간</span>
            <span className="text-gray-900 font-black">{program.start_date} ~ {program.end_date ?? '미정'}</span>
          </div>
        )}
        {program.capacity && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-400 font-medium">모집 인원</span>
            <span className="text-gray-900 font-black">{program.capacity}명</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-gray-400 font-medium">공개 여부</span>
          <span className="text-gray-900 font-black flex items-center gap-1">
            {program.is_public ? <><Globe className="w-3 h-3" />공개</> : <><Lock className="w-3 h-3" />비공개</>}
          </span>
        </div>
      </div>

      {/* 단계별 안내 */}
      <PhaseGuide phase={program.phase} type={program.type} />
    </div>
  );
}

/* ── 단계별 다음 할 일 안내 ── */
function PhaseGuide({ phase, type }: { phase: ProgramPhase; type: ProgramType }) {
  const guides: Partial<Record<ProgramPhase, { title: string; items: string[] }>> = {
    DRAFT: {
      title: '지금 할 일',
      items: [
        '공고 탭에서 상세 내용을 완성하세요',
        type === 'CAMPAIGN' ? '지원서 질문을 최종 확인하세요' : '',
        '준비가 완료되면 "모집 시작" 버튼을 누르세요',
      ].filter(Boolean),
    },
    RECRUITING: {
      title: '모집 중',
      items: [
        '지원자 탭에서 신규 지원을 확인하세요',
        '모집 마감일을 확인하세요',
        '마감 후 "모집 마감" → 검토를 시작하세요',
      ],
    },
    REVIEWING: {
      title: '검토 중',
      items: [
        '지원자 탭에서 지원서를 검토하세요',
        '합격/불합격 처리를 완료하세요',
        '완료 후 "운영 시작" 버튼을 누르세요',
      ],
    },
    OPERATING: {
      title: '운영 중',
      items: [
        '일정 탭에서 활동 일정을 관리하세요',
        '참여자의 미션 완료 현황을 확인하세요',
        '활동이 완료되면 "수료 처리"를 진행하세요',
      ],
    },
    COMPLETED: {
      title: '수료 완료',
      items: ['통계 탭에서 최종 결과를 확인하세요'],
    },
  };
  const g = guides[phase];
  if (!g) return null;
  return (
    <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
      <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">{g.title}</p>
      <ul className="space-y-2">
        {g.items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-white/80 font-medium">
            <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-black text-white/60 shrink-0 mt-0.5">
              {i + 1}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ══════════════════════════════════════
   TAB: 공고
══════════════════════════════════════ */
function TabAnnouncement({ program }: { program: OrgProgram }) {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-black text-gray-700">공고 내용</p>
          <button className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 transition-colors">
            <Pencil className="w-3 h-3" />수정
          </button>
        </div>
        <div className="p-4">
          {program.description ? (
            <p className="text-sm text-gray-700 font-medium leading-relaxed whitespace-pre-wrap">{program.description}</p>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm font-black text-gray-400">공고 내용이 없습니다</p>
              <p className="text-xs text-gray-300 font-medium mt-1">수정 버튼을 눌러 내용을 추가하세요</p>
            </div>
          )}
        </div>
      </div>

      {/* 공유 링크 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">공유 링크</p>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
          <p className="flex-1 text-xs text-gray-500 font-medium truncate">
            https://clubdx.app/programs/{program.id}
          </p>
          <button
            onClick={() => navigator.clipboard.writeText(`https://clubdx.app/programs/${program.id}`)}
            className="text-xs font-black text-gray-400 hover:text-gray-700 transition-colors shrink-0"
          >
            복사
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   TAB: 지원자 / 출품작 / 참가자
══════════════════════════════════════ */
type AppStatus = Application['status'];
const STATUS_FILTERS: { val: AppStatus | 'ALL'; label: string }[] = [
  { val: 'ALL',       label: '전체' },
  { val: 'PENDING',   label: '대기' },
  { val: 'REVIEWING', label: '검토중' },
  { val: 'ACCEPTED',  label: '합격' },
  { val: 'REJECTED',  label: '불합격' },
  { val: 'WAITLISTED',label: '예비' },
];

function TabApplicants({
  applications, programType, onStatusChange,
}: {
  applications: Application[];
  programType: ProgramType;
  onStatusChange: (id: string, status: AppStatus) => void;
}) {
  const [filter,   setFilter]   = useState<AppStatus | 'ALL'>('ALL');
  const [selected, setSelected] = useState<Application | null>(null);

  const filtered = filter === 'ALL' ? applications : applications.filter(a => a.status === filter);
  const counts = Object.fromEntries(
    (['PENDING','REVIEWING','ACCEPTED','REJECTED','WAITLISTED'] as AppStatus[]).map(s => [
      s, applications.filter(a => a.status === s).length,
    ])
  );

  const handleStatus = async (appId: string, status: AppStatus) => {
    await supabase.from('org_applications').update({ status }).eq('id', appId);
    onStatusChange(appId, status);
    if (selected?.id === appId) setSelected(prev => prev ? { ...prev, status } : prev);
  };

  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Users className="w-10 h-10 text-gray-200" />
        <p className="font-black text-gray-400 text-sm">아직 지원자가 없습니다</p>
        <p className="text-xs text-gray-300 font-medium">모집이 시작되면 지원자가 표시됩니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: '전체 지원', value: applications.length, color: 'text-gray-900' },
          { label: '합격',      value: counts.ACCEPTED ?? 0, color: 'text-emerald-600' },
          { label: '검토 대기', value: counts.PENDING ?? 0,  color: 'text-orange-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <p className={`text-xl font-black ${color}`}>{value}</p>
            <p className="text-[10px] text-gray-400 font-bold mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
        {STATUS_FILTERS.map(({ val, label }) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-black transition-all
              ${filter === val ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'}`}
          >
            {label}
            {val !== 'ALL' && counts[val] > 0 && (
              <span className={`rounded-full px-1 min-w-4 text-center ${filter === val ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {counts[val]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 리스트 */}
      <div className="space-y-2">
        {filtered.map(app => (
          <motion.button key={app.id} type="button"
            onClick={() => setSelected(app)}
            whileTap={{ scale: 0.99 }}
            className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 text-left
                       hover:border-gray-300 transition-all flex items-center gap-3 group"
          >
            {/* 아바타 */}
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0 font-black text-sm text-gray-500">
              {(app.name ?? '?').slice(0, 1)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-black text-sm text-gray-900">{app.name}</span>
                <AppStatusBadge status={app.status} />
              </div>
              <p className="text-xs text-gray-400 font-medium truncate">{app.email}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] text-gray-300 font-medium">
                {new Date(app.applied_at).toLocaleDateString('ko-KR', { month:'short', day:'numeric' })}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-300 -rotate-90 group-hover:text-gray-500 transition-colors" />
            </div>
          </motion.button>
        ))}
      </div>

      {/* 지원자 상세 시트 */}
      <AnimatePresence>
        {selected && (
          <ApplicantSheet
            app={selected}
            onClose={() => setSelected(null)}
            onStatusChange={handleStatus}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── 지원자 상세 바텀시트 ── */
function ApplicantSheet({
  app, onClose, onStatusChange,
}: {
  app: Application;
  onClose: () => void;
  onStatusChange: (id: string, status: AppStatus) => void;
}) {
  const STATUS_ACTIONS: { status: AppStatus; label: string; cls: string }[] = [
    { status: 'ACCEPTED',   label: '합격',   cls: 'bg-emerald-600 text-white hover:bg-emerald-700' },
    { status: 'REJECTED',   label: '불합격', cls: 'bg-red-500 text-white hover:bg-red-600' },
    { status: 'WAITLISTED', label: '예비',   cls: 'bg-amber-500 text-white hover:bg-amber-600' },
    { status: 'REVIEWING',  label: '검토중', cls: 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50' },
  ];

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-[100]" onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        className="fixed inset-x-0 bottom-0 z-[100] bg-white rounded-t-3xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 핸들 */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 shrink-0" />

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-black text-gray-500">
              {(app.name ?? '?').slice(0, 1)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-black text-gray-900 text-sm">{app.name}</p>
                <AppStatusBadge status={app.status} />
              </div>
              <p className="text-xs text-gray-400 font-medium">
                {new Date(app.applied_at).toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric' })} 지원
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* 연락처 */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-gray-400 shrink-0" />
              <a href={`mailto:${app.email}`} className="text-blue-600 font-medium hover:underline">{app.email}</a>
            </div>
            {app.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-gray-700 font-medium">{app.phone}</span>
              </div>
            )}
          </div>

          {/* 답변 */}
          {app.answers && Object.keys(app.answers).length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">지원서 답변</p>
              {Object.entries(app.answers).map(([q, a]) => (
                <div key={q} className="bg-white border border-gray-200 rounded-xl p-3">
                  <p className="text-[11px] font-black text-gray-500 mb-1.5">{q}</p>
                  <p className="text-sm text-gray-800 font-medium leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          )}

          {/* 메모 */}
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">내부 메모</p>
            <textarea
              defaultValue={app.note ?? ''}
              placeholder="검토 메모를 입력하세요 (지원자에게 보이지 않음)"
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200
                         text-sm text-gray-700 font-medium placeholder-gray-300
                         outline-none focus:border-gray-300 resize-none"
              onBlur={async e => {
                await supabase.from('org_applications').update({ note: e.target.value }).eq('id', app.id);
              }}
            />
          </div>
        </div>

        {/* 상태 변경 버튼들 */}
        <div className="px-5 py-4 border-t border-gray-100 shrink-0">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2.5">상태 변경</p>
          <div className="grid grid-cols-2 gap-2">
            {STATUS_ACTIONS.filter(s => s.status !== app.status).map(({ status, label, cls }) => (
              <button key={status}
                onClick={() => onStatusChange(app.id, status)}
                className={`py-2.5 rounded-xl font-black text-sm transition-colors ${cls}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ══════════════════════════════════════
   TAB: 부원 / 참여자
══════════════════════════════════════ */
function TabMembers({ members }: { members: ProgramMember[] }) {
  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Users className="w-10 h-10 text-gray-200" />
        <p className="font-black text-gray-400 text-sm">등록된 멤버가 없습니다</p>
      </div>
    );
  }

  const leaders = members.filter(m => ['LEADER', 'ADMIN'].includes(m.role));
  const regulars = members.filter(m => !['LEADER', 'ADMIN'].includes(m.role));

  return (
    <div className="space-y-4">
      {leaders.length > 0 && (
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">운영진</p>
          <div className="space-y-1.5">
            {leaders.map(m => <MemberRow key={m.id} member={m} />)}
          </div>
        </div>
      )}
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
          멤버 ({regulars.length}명)
        </p>
        <div className="space-y-1.5">
          {regulars.map(m => <MemberRow key={m.id} member={m} />)}
        </div>
      </div>
    </div>
  );
}

function MemberRow({ member }: { member: ProgramMember; [key: string]: unknown }) {
  const isLeader = ['LEADER', 'ADMIN'].includes(member.role);
  return (
    <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 font-black text-sm text-gray-500">
        {(member.name ?? '?').slice(0, 1)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-black text-gray-900">{member.name ?? '이름 미설정'}</p>
          {isLeader && (
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-gray-900 text-white shrink-0">
              Leader
            </span>
          )}
        </div>
        {member.email && (
          <a href={`mailto:${member.email}`}
            className="text-xs text-gray-400 font-medium hover:text-gray-600 transition-colors flex items-center gap-1">
            <Mail className="w-3 h-3" />{member.email}
          </a>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   TAB: 통계
══════════════════════════════════════ */
function TabStats({
  program, applications, members,
}: {
  program: OrgProgram;
  applications: Application[];
  members: ProgramMember[];
}) {
  const accepted   = applications.filter(a => a.status === 'ACCEPTED').length;
  const rejected   = applications.filter(a => a.status === 'REJECTED').length;
  const acceptRate = applications.length > 0 ? Math.round((accepted / applications.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* 지원 현황 */}
      {applications.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">지원 현황</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '총 지원', value: applications.length, color: 'text-gray-900' },
              { label: '합격',    value: accepted,             color: 'text-emerald-600' },
              { label: '불합격',  value: rejected,             color: 'text-red-500' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <p className={`text-2xl font-black ${color}`}>{value}</p>
                <p className="text-[10px] text-gray-400 font-bold mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          {/* 합격률 바 */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-400 font-medium">합격률</span>
              <span className="font-black text-gray-700">{acceptRate}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-emerald-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${acceptRate}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 멤버 현황 */}
      {members.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">참여자 현황</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '총 참여자', value: members.length },
              { label: '활성',      value: members.filter(m => m.status === 'ACTIVE').length },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xl font-black text-gray-900">{value}</p>
                <p className="text-[10px] text-gray-400 font-bold mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {applications.length === 0 && members.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <TrendingUp className="w-10 h-10 text-gray-200" />
          <p className="font-black text-gray-400 text-sm">아직 통계 데이터가 없습니다</p>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════
   TAB: 플레이스홀더 (추후 구현)
══════════════════════════════════════ */
function TabPlaceholder({ icon, label, desc }: { icon: React.ReactNode; label: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-300">
        {icon}
      </div>
      <div>
        <p className="font-black text-gray-500 text-sm">{label}</p>
        <p className="text-xs text-gray-400 font-medium mt-1">{desc}</p>
      </div>
      <span className="text-[10px] font-black px-3 py-1.5 rounded-full bg-gray-100 text-gray-400">
        곧 출시 예정
      </span>
    </div>
  );
}
