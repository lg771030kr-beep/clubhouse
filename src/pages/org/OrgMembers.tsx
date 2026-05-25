import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Users, Filter, ChevronDown,
  Mail, Phone, School, Megaphone, Trophy,
  PartyPopper, X, Download, Loader2, Building2,
  ArrowUpDown, CheckCircle2, Clock, XCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { ProgramType } from './OrgDashboard';

/* ════════════════════════ 타입 ════════════════════════ */
interface OrgMember {
  id: string;
  program_id: string;
  program_name: string;
  program_type: ProgramType;
  user_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  joined_at: string;
}

type SortKey = 'name' | 'joined_at' | 'program_name';
type SortDir = 'asc' | 'desc';

/* ════════════════════════ 상수 ════════════════════════ */
const TYPE_META: Record<ProgramType, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
  CLUB:     { label: '동아리',   icon: <School      className="w-3 h-3" />, color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-100' },
  CAMPAIGN: { label: '서포터즈', icon: <Megaphone   className="w-3 h-3" />, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
  CONTEST:  { label: '공모전',   icon: <Trophy      className="w-3 h-3" />, color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-100' },
  EVENT:    { label: '이벤트',   icon: <PartyPopper className="w-3 h-3" />, color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-100' },
};

const STATUS_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  ACTIVE:    { label: '활동중', icon: <CheckCircle2 className="w-3 h-3" />, color: 'text-emerald-600' },
  INACTIVE:  { label: '비활성', icon: <Clock        className="w-3 h-3" />, color: 'text-gray-400'    },
  WITHDRAWN: { label: '탈퇴',   icon: <XCircle      className="w-3 h-3" />, color: 'text-red-400'     },
};

/* ════════════════════════ 서브 컴포넌트 ════════════════════════ */
function TypeChip({ type }: { type: ProgramType }) {
  const m = TYPE_META[type];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${m.bg} ${m.border} ${m.color}`}>
      {m.icon}{m.label}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initial = name.trim()[0]?.toUpperCase() ?? '?';
  const colors = [
    'bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700',
    'bg-amber-100 text-amber-700', 'bg-green-100 text-green-700',
    'bg-rose-100 text-rose-700', 'bg-cyan-100 text-cyan-700',
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 ${colors[idx]}`}>
      {initial}
    </div>
  );
}

/* ════════════════════════ 멤버 상세 바텀시트 ════════════════════════ */
function MemberSheet({
  member,
  onClose,
  onStatusChange,
}: {
  member: OrgMember;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const sm = STATUS_META[member.status] ?? STATUS_META['ACTIVE'];
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col justify-end"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          className="relative bg-white rounded-t-3xl px-5 pt-5 pb-10 shadow-2xl"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        >
          {/* 핸들 */}
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <Avatar name={member.name} />
              <div>
                <p className="font-black text-gray-900 text-base">{member.name}</p>
                <span className={`text-xs font-bold flex items-center gap-1 ${sm.color}`}>
                  {sm.icon}{sm.label}
                </span>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* 프로그램 */}
          <div className="bg-gray-50 rounded-2xl p-4 mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-bold">프로그램</span>
              <div className="flex items-center gap-2">
                <TypeChip type={member.program_type} />
                <span className="text-sm font-black text-gray-800">{member.program_name}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-bold">역할</span>
              <span className="text-sm font-bold text-gray-700">
                {member.role === 'LEADER' ? '운영진' : '일반 멤버'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-bold">합류일</span>
              <span className="text-sm font-bold text-gray-700">
                {new Date(member.joined_at).toLocaleDateString('ko-KR')}
              </span>
            </div>
          </div>

          {/* 연락처 */}
          <div className="space-y-2 mb-6">
            <a
              href={`mailto:${member.email}`}
              className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3 hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                <Mail className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-sm font-bold text-gray-800">{member.email}</span>
            </a>
            {member.phone && (
              <a
                href={`tel:${member.phone}`}
                className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3 hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-sm font-bold text-gray-800">{member.phone}</span>
              </a>
            )}
          </div>

          {/* 상태 변경 */}
          <div className="space-y-2">
            <p className="text-xs text-gray-400 font-black tracking-wide mb-3">상태 변경</p>
            <div className="grid grid-cols-3 gap-2">
              {(['ACTIVE', 'INACTIVE', 'WITHDRAWN'] as const).map(s => {
                const meta = STATUS_META[s];
                const isActive = member.status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { if (!isActive) onStatusChange(member.id, s); }}
                    className={`py-2.5 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1
                      ${isActive
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      }`}
                  >
                    {meta.icon}{meta.label}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ════════════════════════ 메인 ════════════════════════ */
export function OrgMembers() {
  const { profile } = useAuth();

  const [members,   setMembers]   = useState<OrgMember[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [orgId,     setOrgId]     = useState<string | null>(null);

  /* 필터 */
  const [search,    setSearch]    = useState('');
  const [typeFilter, setTypeFilter] = useState<ProgramType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showFilter, setShowFilter] = useState(false);

  /* 정렬 */
  const [sortKey, setSortKey]   = useState<SortKey>('joined_at');
  const [sortDir, setSortDir]   = useState<SortDir>('desc');

  /* 선택된 멤버 */
  const [selected, setSelected] = useState<OrgMember | null>(null);

  /* ── 데이터 로드 ── */
  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);

    const { data: orgData } = await supabase
      .from('organizations')
      .select('id')
      .eq('owner_id', profile.id)
      .single();

    if (!orgData) { setLoading(false); return; }
    setOrgId(orgData.id);

    /* 프로그램 목록 */
    const { data: programs } = await supabase
      .from('org_programs')
      .select('id, name, type')
      .eq('org_id', orgData.id);

    if (!programs?.length) { setLoading(false); return; }

    const programIds = programs.map(p => p.id);

    /* 멤버 */
    const { data: raw } = await supabase
      .from('org_program_members')
      .select('*')
      .in('program_id', programIds);

    const programMap = Object.fromEntries(programs.map(p => [p.id, p]));

    setMembers(
      ((raw ?? []) as OrgMember[]).map(m => ({
        ...m,
        program_name: programMap[m.program_id]?.name ?? '-',
        program_type: programMap[m.program_id]?.type ?? 'EVENT',
      }))
    );
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { load(); }, [load]);

  /* ── 상태 변경 ── */
  const handleStatusChange = async (id: string, status: string) => {
    await supabase.from('org_program_members').update({ status }).eq('id', id);
    setMembers(prev => prev.map(m => m.id === id ? { ...m, status } : m));
    setSelected(prev => prev && prev.id === id ? { ...prev, status } : prev);
  };

  /* ── 필터 + 정렬 ── */
  const filtered = members
    .filter(m => {
      if (typeFilter !== 'ALL' && m.program_type !== typeFilter) return false;
      if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!m.name.toLowerCase().includes(q) && !m.email.toLowerCase().includes(q) && !m.program_name.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'name') return mul * a.name.localeCompare(b.name);
      if (sortKey === 'program_name') return mul * a.program_name.localeCompare(b.program_name);
      return mul * (new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());
    });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  /* ── CSV 다운로드 ── */
  const handleExport = () => {
    const rows = [
      ['이름', '이메일', '연락처', '프로그램', '타입', '역할', '상태', '합류일'],
      ...filtered.map(m => [
        m.name, m.email, m.phone ?? '', m.program_name,
        TYPE_META[m.program_type]?.label ?? m.program_type,
        m.role === 'LEADER' ? '운영진' : '멤버',
        STATUS_META[m.status]?.label ?? m.status,
        new Date(m.joined_at).toLocaleDateString('ko-KR'),
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = 'members.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  /* ── 통계 ── */
  const activeCount   = members.filter(m => m.status === 'ACTIVE').length;
  const programCount  = new Set(members.map(m => m.program_id)).size;

  /* ── 렌더 ── */
  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-5 pt-14 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-black text-gray-900">멤버 관리</h1>
            <p className="text-xs text-gray-400 mt-0.5">전체 프로그램 통합 조회</p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold px-3 py-2 rounded-xl transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            내보내기
          </button>
        </div>

        {/* 통계 칩 */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <StatChip icon={<Users className="w-3.5 h-3.5 text-gray-500" />} label="전체" value={members.length} />
          <StatChip icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />} label="활동중" value={activeCount} />
          <StatChip icon={<Building2 className="w-3.5 h-3.5 text-blue-500" />} label="프로그램" value={programCount} />
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {/* 검색 */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름, 이메일, 프로그램 검색..."
            className="w-full bg-white border border-gray-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm font-medium placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>

        {/* 필터 토글 */}
        <button
          type="button"
          onClick={() => setShowFilter(v => !v)}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-xl"
        >
          <Filter className="w-3.5 h-3.5" />
          필터
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilter ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {showFilter && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-4">
                {/* 타입 필터 */}
                <div>
                  <p className="text-[10px] font-black text-gray-400 tracking-wide mb-2">프로그램 타입</p>
                  <div className="flex flex-wrap gap-2">
                    {(['ALL', 'CLUB', 'CAMPAIGN', 'CONTEST', 'EVENT'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTypeFilter(t)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all
                          ${typeFilter === t
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-600 border-gray-200'
                          }`}
                      >
                        {t === 'ALL' ? '전체' : TYPE_META[t].label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* 상태 필터 */}
                <div>
                  <p className="text-[10px] font-black text-gray-400 tracking-wide mb-2">멤버 상태</p>
                  <div className="flex flex-wrap gap-2">
                    {(['ALL', 'ACTIVE', 'INACTIVE', 'WITHDRAWN'] as const).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatusFilter(s)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all
                          ${statusFilter === s
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-600 border-gray-200'
                          }`}
                      >
                        {s === 'ALL' ? '전체' : STATUS_META[s].label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 정렬 + 카운트 */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400 font-bold">{filtered.length}명</p>
          <div className="flex gap-2">
            {(['name', 'joined_at', 'program_name'] as SortKey[]).map(key => {
              const labels: Record<SortKey, string> = { name: '이름', joined_at: '합류일', program_name: '프로그램' };
              const isActive = sortKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleSort(key)}
                  className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-xl border transition-all
                    ${isActive ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}
                >
                  {labels[key]}
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              );
            })}
          </div>
        </div>

        {/* 리스트 */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm font-bold text-gray-400">
              {members.length === 0 ? '아직 멤버가 없어요' : '검색 결과가 없어요'}
            </p>
          </div>
        ) : (
          <div className="space-y-2 pb-4">
            {filtered.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
              >
                <MemberCard member={m} onClick={() => setSelected(m)} />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* 멤버 상세 바텀시트 */}
      {selected && (
        <MemberSheet
          member={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}

/* ── 멤버 카드 ── */
function MemberCard({ member, onClick }: { member: OrgMember; onClick: () => void; [key: string]: unknown }) {
  const sm = STATUS_META[member.status] ?? STATUS_META['ACTIVE'];
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-3 hover:border-gray-300 transition-colors text-left"
    >
      <Avatar name={member.name} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-black text-gray-900 text-sm">{member.name}</span>
          {member.role === 'LEADER' && (
            <span className="text-[9px] font-black bg-gray-900 text-white px-1.5 py-0.5 rounded-full">운영진</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <TypeChip type={member.program_type} />
          <span className="text-xs text-gray-400 font-medium truncate max-w-[120px]">{member.program_name}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className={`text-[10px] font-bold flex items-center gap-0.5 ${sm.color}`}>
          {sm.icon}{sm.label}
        </span>
        <span className="text-[10px] text-gray-300">
          {new Date(member.joined_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
        </span>
      </div>
    </button>
  );
}

/* ── 통계 칩 ── */
function StatChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-xl px-3 py-1.5 flex-shrink-0">
      {icon}
      <span className="text-xs text-gray-400 font-bold">{label}</span>
      <span className="text-xs font-black text-gray-800">{value.toLocaleString()}</span>
    </div>
  );
}
