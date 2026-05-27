import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Plus, Users, CalendarDays, TrendingUp,
  ChevronRight, Megaphone, Trophy, PartyPopper,
  School, MoreHorizontal, Search, Bell,
  Loader2, Building2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

/* ════════════════════════ 타입 ════════════════════════ */
export type ProgramType  = 'CLUB' | 'CAMPAIGN' | 'CONTEST' | 'EVENT';
export type ProgramPhase = 'DRAFT' | 'RECRUITING' | 'REVIEWING' | 'OPERATING' | 'COMPLETED';

export interface OrgProgram {
  id: string;
  org_id: string;
  name: string;
  type: ProgramType;
  phase: ProgramPhase;
  description: string | null;
  field: string | null;
  thumbnail_url: string | null;
  start_date: string | null;
  end_date: string | null;
  recruit_start: string | null;
  recruit_end: string | null;
  capacity: number | null;
  is_public: boolean;
  created_at: string;
  /* joined */
  member_count?: number;
  applicant_count?: number;
  next_schedule?: string | null;
}

export interface Organization {
  id: string;
  name: string;
  type: 'institution' | 'enterprise';
  description: string | null;
  logo_url: string | null;
  website: string | null;
  owner_id: string;
}

/* ════════════════════════ 헬퍼 ════════════════════════ */
const PROGRAM_META: Record<ProgramType, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  CLUB:     { label: '동아리',    icon: <School      className="w-3.5 h-3.5" />, color: 'text-blue-600',   bg: 'bg-blue-50   border-blue-100' },
  CAMPAIGN: { label: '서포터즈',  icon: <Megaphone   className="w-3.5 h-3.5" />, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-100' },
  CONTEST:  { label: '공모전',    icon: <Trophy      className="w-3.5 h-3.5" />, color: 'text-amber-600',  bg: 'bg-amber-50  border-amber-100' },
  EVENT:    { label: '이벤트',    icon: <PartyPopper className="w-3.5 h-3.5" />, color: 'text-green-600',  bg: 'bg-green-50  border-green-100' },
};

const PHASE_META: Record<ProgramPhase, { label: string; dot: string; badge: string }> = {
  DRAFT:      { label: '임시저장', dot: 'bg-gray-300',   badge: 'bg-gray-100 text-gray-500 border-gray-200' },
  RECRUITING: { label: '모집중',   dot: 'bg-blue-500',   badge: 'bg-blue-50  text-blue-600  border-blue-100' },
  REVIEWING:  { label: '검토중',   dot: 'bg-orange-400', badge: 'bg-orange-50 text-orange-600 border-orange-100' },
  OPERATING:  { label: '운영중',   dot: 'bg-emerald-500',badge: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  COMPLETED:  { label: '수료',     dot: 'bg-gray-400',   badge: 'bg-gray-100 text-gray-400  border-gray-200' },
};

function PhaseBadge({ phase }: { phase: ProgramPhase }) {
  const m = PHASE_META[phase];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${m.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot} ${phase === 'RECRUITING' || phase === 'OPERATING' ? 'animate-pulse' : ''}`} />
      {m.label}
    </span>
  );
}

/* ════════════════════════ 프로그램 카드 ════════════════════════ */
function ProgramCard({ program, onClick }: { program: OrgProgram; onClick: () => void }) {
  const tm = PROGRAM_META[program.type];
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.99 }}
      className="w-full bg-white border border-gray-200 rounded-2xl p-4 text-left
                 hover:border-gray-300 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* 타입 뱃지 */}
          <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${tm.bg} ${tm.color}`}>
            {tm.icon}{tm.label}
          </span>
          {/* 상태 뱃지 */}
          <PhaseBadge phase={program.phase} />
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors shrink-0 mt-0.5" />
      </div>

      <h3 className="font-black text-gray-900 text-sm leading-snug mb-1 truncate">{program.name}</h3>
      {program.field && <p className="text-xs text-gray-400 font-medium mb-3">{program.field}</p>}

      <div className="flex items-center gap-4 text-xs text-gray-400 font-medium">
        {program.member_count !== undefined && (
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {program.member_count}명
          </span>
        )}
        {program.applicant_count !== undefined && program.applicant_count > 0 && (
          <span className="flex items-center gap-1 text-blue-500 font-black">
            <TrendingUp className="w-3 h-3" />
            지원 {program.applicant_count}명
          </span>
        )}
        {program.recruit_end && program.phase === 'RECRUITING' && (
          <span className="flex items-center gap-1 text-orange-500 font-black">
            <CalendarDays className="w-3 h-3" />
            {program.recruit_end} 마감
          </span>
        )}
      </div>
    </motion.button>
  );
}

/* ════════════════════════ 빈 상태 ════════════════════════ */
function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
        <Building2 className="w-8 h-8 text-gray-300" />
      </div>
      <div className="text-center">
        <p className="font-black text-gray-700 text-sm">등록된 프로그램이 없습니다</p>
        <p className="text-xs text-gray-400 font-medium mt-1">첫 번째 프로그램을 만들어보세요</p>
      </div>
      <button
        onClick={onNew}
        className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gray-900 text-white font-black text-sm
                   hover:bg-gray-800 transition-colors"
      >
        <Plus className="w-4 h-4" />새 프로그램 만들기
      </button>
    </div>
  );
}

/* ════════════════════════ 메인 컴포넌트 ════════════════════════ */
type FilterType = 'ALL' | ProgramType;
type FilterPhase = 'ALL' | ProgramPhase;

export function OrgDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [org,         setOrg]         = useState<Organization | null>(null);
  const [programs,    setPrograms]    = useState<OrgProgram[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [filterType,  setFilterType]  = useState<FilterType>('ALL');
  const [filterPhase, setFilterPhase] = useState<FilterPhase>('ALL');
  const [search,      setSearch]      = useState('');

  /* 로드 */
  useEffect(() => {
    if (!profile?.id) return;
    void load();
  }, [profile?.id]);

  const load = async () => {
    setLoading(true);
    try {
      /* 기관 정보 */
      const { data: orgData } = await supabase
        .from('organizations')
        .select('*')
        .eq('owner_id', profile!.id)
        .single();
      if (orgData) setOrg(orgData as Organization);

      /* 프로그램 목록 */
      if (orgData) {
        const { data: progData } = await supabase
          .from('org_programs')
          .select('*')
          .eq('org_id', orgData.id)
          .order('created_at', { ascending: false });
        setPrograms((progData ?? []) as OrgProgram[]);
      }
    } finally {
      setLoading(false);
    }
  };

  /* 통계 */
  const stats = React.useMemo(() => ({
    total:      programs.length,
    active:     programs.filter(p => p.phase === 'OPERATING' || p.phase === 'RECRUITING').length,
    recruiting: programs.filter(p => p.phase === 'RECRUITING').length,
    members:    programs.reduce((s, p) => s + (p.member_count ?? 0), 0),
  }), [programs]);

  /* 필터 */
  const filtered = React.useMemo(() => {
    return programs.filter(p => {
      const matchType  = filterType  === 'ALL' || p.type  === filterType;
      const matchPhase = filterPhase === 'ALL' || p.phase === filterPhase;
      const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
      return matchType && matchPhase && matchSearch;
    });
  }, [programs, filterType, filterPhase, search]);

  /* 로딩 */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] pb-28">
      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-5">

        {/* ── 헤더 ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* 로고 */}
            <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shrink-0">
              {org?.logo_url
                ? <img src={org.logo_url} alt="logo" className="w-full h-full rounded-xl object-cover" />
                : <Building2 className="w-5 h-5 text-white" />
              }
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">기관/기업</p>
              <h1 className="text-base font-black text-gray-900 leading-tight">
                {org?.name ?? '내 기관'}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
              <Bell className="w-4 h-4 text-gray-500" />
            </button>
            <button className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
              <MoreHorizontal className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* ── 통계 카드 ── */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: '전체',   value: stats.total,      sub: '프로그램' },
            { label: '진행중', value: stats.active,     sub: '활성',     accent: true },
            { label: '모집중', value: stats.recruiting, sub: '모집',     blue: true },
            { label: '참여자', value: stats.members,    sub: '명' },
          ].map(({ label, value, sub, accent, blue }) => (
            <div key={label}
              className={`rounded-xl border p-3 text-center
                ${accent ? 'bg-gray-900 border-transparent' : blue ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-200'}`}>
              <p className={`text-xl font-black leading-none ${accent ? 'text-white' : blue ? 'text-blue-600' : 'text-gray-900'}`}>
                {value}
              </p>
              <p className={`text-[9px] font-bold mt-1 ${accent ? 'text-white/60' : blue ? 'text-blue-400' : 'text-gray-400'}`}>
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* ── 새 프로그램 버튼 ── */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/org/programs/new')}
          className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl
                     bg-gray-900 text-white hover:bg-gray-800 transition-colors group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <span className="font-black text-sm">새 프로그램 만들기</span>
          </div>
          <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white/70 transition-colors" />
        </motion.button>

        {/* ── 검색 + 필터 ── */}
        {programs.length > 0 && (
          <div className="space-y-2.5">
            {/* 검색 */}
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5">
              <Search className="w-4 h-4 text-gray-300 shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="프로그램 검색..."
                className="flex-1 text-sm text-gray-700 font-medium placeholder-gray-300 outline-none bg-transparent"
              />
            </div>

            {/* 타입 필터 */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
              {(['ALL', 'CLUB', 'CAMPAIGN', 'CONTEST', 'EVENT'] as FilterType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black transition-all
                    ${filterType === t
                      ? 'bg-gray-900 text-white'
                      : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                >
                  {t === 'ALL' ? '전체' : (
                    <>{PROGRAM_META[t].icon}{PROGRAM_META[t].label}</>
                  )}
                </button>
              ))}
            </div>

            {/* 상태 필터 */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
              {(['ALL', 'RECRUITING', 'OPERATING', 'REVIEWING', 'COMPLETED', 'DRAFT'] as FilterPhase[]).map(p => (
                <button
                  key={p}
                  onClick={() => setFilterPhase(p)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black transition-all
                    ${filterPhase === p
                      ? 'bg-gray-800 text-white'
                      : 'bg-white border border-gray-200 text-gray-400 hover:border-gray-300'
                    }`}
                >
                  {p === 'ALL' ? '전체 상태' : PHASE_META[p].label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── 프로그램 목록 ── */}
        {programs.length === 0 ? (
          <EmptyState onNew={() => navigate('/org/programs/new')} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm font-black text-gray-400">검색 결과가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2 pb-4">
            {/* 모집중 섹션 */}
            {filtered.filter(p => p.phase === 'RECRUITING').length > 0 && (
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 mb-2">모집중</p>
                <div className="space-y-2">
                  {filtered.filter(p => p.phase === 'RECRUITING').map((p, i) => (
                    <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                      <ProgramCard program={p} onClick={() => navigate(`/org/programs/${p.id}`)} />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* 운영중 섹션 */}
            {filtered.filter(p => p.phase === 'OPERATING').length > 0 && (
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 mb-2 mt-4">운영중</p>
                <div className="space-y-2">
                  {filtered.filter(p => p.phase === 'OPERATING').map((p, i) => (
                    <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                      <ProgramCard program={p} onClick={() => navigate(`/org/programs/${p.id}`)} />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* 나머지 */}
            {filtered.filter(p => !['RECRUITING','OPERATING'].includes(p.phase)).length > 0 && (
              <div>
                {(filtered.some(p => p.phase === 'RECRUITING') || filtered.some(p => p.phase === 'OPERATING')) && (
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 mb-2 mt-4">기타</p>
                )}
                <div className="space-y-2">
                  {filtered.filter(p => !['RECRUITING','OPERATING'].includes(p.phase)).map((p, i) => (
                    <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                      <ProgramCard program={p} onClick={() => navigate(`/org/programs/${p.id}`)} />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
