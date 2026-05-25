import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  TrendingUp, Users, FileCheck, Percent,
  School, Megaphone, Trophy, PartyPopper,
  Loader2, BarChart3, PieChart, Calendar,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { ProgramType, ProgramPhase } from './OrgDashboard';

/* ════════════════════════ 타입 ════════════════════════ */
interface ProgramStat {
  id: string;
  name: string;
  type: ProgramType;
  phase: ProgramPhase;
  memberCount: number;
  applicantCount: number;
  acceptedCount: number;
}

/* ════════════════════════ 상수 ════════════════════════ */
const TYPE_META: Record<ProgramType, { label: string; icon: React.ReactNode; color: string; bar: string }> = {
  CLUB:     { label: '동아리',   icon: <School      className="w-4 h-4" />, color: 'text-blue-600',   bar: 'bg-blue-500'   },
  CAMPAIGN: { label: '서포터즈', icon: <Megaphone   className="w-4 h-4" />, color: 'text-purple-600', bar: 'bg-purple-500' },
  CONTEST:  { label: '공모전',   icon: <Trophy      className="w-4 h-4" />, color: 'text-amber-600',  bar: 'bg-amber-500'  },
  EVENT:    { label: '이벤트',   icon: <PartyPopper className="w-4 h-4" />, color: 'text-green-600',  bar: 'bg-green-500'  },
};

/* ════════════════════════ 서브 컴포넌트 ════════════════════════ */
function KpiCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        {icon}
      </div>
      <p className="text-2xl font-black text-gray-900 mb-0.5">{value}</p>
      <p className="text-xs font-bold text-gray-500">{label}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="text-gray-500">{icon}</div>
      <h2 className="text-sm font-black text-gray-800">{title}</h2>
    </div>
  );
}

/* ════════════════════════ 메인 ════════════════════════ */
export function OrgAnalytics() {
  const { profile } = useAuth();

  const [stats,   setStats]   = useState<ProgramStat[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);

    const { data: orgData } = await supabase
      .from('organizations')
      .select('id')
      .eq('owner_id', profile.id)
      .single();

    if (!orgData) { setLoading(false); return; }

    const { data: programs } = await supabase
      .from('org_programs')
      .select('id, name, type, phase')
      .eq('org_id', orgData.id);

    if (!programs?.length) { setLoading(false); return; }

    const ids = programs.map(p => p.id);

    const [{ data: members }, { data: applications }] = await Promise.all([
      supabase.from('org_program_members').select('program_id, status').in('program_id', ids),
      supabase.from('org_applications').select('program_id, status').in('program_id', ids),
    ]);

    setStats(
      programs.map(p => {
        const pm = (members ?? []).filter(m => m.program_id === p.id);
        const pa = (applications ?? []).filter(a => a.program_id === p.id);
        return {
          id:            p.id,
          name:          p.name,
          type:          p.type as ProgramType,
          phase:         p.phase as ProgramPhase,
          memberCount:   pm.filter(m => m.status === 'ACTIVE').length,
          applicantCount: pa.length,
          acceptedCount: pa.filter(a => a.status === 'ACCEPTED').length,
        };
      })
    );
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { load(); }, [load]);

  /* ── KPI ── */
  const totalMembers    = stats.reduce((s, p) => s + p.memberCount,    0);
  const totalApplicants = stats.reduce((s, p) => s + p.applicantCount, 0);
  const totalAccepted   = stats.reduce((s, p) => s + p.acceptedCount,  0);
  const acceptRate      = totalApplicants > 0 ? Math.round(totalAccepted / totalApplicants * 100) : 0;
  const activePrograms  = stats.filter(p => ['RECRUITING', 'OPERATING'].includes(p.phase)).length;

  /* ── 타입별 집계 ── */
  const byType = (['CLUB', 'CAMPAIGN', 'CONTEST', 'EVENT'] as ProgramType[]).map(t => {
    const group = stats.filter(p => p.type === t);
    return {
      type:     t,
      programs: group.length,
      members:  group.reduce((s, p) => s + p.memberCount, 0),
    };
  }).filter(g => g.programs > 0);

  const maxMembers = Math.max(...byType.map(g => g.members), 1);

  /* ── 프로그램별 멤버 TOP ── */
  const topPrograms = [...stats].sort((a, b) => b.memberCount - a.memberCount).slice(0, 5);
  const maxProgramMembers = Math.max(...topPrograms.map(p => p.memberCount), 1);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-5 pt-14 pb-5">
        <h1 className="text-xl font-black text-gray-900">통계</h1>
        <p className="text-xs text-gray-400 mt-0.5">전체 프로그램 현황 요약</p>
      </div>

      <div className="px-4 py-5 space-y-6">
        {/* KPI 카드 */}
        <div className="grid grid-cols-2 gap-3">
          <KpiCard
            icon={<TrendingUp className="w-4.5 h-4.5 text-blue-600" />}
            label="운영 중 프로그램"
            value={activePrograms}
            sub={`전체 ${stats.length}개`}
            color="bg-blue-50"
          />
          <KpiCard
            icon={<Users className="w-4.5 h-4.5 text-emerald-600" />}
            label="총 활동 멤버"
            value={totalMembers.toLocaleString()}
            sub="활동중 기준"
            color="bg-emerald-50"
          />
          <KpiCard
            icon={<FileCheck className="w-4.5 h-4.5 text-purple-600" />}
            label="누적 지원자"
            value={totalApplicants.toLocaleString()}
            color="bg-purple-50"
          />
          <KpiCard
            icon={<Percent className="w-4.5 h-4.5 text-amber-600" />}
            label="평균 합격률"
            value={`${acceptRate}%`}
            sub={`${totalAccepted}명 합격`}
            color="bg-amber-50"
          />
        </div>

        {/* 타입별 분포 */}
        {byType.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <SectionTitle icon={<PieChart className="w-4 h-4" />} title="프로그램 타입별 멤버" />
            <div className="space-y-3">
              {byType.map((g, i) => {
                const tm = TYPE_META[g.type];
                const pct = Math.round(g.members / Math.max(maxMembers, 1) * 100);
                return (
                  <div key={g.type}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className={`flex items-center gap-1.5 text-xs font-bold ${tm.color}`}>
                        {tm.icon}{tm.label}
                        <span className="text-gray-400 font-medium">({g.programs}개)</span>
                      </div>
                      <span className="text-xs font-black text-gray-800">{g.members}명</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${tm.bar}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.7, delay: i * 0.1, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 프로그램별 멤버 TOP5 */}
        {topPrograms.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <SectionTitle icon={<BarChart3 className="w-4 h-4" />} title="프로그램별 멤버 현황" />
            <div className="space-y-3">
              {topPrograms.map((p, i) => {
                const tm = TYPE_META[p.type];
                const pct = Math.round(p.memberCount / maxProgramMembers * 100);
                return (
                  <div key={p.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-black text-gray-400 w-4 flex-shrink-0">#{i + 1}</span>
                        <span className={`flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded-full ${tm.color}`}>
                          {tm.icon}
                        </span>
                        <span className="text-xs font-bold text-gray-700 truncate">{p.name}</span>
                      </div>
                      <span className="text-xs font-black text-gray-800 flex-shrink-0 ml-2">{p.memberCount}명</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${tm.bar}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 지원·합격 현황 */}
        {totalApplicants > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <SectionTitle icon={<Calendar className="w-4 h-4" />} title="지원 · 합격 현황" />
            <div className="space-y-3">
              {stats.filter(p => p.applicantCount > 0).sort((a, b) => b.applicantCount - a.applicantCount).map(p => {
                const rate = p.applicantCount > 0 ? Math.round(p.acceptedCount / p.applicantCount * 100) : 0;
                const tm = TYPE_META[p.type];
                return (
                  <div key={p.id} className="flex items-center gap-3">
                    <div className={`flex-shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded-full ${tm.color}`}>
                      {tm.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-700 truncate mb-1">{p.name}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-gray-700"
                            initial={{ width: 0 }}
                            animate={{ width: `${rate}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                          />
                        </div>
                        <span className="text-[10px] font-black text-gray-500 flex-shrink-0">
                          {p.acceptedCount}/{p.applicantCount} ({rate}%)
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 데이터 없음 */}
        {stats.length === 0 && (
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm font-bold text-gray-400">프로그램을 생성하면 통계가 표시돼요</p>
          </div>
        )}
      </div>
    </div>
  );
}
