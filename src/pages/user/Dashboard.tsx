import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  QrCode, ChevronRight, Activity, Plus, X, Loader2, CheckCircle2,
} from 'lucide-react';
import { QRScanner } from '../../components/QRScanner';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { ThreeWeekSummaryCard } from './ThreeWeekSummaryCard';

const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  }),
};
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };

type RecruitingClub = {
  id: string; name: string;
  category?: string | null; logo_url?: string | null; is_recruiting?: boolean;
};
type HotProject = {
  id: string; title: string;
  description?: string | null; image_url?: string | null;
  views?: number | null; club_id?: string | null;
  clubs?: { id: string; name: string } | { id: string; name: string }[] | null;
};

export function UserDashboard() {
  const { user, profile, isAdminMode } = useAuth();
  const navigate = useNavigate();
  const userName = profile?.full_name || '김부원';

  const [isScannerOpen,    setIsScannerOpen]    = useState(false);
  const [toastMessage,     setToastMessage]     = useState<{ title: string; type: 'success' | 'error' } | null>(null);
  const [clubInfo,         setClubInfo]         = useState<{ id: string; name: string; is_recruiting?: boolean; recruit_link?: string } | null>(null);
  const [isAddingSchedule, setIsAddingSchedule] = useState(false);
  const [isSubmitting,     setIsSubmitting]     = useState(false);
  const [recruitingClubs,  setRecruitingClubs]  = useState<RecruitingClub[]>([]);
  const [hotProjects,      setHotProjects]      = useState<HotProject[]>([]);
  const [selectedProject,  setSelectedProject]  = useState<HotProject | null>(null);
  const [newSchedule, setNewSchedule] = useState({ title: '', date: '', time: '', description: '' });

  // 일정 제안 가능 동아리: club_members.role = CAPTAIN or LEADER 인 클럽만
  const [eligibleClubs,  setEligibleClubs]  = useState<{ id: string; name: string; role: string }[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string>('');

  useEffect(() => {
    if (!user?.id) return;

    interface MemberWithClub {
      club_id: string;
      role: string;
      clubs: { id: string; name: string } | { id: string; name: string }[] | null;
    }

    supabase
      .from('club_members')
      .select('club_id, role, clubs(id, name)')
      .eq('user_id', user.id)
      .in('role', ['CAPTAIN', 'LEADER'])
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const list = (data as MemberWithClub[]).map((m) => {
          const club = Array.isArray(m.clubs) ? m.clubs[0] : m.clubs;
          return {
            id:   club?.id   ?? m.club_id,
            name: club?.name ?? '동아리',
            role: m.role,
          };
        });
        setEligibleClubs(list);
        setSelectedClubId(list[0].id);
      });
  }, [user?.id]);

  useEffect(() => { if (profile?.univ_name) void fetchClub(); }, [profile?.univ_name]);
  useEffect(() => { void fetchRecruitingClubs(); void fetchHotProjects(); }, []);

  const fetchClub = async () => {
    try {
      const { data } = await supabase.from('clubs').select('id, name, is_recruiting, recruit_link')
        .eq('name', profile?.univ_name).single();
      if (data) setClubInfo(data);
    } catch (e) { console.error(e); }
  };
  const fetchRecruitingClubs = async () => {
    try {
      const { data, error } = await supabase.from('clubs')
        .select('id, name, category, logo_url, is_recruiting')
        .eq('is_recruiting', true)
        .order('created_at', { ascending: false })
        .limit(12);

      if (error) throw error;
      setRecruitingClubs((data ?? []) as RecruitingClub[]);
    } catch { setRecruitingClubs([]); }
  };

  const fetchHotProjects = async () => {
    try {
      const { data, error } = await supabase.from('projects')
        .select('id, title, description, image_url, views, club_id, clubs(id, name)')
        .order('views', { ascending: false })
        .limit(3);

      if (error) throw error;
      setHotProjects((data ?? []) as HotProject[]);
    } catch { setHotProjects([]); }
  };

  const getProjectClubName = (p: HotProject) => {
    if (!p.clubs) return '동아리 정보 없음';
    return Array.isArray(p.clubs) ? p.clubs[0]?.name || '동아리 정보 없음' : p.clubs.name;
  };

  const handleCreateTeamSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const payload: Record<string, unknown> = {
        title: newSchedule.title, type: 'GENERAL',
        date: newSchedule.date, time: newSchedule.time,
        description: newSchedule.description, is_approved: false, location: '',
      };
      // 반드시 해당 역할을 가진 동아리의 club_id만 사용 (타 동아리 간섭 방지)
      if (selectedClubId) payload.club_id = selectedClubId;
      const { error } = await supabase.from('schedules').insert([payload]);
      if (error) throw error;
      setIsAddingSchedule(false);
      setNewSchedule({ title: '', date: '', time: '', description: '' });
      showToast('팀 일정이 관리자 승인 대기열에 등록되었습니다!', 'success');
    } catch (err: unknown) {
      showToast('일정 등록 실패: ' + (err instanceof Error ? err.message : '알 수 없는 오류'), 'error');
    } finally { setIsSubmitting(false); }
  };

  const showToast = (title: string, type: 'success' | 'error') => {
    setToastMessage({ title, type });
    setTimeout(() => setToastMessage(null), 3200);
  };

  const handleScanSuccess = async (rawText: string) => {
    setIsScannerOpen(false);
    if (!user) { showToast('로그인이 필요합니다.', 'error'); return; }
    try {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

      type QRv2 = { v: 2; schedule_id: string; date: string };
      type QRv3 = { v: 3; token: string; date: string };
      let parsed: QRv2 | QRv3 | null = null;
      try { parsed = JSON.parse(rawText); } catch { /* invalid JSON */ }

      if (!parsed?.v || parsed.v < 2 || !parsed.date) {
        showToast('유효하지 않은 QR입니다.', 'error'); return;
      }
      if (parsed.date !== todayStr) {
        showToast('오늘 날짜의 QR이 아닙니다.', 'error'); return;
      }

      let scheduleId: string;

      if (parsed.v === 3) {
        // v3: qr_code_token 으로 일정 조회 (schedule_id 미노출 방식)
        const { data: sched, error: tokErr } = await supabase
          .from('schedules').select('id, date, is_approved')
          .eq('qr_code_token', (parsed as QRv3).token).maybeSingle();
        if (tokErr || !sched) { showToast('유효하지 않은 QR입니다.', 'error'); return; }
        if (!sched.is_approved)     { showToast('미승인 일정의 QR입니다.', 'error'); return; }
        if (sched.date !== todayStr) { showToast('오늘 날짜의 QR이 아닙니다.', 'error'); return; }
        scheduleId = sched.id;
      } else {
        // v2: schedule_id 직접 포함 (하위 호환)
        const v2 = parsed as QRv2;
        if (!v2.schedule_id) { showToast('유효하지 않은 QR입니다.', 'error'); return; }
        const { data: sched, error: schErr } = await supabase
          .from('schedules').select('id, date, is_approved')
          .eq('id', v2.schedule_id).maybeSingle();
        if (schErr || !sched) { showToast('유효하지 않은 QR입니다.', 'error'); return; }
        if (!sched.is_approved)     { showToast('미승인 일정의 QR입니다.', 'error'); return; }
        if (sched.date !== todayStr) { showToast('오늘 날짜의 QR이 아닙니다.', 'error'); return; }
        scheduleId = sched.id;
      }

      const { error: attendanceError } = await supabase.from('attendance').upsert(
        { schedule_id: scheduleId, user_id: user.id, status: 'PRESENT', marked_at: new Date().toISOString() },
        { onConflict: 'schedule_id,user_id' }
      );
      attendanceError
        ? showToast('출석 처리 중 오류가 발생했습니다.', 'error')
        : showToast('✅ 출석이 완료되었습니다!', 'success');
    } catch { showToast('QR 처리 중 오류가 발생했습니다.', 'error'); }
  };

  /* 공통 입력 스타일 (다크) */
  const inp = "w-full rounded-2xl border border-white/15 bg-white/5 p-3.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/30 focus:bg-white/8 transition-all";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      className="relative min-h-screen w-full max-w-xl mx-auto bg-black pb-10"
    >
      <div className="relative z-10 px-4 pt-10 md:px-5 md:pt-12">

        {/* ── Hero 헤더 ── */}
        <motion.header
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-7 flex items-start justify-between gap-4"
        >
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-black text-white/40 uppercase tracking-widest">나의 활동 현황</p>
            <h1 className="text-3xl font-black tracking-tight text-white">
              반가워요,<br />{userName}님 👋
            </h1>
            <p className="text-sm text-white/50 font-medium pt-0.5">부원 대시보드</p>
            {clubInfo?.is_recruiting && (
              <motion.a
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                href={clubInfo.recruit_link || '#'} target="_blank" rel="noreferrer"
                className="mt-2 inline-flex items-center gap-2 rounded-full
                           border border-white/20 bg-white/8 px-3.5 py-1.5
                           text-xs font-bold text-white hover:bg-white/15 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                {clubInfo.name} 신입 모집 중
              </motion.a>
            )}
          </div>
          <motion.div
            whileHover={{ rotate: [0, -6, 6, 0], transition: { duration: 0.4 } }}
            className="flex shrink-0 items-center justify-center rounded-2xl
                       border border-white/10 bg-white/6 p-3.5"
          >
            <span className="text-3xl" aria-hidden>😊</span>
          </motion.div>
        </motion.header>

        {/* ── 섹션들 ── */}
        <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-3">

          {/* ── QR 출석 체크 ── */}
          <motion.section custom={0} variants={fadeUp}>
            <motion.button
              type="button" onClick={() => setIsScannerOpen(true)}
              whileHover={{ scale: 1.015, y: -2 }} whileTap={{ scale: 0.98 }}
              className="w-full bg-white rounded-3xl px-5 py-4 flex items-center justify-between gap-4 text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center shrink-0">
                  <QrCode className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-base font-black text-black">QR 출석 체크</p>
                  <p className="text-xs text-black/40 font-medium mt-0.5">스캔하여 출석을 체크하세요</p>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-black/8 flex items-center justify-center shrink-0">
                <ChevronRight className="w-4 h-4 text-black/50" />
              </div>
            </motion.button>
          </motion.section>

          {/* ── 3주 요약 ── */}
          <motion.div custom={1} variants={fadeUp}>
            <ThreeWeekSummaryCard />
          </motion.div>

          {/* ── 구분선 ── */}
          <div className="border-t border-white/8 my-1" />

          {/* ── 팀장/운영진 전용: 일정 제안 (CAPTAIN or LEADER 역할인 경우만 표시) ── */}
          {eligibleClubs.length > 0 && (
            <motion.section custom={2} variants={fadeUp}>
              <div className="bg-black rounded-3xl border border-white/10 p-5">
                <div className="flex items-center gap-2 mb-3">
                  {/* 가장 높은 권한 배지 표시: LEADER > CAPTAIN */}
                  {eligibleClubs.some(c => c.role === 'LEADER') ? (
                    <span className="rounded-full bg-white text-black px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest">
                      LEADER
                    </span>
                  ) : (
                    <span className="rounded-full bg-white/20 text-white px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest">
                      CAPTAIN
                    </span>
                  )}
                  <p className="text-xs font-medium text-white/40">운영진 승인 후 반영됩니다.</p>
                </div>
                <motion.button
                  type="button" onClick={() => setIsAddingSchedule(true)}
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }}
                  className="flex w-full items-center justify-center gap-2 bg-white text-black
                             py-3.5 rounded-2xl text-sm font-black"
                >
                  <Plus className="h-4 w-4" />
                  우리 팀 일정 만들기
                </motion.button>
              </div>
            </motion.section>
          )}

          {/* ── 모집 중인 동아리 ── */}
          <motion.section custom={3} variants={fadeUp} className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-base font-black text-white">나랑 어울리는 동아리</h2>
                <p className="text-[11px] text-white/40 font-medium mt-0.5">현재 모집 중</p>
              </div>
              <Link to="/user/recruitments"
                className="inline-flex items-center gap-1 text-xs font-bold text-white/60 hover:text-white transition-colors">
                더 보기 <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {recruitingClubs.length === 0 ? (
              <div className="bg-black rounded-3xl border border-white/10 py-8 text-center text-xs text-white/30">
                현재 모집 중인 동아리가 없습니다.
              </div>
            ) : (
              <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-none">
                {recruitingClubs.map((club, i) => (
                  <motion.div
                    key={club.id} custom={i} variants={fadeUp}
                    whileHover={{ y: -3, scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="min-w-[148px] max-w-[148px] overflow-hidden rounded-3xl bg-black border border-white/10 cursor-pointer shrink-0"
                  >
                    <div className="h-20 w-full bg-white/5">
                      {club.logo_url
                        ? <img src={club.logo_url} alt={club.name} className="h-full w-full object-cover" />
                        : (
                          <div className="flex h-full items-center justify-center text-2xl">
                            {club.category === '개발' ? '💻' : club.category === '디자인' ? '🎨' : club.category === '마케팅' ? '📣' : '🚀'}
                          </div>
                        )
                      }
                    </div>
                    <div className="p-3 space-y-1">
                      <p className="line-clamp-1 font-black text-white text-xs">{club.name}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        <span className="text-[9px] font-black text-white/40 uppercase tracking-wide">모집중</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.section>

          {/* ── 구분선 ── */}
          <div className="border-t border-white/8 my-1" />

          {/* ── HOT 프로젝트 ── */}
          <motion.section custom={4} variants={fadeUp} className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-base font-black text-white">요즘 HOT한 프로젝트</h2>
                <p className="text-[11px] text-white/40 font-medium mt-0.5">조회수 상위</p>
              </div>
              <Link to="/projects"
                className="inline-flex items-center gap-1 text-xs font-bold text-white/60 hover:text-white transition-colors">
                더 보기 <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {hotProjects.length === 0 ? (
              <div className="bg-black rounded-3xl border border-white/10 py-8 text-center text-xs text-white/30">
                인기 프로젝트 데이터가 없습니다.
              </div>
            ) : (
              <div className="space-y-2.5">
                {hotProjects.map((project, i) => (
                  <motion.div
                    key={project.id} custom={i} variants={fadeUp}
                    whileHover={{ x: 3 }} whileTap={{ scale: 0.99 }}
                    onClick={() => setSelectedProject(project)}
                    className="bg-black border border-white/10 rounded-3xl cursor-pointer"
                  >
                    <div className="flex gap-3.5 p-4">
                      <div className="h-14 w-20 shrink-0 overflow-hidden rounded-2xl bg-white/8">
                        {project.image_url
                          ? <img src={project.image_url} alt={project.title} className="h-full w-full object-cover" />
                          : <div className="flex h-full items-center justify-center text-xl">📁</div>
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 font-black text-white text-sm">{project.title}</p>
                        <p className="mt-0.5 text-xs font-medium text-white/40">{getProjectClubName(project)}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                          <span className="text-[10px] text-white/30 font-medium">조회 {(project.views ?? 0).toLocaleString()}회</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/20 shrink-0 self-center" />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.section>

        </motion.div>
      </div>

      {/* QR 스캐너 */}
      {isScannerOpen && <QRScanner onScanSuccess={handleScanSuccess} onClose={() => setIsScannerOpen(false)} />}

      {/* ── 일정 제안 모달 ── */}
      <AnimatePresence>
        {isAddingSchedule && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsAddingSchedule(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 20 }}
              transition={{ type: 'spring', damping: 28, stiffness: 360 }}
              className="relative flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-3xl bg-black border border-white/10"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-6 py-5">
                <h3 className="text-base font-black text-white">팀 일정 제안</h3>
                <button type="button" onClick={() => setIsAddingSchedule(false)}
                  className="rounded-xl p-2 hover:bg-white/5 transition-colors">
                  <X size={18} className="text-white/40" />
                </button>
              </div>
              <form onSubmit={handleCreateTeamSchedule} className="space-y-4 overflow-y-auto px-6 py-5">

                {/* 동아리 선택 — CAPTAIN/LEADER 권한을 가진 동아리만 표시 */}
                {eligibleClubs.length > 1 ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-white/50 block">동아리 선택</label>
                    <select
                      value={selectedClubId}
                      onChange={e => setSelectedClubId(e.target.value)}
                      className={inp + ' [color-scheme:dark]'}
                    >
                      {eligibleClubs.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} · {c.role === 'LEADER' ? '운영진' : '팀장'}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : eligibleClubs.length === 1 ? (
                  <div className="flex items-center gap-2 rounded-2xl bg-white/5 border border-white/8 px-4 py-3">
                    <span className="text-xs font-black text-white/40">동아리</span>
                    <span className="text-xs font-black text-white flex-1">{eligibleClubs[0].name}</span>
                    <span className="text-[10px] font-black text-white/30 uppercase">
                      {eligibleClubs[0].role === 'LEADER' ? '운영진' : '팀장'}
                    </span>
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-white/50 block">일정명</label>
                  <input required type="text"
                    value={newSchedule.title}
                    onChange={e => setNewSchedule({ ...newSchedule, title: e.target.value })}
                    placeholder="팀 온라인 미팅"
                    className={inp} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[{ label: '날짜', type: 'date', key: 'date' }, { label: '시간', type: 'time', key: 'time' }].map(f => (
                    <div key={f.key} className="space-y-1.5">
                      <label className="text-xs font-black text-white/50 block">{f.label}</label>
                      <input required type={f.type}
                        value={newSchedule[f.key as 'date' | 'time']}
                        onChange={e => setNewSchedule({ ...newSchedule, [f.key]: e.target.value })}
                        className={inp + ' [color-scheme:dark]'} />
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-white/50 block">설명</label>
                  <textarea value={newSchedule.description}
                    onChange={e => setNewSchedule({ ...newSchedule, description: e.target.value })}
                    placeholder="안건 및 준비물..."
                    className="h-20 w-full resize-none rounded-2xl border border-white/10 bg-white/5 p-3.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/25 focus:bg-white/8 transition-all" />
                </div>
                <p className="flex gap-2 rounded-2xl bg-white/5 border border-white/8 p-3 text-xs font-medium text-white/50">
                  <Activity className="h-3.5 w-3.5 shrink-0 text-white/30 mt-0.5" />
                  등록 시 운영진 승인 후 최종 반영됩니다.
                </p>
                <motion.button type="submit" disabled={isSubmitting}
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }}
                  className="flex w-full items-center justify-center gap-2 bg-white text-black
                             py-3.5 rounded-2xl font-black text-sm disabled:opacity-50">
                  {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> 제출 중...</> : '승인 요청하기'}
                </motion.button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 토스트 ── */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={{ type: 'spring', damping: 24, stiffness: 320 }}
            className="fixed top-4 left-1/2 z-[110] -translate-x-1/2"
          >
            <div className={`flex items-center gap-2 rounded-full px-4 py-2.5
                             shadow-2xl text-sm font-bold ${
              toastMessage.type === 'success'
                ? 'bg-white text-black border border-black/10'
                : 'bg-black text-white border border-white/10'
            }`}>
              {toastMessage.type === 'success'
                ? <CheckCircle2 className="h-4 w-4 text-black/50" />
                : <Activity className="h-4 w-4 text-white/60" />
              }
              {toastMessage.title}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 프로젝트 상세 모달 ── */}
      <AnimatePresence>
        {selectedProject && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={() => setSelectedProject(null)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg"
            >
              <div className="bg-black rounded-t-[2rem] sm:rounded-3xl border border-white/10 overflow-hidden">
                <div className="flex items-start justify-between px-6 py-5 border-b border-white/8">
                  <div>
                    <h3 className="text-base font-black text-white">{selectedProject.title}</h3>
                    <p className="mt-0.5 text-xs font-medium text-white/40">{getProjectClubName(selectedProject)}</p>
                  </div>
                  <button onClick={() => setSelectedProject(null)}
                    className="rounded-xl p-1.5 hover:bg-white/5 transition-colors text-white/40">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="h-40 w-full overflow-hidden rounded-2xl bg-white/8">
                    {selectedProject.image_url
                      ? <img src={selectedProject.image_url} alt={selectedProject.title} className="h-full w-full object-cover" />
                      : <div className="flex h-full items-center justify-center text-2xl">📁</div>
                    }
                  </div>
                  <p className="text-sm leading-6 text-white/50">
                    {selectedProject.description || '프로젝트 상세 설명이 아직 등록되지 않았습니다.'}
                  </p>
                  <div className="flex gap-2.5">
                    <button onClick={() => setSelectedProject(null)}
                      className="flex-1 py-3 rounded-2xl border border-white/10 font-black text-sm text-white/50 hover:bg-white/5 transition-colors">
                      닫기
                    </button>
                    <button onClick={() => { setSelectedProject(null); navigate(`/project/${selectedProject.id}`); }}
                      className="flex-1 py-3 rounded-2xl bg-white text-black font-black text-sm
                                 flex items-center justify-center gap-1.5 hover:bg-white/90 transition-colors">
                      자세히 보기 <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
