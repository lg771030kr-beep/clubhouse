import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDown, Activity, Calendar,
  FileText, Clock, Users, CheckCircle2, Loader2,
} from 'lucide-react';
import { BackButton } from '../../components/common/BackButton';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

/* ── 타입 ── */
interface ActivityItem {
  id: string;
  clubName: string;
  title: string;
  date: string;        // 'YYYY-MM-DD'
  displayDate: string; // 'YYYY. MM. DD'
  type: '출석' | '과제' | '행사';
  status: string;
}

/* ── 더미 데이터 (폴백) ── */
const DUMMY: ActivityItem[] = [
  { id: 'd1', clubName: '멋쟁이사자처럼', title: 'IT 서비스 개발 기획 회의', date: '2026-03-18', displayDate: '2026. 03. 18', type: '출석', status: '완료' },
  { id: 'd2', clubName: '멋쟁이사자처럼', title: 'UI/UX 워크샵',            date: '2026-03-16', displayDate: '2026. 03. 16', type: '행사', status: '완료' },
  { id: 'd3', clubName: 'GDSC',           title: '구글 솔루션 챌린지 킥오프',date: '2026-03-15', displayDate: '2026. 03. 15', type: '출석', status: '완료' },
  { id: 'd4', clubName: '멋쟁이사자처럼', title: '1주차 과제 제출',          date: '2026-03-14', displayDate: '2026. 03. 14', type: '과제', status: '완료' },
  { id: 'd5', clubName: 'UMC',            title: '안드로이드 스터디',         date: '2026-03-10', displayDate: '2026. 03. 10', type: '출석', status: '완료' },
  { id: 'd6', clubName: 'GDSC',           title: '알고리즘 과제',            date: '2026-03-08', displayDate: '2026. 03. 08', type: '과제', status: '완료' },
  { id: 'd7', clubName: 'UMC',            title: '1학기 OT',                date: '2026-03-02', displayDate: '2026. 03. 02', type: '행사', status: '완료' },
  { id: 'd8', clubName: '멋쟁이사자처럼', title: 'OT 및 신입생 환영회',      date: '2026-02-25', displayDate: '2026. 02. 25', type: '출석', status: '완료' },
];

/* ── 활동 유형 배지 ── */
const typeBadge: Record<ActivityItem['type'], string> = {
  출석: 'bg-white text-black',
  과제: 'bg-white/15 text-white border border-white/20',
  행사: 'bg-white/10 text-white/70 border border-white/15',
};

/* ── 동아리 첫글자 아바타 색 팔레트 ── */
const avatarPalette = [
  'bg-white/10', 'bg-white/15', 'bg-white/8',
  'bg-white/12', 'bg-white/20', 'bg-white/10',
];
function clubColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % avatarPalette.length;
  return avatarPalette[h];
}

/* ═══════════════════════════════════════════════
   Component
════════════════════════════════════════════════ */
export function MyActivities() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [activities,     setActivities]     = useState<ActivityItem[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [expandedClubs,  setExpandedClubs]  = useState<string[]>([]);

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
          .order('marked_at', { ascending: false })
          .limit(60);

        if (error || !data || data.length === 0) throw new Error('no data');

        const mapped: ActivityItem[] = (data as any[]).flatMap(r => {
          const sch = r.schedules;
          if (!sch) return [];
          const club = sch.clubs;
          const dateStr: string = sch.date ?? '';
          const typeMap: Record<string, ActivityItem['type']> = {
            ASSIGNMENT: '과제', BOTH: '과제', GENERAL: '출석',
          };
          return [{
            id:          r.id,
            clubName:    club?.name ?? '동아리',
            title:       sch.title  ?? '일정',
            date:        dateStr,
            displayDate: dateStr.replace(/-/g, '. '),
            type:        typeMap[sch.type ?? 'GENERAL'] ?? '출석',
            status:      r.status === 'PRESENT' ? '완료' : r.status === 'LATE' ? '지각' : '결석',
          }];
        });

        setActivities(mapped.length > 0 ? mapped : DUMMY);
        // 첫 번째 클럽 자동 펼침
        const firstClub = mapped[0]?.clubName;
        if (firstClub) setExpandedClubs([firstClub]);
      } catch {
        setActivities(DUMMY);
        setExpandedClubs(['멋쟁이사자처럼']);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [profile?.id]);

  const toggleClub = (name: string) =>
    setExpandedClubs(prev =>
      prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
    );

  /* ── 통계 계산 ── */
  const today7 = new Date();
  today7.setHours(23, 59, 59, 999);
  const ago7 = new Date(today7); ago7.setDate(today7.getDate() - 6);

  const weekly = activities.filter(a => {
    const d = new Date(a.date);
    return d >= ago7 && d <= today7;
  });

  const grouped: Record<string, ActivityItem[]> = {};
  for (const a of activities) {
    if (!grouped[a.clubName]) grouped[a.clubName] = [];
    grouped[a.clubName].push(a);
  }
  const clubs = Object.keys(grouped);

  return (
    <div className="min-h-screen bg-black font-sans pb-20 w-full mx-auto max-w-lg">

      {/* ── 헤더 ── */}
      <header className="bg-black px-6 py-4 flex flex-col gap-1 border-b border-white/10 sticky top-0 z-20">
        <BackButton onClick={() => navigate(-1)} />
        <h1 className="text-lg font-black text-white">포트폴리오 기록</h1>
      </header>

      <div className="p-6 space-y-8">

        {/* ── 이번 주 하이라이트 ── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="text-base font-black text-white mb-3 flex items-center gap-2">
            <span className="text-lg">🔥</span> 이번 주 하이라이트
          </h2>
          <div className="bg-black rounded-3xl border border-white/10 p-6 relative overflow-hidden">
            {/* 배경 장식 */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/3 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />

            <p className="text-white/50 font-medium text-xs mb-1">최근 7일간의 포트폴리오</p>
            <h3 className="text-xl font-black text-white mb-5">
              {loading ? '—' : `총 ${weekly.length}건의 기록`}
            </h3>

            <div className="flex gap-3">
              <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="flex items-center gap-1.5 mb-2 text-white/50 text-xs font-black">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 출석
                </div>
                <p className="text-2xl font-black text-white">
                  {loading ? '—' : weekly.filter(a => a.type === '출석').length}
                  <span className="text-sm ml-1 text-white/40">회</span>
                </p>
              </div>
              <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="flex items-center gap-1.5 mb-2 text-white/50 text-xs font-black">
                  <FileText className="w-3.5 h-3.5" /> 과제
                </div>
                <p className="text-2xl font-black text-white">
                  {loading ? '—' : weekly.filter(a => a.type === '과제').length}
                  <span className="text-sm ml-1 text-white/40">회</span>
                </p>
              </div>
              <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="flex items-center gap-1.5 mb-2 text-white/50 text-xs font-black">
                  <Calendar className="w-3.5 h-3.5" /> 행사
                </div>
                <p className="text-2xl font-black text-white">
                  {loading ? '—' : weekly.filter(a => a.type === '행사').length}
                  <span className="text-sm ml-1 text-white/40">회</span>
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── 로딩 ── */}
        {loading && (
          <div className="flex items-center justify-center py-12 gap-2 text-white/40">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-black">기록 불러오는 중...</span>
          </div>
        )}

        {/* ── 동아리별 기록 ── */}
        {!loading && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <h2 className="text-base font-black text-white mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-white/60" /> 소속 동아리별 기록
            </h2>

            {clubs.length === 0 ? (
              <div className="bg-black rounded-3xl border border-white/10 py-14 text-center">
                <Activity className="w-8 h-8 mx-auto mb-3 text-white/20" />
                <p className="text-sm font-black text-white/40">기록된 활동이 없습니다</p>
                <p className="text-xs text-white/25 mt-1">출결 체크나 과제를 완료하면 여기에 표시됩니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {clubs.map((clubName, ci) => {
                  const items      = grouped[clubName];
                  const isExpanded = expandedClubs.includes(clubName);
                  const bgCls      = clubColor(clubName);

                  const attendCount = items.filter(a => a.type === '출석').length;
                  const taskCount   = items.filter(a => a.type === '과제').length;
                  const eventCount  = items.filter(a => a.type === '행사').length;

                  return (
                    <motion.div
                      key={clubName}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: ci * 0.06 }}
                      className="bg-black rounded-[1.5rem] border border-white/10 overflow-hidden"
                    >
                      <button
                        onClick={() => toggleClub(clubName)}
                        className="w-full p-5 flex items-center justify-between hover:bg-white/3 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl ${bgCls} border border-white/10 flex items-center justify-center font-black text-white text-sm shrink-0`}>
                            {clubName.slice(0, 2)}
                          </div>
                          <div className="text-left">
                            <h3 className="font-black text-white text-sm">{clubName}</h3>
                            <p className="text-xs text-white/40 font-medium mt-0.5">
                              출석 {attendCount}회 · 과제 {taskCount}회 · 행사 {eventCount}회
                            </p>
                          </div>
                        </div>
                        <ChevronDown className={`w-5 h-5 text-white/30 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>

                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            className="border-t border-white/8"
                          >
                            <div className="p-3 space-y-2">
                              {items.map(a => (
                                <div
                                  key={a.id}
                                  className="bg-white/5 rounded-2xl border border-white/8 p-4 flex items-center justify-between"
                                >
                                  <div className="flex flex-col gap-1.5 min-w-0">
                                    <span className={`w-max text-[10px] font-black tracking-wider px-2 py-0.5 rounded-full ${typeBadge[a.type]}`}>
                                      {a.type} {a.status}
                                    </span>
                                    <p className="font-black text-white text-sm truncate">{a.title}</p>
                                    <div className="flex items-center gap-1.5 text-xs text-white/40 font-medium">
                                      <Clock className="w-3.5 h-3.5" />
                                      {a.displayDate}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.section>
        )}

      </div>
    </div>
  );
}
