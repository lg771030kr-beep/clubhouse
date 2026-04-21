import React, { useState, useEffect } from 'react';
import {
  ChevronDown, ChevronRight, Award, Calendar, Loader2,
  FileText, Download, MessageSquare, CheckCircle2,
  Clock3, UserX, HelpCircle, X, ClipboardList, MapPin,
} from 'lucide-react';
import { BackButton } from '../../components/common/BackButton';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

/* ══════════════════════════════════════════
   타입
══════════════════════════════════════════ */
interface SessionItem {
  scheduleId: string;
  title: string;
  date: string;          // yyyy-mm-dd
  type: string;          // GENERAL | ASSIGNMENT | BOTH
  location: string | null;
  adminDescription: string | null;  // 운영진이 입력한 활동 내용
  attendStatus: 'PRESENT' | 'LATE' | 'ABSENT' | 'UNRECORDED';
  markedAt: string | null;
  // 제출 정보 (ASSIGNMENT / BOTH)
  submContent: string | null;
  submFileName: string | null;
  submFileUrl: string | null;
  submittedAt: string | null;
}

interface ClubActivity {
  id: string;            // clubId_year
  clubId: string;
  clubName: string;
  year: string;
  isCompleted: boolean;  // year < thisYear
  sessions: SessionItem[];
}

interface YearGroup {
  year: string;
  activities: ClubActivity[];
}

/* ══════════════════════════════════════════
   헬퍼
══════════════════════════════════════════ */
const todayStr = () => new Date().toISOString().slice(0, 10);

const fmtDate = (d: string) => {
  const dt = new Date(d + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${dt.getMonth() + 1}월 ${dt.getDate()}일 (${days[dt.getDay()]})`;
};

const TYPE_LABEL: Record<string, string> = {
  GENERAL: '활동', ASSIGNMENT: '과제', BOTH: '활동+과제',
};
const TYPE_BADGE: Record<string, string> = {
  GENERAL:    'bg-white/10 text-white/70 border-white/15',
  ASSIGNMENT: 'bg-white text-black border-transparent',
  BOTH:       'bg-white/20 text-white border-white/30',
};

function AttendBadge({ status }: { status: SessionItem['attendStatus'] }) {
  if (status === 'PRESENT') return (
    <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
      <CheckCircle2 className="w-3 h-3" /> 출석
    </span>
  );
  if (status === 'LATE') return (
    <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
      <Clock3 className="w-3 h-3" /> 지각
    </span>
  );
  if (status === 'ABSENT') return (
    <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25">
      <UserX className="w-3 h-3" /> 결석
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-white/5 text-white/30 border border-white/10">
      <HelpCircle className="w-3 h-3" /> 미인증
    </span>
  );
}

/* ══════════════════════════════════════════
   세션 상세 모달
══════════════════════════════════════════ */
function SessionDetailModal({ session, onClose }: { session: SessionItem; onClose: () => void }) {
  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
      />
      <motion.div
        key="modal"
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className="fixed inset-x-4 bottom-0 sm:inset-auto sm:left-1/2 sm:-translate-x-1/2
                   sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-lg
                   bg-[#111] border border-white/10 rounded-t-3xl sm:rounded-3xl z-50 overflow-hidden shadow-2xl"
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-white/8">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${TYPE_BADGE[session.type] ?? TYPE_BADGE.GENERAL}`}>
                {TYPE_LABEL[session.type] ?? '활동'}
              </span>
              <AttendBadge status={session.attendStatus} />
            </div>
            <h3 className="font-black text-white text-base leading-tight">{session.title}</h3>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-white/40 font-medium flex-wrap">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(session.date)}</span>
              {session.location && (
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{session.location}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">

          {/* 운영진 활동 내용 */}
          {session.adminDescription ? (
            <div>
              <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3" /> 운영진 활동 내용
              </p>
              <div className="bg-white/5 border border-white/8 rounded-2xl px-4 py-3 text-sm text-white/80 leading-relaxed whitespace-pre-wrap font-medium">
                {session.adminDescription}
              </div>
            </div>
          ) : (
            <div className="bg-white/3 border border-white/6 rounded-2xl px-4 py-3 text-xs text-white/30 font-medium">
              운영진이 입력한 활동 내용이 없습니다
            </div>
          )}

          {/* 내 제출 내용 (ASSIGNMENT / BOTH) */}
          {(session.type === 'ASSIGNMENT' || session.type === 'BOTH') && (
            <div>
              <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <ClipboardList className="w-3 h-3" /> 나의 제출 내용
              </p>

              {session.submittedAt ? (
                <div className="space-y-2">
                  <p className="text-[10px] text-white/30 font-medium">
                    제출: {new Date(session.submittedAt).toLocaleString('ko-KR', { hour12: false })}
                  </p>

                  {/* 첨부 파일 */}
                  {session.submFileName && (
                    <a
                      href={session.submFileUrl ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 hover:bg-white/10 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-white/60" />
                        </div>
                        <p className="text-sm font-black text-white truncate">{session.submFileName}</p>
                      </div>
                      <Download className="w-4 h-4 text-white/30 group-hover:text-white/70 shrink-0 transition-colors" />
                    </a>
                  )}

                  {/* 텍스트 내용 */}
                  {session.submContent && (
                    <div className="bg-white/5 border border-white/8 rounded-2xl px-4 py-3 text-sm text-white/70 leading-relaxed whitespace-pre-wrap font-medium">
                      {session.submContent}
                    </div>
                  )}

                  {!session.submFileName && !session.submContent && (
                    <p className="text-xs text-white/30 font-medium py-1">첨부 파일 또는 내용이 없습니다</p>
                  )}
                </div>
              ) : (
                <div className="bg-white/3 border border-white/6 rounded-2xl px-4 py-3 text-xs text-white/30 font-medium">
                  제출 기록이 없습니다
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/8">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-white text-black font-black text-sm hover:bg-white/90 transition-all active:scale-[0.98]"
          >
            닫기
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ══════════════════════════════════════════
   Component
══════════════════════════════════════════ */
export function Portfolio() {
  const { profile } = useAuth();
  const thisYear = new Date().getFullYear();

  const [careerData,         setCareerData]         = useState<YearGroup[]>([]);
  const [loading,            setLoading]            = useState(true);
  const [expandedYears,      setExpandedYears]      = useState<string[]>([String(thisYear)]);
  const [expandedActivities, setExpandedActivities] = useState<string[]>([]);
  const [selectedSession,    setSelectedSession]    = useState<SessionItem | null>(null);

  /* ── 데이터 로드 ── */
  useEffect(() => {
    if (!profile?.id) return;
    load();
  }, [profile?.id]);

  async function load() {
    setLoading(true);
    try {
      const today = todayStr();

      /* 1. 유저가 가입한 동아리 */
      const { data: memberships, error: memErr } = await supabase
        .from('club_members')
        .select('club_id, clubs(id, name)')
        .eq('user_id', profile!.id);

      if (memErr || !memberships || memberships.length === 0) {
        setCareerData([]);
        return;
      }

      interface MembershipRow {
        club_id: string;
        clubs: { id: string; name: string } | { id: string; name: string }[] | null;
      }
      interface ScheduleRow {
        id: string;
        title: string | null;
        type: string | null;
        date: string;
        location: string | null;
        description: string | null;
        club_id: string;
      }
      interface AttendanceRow { schedule_id: string; status: string; marked_at: string | null; }
      interface SubmissionRow {
        schedule_id: string;
        content: string | null;
        file_name: string | null;
        file_url: string | null;
        submitted_at: string | null;
      }

      const clubMap: Record<string, string> = {};
      (memberships as MembershipRow[]).forEach((m) => {
        const club = Array.isArray(m.clubs) ? m.clubs[0] : m.clubs;
        if (club) clubMap[club.id] = club.name;
      });
      const clubIds = Object.keys(clubMap);

      /* 2. 각 동아리의 과거 일정 (오늘 이전) */
      const { data: schedules } = await supabase
        .from('schedules')
        .select('id, title, type, date, location, description, club_id')
        .in('club_id', clubIds)
        .lt('date', today)
        .order('date', { ascending: false });

      const scheduleList = (schedules ?? []) as ScheduleRow[];
      const scheduleIds = scheduleList.map((s) => s.id);

      /* 3. 내 출결 기록 */
      const attendMap: Record<string, AttendanceRow> = {};
      if (scheduleIds.length > 0) {
        const { data: attendances } = await supabase
          .from('attendance')
          .select('schedule_id, status, marked_at')
          .eq('user_id', profile!.id)
          .in('schedule_id', scheduleIds);
        ((attendances ?? []) as AttendanceRow[]).forEach((a) => { attendMap[a.schedule_id] = a; });
      }

      /* 4. 내 제출 기록 */
      const assignIds = scheduleList
        .filter((s) => s.type === 'ASSIGNMENT' || s.type === 'BOTH')
        .map((s) => s.id);

      const submMap: Record<string, SubmissionRow> = {};
      if (assignIds.length > 0) {
        const { data: submissions } = await supabase
          .from('submissions')
          .select('schedule_id, content, file_name, file_url, submitted_at')
          .eq('user_id', profile!.id)
          .in('schedule_id', assignIds);
        ((submissions ?? []) as SubmissionRow[]).forEach((s) => { submMap[s.schedule_id] = s; });
      }

      /* 5. 데이터 조합 → YearGroup[] */
      // clubId_year 단위로 그루핑
      const actMap = new Map<string, ClubActivity>();

      for (const s of scheduleList) {
        const year = (s.date as string).substring(0, 4);
        const key  = `${s.club_id}_${year}`;
        if (!actMap.has(key)) {
          actMap.set(key, {
            id:          key,
            clubId:      s.club_id,
            clubName:    clubMap[s.club_id] ?? '동아리',
            year,
            isCompleted: Number(year) < thisYear,
            sessions:    [],
          });
        }

        const att  = attendMap[s.id];
        const subm = submMap[s.id];

        actMap.get(key)!.sessions.push({
          scheduleId:       s.id,
          title:            s.title ?? '일정',
          date:             s.date,
          type:             s.type ?? 'GENERAL',
          location:         s.location ?? null,
          adminDescription: s.description ?? null,
          attendStatus:     att
            ? (att.status as 'PRESENT' | 'LATE' | 'ABSENT')
            : 'UNRECORDED',
          markedAt:         att?.marked_at ?? null,
          submContent:      subm?.content    ?? null,
          submFileName:     subm?.file_name  ?? null,
          submFileUrl:      subm?.file_url   ?? null,
          submittedAt:      subm?.submitted_at ?? null,
        });
      }

      // 세션 날짜 내림차순 (최신 먼저)
      for (const act of actMap.values()) {
        act.sessions.sort((a, b) => b.date.localeCompare(a.date));
      }

      // 과거 활동이 전혀 없는 소속 동아리도 현재 연도 빈 껍데기로 추가
      const clubsInActMap = new Set([...actMap.values()].map(a => a.clubId));
      for (const clubId of clubIds) {
        if (!clubsInActMap.has(clubId)) {
          const key = `${clubId}_${thisYear}`;
          actMap.set(key, {
            id:          key,
            clubId,
            clubName:    clubMap[clubId] ?? '동아리',
            year:        String(thisYear),
            isCompleted: false,
            sessions:    [],
          });
        }
      }

      // 연도별 그루핑 → 내림차순
      const yearMap = new Map<string, ClubActivity[]>();
      for (const act of actMap.values()) {
        if (!yearMap.has(act.year)) yearMap.set(act.year, []);
        yearMap.get(act.year)!.push(act);
      }

      const groups: YearGroup[] = [...yearMap.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([year, activities]) => ({ year, activities }));

      setCareerData(groups);
      if (groups.length > 0) setExpandedYears([groups[0].year]);
    } catch (e) {
      console.error('[활동 이력]', e);
      setCareerData([]);
    } finally {
      setLoading(false);
    }
  }

  const toggleYear = (year: string) =>
    setExpandedYears(prev =>
      prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]
    );

  const toggleActivity = (id: string) =>
    setExpandedActivities(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );

  return (
    <div className="min-h-screen bg-black font-sans w-full mx-auto max-w-lg relative pb-10">

      {/* ── 헤더 ── */}
      <header className="bg-black px-6 py-4 flex flex-col gap-1 border-b border-white/10 sticky top-0 z-20">
        <BackButton />
        <h1 className="text-lg font-black text-white">활동 이력</h1>
      </header>

      <div className="p-6 space-y-8">
        <section>
          <h2 className="text-lg font-black text-white mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-white/60" /> 나의 활동 이력
          </h2>

          {/* 로딩 */}
          {loading && (
            <div className="flex items-center justify-center py-14 gap-2 text-white/40">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-black">기록 불러오는 중...</span>
            </div>
          )}

          {/* 빈 상태 — 소속 동아리 자체가 없을 때 */}
          {!loading && careerData.length === 0 && (
            <div className="bg-white/5 rounded-3xl border border-white/8 py-16 text-center">
              <Award className="w-10 h-10 mx-auto mb-3 text-white/15" />
              <p className="text-sm font-black text-white/40">소속된 동아리가 없습니다</p>
              <p className="text-xs text-white/20 mt-1 font-medium">
                동아리에 가입하면 활동 이력이 여기에 기록됩니다
              </p>
            </div>
          )}

          {/* 연도별 트리 */}
          {!loading && careerData.length > 0 && (
            <div className="space-y-4">
              {careerData.map(yearGroup => {
                const isYearOpen = expandedYears.includes(yearGroup.year);
                const totalSessions = yearGroup.activities.reduce((s, a) => s + a.sessions.length, 0);

                return (
                  <div key={yearGroup.year} className="bg-black rounded-[1.5rem] border border-white/10 overflow-hidden">
                    {/* 연도 헤더 */}
                    <button
                      onClick={() => toggleYear(yearGroup.year)}
                      className="w-full p-5 flex items-center justify-between hover:bg-white/3 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 text-white flex items-center justify-center font-black text-sm">
                          {yearGroup.year}
                        </div>
                        <div className="text-left">
                          <h3 className="font-black text-white">{yearGroup.year}년 활동 기록</h3>
                          <p className="text-xs text-white/30 font-medium mt-0.5">
                            {yearGroup.activities.length}개 동아리 · {totalSessions}개 활동
                          </p>
                        </div>
                      </div>
                      <ChevronDown className={`w-5 h-5 text-white/40 transition-transform duration-300 ${isYearOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence initial={false}>
                      {isYearOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                          className="border-t border-white/8"
                        >
                          <div className="p-3 space-y-3">
                            {yearGroup.activities.map(activity => {
                              const isActOpen = expandedActivities.includes(activity.id);
                              const presentCount = activity.sessions.filter(s => s.attendStatus === 'PRESENT').length;

                              return (
                                <div key={activity.id} className="bg-white/5 rounded-2xl border border-white/8 overflow-hidden">
                                  {/* 동아리 행 */}
                                  <button
                                    onClick={() => toggleActivity(activity.id)}
                                    className="w-full p-4 flex items-start sm:items-center justify-between hover:bg-white/5 transition-colors text-left"
                                  >
                                    <div className="flex-1 pr-4">
                                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                        {activity.isCompleted ? (
                                          <span className="bg-white text-black text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                            <CheckCircle2 className="w-3 h-3" /> 수료 완료
                                          </span>
                                        ) : (
                                          <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> 진행중
                                          </span>
                                        )}
                                        <span className="text-[11px] text-white/40 font-bold">{activity.year}년 활동</span>
                                      </div>
                                      <h4 className="font-black text-white text-sm">{activity.clubName}</h4>
                                      <p className="text-xs text-white/30 mt-0.5">
                                        {activity.sessions.length}개 활동 · 출석 {presentCount}회
                                      </p>
                                    </div>
                                    <ChevronRight className={`w-5 h-5 mt-1 sm:mt-0 text-white/30 transition-transform duration-300 shrink-0 ${isActOpen ? 'rotate-90' : ''}`} />
                                  </button>

                                  {/* 세션 목록 */}
                                  <AnimatePresence initial={false}>
                                    {isActOpen && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                                        className="border-t border-white/8 bg-white/3"
                                      >
                                        <div className="p-3 space-y-2">
                                          {activity.sessions.length === 0 ? (
                                            <p className="text-xs text-white/25 font-medium text-center py-4">
                                              아직 진행된 활동이 없습니다
                                            </p>
                                          ) : activity.sessions.map(session => {
                                            const canView = session.attendStatus === 'PRESENT' || session.attendStatus === 'LATE';
                                            return (
                                            <motion.button
                                              key={session.scheduleId}
                                              initial={{ opacity: 0, y: 4 }}
                                              animate={{ opacity: 1, y: 0 }}
                                              onClick={() => canView && setSelectedSession(session)}
                                              className={`w-full bg-black rounded-xl border border-white/8 px-4 py-3
                                                         flex items-center justify-between gap-3 transition-all text-left group
                                                         ${canView
                                                           ? 'hover:border-white/20 hover:bg-white/5 cursor-pointer'
                                                           : 'cursor-default opacity-60'}`}
                                            >
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full border ${TYPE_BADGE[session.type] ?? TYPE_BADGE.GENERAL}`}>
                                                    {TYPE_LABEL[session.type] ?? '활동'}
                                                  </span>
                                                  <span className="text-[10px] text-white/30 font-medium">
                                                    {fmtDate(session.date)}
                                                  </span>
                                                </div>
                                                <p className="text-sm font-black text-white truncate">{session.title}</p>
                                              </div>
                                              <div className="flex items-center gap-2 shrink-0">
                                                <AttendBadge status={session.attendStatus} />
                                                {canView && (
                                                  <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors" />
                                                )}
                                              </div>
                                            </motion.button>
                                            );
                                          })}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* 세션 상세 모달 */}
      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </div>
  );
}
