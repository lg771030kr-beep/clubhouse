import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UserCheck, UserX, Clock3, HelpCircle, ChevronLeft, ChevronRight,
  CalendarDays, Users, Search, ChevronRight as ChevronRightIcon,
  RotateCcw, PenLine, Loader2, CalendarX,
} from 'lucide-react';
import { BackButton } from '../../components/common/BackButton';
import { MemberDetailModal } from '../../components/admin/MemberDetailModal';
import { supabase } from '../../lib/supabase';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/* ── 타입 ── */
type AttendStatus = '출석' | '결석' | '지각' | '미인증';

interface MemberAttendance {
  id: number;
  userId: string;
  name: string;
  studentId: string;
  status: AttendStatus;
  checkTime: string | null;
}

interface DbSchedule { id: string; title: string; }

/* ── DB ↔ UI 상태 변환 ── */
const toUiStatus = (s: string): AttendStatus =>
  s === 'PRESENT' ? '출석' : s === 'LATE' ? '지각' : '결석';

const toDbStatus = (s: AttendStatus): string =>
  s === '출석' ? 'PRESENT' : s === '지각' ? 'LATE' : 'ABSENT';

interface ChangeLog {
  memberId: number;
  name: string;
  from: AttendStatus;
  to: AttendStatus;
  at: string;
}

/* ── 유틸 ── */
const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
};

const statusStyle: Record<AttendStatus, { bg: string; icon: React.ReactNode }> = {
  출석:   { bg: 'bg-black/8 text-black border border-black/20',     icon: <UserCheck  className="w-3.5 h-3.5" /> },
  지각:   { bg: 'bg-black/8 text-black border border-black/20',     icon: <Clock3     className="w-3.5 h-3.5" /> },
  미인증: { bg: 'bg-black/5 text-black/40 border border-black/10',  icon: <HelpCircle className="w-3.5 h-3.5" /> },
  결석:   { bg: 'bg-black/8 text-black border border-black/20',     icon: <UserX      className="w-3.5 h-3.5" /> },
};

/* ═══════════════════════════════════════════════
   Component
════════════════════════════════════════════════ */
export function AttendanceDetail() {
  const todayStr = toDateStr(new Date());
  const { activeClubId } = useAuth();
  const [searchParams] = useSearchParams();
  const initDate = searchParams.get('date');

  /* ── 스케줄 날짜 목록 (전체 — 오름차순) ── */
  const [scheduleDates,  setScheduleDates]  = useState<string[]>([]);
  const [datesLoading,   setDatesLoading]   = useState(true);

  /* ── 선택된 날짜 ── */
  const [selectedDate, setSelectedDate] = useState(initDate ?? todayStr);

  /* ── DB 상태 ── */
  const [dbSchedules,  setDbSchedules]  = useState<DbSchedule[]>([]);
  const [scheduleId,   setScheduleId]   = useState<string | null>(null);
  const [dbMembers,    setDbMembers]    = useState<MemberAttendance[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [noSchedule,   setNoSchedule]   = useState(false);
  const [savingId,     setSavingId]     = useState<number | null>(null);

  /* ── UI 상태 ── */
  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState<AttendStatus | 'ALL'>('ALL');
  const [modalUserId,  setModalUserId]  = useState<string | null>(null);

  /* 관리자 수정 상태 */
  const [overrides,    setOverrides]    = useState<Record<number, AttendStatus>>({});
  const [editingId,    setEditingId]    = useState<number | null>(null);
  const [changeLogs,   setChangeLogs]   = useState<ChangeLog[]>([]);
  const [dropdownPos,  setDropdownPos]  = useState<{ top: number; right: number } | null>(null);

  /* ── ① 동아리의 모든 일정 날짜 로드 ── */
  useEffect(() => {
    if (!activeClubId) return;
    setDatesLoading(true);

    supabase
      .from('schedules')
      .select('date')
      .eq('club_id', activeClubId)
      .not('date', 'is', null)
      .order('date', { ascending: true })
      .then(({ data }) => {
        if (!data || data.length === 0) {
          setScheduleDates([]);
          setDatesLoading(false);
          return;
        }

        // 중복 제거 + 정렬
        const dates = [...new Set(data.map((s: { date: string }) => s.date))].sort();
        setScheduleDates(dates);

        // URL 파라미터로 지정된 날짜가 있으면 우선 사용
        if (initDate && dates.includes(initDate)) {
          setSelectedDate(initDate);
        } else {
          // 가장 가까운 과거 날짜 (≤ 오늘) 중 마지막 → 없으면 미래 첫 번째
          const past = dates.filter(d => d <= todayStr);
          setSelectedDate(past.length > 0 ? past[past.length - 1] : dates[0]);
        }

        setDatesLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClubId]);

  /* ── ② 선택 날짜의 출결 fetch ── */
  const fetchAttendance = useCallback(async (dateStr: string, sid?: string) => {
    setLoading(true);
    setNoSchedule(false);
    try {
      let schedQuery = supabase
        .from('schedules')
        .select('id, title')
        .eq('date', dateStr)
        .order('created_at');
      if (activeClubId) schedQuery = schedQuery.eq('club_id', activeClubId);

      const { data: scheds, error: schedErr } = await schedQuery;

      if (schedErr || !scheds || scheds.length === 0) {
        setNoSchedule(true);
        setDbSchedules([]);
        setScheduleId(null);
        setDbMembers([]);
        return;
      }

      setDbSchedules(scheds);
      const activeSid = sid ?? scheds[0].id;
      setScheduleId(activeSid);
      setNoSchedule(false);

      // 출결 기록
      const { data: attRecords } = await supabase
        .from('attendance')
        .select('user_id, status, marked_at')
        .eq('schedule_id', activeSid);
      interface AttendanceRow { user_id: string; status: string; marked_at: string | null; }
      type ProfJoin = { id: string; full_name: string | null; email: string | null };
      interface MemberRow {
        user_id: string;
        profiles: ProfJoin | ProfJoin[] | null;
      }

      const attMap = new Map(
        ((attRecords ?? []) as AttendanceRow[]).map((a) => [a.user_id, a])
      );

      // 해당 동아리 부원
      let memberQuery = supabase
        .from('club_members')
        .select('user_id, profiles(id, full_name, email)')
        .order('joined_at');
      if (activeClubId) memberQuery = memberQuery.eq('club_id', activeClubId);

      const { data: memberRows } = await memberQuery;

      const rows: MemberAttendance[] = ((memberRows ?? []) as unknown as MemberRow[]).map((m, i) => {
        const pRaw = m.profiles;
        const p    = Array.isArray(pRaw) ? pRaw[0] : pRaw;
        const rec = attMap.get(p?.id ?? '');
        return {
          id:        i + 1,
          userId:    p?.id ?? '',
          name:      p?.full_name ?? '멤버',
          studentId: p?.email ?? p?.id ?? '-',
          status:    rec ? toUiStatus(rec.status) : (dateStr < todayStr ? '결석' : '미인증'),
          checkTime: rec?.marked_at
            ? new Date(rec.marked_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
            : null,
        };
      });

      setDbMembers(rows);
    } catch (e) {
      console.error('[출결] fetch 실패:', e);
      setNoSchedule(true);
      setDbSchedules([]);
      setScheduleId(null);
      setDbMembers([]);
    } finally {
      setLoading(false);
    }
  }, [activeClubId]);

  /* 날짜 변경 시 재조회 */
  useEffect(() => {
    if (datesLoading) return;
    setOverrides({});
    setEditingId(null);
    setChangeLogs([]);
    fetchAttendance(selectedDate);
  }, [selectedDate, datesLoading, fetchAttendance]);

  /* ── 좌우 네비게이션: 스케줄 있는 날짜만 이동 ── */
  const currentIdx = scheduleDates.indexOf(selectedDate);
  const canGoPrev  = scheduleDates.length > 0 && currentIdx > 0;
  const canGoNext  = scheduleDates.length > 0 && currentIdx < scheduleDates.length - 1;

  const shiftDate = (delta: number) => {
    if (scheduleDates.length === 0) return;
    if (currentIdx === -1) {
      // 현재 날짜가 목록에 없으면 가장 가까운 위치로
      const fallback = delta < 0 ? scheduleDates[scheduleDates.length - 1] : scheduleDates[0];
      setSelectedDate(fallback);
      return;
    }
    const next = currentIdx + delta;
    if (next >= 0 && next < scheduleDates.length) setSelectedDate(scheduleDates[next]);
  };

  const handleDateChange = (val: string) => {
    if (!val) return;
    setSelectedDate(val);
  };

  const rawData = dbMembers;
  const getStatus = (m: MemberAttendance): AttendStatus => overrides[m.id] ?? m.status;
  const allMembers = rawData.map(m => ({ ...m, status: getStatus(m) }));

  const filtered = allMembers.filter(m => {
    const matchName   = m.name.includes(search) || m.studentId.includes(search);
    const matchStatus = filterStatus === 'ALL' || m.status === filterStatus;
    return matchName && matchStatus;
  });

  const counts = {
    출석:   allMembers.filter(m => m.status === '출석').length,
    지각:   allMembers.filter(m => m.status === '지각').length,
    미인증: allMembers.filter(m => m.status === '미인증').length,
    결석:   allMembers.filter(m => m.status === '결석').length,
  };

  /* 관리자 출결 수정 */
  const handleOverride = async (m: MemberAttendance, newStatus: AttendStatus) => {
    const current = getStatus(m);
    if (current === newStatus) { setEditingId(null); return; }

    setOverrides(prev => ({ ...prev, [m.id]: newStatus }));
    setChangeLogs(prev => [
      { memberId: m.id, name: m.name, from: current, to: newStatus, at: nowTime() },
      ...prev,
    ]);
    setEditingId(null);
    setDropdownPos(null);

    if (!noSchedule && scheduleId && m.userId) {
      setSavingId(m.id);
      try {
        await supabase.from('attendance').upsert({
          schedule_id: scheduleId,
          user_id:     m.userId,
          status:      toDbStatus(newStatus),
          marked_at:   new Date().toISOString(),
        }, { onConflict: 'schedule_id,user_id' });
      } catch { /* silent */ } finally {
        setSavingId(null);
      }
    }
  };

  /* 수정 초기화 */
  const resetOverride = async (memberId: number, originalStatus: AttendStatus) => {
    if (!overrides[memberId]) return;
    const current = overrides[memberId];
    const member  = rawData.find(m => m.id === memberId);
    setOverrides(prev => { const next = { ...prev }; delete next[memberId]; return next; });
    setChangeLogs(prev => [
      { memberId, name: member?.name ?? '', from: current, to: originalStatus, at: nowTime() },
      ...prev,
    ]);

    if (!noSchedule && scheduleId && member?.userId) {
      if (originalStatus === '결석') {
        await supabase.from('attendance')
          .delete()
          .eq('schedule_id', scheduleId)
          .eq('user_id', member.userId);
      } else {
        await supabase.from('attendance').upsert({
          schedule_id: scheduleId,
          user_id:     member.userId,
          status:      toDbStatus(originalStatus),
          marked_at:   new Date().toISOString(),
        }, { onConflict: 'schedule_id,user_id' });
      }
    }
  };

  const [yyyy, mm, dd] = selectedDate.split('-');
  const dateLabel = `${yyyy}년 ${Number(mm)}월 ${Number(dd)}일`;

  /* 전체 로딩 (날짜 목록 로드 중) */
  if (datesLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-black/40">
          <Loader2 className="w-7 h-7 animate-spin" />
          <p className="text-sm font-black">일정을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  /* 일정이 하나도 없는 경우 */
  if (scheduleDates.length === 0) {
    return (
      <div className="min-h-screen bg-white pb-24">
        <div className="bg-white text-black pt-16 pb-16 px-6 shadow-sm" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          <div className="max-w-5xl mx-auto">
            <BackButton to="/admin" className="mb-4" />
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
              <CalendarDays className="w-8 h-8 opacity-90" />
              출결 확인
            </h1>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-10">
          <div className="bg-white rounded-3xl border border-black/20 py-24 flex flex-col items-center gap-3 text-center">
            <CalendarX className="w-10 h-10 text-black/20" />
            <p className="text-base font-black text-black/40">출결 내용이 없습니다</p>
            <p className="text-xs text-black/30 font-medium">
              일정 관리에서 일정을 추가하면 출결을 기록할 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">

      {/* ══ 상단 헤더 배너 ══ */}
      <div className="bg-white text-black pt-16 pb-16 px-6 shadow-sm" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <div className="relative z-10 max-w-5xl mx-auto">
          <BackButton to="/admin" className="mb-4" />
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                <CalendarDays className="w-8 h-8 opacity-90" />
                출결 확인
              </h1>
              <p className="mt-1.5 text-black/70 text-sm font-medium">
                날짜별 부원 출석·지각·결석 현황을 확인하세요.
              </p>
            </div>

            <div className="grid grid-cols-4 divide-x divide-black/20 bg-black/5 border border-black/20 rounded-2xl px-0 py-4 shrink-0">
              <div className="text-center px-3">
                <p className="text-2xl font-black text-black">{counts['출석']}</p>
                <p className="text-[10px] text-black/70 font-black uppercase tracking-wider">출석</p>
              </div>
              <div className="text-center px-3">
                <p className="text-2xl font-black text-black">{counts['지각']}</p>
                <p className="text-[10px] text-black/70 font-black uppercase tracking-wider">지각</p>
              </div>
              <div className="text-center px-3">
                <p className="text-2xl font-black text-black">{counts['미인증']}</p>
                <p className="text-[10px] text-black/70 font-black uppercase tracking-wider">미인증</p>
              </div>
              <div className="text-center px-3">
                <p className="text-2xl font-black text-black">{counts['결석']}</p>
                <p className="text-[10px] text-black/70 font-black uppercase tracking-wider">결석</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ 콘텐츠 영역 ══ */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-8 relative z-20 space-y-5">

        {/* ── 날짜 네비게이션 바 ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="bg-white rounded-3xl border border-black/20 px-4 py-3 flex items-center gap-3"
        >
          {/* 이전 일정 */}
          <button
            onClick={() => shiftDate(-1)}
            disabled={!canGoPrev}
            className="p-2.5 rounded-2xl hover:bg-black/5 text-black/70 hover:text-black transition-colors disabled:opacity-20 disabled:cursor-not-allowed shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* 날짜 입력 */}
          <div className="flex-1 relative">
            <input
              type="date"
              value={selectedDate}
              onChange={e => handleDateChange(e.target.value)}
              className="w-full text-center text-base font-black text-black bg-white border border-black/20 rounded-2xl px-4 py-2.5 outline-none focus:border-black focus:ring-2 focus:ring-black/20 transition-all cursor-pointer"
            />
          </div>

          {/* 날짜 레이블 + 일정 인덱스 */}
          <div className="text-right shrink-0 hidden sm:block">
            <p className="text-sm font-black text-black/70 leading-tight">{dateLabel}</p>
            <p className="text-[10px] text-black/30 font-bold mt-0.5">
              {currentIdx >= 0 ? `${currentIdx + 1} / ${scheduleDates.length}번째 일정` : ''}
            </p>
          </div>

          {/* 다음 일정 */}
          <button
            onClick={() => shiftDate(1)}
            disabled={!canGoNext}
            className="p-2.5 rounded-2xl hover:bg-black/5 text-black/70 hover:text-black transition-colors disabled:opacity-20 disabled:cursor-not-allowed shrink-0"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </motion.div>

        {/* ── 일정 없음 (선택 날짜에 스케줄 없음) ── */}
        {!loading && noSchedule && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white rounded-3xl border border-black/20 py-20 flex flex-col items-center gap-3 text-center"
          >
            <CalendarX className="w-10 h-10 text-black/20" />
            <p className="text-base font-black text-black/40">출결 내용이 없습니다</p>
            <p className="text-xs text-black/30 font-medium">
              좌우 버튼으로 일정이 있는 날짜로 이동하세요
            </p>
          </motion.div>
        )}

        {/* ── 스케줄이 여러 개일 때 선택 탭 ── */}
        {!loading && !noSchedule && dbSchedules.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {dbSchedules.map(s => (
              <button
                key={s.id}
                onClick={() => {
                  setOverrides({});
                  setEditingId(null);
                  setChangeLogs([]);
                  fetchAttendance(selectedDate, s.id);
                }}
                className={`px-4 py-2 rounded-full text-xs font-black border transition-all
                  ${scheduleId === s.id
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-black/70 border-black/20 hover:border-black/40'}`}
              >
                {s.title}
              </button>
            ))}
          </div>
        )}

        {/* ── 로딩 스켈레톤 ── */}
        {loading && (
          <div className="bg-white rounded-3xl border border-black/20 py-20 flex flex-col items-center gap-3 text-black/40">
            <Loader2 className="w-7 h-7 animate-spin" />
            <p className="text-sm font-black">출결 데이터 불러오는 중...</p>
          </div>
        )}

        {/* ── 통계 카드 + 리스트 ── */}
        {!loading && !noSchedule && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-3"
            >
              {(['출석', '지각', '미인증', '결석'] as AttendStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(prev => prev === s ? 'ALL' : s)}
                  className={`rounded-3xl p-4 sm:p-5 text-left transition-all border-2 shadow-sm
                    hover:shadow-md active:scale-[0.98]
                    ${filterStatus === s
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-black border-black/20 hover:border-black/40'}`}
                >
                  <p className="text-2xl sm:text-3xl font-black">
                    {counts[s]}<span className="text-sm font-black ml-1 opacity-70">명</span>
                  </p>
                  <p className="text-xs font-black mt-1 flex items-center gap-1.5">
                    {statusStyle[s].icon} {s}
                  </p>
                </button>
              ))}
            </motion.div>

            {/* ── 검색 + 리스트 카드 ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="bg-white rounded-3xl border border-black/20"
            >
              {/* 검색 바 */}
              <div className="px-5 pt-5 pb-4 border-b border-black/20 rounded-t-3xl overflow-hidden">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/50" />
                    <input
                      type="text"
                      placeholder="이름 또는 학번 검색..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-white border border-black/20 rounded-2xl text-black placeholder:text-black/50 outline-none focus:border-black focus:ring-2 focus:ring-black/20 text-sm transition-all"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-black font-black shrink-0">
                    <Users className="w-4 h-4" />
                    <span className="text-sm">{filterStatus === 'ALL' ? '전체' : filterStatus}</span>
                    <span className="text-xs bg-black/8 text-black font-black px-2.5 py-0.5 rounded-full border border-black/20">
                      {filtered.length}명
                    </span>
                  </div>
                </div>
              </div>

              {/* 팝오버 열릴 때 외부 클릭 닫기용 오버레이 */}
              {editingId !== null && (
                <div className="fixed inset-0 z-40" onClick={() => { setEditingId(null); setDropdownPos(null); }} />
              )}

              <AnimatePresence mode="popLayout">
                {filtered.length === 0 ? (
                  <div className="py-20 text-center text-black/50 rounded-b-3xl overflow-hidden">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-black">해당하는 부원이 없습니다</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-black/20">
                    {filtered.map((m, i) => {
                      const origMember   = rawData.find(r => r.id === m.id)!;
                      const isOverridden = !!overrides[m.id];
                      const s            = statusStyle[m.status];
                      return (
                        <motion.li
                          key={m.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03, duration: 0.25 }}
                          className={`flex items-center justify-between px-6 py-4 transition-colors
                            ${i === filtered.length - 1 ? 'rounded-b-3xl' : ''}
                            ${isOverridden ? 'bg-black/[0.03]' : 'hover:bg-black/5'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white text-sm font-black shrink-0 shadow-sm">
                              {m.name[0]}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => setModalUserId(m.userId || null)}
                                  className="group flex items-center gap-0.5 font-black text-black text-sm
                                             hover:bg-black/5 px-1.5 py-0.5 rounded-lg transition-all -mx-1.5 active:scale-95"
                                >
                                  {m.name}
                                  <ChevronRightIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
                                </button>
                              </div>
                              <p className="text-xs text-black/50 mt-0.5">{m.studentId}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-black/60 flex items-center gap-1.5 hidden sm:flex">
                              {m.checkTime && (
                                <><Clock3 className="w-3.5 h-3.5" /> {m.checkTime}</>
                              )}
                              {isOverridden && (
                                <span className="text-black/50">
                                  {m.checkTime ? ', ' : ''}관리자가 수정함
                                </span>
                              )}
                            </span>

                            {/* 상태 배지 + 드롭다운 */}
                            <div>
                              <button
                                onClick={(e) => {
                                  if (editingId === m.id) {
                                    setEditingId(null);
                                    setDropdownPos(null);
                                  } else {
                                    const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                    setDropdownPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
                                    setEditingId(m.id);
                                  }
                                }}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black shadow-sm transition-all
                                  hover:opacity-75 active:scale-95 ${s.bg}`}
                              >
                                {savingId === m.id
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : s.icon}
                                {m.status}
                                {savingId !== m.id && <PenLine className="w-2.5 h-2.5 opacity-40" />}
                              </button>

                              <AnimatePresence>
                                {editingId === m.id && dropdownPos && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.92, y: -4 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.92, y: -4 }}
                                    transition={{ duration: 0.15 }}
                                    style={{ position: 'fixed', top: dropdownPos.top, right: dropdownPos.right }}
                                    className="bg-white border border-black/20 rounded-2xl shadow-xl p-1.5 flex flex-col gap-0.5 min-w-[100px] z-50"
                                  >
                                    {(['출석', '지각', '결석'] as Exclude<AttendStatus, '미인증'>[]).map(opt => (
                                      <button
                                        key={opt}
                                        onClick={() => handleOverride(origMember, opt)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black transition-colors
                                          ${m.status === opt
                                            ? 'bg-black text-white'
                                            : 'hover:bg-black/8 text-black'}`}
                                      >
                                        {statusStyle[opt].icon} {opt}
                                      </button>
                                    ))}
                                    {isOverridden && (
                                      <>
                                        <div className="h-px bg-black/10 my-0.5" />
                                        <button
                                          onClick={() => { resetOverride(m.id, origMember.status); setEditingId(null); }}
                                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black text-black/50 hover:bg-black/8 transition-colors"
                                        >
                                          <RotateCcw className="w-3 h-3" /> 원래대로
                                        </button>
                                      </>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </motion.li>
                      );
                    })}
                  </ul>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </div>

      {/* 부원 상세 모달 */}
      <MemberDetailModal userId={modalUserId} onClose={() => setModalUserId(null)} />
    </div>
  );
}
