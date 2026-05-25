import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Plus, ChevronRight, Bell, Building2,
  Loader2, AlertCircle, TrendingUp, Users,
  School, Megaphone, Trophy, PartyPopper,
  FolderKanban, BarChart3,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { OrgProgram, Organization, ProgramType, ProgramPhase } from './OrgDashboard';

/* ════════════════════════ 상수 ════════════════════════ */
const TYPE_META: Record<ProgramType, { label: string; icon: React.ReactNode; color: string; bg: string; bar: string }> = {
  CLUB:     { label: '동아리',   icon: <School      className="w-3.5 h-3.5" />, color: 'text-blue-600',   bg: 'bg-blue-50',   bar: 'bg-blue-500'   },
  CAMPAIGN: { label: '서포터즈', icon: <Megaphone   className="w-3.5 h-3.5" />, color: 'text-purple-600', bg: 'bg-purple-50', bar: 'bg-purple-500' },
  CONTEST:  { label: '공모전',   icon: <Trophy      className="w-3.5 h-3.5" />, color: 'text-amber-600',  bg: 'bg-amber-50',  bar: 'bg-amber-500'  },
  EVENT:    { label: '이벤트',   icon: <PartyPopper className="w-3.5 h-3.5" />, color: 'text-green-600',  bg: 'bg-green-50',  bar: 'bg-green-500'  },
};

const PHASE_META: Record<ProgramPhase, { label: string; dot: string }> = {
  DRAFT:      { label: '임시저장', dot: 'bg-gray-300'    },
  RECRUITING: { label: '모집중',   dot: 'bg-blue-500'    },
  REVIEWING:  { label: '검토중',   dot: 'bg-orange-400'  },
  OPERATING:  { label: '운영중',   dot: 'bg-emerald-500' },
  COMPLETED:  { label: '수료',     dot: 'bg-gray-400'    },
};

/* ── 마감까지 남은 일 ── */
function daysLeft(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/* ── 날짜 짧게 ── */
function shortDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

/* ════════════════════════ 메인 ════════════════════════ */
export function OrgHome() {
  const { profile } = useAuth();
  const navigate    = useNavigate();

  const [org,      setOrg]      = useState<Organization | null>(null);
  const [programs, setPrograms] = useState<OrgProgram[]>([]);
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);

    const { data: orgData } = await supabase
      .from('organizations')
      .select('*')
      .eq('owner_id', profile.id)
      .single();

    if (orgData) {
      setOrg(orgData as Organization);
      const { data: progData } = await supabase
        .from('org_programs')
        .select('*')
        .eq('org_id', orgData.id)
        .order('created_at', { ascending: false });
      setPrograms((progData ?? []) as OrgProgram[]);
    }
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { load(); }, [load]);

  /* ── 파생 데이터 ── */
  const active     = programs.filter(p => ['OPERATING', 'RECRUITING'].includes(p.phase));
  const recruiting = programs.filter(p => p.phase === 'RECRUITING');
  const totalMembers = programs.reduce((s, p) => s + (p.member_count ?? 0), 0);

  /* 마감 임박 (7일 이내 모집 마감) */
  const urgentPrograms = recruiting
    .map(p => ({ ...p, days: daysLeft(p.recruit_end) }))
    .filter(p => p.days !== null && p.days >= 0 && p.days <= 7)
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0));

  /* 최근 활성 프로그램 최대 3개 */
  const recentActive = active.slice(0, 3);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] pb-28">
      <div className="max-w-2xl mx-auto px-4 pt-14 space-y-5">

        {/* ── 헤더 ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gray-900 flex items-center justify-center shrink-0 overflow-hidden">
              {org?.logo_url
                ? <img src={org.logo_url} alt="logo" className="w-full h-full object-cover" />
                : <Building2 className="w-5 h-5 text-white" />
              }
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                {org?.type === 'enterprise' ? '기업' : '기관'}
              </p>
              <h1 className="text-lg font-black text-gray-900 leading-tight">
                {org?.name ?? '내 기관'}
              </h1>
            </div>
          </div>
          <button className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
            <Bell className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* ── KPI 카드 4개 ── */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: '전체',   value: programs.length, accent: false, blue: false },
            { label: '진행중', value: active.length,    accent: true,  blue: false },
            { label: '모집중', value: recruiting.length,accent: false, blue: true  },
            { label: '참여자', value: totalMembers,     accent: false, blue: false },
          ].map(({ label, value, accent, blue }) => (
            <div
              key={label}
              className={`rounded-xl border p-3 text-center
                ${accent ? 'bg-gray-900 border-transparent' : blue ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-200'}`}
            >
              <p className={`text-xl font-black leading-none
                ${accent ? 'text-white' : blue ? 'text-blue-600' : 'text-gray-900'}`}>
                {value}
              </p>
              <p className={`text-[9px] font-bold mt-1
                ${accent ? 'text-white/60' : blue ? 'text-blue-400' : 'text-gray-400'}`}>
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* ── 새 프로그램 CTA ── */}
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

        {/* ── 마감 임박 알림 ── */}
        {urgentPrograms.length > 0 && (
          <div className="space-y-2">
            <SectionHeader
              icon={<AlertCircle className="w-3.5 h-3.5 text-orange-500" />}
              title="모집 마감 임박"
              accent="text-orange-500"
            />
            {urgentPrograms.map(p => (
              <motion.button
                key={p.id}
                type="button"
                onClick={() => navigate(`/org/programs/${p.id}`)}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center gap-3 bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3 text-left hover:border-orange-200 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <span className={`${TYPE_META[p.type].color}`}>{TYPE_META[p.type].icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-gray-900 truncate">{p.name}</p>
                  <p className="text-xs text-gray-400 font-medium">모집 마감 {shortDate(p.recruit_end)}</p>
                </div>
                <div className={`flex-shrink-0 text-right`}>
                  <p className="text-sm font-black text-orange-600">{p.days}일</p>
                  <p className="text-[9px] text-orange-400 font-bold">남음</p>
                </div>
              </motion.button>
            ))}
          </div>
        )}

        {/* ── 진행 중 프로그램 ── */}
        {programs.length === 0 ? (
          <EmptyState onNew={() => navigate('/org/programs/new')} />
        ) : recentActive.length > 0 ? (
          <div className="space-y-2">
            <SectionHeader
              icon={<TrendingUp className="w-3.5 h-3.5 text-gray-500" />}
              title="진행 중 프로그램"
              rightAction={{ label: `전체 ${programs.length}개 보기`, onClick: () => navigate('/org/programs') }}
            />
            {recentActive.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <ActiveProgramCard program={p} onClick={() => navigate(`/org/programs/${p.id}`)} />
              </motion.div>
            ))}
            {active.length > 3 && (
              <button
                type="button"
                onClick={() => navigate('/org/programs')}
                className="w-full py-3 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
              >
                +{active.length - 3}개 더 보기
              </button>
            )}
          </div>
        ) : (
          /* 프로그램은 있지만 진행 중인 게 없을 때 */
          <div className="space-y-2">
            <SectionHeader
              icon={<FolderKanban className="w-3.5 h-3.5 text-gray-500" />}
              title="프로그램"
              rightAction={{ label: `전체 보기`, onClick: () => navigate('/org/programs') }}
            />
            {programs.slice(0, 3).map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <ActiveProgramCard program={p} onClick={() => navigate(`/org/programs/${p.id}`)} />
              </motion.div>
            ))}
          </div>
        )}

        {/* ── 빠른 이동 ── */}
        <div className="grid grid-cols-2 gap-2 pb-4">
          <QuickLink
            icon={<Users className="w-5 h-5 text-blue-600" />}
            label="멤버 관리"
            bg="bg-blue-50"
            onClick={() => navigate('/org/members')}
          />
          <QuickLink
            icon={<BarChart3 className="w-5 h-5 text-purple-600" />}
            label="통계"
            bg="bg-purple-50"
            onClick={() => navigate('/org/analytics')}
          />
        </div>

      </div>
    </div>
  );
}

/* ── 섹션 헤더 ── */
function SectionHeader({
  icon, title, accent, rightAction,
}: {
  icon: React.ReactNode;
  title: string;
  accent?: string;
  rightAction?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex items-center justify-between px-0.5">
      <div className={`flex items-center gap-1.5 ${accent ?? 'text-gray-500'}`}>
        {icon}
        <span className="text-xs font-black text-gray-700">{title}</span>
      </div>
      {rightAction && (
        <button
          type="button"
          onClick={rightAction.onClick}
          className="text-[10px] font-bold text-gray-400 hover:text-gray-600 flex items-center gap-0.5"
        >
          {rightAction.label} <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

/* ── 활성 프로그램 카드 ── */
function ActiveProgramCard({ program, onClick }: { program: OrgProgram; onClick: () => void; [key: string]: unknown }) {
  const tm = TYPE_META[program.type];
  const pm = PHASE_META[program.phase];
  const isPulse = program.phase === 'RECRUITING' || program.phase === 'OPERATING';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3.5 flex items-center gap-3 hover:border-gray-300 transition-colors text-left"
    >
      {/* 타입 아이콘 */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${tm.bg}`}>
        <span className={tm.color}>{tm.icon}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-black text-gray-900 truncate">{program.name}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-gray-400 font-medium">
          <span className={`inline-flex items-center gap-1 font-black`}>
            <span className={`w-1.5 h-1.5 rounded-full ${pm.dot} ${isPulse ? 'animate-pulse' : ''}`} />
            {pm.label}
          </span>
          {program.recruit_end && (
            <>
              <span className="text-gray-200">·</span>
              <span>마감 {shortDate(program.recruit_end)}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {program.member_count != null && program.member_count > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold">
            <Users className="w-3 h-3" />
            {program.member_count}
          </div>
        )}
        <ChevronRight className="w-4 h-4 text-gray-300" />
      </div>
    </button>
  );
}

/* ── 빠른 이동 카드 ── */
function QuickLink({ icon, label, bg, onClick }: {
  icon: React.ReactNode; label: string; bg: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${bg} rounded-2xl px-4 py-4 flex items-center gap-3 hover:brightness-95 transition-all`}
    >
      {icon}
      <span className="text-sm font-black text-gray-800">{label}</span>
      <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
    </button>
  );
}

/* ── 빈 상태 ── */
function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center py-12 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
        <FolderKanban className="w-7 h-7 text-gray-400" />
      </div>
      <div className="text-center">
        <p className="font-black text-gray-700 mb-1">프로그램이 없어요</p>
        <p className="text-sm text-gray-400">동아리, 공모전, 서포터즈를 만들어 보세요</p>
      </div>
      <button
        type="button"
        onClick={onNew}
        className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-black"
      >
        <Plus className="w-4 h-4" />
        첫 프로그램 만들기
      </button>
    </div>
  );
}
