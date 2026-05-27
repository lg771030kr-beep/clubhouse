import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  QrCode,
  CalendarDays, ChevronDown, Check,
  X as XIcon, AlertCircle,
  ChevronRight, Clock, MapPin, Wallet,
} from 'lucide-react';
import { AttendanceQR } from './AttendanceQR';
import { ScheduleModal } from '../../components/admin/ScheduleModal';
import { AdminClubWelcome } from './AdminClubWelcome';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

/* ── 모션 Variants ── */
const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  }),
};

const Btn = ({
  children, className = '', onClick, type = 'button', disabled,
}: {
  children: React.ReactNode; className?: string;
  onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean;
}) => (
  <motion.button type={type} onClick={onClick} disabled={disabled}
    whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.97 }} className={className}>
    {children}
  </motion.button>
);

function todayYMD(): string {
  const t = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

interface UpcomingSchedule {
  id: string;
  title: string;
  date: string;
  time: string | null;
  location: string | null;
  type: 'GENERAL' | 'ASSIGNMENT' | 'BOTH';
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const { profile, activeClubId, loading: authLoading } = useAuth();
  const [todaySchedules,      setTodaySchedules]      = useState<{ id: string; title: string; time: string | null }[]>([]);
  const [selectedScheduleId,  setSelectedScheduleId]  = useState<string>('');
  const [isQRModalOpen,         setIsQRModalOpen]         = useState(false);
  const [isScheduleModalOpen,   setIsScheduleModalOpen]   = useState(false);
  const [pendingSchedules,    setPendingSchedules]    = useState<UpcomingSchedule[]>([]);

  /* ── 동아리 정보 ── */
  const [clubId,       setClubId]       = useState<string | null>(null);
  const [clubName,     setClubName]     = useState<string>('');
  const [isNewClub,    setIsNewClub]    = useState<boolean | null>(null); // null = 아직 판단 전
  const [isDeleted,    setIsDeleted]    = useState(false);
  const [isRestoring,  setIsRestoring]  = useState(false);

  /* ── 실시간 메트릭 상태 ── */
  const [totalMembers,      setTotalMembers]      = useState<number>(0);
  const [todayAttendance,   setTodayAttendance]   = useState<number>(0);
  const [pendingAssignCount,setPendingAssignCount] = useState<number>(0);
  const [metricsLoading,    setMetricsLoading]    = useState(true);

  /* ── 다가오는 일정 미리보기 ── */
  const [upcomingSchedules,  setUpcomingSchedules]  = useState<UpcomingSchedule[]>([]);
  const [upcomingAssignment, setUpcomingAssignment] = useState<UpcomingSchedule | null>(null);
  const [upcomingLoading,    setUpcomingLoading]    = useState(true);

  /* ── 회비 현황 ── */
  const [grantTotal,      setGrantTotal]      = useState<number>(0);
  const [membershipTotal, setMembershipTotal] = useState<number>(0);
  const [hasGrantCat,     setHasGrantCat]     = useState<boolean>(false);
  const [hasMemberCat,    setHasMemberCat]    = useState<boolean>(false);


  /* activeClubId가 바뀔 때마다 모든 데이터 재조회 */
  useEffect(() => {
    // 아직 auth 로딩 중이면 대기 (activeClubId가 아직 null일 수 있음)
    if (authLoading) return;

    if (!activeClubId) {
      // auth 완료됐는데 clubId 없음 → 진짜 새 관리자
      setIsNewClub(true);
      setMetricsLoading(false);
      return;
    }
    // Promise.all로 병렬 fetch — 순차 호출 대비 렌더 지연 최소화
    Promise.all([
      fetchMetrics(),
      fetchTodaySchedules(),
      fetchPendingSchedules(),
      fetchUpcoming(),
      fetchFees(),
    ]);
  }, [activeClubId, authLoading]);

  /* ── 실시간 메트릭 fetch ── */
  const fetchMetrics = async () => {
    setMetricsLoading(true);
    const today = todayYMD();
    try {
      const cId = activeClubId;
      if (!cId) {
        setTotalMembers(0);
        setTodayAttendance(0);
        setPendingAssignCount(0);
        setIsNewClub(true);
        return;
      }
      setClubId(cId);

      // 동아리 이름 + 삭제 여부 조회
      const { data: clubData } = await supabase
        .from('clubs').select('name, deleted_at').eq('id', cId).maybeSingle();
      const cd = clubData as { name: string | null; deleted_at: string | null } | null;
      setClubName(cd?.name ?? '');
      setIsDeleted(!!cd?.deleted_at);

      // 삭제된 동아리면 메트릭 조회 생략
      if (cd?.deleted_at) {
        setIsNewClub(false);
        return;
      }

      // 1. 총 부원 수
      const { count: mc } = await supabase
        .from('club_members')
        .select('*', { count: 'exact', head: true })
        .eq('club_id', cId);
      const memberCount = mc ?? 0;
      setTotalMembers(memberCount);

      // 2. 오늘 출석 수
      // ★ marked_at 날짜 범위 대신 today의 schedule_id를 경유
      //   (RLS 정책이 schedule_id → clubs.admin_id 기준이므로 이 방식이 안전)
      const { data: todaySchRows } = await supabase
        .from('schedules')
        .select('id')
        .eq('club_id', cId)
        .eq('date', today);
      const todaySchIds = (todaySchRows ?? []).map((r: { id: string }) => r.id).filter(Boolean);
      if (todaySchIds.length > 0) {
        const { count: ac } = await supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .in('schedule_id', todaySchIds)
          .eq('status', 'PRESENT');
        setTodayAttendance(ac ?? 0);
      } else {
        setTodayAttendance(0);
      }

      // 3. 활성 과제 수 (이 동아리 것만)
      const { count: schC } = await supabase
        .from('schedules')
        .select('*', { count: 'exact', head: true })
        .in('type', ['ASSIGNMENT', 'BOTH'])
        .eq('is_approved', true)
        .gte('date', today)
        .eq('club_id', cId);
      setPendingAssignCount(schC ?? 0);

      // 4. 이 동아리 일정 총 개수
      const { count: totalSched } = await supabase
        .from('schedules')
        .select('*', { count: 'exact', head: true })
        .eq('club_id', cId);

      // 규칙 3: 일정이 하나도 없으면 관리자 welcome 페이지
      // (동아리를 막 만들었거나 아직 일정/과제를 등록하지 않은 상태)
      const isEmpty = (totalSched ?? 0) === 0;
      setIsNewClub(isEmpty);

    } catch {
      setTotalMembers(0);
      setTodayAttendance(0);
      setPendingAssignCount(0);
      setIsNewClub(false);
    } finally {
      setMetricsLoading(false);
    }
  };

  /* ── 다가오는 일정 fetch ── */
  const fetchUpcoming = async () => {
    setUpcomingLoading(true);
    const today = todayYMD();
    const cId = activeClubId;   // 로컬 state(clubId)는 비동기 set → activeClubId 직접 사용
    try {
      // 일반 일정 2개 (이 동아리 것만)
      const { data: general } = cId ? await supabase
        .from('schedules')
        .select('id, title, date, time, location, type')
        .in('type', ['GENERAL', 'BOTH'])
        .eq('club_id', cId)
        .gte('date', today)
        .order('date', { ascending: true })
        .order('time', { ascending: true })
        .limit(2) : { data: [] };

      // 과제 1개 (이 동아리 것만)
      const { data: assignment } = cId ? await supabase
        .from('schedules')
        .select('id, title, date, time, location, type')
        .in('type', ['ASSIGNMENT', 'BOTH'])
        .eq('club_id', cId)
        .gte('date', today)
        .order('date', { ascending: true })
        .order('time', { ascending: true })
        .limit(1) : { data: [] };

      setUpcomingSchedules((general ?? []) as UpcomingSchedule[]);
      setUpcomingAssignment((assignment ?? [])[0] as UpcomingSchedule ?? null);
    } catch {
      setUpcomingSchedules([]);
      setUpcomingAssignment(null);
    } finally {
      setUpcomingLoading(false);
    }
  };

  const fetchFees = async () => {
    if (!activeClubId) return;
    try {
      const { data: cats } = await supabase
        .from('club_fee_categories').select('id, type').eq('club_id', activeClubId);
      const catList = (cats ?? []) as { id: string; type: string }[];
      const grantIds = catList.filter(c => c.type === 'grant').map(c => c.id);
      const membIds  = catList.filter(c => c.type === 'membership').map(c => c.id);
      setHasGrantCat(grantIds.length > 0);
      setHasMemberCat(membIds.length > 0);
      if (!catList.length) { setGrantTotal(0); setMembershipTotal(0); return; }
      const { data: recs } = await supabase
        .from('club_fee_records').select('amount, category_id').in('category_id', catList.map(c => c.id));
      const rows = (recs ?? []) as { amount: number; category_id: string }[];
      setGrantTotal(rows.filter(r => grantIds.includes(r.category_id)).reduce((s, r) => s + (r.amount ?? 0), 0));
      setMembershipTotal(rows.filter(r => membIds.includes(r.category_id)).reduce((s, r) => s + (r.amount ?? 0), 0));
    } catch {
      setGrantTotal(0);
      setMembershipTotal(0);
    }
  };

  const fetchTodaySchedules = async () => {
    if (!activeClubId) return;
    const today = todayYMD();
    const { data } = await supabase.from('schedules').select('id, title, time')
      .eq('is_approved', true).eq('date', today)
      .eq('club_id', activeClubId)
      .order('time');
    const list = data ?? [];
    setTodaySchedules(list);
    if (list.length > 0) setSelectedScheduleId(list[0].id);
  };

  const fetchPendingSchedules = async () => {
    if (!activeClubId) return;
    try {
      const { data, error } = await supabase.from('schedules').select('*')
        .eq('is_approved', false)
        .eq('club_id', activeClubId)
        .order('created_at', { ascending: false });
      if (!error && data) setPendingSchedules(data);
    } catch (err) { console.error(err); }
  };

  const approveSchedule = async (id: string) => {
    try {
      const { error } = await supabase.from('schedules').update({ is_approved: true }).eq('id', id);
      if (error) throw error;
      setPendingSchedules(prev => prev.filter(s => s.id !== id));
      fetchUpcoming(); // 승인 후 미리보기 갱신
      fetchMetrics();
    } catch { alert('승인 중 오류가 발생했습니다.'); }
  };

  const rejectSchedule = async (id: string) => {
    if (!window.confirm('이 일정을 반려(삭제)하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('schedules').delete().eq('id', id);
      if (error) throw error;
      setPendingSchedules(prev => prev.filter(s => s.id !== id));
    } catch { alert('반려 중 오류가 발생했습니다.'); }
  };

  /* ── 날짜 포맷 ── */
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const month = d.getMonth() + 1;
    const day   = d.getDate();
    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
    const dow = weekDays[d.getDay()];
    const today = todayYMD();
    if (dateStr === today) return `오늘 (${dow})`;
    return `${month}월 ${day}일 (${dow})`;
  };

  const hasUpcoming = upcomingSchedules.length > 0 || upcomingAssignment !== null;

  /* 판단 전 (메트릭 로딩 중) */
  if (isNewClub === null && metricsLoading) return null;

  /* ── 삭제된 동아리 → 복구 화면 ── */
  if (isDeleted && clubId) {
    const handleRestore = async () => {
      setIsRestoring(true);
      try {
        const { error } = await supabase
          .from('clubs')
          .update({ deleted_at: null })
          .eq('id', clubId);
        if (error) throw error;
        setIsDeleted(false);
        Promise.all([
          fetchMetrics(),
          fetchTodaySchedules(),
          fetchPendingSchedules(),
          fetchUpcoming(),
        ]);
      } catch {
        alert('복구 중 오류가 발생했습니다.');
      } finally {
        setIsRestoring(false);
      }
    };

    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
        <div className="max-w-sm w-full text-center space-y-6">
          {/* 아이콘 */}
          <div className="w-16 h-16 rounded-3xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto">
            <span className="text-3xl">🗑️</span>
          </div>

          {/* 동아리명 취소선 */}
          <div>
            <p className="text-xs font-black text-black/30 uppercase tracking-widest mb-2">삭제된 동아리</p>
            <h2 className="text-2xl font-black text-black/30 line-through">{clubName}</h2>
          </div>

          <p className="text-sm text-black/40 font-medium leading-relaxed">
            이 동아리는 삭제 처리되었습니다.<br />
            복구하면 모든 데이터가 다시 활성화됩니다.
          </p>

          {/* 복구 버튼 */}
          <button
            onClick={handleRestore}
            disabled={isRestoring}
            className="w-full py-4 bg-black text-white font-black rounded-2xl text-sm
                       hover:bg-black/85 active:scale-[0.98] transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isRestoring ? '복구 중...' : '🔄 동아리 복구하기'}
          </button>

          <p className="text-xs text-black/25">
            복구하지 않으려면 동아리 전환에서 다른 동아리를 선택하세요.
          </p>
        </div>
      </div>
    );
  }

  /* 빈 동아리 → 웰컴 페이지 */
  if (isNewClub && clubId) {
    return (
      <AdminClubWelcome
        clubName={clubName}
        clubId={clubId}
      />
    );
  }

  return (
    <div className="min-h-screen font-sans w-full bg-white">

      {/* ── Hero Header ── */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden text-black pt-10 pb-5 px-6 bg-white"
        style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}
      >
        <div className="absolute top-0 inset-x-0 h-[1px]
                        bg-gradient-to-r from-transparent via-black/20 to-transparent" />
        <div className="pointer-events-none absolute -top-20 -right-20 w-96 h-96
                        rounded-full bg-black/3 blur-3xl" />
        <div className="relative z-10 max-w-5xl mx-auto">
          <span className="inline-flex items-center gap-1.5 mb-2 px-3 py-1 rounded-full text-[10px]
                           font-black tracking-widest uppercase bg-black/15 border border-black/20 text-black">
            <span className="dot-active-light dot-pulse-light" />
            Administrator
          </span>
          <h1 className="text-3xl font-black tracking-tight text-black">관리자 대시보드</h1>
          <p className="mt-1 text-black/70 text-sm font-medium">동아리 현황을 한눈에 파악하고 관리하세요.</p>
        </div>
      </motion.header>

      {/* ── 콘텐츠 ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-4 relative z-20 space-y-4 pb-24">

        {/* ── 3 Key Metrics ── */}
        <motion.section
          custom={0} variants={fadeUp} initial="hidden" animate="visible"
          className="bg-white rounded-3xl border border-black/20 p-4"
        >
          <h2 className="text-base font-black text-black mb-3">✨ 동아리 현황</h2>
          <div className="grid grid-cols-3 divide-x divide-black/20">

            {/* 총 인원 */}
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/admin/members')}
              className="flex flex-col items-center justify-center py-3 px-3 hover:bg-black/5 cursor-pointer transition-colors"
            >
              <div className="text-center w-full">
                <div className="text-xs font-bold text-black/70 mb-1">총 인원</div>
                <div className="flex items-baseline justify-center gap-1 mb-0.5">
                  {metricsLoading
                    ? <span className="text-2xl font-black text-black/30">—</span>
                    : <span className="text-2xl font-black text-black">{totalMembers}</span>
                  }
                  <span className="text-xs text-black/60">명</span>
                </div>
                <div className="text-[11px] text-black/60">클릭하여 부원 관리</div>
              </div>
            </motion.button>

            {/* 오늘 출석 */}
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => navigate(`/admin/attendance?date=${todayYMD()}`)}
              className="flex flex-col items-center justify-center py-3 px-3 hover:bg-black/5 cursor-pointer transition-colors"
            >
              <div className="text-center w-full">
                <div className="text-xs font-bold text-black/70 mb-1">오늘 출석</div>
                <div className="flex items-baseline justify-center gap-1 mb-0.5">
                  {metricsLoading
                    ? <span className="text-2xl font-black text-black/30">—</span>
                    : <span className="text-2xl font-black text-black">{todayAttendance}</span>
                  }
                  <span className="text-xs text-black/60">명</span>
                </div>
                <div className="text-[11px] text-black/60">
                  {!metricsLoading && totalMembers > 0
                    ? `출석률 ${Math.round((todayAttendance / totalMembers) * 100)}%`
                    : '클릭하여 출결 관리'}
                </div>
              </div>
            </motion.button>

            {/* 활성 과제 */}
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/admin/assignments?filter=pending')}
              className="flex flex-col items-center justify-center py-3 px-3 hover:bg-black/5 cursor-pointer transition-colors"
            >
              <div className="text-center w-full">
                <div className="text-xs font-bold text-black/70 mb-1">활성 과제</div>
                <div className="flex items-baseline justify-center gap-1 mb-0.5">
                  {metricsLoading
                    ? <span className="text-2xl font-black text-black/30">—</span>
                    : <span className="text-2xl font-black text-black">{pendingAssignCount}</span>
                  }
                  <span className="text-xs text-black/60">건</span>
                </div>
                <div className="text-[11px] text-black/60">클릭하여 제출 현황</div>
              </div>
            </motion.button>
          </div>
        </motion.section>

        {/* ── 승인 대기 일정 ── */}
        {pendingSchedules.length > 0 && (
          <motion.section
            custom={1} variants={fadeUp} initial="hidden" animate="visible"
            className="rounded-3xl p-6 border border-black/20 bg-white"
          >
            <div className="flex items-center gap-2.5 mb-5">
              <AlertCircle className="w-4 h-4 text-black" />
              <h2 className="text-base font-black text-black">승인 대기 중인 일정</h2>
              <span className="bg-black text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">
                {pendingSchedules.length}건
              </span>
            </div>
            <div className="space-y-2.5">
              {pendingSchedules.map(schedule => (
                <div key={schedule.id}
                  className="bg-white rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-black/20">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-black text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                        {schedule.type === 'ASSIGNMENT' ? '과제' : '일반'}
                      </span>
                      <h4 className="font-black text-black text-sm">{schedule.title}</h4>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-black/60">
                      <CalendarDays className="w-3 h-3" />
                      {schedule.date} {schedule.time?.substring(0, 5)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Btn onClick={() => approveSchedule(schedule.id)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-black text-white text-xs font-black rounded-full hover:bg-black/90 transition-colors">
                      <Check className="w-3.5 h-3.5" /> 승인하기
                    </Btn>
                    <Btn onClick={() => rejectSchedule(schedule.id)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-white/10 border border-black/20
                                 hover:bg-black/5 text-black text-xs font-black rounded-full transition-colors">
                      <XIcon className="w-3.5 h-3.5" /> 반려
                    </Btn>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* ── 출석 QR ── */}
        <motion.section
          custom={2} variants={fadeUp} initial="hidden" animate="visible"
          className="bg-white rounded-3xl p-4 relative overflow-hidden border border-black/20"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
            <div className="space-y-1.5">
              <label className="text-black/70 block font-bold text-sm">오늘의 일정 선택</label>
              <div className="relative">
                {todaySchedules.length === 0 ? (
                  <div className="flex items-center gap-2 w-full bg-black/4 border border-black/20
                                  text-black/60 font-medium py-3.5 px-4 rounded-2xl text-sm">
                    <span className="dot-neutral-light" />
                    오늘 등록된 일정이 없습니다
                  </div>
                ) : (
                  <>
                    <select
                      value={selectedScheduleId}
                      onChange={e => setSelectedScheduleId(e.target.value)}
                      className="w-full appearance-none bg-white border border-black/20
                                 text-black font-semibold py-3.5 pl-4 pr-10 rounded-2xl
                                 focus:outline-none focus:ring-2 focus:ring-black
                                 focus:border-black transition-all cursor-pointer text-sm
                                 [color-scheme:light]"
                    >
                      {todaySchedules.map(s => (
                        <option key={s.id} value={s.id} className="bg-white">
                          {s.title}{s.time ? ` (${String(s.time).slice(0, 5)})` : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-black/60 pointer-events-none" />
                  </>
                )}
              </div>
            </div>
            <Btn onClick={() => setIsQRModalOpen(true)}
              className="w-full bg-black text-white rounded-full font-black text-sm py-4 px-6
                         flex items-center justify-center gap-2.5 hover:bg-black/90 transition-colors">
              <QrCode className="w-5 h-5" />
              오늘의 출석 QR 생성하기
            </Btn>
          </div>

        </motion.section>

        {/* ── 다가오는 일정 미리보기 ── */}
        <motion.section
          custom={3} variants={fadeUp} initial="hidden" animate="visible"
          className="bg-white rounded-3xl p-4 border border-black/20"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-black/8 border border-black/20">
                <CalendarDays className="w-4 h-4 text-black" />
              </div>
              <div>
                <h2 className="text-base font-black text-black">다가오는 일정</h2>
                <p className="text-xs text-black/60 mt-0.5">승인된 일정 기준</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/admin/schedules')}
              className="flex items-center gap-1 text-xs font-black text-black/50 hover:text-black transition-colors"
            >
              일정 더보기 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {upcomingLoading ? (
            <div className="py-6 text-center text-sm text-black/30 font-black">불러오는 중...</div>
          ) : !hasUpcoming ? (
            <div className="py-8 text-center">
              <CalendarDays className="w-8 h-8 text-black/15 mx-auto mb-2" />
              <p className="text-sm font-black text-black/40">다가오는 과제 및 일정이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* 일반 일정 2개 */}
              {upcomingSchedules.map(s => (
                <div key={s.id}
                  className="flex items-center gap-3.5 p-3.5 rounded-2xl border border-black/20 hover:bg-black/[0.03] transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-black/8 border border-black/20 flex items-center justify-center shrink-0">
                    <CalendarDays className="w-4 h-4 text-black/60" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-black text-sm truncate">{s.title}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-black/50">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(s.date)}{s.time ? ` ${s.time.slice(0, 5)}` : ''}
                      </span>
                      {s.location && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 shrink-0" />{s.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-black/8 border border-black/20 text-black/60 shrink-0">
                    일정
                  </span>
                </div>
              ))}

              {/* 과제 1개 */}
              {upcomingAssignment && (
                <div
                  className="flex items-center gap-3.5 p-3.5 rounded-2xl border border-black/30 bg-black/[0.02] hover:bg-black/[0.04] transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-black/12 border border-black/25 flex items-center justify-center shrink-0">
                    <span className="text-base">📋</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-black text-sm truncate">{upcomingAssignment.title}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-black/50">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(upcomingAssignment.date)}{upcomingAssignment.time ? ` ${upcomingAssignment.time.slice(0, 5)}` : ''}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-black text-white shrink-0">
                    과제
                  </span>
                </div>
              )}
            </div>
          )}

        </motion.section>

        {/* ── 회비 현황 ── */}
        <motion.section
          custom={4} variants={fadeUp} initial="hidden" animate="visible"
          className="bg-white rounded-3xl p-4 border border-black/20"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-black/6 border border-black/15">
                <Wallet className="w-4 h-4 text-black/60" />
              </div>
              <h2 className="text-sm font-black text-black">회비 현황</h2>
            </div>
            <button
              onClick={() => navigate('/admin/fees')}
              className="text-[11px] font-black text-black/40 hover:text-black transition-colors flex items-center gap-0.5"
            >
              상세히보기 <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* 카테고리 없을 때 */}
          {!hasGrantCat && !hasMemberCat ? (
            <div className="flex flex-col items-center justify-center py-5 rounded-2xl border border-black/10 bg-black/[0.02]">
              <Wallet className="w-6 h-6 text-black/15 mb-1.5" />
              <p className="text-sm font-black text-black/30">회비 없음</p>
              <p className="text-[11px] text-black/20 mt-0.5 font-medium">상세히보기에서 회비 구분을 추가하세요</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 divide-x divide-black/10 rounded-2xl border border-black/10 overflow-hidden">
              {/* 지원금 */}
              <div className="flex flex-col items-center justify-center py-4 px-3 bg-black/[0.02]">
                <span className="text-[10px] font-black text-black/40 tracking-wider mb-1">지원금 합계</span>
                {hasGrantCat ? (
                  <>
                    <span className="text-xl font-black text-black">{grantTotal.toLocaleString()}</span>
                    <span className="text-[10px] text-black/35 font-medium mt-0.5">원</span>
                  </>
                ) : (
                  <span className="text-sm font-black text-black/25 mt-1">없음</span>
                )}
              </div>
              {/* 자체 회비 */}
              <div className="flex flex-col items-center justify-center py-4 px-3">
                <span className="text-[10px] font-black text-black/40 tracking-wider mb-1">자체 회비 합계</span>
                {hasMemberCat ? (
                  <>
                    <span className="text-xl font-black text-black">{membershipTotal.toLocaleString()}</span>
                    <span className="text-[10px] text-black/35 font-medium mt-0.5">원</span>
                  </>
                ) : (
                  <span className="text-sm font-black text-black/25 mt-1">없음</span>
                )}
              </div>
            </div>
          )}
        </motion.section>

      </div>

      {isQRModalOpen && (
        <AttendanceQR scheduleId={selectedScheduleId || undefined} onClose={() => setIsQRModalOpen(false)} />
      )}
      {isScheduleModalOpen && (
        <ScheduleModal
          onClose={() => setIsScheduleModalOpen(false)}
          onSaved={() => { setIsScheduleModalOpen(false); fetchUpcoming(); fetchMetrics(); }}
        />
      )}
    </div>
  );
}
