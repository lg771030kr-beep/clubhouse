import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Activity, Calendar, Award, CheckCircle2, Loader2 } from 'lucide-react';
import { BackButton } from '../../components/common/BackButton';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

/* ── 타입 ── */
interface PortfolioSession {
  title: string;
  date: string;
  status: string;
}

interface PortfolioActivity {
  id: string;
  title: string;   // 동아리명
  term: string;    // "2026년 활동"
  isCompleted: boolean;
  sessions: PortfolioSession[];
}

interface YearGroup {
  year: string;
  activities: PortfolioActivity[];
}

/* ── 더미 (폴백) ── */
const DUMMY_HISTORY: YearGroup[] = [
  {
    year: '2026',
    activities: [
      {
        id: 'c1', title: '멋쟁이사자처럼 13기 프론트엔드', term: '2026년 상반기', isCompleted: false,
        sessions: [
          { title: '1주차 OT',        date: '2026.03.02', status: '출석 완료' },
          { title: '2주차 UI/UX',     date: '2026.03.09', status: '과제 제출' },
          { title: '3주차 React 기초', date: '2026.03.16', status: '출석 완료' },
        ],
      },
    ],
  },
  {
    year: '2025',
    activities: [
      {
        id: 'c2', title: 'UMC 5기 안드로이드 워크북', term: '2025년 하반기', isCompleted: true,
        sessions: [
          { title: '1주차 코틀린',       date: '2025.09.10', status: '결석'      },
          { title: '8주차 네트워킹',     date: '2025.11.10', status: '출석 완료' },
          { title: '최종 프로젝트 발표', date: '2025.12.20', status: '수료'      },
        ],
      },
      {
        id: 'c3', title: 'GDSC 알고리즘 스터디', term: '2025년 2학기', isCompleted: true,
        sessions: [
          { title: 'DP 정복하기', date: '2025.10.15', status: '출석 완료' },
          { title: '그래프 이론', date: '2025.11.02', status: '출석 완료' },
        ],
      },
    ],
  },
];

/* ── 세션 상태 배지 색상 ── */
function statusCls(status: string) {
  if (status.includes('출석') || status.includes('수료'))
    return 'bg-white text-black border-transparent';
  if (status.includes('결석'))
    return 'bg-white/5 text-white/50 border-white/15';
  return 'bg-white/10 text-white/60 border-white/15';
}

/* ── DB 레코드 → YearGroup[] 변환 ── */
function buildCareerData(records: any[]): YearGroup[] {
  const actMap = new Map<string, {
    clubId: string; clubName: string; year: string;
    sessions: PortfolioSession[];
  }>();

  const statusLabel: Record<string, string> = {
    PRESENT: '출석 완료', ABSENT: '결석', LATE: '지각',
  };

  for (const r of records) {
    const sch  = r.schedules;
    if (!sch) continue;
    const club = sch.clubs;
    const year = (sch.date as string).substring(0, 4);
    const key  = `${club?.id ?? 'unk'}_${year}`;

    if (!actMap.has(key)) {
      actMap.set(key, { clubId: club?.id ?? 'unk', clubName: club?.name ?? '동아리', year, sessions: [] });
    }

    const sessionStatus =
      sch.type === 'ASSIGNMENT' || sch.type === 'BOTH'
        ? '과제 제출'
        : statusLabel[r.status] ?? '출석 완료';

    actMap.get(key)!.sessions.push({
      title:  sch.title ?? '일정',
      date:   (sch.date as string).replace(/-/g, '.'),
      status: sessionStatus,
    });
  }

  // 연도별 그루핑
  const yearMap = new Map<string, PortfolioActivity[]>();
  const thisYear = new Date().getFullYear();

  for (const [, val] of actMap) {
    if (!yearMap.has(val.year)) yearMap.set(val.year, []);
    // 세션을 날짜 순 정렬
    val.sessions.sort((a, b) => a.date.localeCompare(b.date));
    yearMap.get(val.year)!.push({
      id:          `${val.clubId}_${val.year}`,
      title:       val.clubName,
      term:        `${val.year}년 활동`,
      isCompleted: Number(val.year) < thisYear,
      sessions:    val.sessions,
    });
  }

  // 연도 내림차순
  return [...yearMap.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, activities]) => ({ year, activities }));
}

/* ═══════════════════════════════════════════════
   Component
════════════════════════════════════════════════ */
export function Portfolio() {
  const { profile } = useAuth();

  const [careerData,         setCareerData]         = useState<YearGroup[]>(DUMMY_HISTORY);
  const [loading,            setLoading]            = useState(true);
  const [expandedYears,      setExpandedYears]      = useState<string[]>(['2026', '2025']);
  const [expandedActivities, setExpandedActivities] = useState<string[]>([]);

  /* ── Supabase fetch ── */
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (!profile?.id) throw new Error('no profile');

        const { data, error } = await supabase
          .from('attendance')
          .select(`
            id, status, marked_at,
            schedules(id, title, type, date, clubs(id, name))
          `)
          .eq('user_id', profile.id)
          .order('marked_at', { ascending: false });

        if (error || !data || data.length === 0) throw new Error('empty');

        const built = buildCareerData(data as any[]);
        if (built.length > 0) {
          setCareerData(built);
          setExpandedYears([built[0].year]);   // 최신 연도 자동 펼침
        }
      } catch {
        /* 더미 유지 */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [profile?.id]);

  const toggleYear = (year: string) =>
    setExpandedYears(prev => prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]);

  const toggleActivity = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedActivities(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  };

  return (
    <div className="min-h-screen bg-black font-sans w-full mx-auto max-w-lg relative pb-10">

      {/* ── 헤더 ── */}
      <header className="bg-black px-6 py-4 flex flex-col gap-1 border-b border-white/10 sticky top-0 z-20">
        <BackButton />
        <h1 className="text-lg font-black text-white">포트폴리오</h1>
      </header>

      <div className="p-6 space-y-8">
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-lg font-black text-white mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-white/60" /> 나의 포트폴리오
          </h2>

          {/* 로딩 */}
          {loading && (
            <div className="flex items-center justify-center py-14 gap-2 text-white/40">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-black">기록 불러오는 중...</span>
            </div>
          )}

          {/* 포트폴리오 트리 */}
          {!loading && (
            <div className="space-y-4">
              {careerData.map(yearGroup => {
                const isYearExpanded = expandedYears.includes(yearGroup.year);
                return (
                  <div
                    key={yearGroup.year}
                    className="bg-black rounded-[1.5rem] border border-white/10 overflow-hidden"
                  >
                    {/* 연도 헤더 */}
                    <button
                      onClick={() => toggleYear(yearGroup.year)}
                      className="w-full p-5 flex items-center justify-between hover:bg-white/3 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 text-white flex items-center justify-center font-black text-sm">
                          {yearGroup.year}
                        </div>
                        <h3 className="font-black text-white text-left">{yearGroup.year}년 활동 기록</h3>
                      </div>
                      <ChevronDown className={`w-5 h-5 text-white/40 transition-transform duration-300 ${isYearExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence initial={false}>
                      {isYearExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                          className="border-t border-white/8"
                        >
                          <div className="p-3 space-y-3">
                            {yearGroup.activities.map(activity => {
                              const isActivityExpanded = expandedActivities.includes(activity.id);
                              return (
                                <div
                                  key={activity.id}
                                  className="bg-white/5 rounded-2xl border border-white/8 overflow-hidden"
                                >
                                  {/* 동아리 행 */}
                                  <button
                                    onClick={e => toggleActivity(activity.id, e)}
                                    className="w-full p-4 flex items-start sm:items-center justify-between hover:bg-white/5 transition-colors text-left"
                                  >
                                    <div className="flex-1 pr-4">
                                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                        {activity.isCompleted && (
                                          <span className="bg-white text-black text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                            <CheckCircle2 className="w-3 h-3" /> 수료 완료
                                          </span>
                                        )}
                                        <span className="text-[11px] text-white/40 font-bold">{activity.term}</span>
                                      </div>
                                      <h4 className="font-black text-white text-sm">{activity.title}</h4>
                                      <p className="text-xs text-white/30 mt-0.5">{activity.sessions.length}개 세션</p>
                                    </div>
                                    <ChevronRight
                                      className={`w-5 h-5 mt-1 sm:mt-0 text-white/30 transition-transform duration-300 shrink-0 ${isActivityExpanded ? 'rotate-90' : ''}`}
                                    />
                                  </button>

                                  {/* 세션 상세 */}
                                  <AnimatePresence initial={false}>
                                    {isActivityExpanded && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                                        className="border-t border-white/8 bg-white/3"
                                      >
                                        <div className="p-4 space-y-3">
                                          <h5 className="text-xs font-black text-white/40 mb-2 flex items-center gap-1.5">
                                            <Activity className="w-3.5 h-3.5" /> 세션 상세 기록
                                          </h5>
                                          {activity.sessions.map((session, idx) => (
                                            <div
                                              key={idx}
                                              className="bg-black p-3 rounded-xl border border-white/8 flex items-center justify-between"
                                            >
                                              <div>
                                                <p className="text-[13px] font-black text-white">{session.title}</p>
                                                <p className="text-[10px] text-white/40 font-medium mt-0.5 flex items-center gap-1">
                                                  <Calendar className="w-3 h-3" /> {session.date}
                                                </p>
                                              </div>
                                              <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${statusCls(session.status)}`}>
                                                {session.status}
                                              </span>
                                            </div>
                                          ))}
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
    </div>
  );
}
