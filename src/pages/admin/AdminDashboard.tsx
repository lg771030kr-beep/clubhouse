import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Users, UserCheck, FileWarning, QrCode,
  CalendarDays, ChevronDown, Check,
  X as XIcon, AlertCircle, CalendarPlus,
  Flame, Eye, ChevronRight, Layers, Megaphone,
  TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import { AttendanceQR } from './AttendanceQR';
import { ScheduleModal } from '../../components/admin/ScheduleModal';
import { supabase } from '../../lib/supabase';

/* ── 모션 Variants ── */
const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  }),
};
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };

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

export function AdminDashboard() {
  const navigate = useNavigate();
  const [todaySchedules,      setTodaySchedules]      = useState<{ id: string; title: string; time: string | null }[]>([]);
  const [selectedScheduleId,  setSelectedScheduleId]  = useState<string>('');
  const [isQRModalOpen,       setIsQRModalOpen]       = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [pendingSchedules,    setPendingSchedules]    = useState<any[]>([]);
  const [hotProjects,         setHotProjects]         = useState<{ id: string; title: string; views: number; status: string; emoji: string }[]>([
    { id: '1', title: 'Club DX 메인 앱',   views: 1240, status: '진행중', emoji: '📱' },
    { id: '2', title: '브랜딩 리뉴얼',     views: 873,  status: '완료',   emoji: '🎯' },
    { id: '3', title: '신입 온보딩 자동화', views: 542,  status: '준비중', emoji: '🤖' },
  ]);
  const [popularClubs,        setPopularClubs]        = useState<{ id: string; name: string; field: string; members: number; emoji: string; pct: number }[]>([]);
  const [clubsLoading,        setClubsLoading]        = useState(true);

  /* ── 실시간 메트릭 상태 ── */
  const [totalMembers,      setTotalMembers]      = useState<number>(42);
  const [todayAttendance,   setTodayAttendance]   = useState<number>(35);
  const [pendingAssignCount,setPendingAssignCount] = useState<number>(5);
  const [metricsLoading,    setMetricsLoading]    = useState(true);

  useEffect(() => {
    fetchPendingSchedules();
    fetchTodaySchedules();
    fetchHotProjects();
    fetchMetrics();
    fetchPopularClubs();
  }, []);

  /* ── 실시간 메트릭 fetch ── */
  const fetchMetrics = async () => {
    setMetricsLoading(true);
    const today = todayYMD();
    try {
      // 1. 총 부원 수
      const { count: mc } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      if (mc !== null) setTotalMembers(mc);

      // 2. 오늘 출석 수
      const { count: ac } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'PRESENT')
        .gte('marked_at', `${today}T00:00:00.000Z`)
        .lte('marked_at', `${today}T23:59:59.999Z`);
      if (ac !== null) setTodayAttendance(ac);

      // 3. 미제출 과제 수 (assignments 테이블 우선 → schedules fallback)
      try {
        const { count: asgC, error: asgErr } = await supabase
          .from('assignments')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true)
          .gte('due_date', today);
        if (!asgErr && asgC !== null) {
          setPendingAssignCount(asgC);
        } else {
          throw new Error('assignments table not ready');
        }
      } catch {
        // fallback: schedules.type='ASSIGNMENT' 중 오늘 이후 일정
        const { count: schC } = await supabase
          .from('schedules')
          .select('*', { count: 'exact', head: true })
          .eq('type', 'ASSIGNMENT')
          .eq('is_approved', true)
          .gte('date', today);
        setPendingAssignCount(schC ?? 0);
      }
    } catch { /* 초기값 유지 */ } finally {
      setMetricsLoading(false);
    }
  };

  const fetchTodaySchedules = async () => {
    const today = todayYMD();
    const { data } = await supabase.from('schedules').select('id, title, time')
      .eq('is_approved', true).eq('date', today).order('time');
    const list = data ?? [];
    setTodaySchedules(list);
    if (list.length > 0) setSelectedScheduleId(list[0].id);
  };

  const fetchHotProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, title, views, status')
        .order('views', { ascending: false })
        .limit(3);
      if (!error && data && data.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setHotProjects(data.map((p: any) => ({
          id:     String(p.id),
          title:  p.title  ?? '프로젝트',
          views:  p.views  ?? 0,
          status: p.status === 'active' ? '진행중' : p.status === 'closed' ? '완료' : '준비중',
          emoji:  '📁',
        })));
      }
    } catch { /* mock 유지 */ }
  };

  /* ── 인기 동아리 실시간 fetch ── */
  const fetchPopularClubs = async () => {
    setClubsLoading(true);
    try {
      const { data, error } = await supabase
        .from('clubs')
        .select('id, name, category, member_count')
        .order('member_count', { ascending: false })
        .limit(3);
      if (!error && data && data.length > 0) {
        const maxCount = (data[0] as any).member_count ?? 1;
        setPopularClubs(data.map((c: any) => ({
          id:      String(c.id),
          name:    c.name          ?? '동아리',
          field:   c.category      ?? '기타',
          members: c.member_count  ?? 0,
          emoji:   '🏢',
          pct:     maxCount > 0 ? Math.round(((c.member_count ?? 0) / maxCount) * 100) : 0,
        })));
      }
    } catch { /* 빈 상태 표시 */ } finally {
      setClubsLoading(false);
    }
  };

  const fetchPendingSchedules = async () => {
    try {
      const { data, error } = await supabase.from('schedules').select('*')
        .eq('is_approved', false).order('created_at', { ascending: false });
      if (!error && data) setPendingSchedules(data);
    } catch (err) { console.error(err); }
  };

  const approveSchedule = async (id: string) => {
    try {
      const { error } = await supabase.from('schedules').update({ is_approved: true }).eq('id', id);
      if (error) throw error;
      setPendingSchedules(prev => prev.filter(s => s.id !== id));
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

  /* 메트릭 카드 데이터 */
  const metrics = [
    {
      label: '총 부원',
      value: 42,
      unit: '명',
      trend: +3,
      trendLabel: '지난달 대비',
      icon: Users,
      accentColor: '#000000',
      to: '/admin/members',
    },
    {
      label: '오늘 출석',
      value: 35,
      unit: '명',
      trend: +2,
      trendLabel: '어제 대비',
      icon: UserCheck,
      accentColor: '#000000',
      attendanceRate: 83,
      to: '/admin/attendance',
    },
    {
      label: '미제출 과제',
      value: 5,
      unit: '건',
      trend: -2,
      trendLabel: '어제 대비',
      icon: FileWarning,
      accentColor: '#000000',
      to: '/admin/assignments',
    },
  ];

  return (
    <div className="min-h-screen font-sans w-full bg-white">

      {/* ── Hero Header ── */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden text-black pt-10 pb-14 px-6 bg-white"
        style={{
          borderBottom: '1px solid rgba(0,0,0,0.08)',
        }}
      >
        {/* 네온 라인 */}
        <div className="absolute top-0 inset-x-0 h-[1px]
                        bg-gradient-to-r from-transparent via-black/20 to-transparent" />
        <div className="pointer-events-none absolute -top-20 -right-20 w-96 h-96
                        rounded-full bg-black/3 blur-3xl" />
        <div className="relative z-10 max-w-5xl mx-auto">
          <span className="inline-flex items-center gap-1.5 mb-3 px-3 py-1 rounded-full text-[10px]
                           font-black tracking-widest uppercase bg-black/15 border border-black/20 text-black">
            <span className="dot-active-light dot-pulse-light" />
            Administrator
          </span>
          <h1 className="text-3xl font-black tracking-tight text-black">관리자 대시보드</h1>
          <p className="mt-1 text-black/70 text-sm font-medium">동아리 현황을 한눈에 파악하고 관리하세요.</p>
        </div>
      </motion.header>

      {/* ── 콘텐츠 ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-6 relative z-20 space-y-6 pb-24">

        {/* ── 3 Key Metrics Slim Summary Bar ── */}
        <motion.section
          custom={0} variants={fadeUp} initial="hidden" animate="visible"
          className="bg-white rounded-3xl border border-black/20 p-6"
        >
          {/* 제목 */}
          <h2 className="text-xl font-black text-black mb-5">✨ 동아리 현황</h2>

          {/* 3열 가로 요약 바 */}
          <div className="grid grid-cols-3 divide-x divide-black/20">
            {/* Column 1: 총 인원 */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/admin/members')}
              className="flex flex-col items-center justify-center py-5 px-4 hover:bg-black/5 cursor-pointer transition-colors"
            >
              <div className="text-center w-full">
                <div className="text-sm font-bold text-black/70 mb-2">총 인원</div>
                <div className="flex items-baseline justify-center gap-1 mb-1">
                  {metricsLoading
                    ? <span className="text-2xl font-black text-black/30">—</span>
                    : <span className="text-2xl font-black text-black">{totalMembers}</span>
                  }
                  <span className="text-xs text-black/60">명</span>
                </div>
                <div className="text-xs text-black/60">클릭하여 부원 관리</div>
              </div>
            </motion.button>

            {/* Column 2: 출석 인원 */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(`/admin/attendance?date=${todayYMD()}`)}
              className="flex flex-col items-center justify-center py-5 px-4 hover:bg-black/5 cursor-pointer transition-colors"
            >
              <div className="text-center w-full">
                <div className="text-sm font-bold text-black/70 mb-2">오늘 출석</div>
                <div className="flex items-baseline justify-center gap-1 mb-1">
                  {metricsLoading
                    ? <span className="text-2xl font-black text-black/30">—</span>
                    : <span className="text-2xl font-black text-black">{todayAttendance}</span>
                  }
                  <span className="text-xs text-black/60">명</span>
                </div>
                <div className="text-xs text-black/60">
                  {!metricsLoading && totalMembers > 0
                    ? `출석률 ${Math.round((todayAttendance / totalMembers) * 100)}%`
                    : '클릭하여 출결 관리'}
                </div>
              </div>
            </motion.button>

            {/* Column 3: 활성 과제 */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/admin/assignments?filter=pending')}
              className="flex flex-col items-center justify-center py-5 px-4 hover:bg-black/5 cursor-pointer transition-colors"
            >
              <div className="text-center w-full">
                <div className="text-sm font-bold text-black/70 mb-2">활성 과제</div>
                <div className="flex items-baseline justify-center gap-1 mb-1">
                  {metricsLoading
                    ? <span className="text-2xl font-black text-black/30">—</span>
                    : <span className="text-2xl font-black text-black">{pendingAssignCount}</span>
                  }
                  <span className="text-xs text-black/60">건</span>
                </div>
                <div className="text-xs text-black/60">클릭하여 제출 현황</div>
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
          className="bg-white rounded-3xl p-7 relative overflow-hidden border border-black/20"
        >
          <div className="flex items-center gap-2.5 mb-6">
            <div className="p-2 rounded-xl bg-black/8 border border-black/20">
              <QrCode className="w-4 h-4 text-black" />
            </div>
            <div>
              <h2 className="text-base font-black text-black">출석 QR 시작하기</h2>
              <p className="text-xs text-black/60 mt-0.5">오늘 일정을 선택하고 QR을 생성하세요</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-end">
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

          <div className="mt-4 pt-4 border-t border-black/20">
            <Btn onClick={() => setIsScheduleModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-full
                         font-black text-xs text-white bg-black
                         hover:bg-black/90 transition-colors">
              <CalendarPlus className="w-3.5 h-3.5" />
              일정 및 과제 추가하기
            </Btn>
          </div>
        </motion.section>

        {/* ── 인기 동아리 + 인기 프로젝트 ── */}
        <motion.div
          variants={stagger} initial="hidden" animate="visible"
          className="grid grid-cols-1 lg:grid-cols-2 gap-5"
        >

          {/* 인기 동아리 */}
          <motion.section custom={0} variants={fadeUp} className="bg-white rounded-3xl p-6 flex flex-col border border-black/20">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-black/8 border border-black/20 flex items-center justify-center">
                  <Megaphone className="w-3.5 h-3.5 text-black" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-black">인기 동아리</h2>
                  <p className="text-xs text-black/70">이번 주 기준</p>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-2">
              {clubsLoading ? (
                <div className="py-6 flex items-center justify-center gap-2 text-black/30">
                  <span className="text-sm font-black">불러오는 중...</span>
                </div>
              ) : popularClubs.length === 0 ? (
                <div className="py-6 text-center text-black/30 text-sm font-black">
                  등록된 동아리가 없습니다
                </div>
              ) : null}
              {!clubsLoading && popularClubs.map((club, i) => (
                <motion.div key={club.id}
                  whileHover={{ x: 4 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  onClick={() => navigate(`/club/${club.id}`)}
                  className="flex items-center gap-3.5 p-3 rounded-2xl border border-black/20
                             hover:border-black/40 hover:bg-black/5 transition-all cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0
                       bg-black/8 border border-black/20">
                    {club.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-black text-black text-sm truncate">{club.name}</p>
                      <span className="text-xs font-bold ml-2 shrink-0 text-black">{club.pct}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-black/20">
                      <div className="h-full rounded-full transition-all bg-black/60"
                           style={{ width: `${club.pct}%` }} />
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-black/60">
                      <Users className="w-2.5 h-2.5" /> {club.members}명
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-black/40 group-hover:text-black/60 transition-colors shrink-0" />
                </motion.div>
              ))}
            </div>

            <Btn onClick={() => navigate('/user/clubs')}
              className="mt-5 w-full py-2.5 text-xs font-black flex items-center justify-center gap-1.5
                         bg-black text-white hover:bg-black/90 rounded-full transition-colors">
              더 많은 동아리 <ChevronRight className="w-3 h-3" />
            </Btn>
          </motion.section>

          {/* 인기 프로젝트 */}
          <motion.section custom={1} variants={fadeUp} className="bg-white rounded-3xl p-6 flex flex-col border border-black/20">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-black/8 border border-black/20 flex items-center justify-center">
                  <Layers className="w-3.5 h-3.5 text-black" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-black">인기 프로젝트</h2>
                  <p className="text-xs text-black/70">조회수 순</p>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-2">
              {hotProjects.map(project => (
                <motion.div key={project.id}
                  whileHover={{ x: 4 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  onClick={() => navigate(`/project/${project.id}`)}
                  className="flex items-center gap-3.5 p-3 rounded-2xl border border-black/20
                             hover:border-black/40 hover:bg-black/5 transition-all cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0
                       bg-black/8 border border-black/20">
                    {project.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-black text-black text-sm truncate">{project.title}</p>
                      {project.views >= 500 && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-black
                                         text-white bg-black border border-black/20
                                         px-1.5 py-0.5 rounded-full shrink-0">
                          <Flame className="w-2 h-2" /> HOT
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-black/60">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-black/40 shrink-0" />
                        {project.status}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-2.5 h-2.5" /> {project.views.toLocaleString()}회
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-black/40 group-hover:text-black/60 transition-colors shrink-0" />
                </motion.div>
              ))}
            </div>

            <Btn onClick={() => navigate('/projects')}
              className="mt-5 w-full py-2.5 text-xs font-black flex items-center justify-center gap-1.5
                         bg-black text-white hover:bg-black/90 rounded-full transition-colors">
              더 많은 프로젝트 <ChevronRight className="w-3 h-3" />
            </Btn>
          </motion.section>
        </motion.div>

      </div>

      {isQRModalOpen && (
        <AttendanceQR scheduleId={selectedScheduleId || undefined} onClose={() => setIsQRModalOpen(false)} />
      )}
      {isScheduleModalOpen && (
        <ScheduleModal onClose={() => setIsScheduleModalOpen(false)} onSaved={() => setIsScheduleModalOpen(false)} />
      )}
    </div>
  );
}
