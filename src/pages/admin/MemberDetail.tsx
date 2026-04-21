import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  UserCheck, UserX, Clock3, CheckCircle2, XCircle,
  Mail, Users, ShieldCheck, Award, User as UserIcon,
  CalendarDays, ClipboardList, Loader2,
} from 'lucide-react';
import { BackButton } from '../../components/common/BackButton';
import { supabase } from '../../lib/supabase';

/* ── 타입 ── */
interface MemberProfile {
  name: string; email: string; role: 'ADMIN' | 'LEADER' | 'USER';
  joinedAt: string; team: string;
}

type AttendStatus = '출석' | '지각' | '결석';
interface AttendRecord { date: string; session: string; status: AttendStatus; time: string | null; }
interface AssignRecord { title: string; dueDate: string; isSubmitted: boolean; submittedAt: string | null; score: number | null; }

/* ── RoleBadge ── */
const RoleBadge = ({ role }: { role: MemberProfile['role'] }) => {
  const map = {
    ADMIN:  { label: '운영진',   Icon: ShieldCheck },
    LEADER: { label: '팀장',     Icon: Award       },
    USER:   { label: '일반 부원', Icon: UserIcon    },
  };
  const { label, Icon } = map[role];
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-black/8 text-black border border-black/15">
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
};

/* ── DonutChart ── */
const AttendSummary = ({ records }: { records: AttendRecord[] }) => {
  const counts = {
    출석: records.filter(r => r.status === '출석').length,
    지각: records.filter(r => r.status === '지각').length,
    결석: records.filter(r => r.status === '결석').length,
  };
  const total = records.length || 1;
  const r = 36, cx = 44, cy = 44, sw = 8;
  const circ = 2 * Math.PI * r;
  const e = (counts.출석 / total) * circ;
  const j = (counts.지각  / total) * circ;
  const a = (counts.결석 / total) * circ;

  return (
    <div className="flex items-center gap-6">
      <svg width={88} height={88} className="shrink-0 -rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={sw} />
        {counts.출석 > 0 && <circle cx={cx} cy={cy} r={r} fill="none" stroke="#000000" strokeWidth={sw}
          strokeDasharray={`${e} ${circ}`} strokeDashoffset={0} />}
        {counts.지각 > 0 && <circle cx={cx} cy={cy} r={r} fill="none" stroke="#555555" strokeWidth={sw}
          strokeDasharray={`${j} ${circ}`} strokeDashoffset={-e} />}
        {counts.결석 > 0 && <circle cx={cx} cy={cy} r={r} fill="none" stroke="#aaaaaa" strokeWidth={sw}
          strokeDasharray={`${a} ${circ}`} strokeDashoffset={-(e + j)} />}
      </svg>
      <div className="space-y-1.5">
        {([
          { label: '출석', count: counts.출석, color: 'text-black',    dot: 'bg-black'    },
          { label: '지각', count: counts.지각,  color: 'text-black/60', dot: 'bg-black/50' },
          { label: '결석', count: counts.결석, color: 'text-black/40', dot: 'bg-black/30' },
        ] as const).map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${item.dot}`} />
            <span className="text-xs text-black/50 w-8">{item.label}</span>
            <span className={`text-sm font-black ${item.color}`}>{item.count}</span>
            <span className="text-xs text-black/40">회</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const statusStyle = {
  출석: { bg: 'bg-black/8 text-black border border-black/15',        Icon: UserCheck },
  지각: { bg: 'bg-black/8 text-black/60 border border-black/15',    Icon: Clock3    },
  결석: { bg: 'bg-black/5 text-black/40 border border-black/10',    Icon: UserX     },
};

/* ════════════════════════════════════════════════
   Page Component
════════════════════════════════════════════════ */
export function MemberDetail() {
  const { userId } = useParams<{ userId: string }>();

  const [member,        setMember]        = useState<MemberProfile | null>(null);
  const [attendRecords, setAttendRecords] = useState<AttendRecord[]>([]);
  const [assignRecords, setAssignRecords] = useState<AssignRecord[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [notFound,      setNotFound]      = useState(false);

  useEffect(() => {
    if (!userId) { setNotFound(true); setLoading(false); return; }

    async function load() {
      setLoading(true);
      try {
        // 1. 프로필
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name, email, role, created_at, univ_name')
          .eq('id', userId)
          .maybeSingle();

        if (!prof) { setNotFound(true); return; }

        interface ProfileRow {
          full_name: string | null; email: string | null; role: string | null;
          created_at: string | null; univ_name: string | null;
        }
        type SchedJoin = { title: string | null; date: string | null };
        interface AttendanceWithSchedule {
          status: string; marked_at: string | null;
          schedules: SchedJoin | SchedJoin[] | null;
        }
        type AssignJoin = { title: string | null; due_date: string | null };
        interface SubmissionWithAssignment {
          submitted_at: string | null; score: number | null;
          assignments: AssignJoin | AssignJoin[] | null;
        }

        const p = prof as ProfileRow;
        setMember({
          name:     p.full_name ?? '멤버',
          email:    p.email     ?? '',
          role:     (p.role as MemberProfile['role']) ?? 'USER',
          joinedAt: p.created_at ? p.created_at.substring(0, 10) : '',
          team:     p.univ_name  ?? '',
        });

        // 2. 출결 기록
        const { data: attData } = await supabase
          .from('attendance')
          .select('status, marked_at, schedules(title, date)')
          .eq('user_id', userId)
          .order('marked_at', { ascending: false })
          .limit(10);

        if (attData && attData.length > 0) {
          const sm: Record<string, AttendStatus> = { PRESENT: '출석', LATE: '지각', ABSENT: '결석' };
          setAttendRecords((attData as unknown as AttendanceWithSchedule[]).map(r => {
            const sched = Array.isArray(r.schedules) ? r.schedules[0] : r.schedules;
            return {
              date:    sched?.date  ?? '',
              session: sched?.title ?? '일정',
              status:  sm[r.status] ?? '결석',
              time:    r.marked_at
                ? new Date(r.marked_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
                : null,
            };
          }));
        }

        // 3. 과제 제출 (optional)
        try {
          const { data: subData, error: subErr } = await supabase
            .from('submissions')
            .select('submitted_at, score, assignments(title, due_date)')
            .eq('user_id', userId)
            .order('submitted_at', { ascending: false });

          if (!subErr && subData && subData.length > 0) {
            setAssignRecords((subData as unknown as SubmissionWithAssignment[]).map(s => {
              const assign = Array.isArray(s.assignments) ? s.assignments[0] : s.assignments;
              return {
                title:       assign?.title    ?? '과제',
                dueDate:     assign?.due_date ?? '',
                isSubmitted: true,
                submittedAt: s.submitted_at ? s.submitted_at.substring(0, 16).replace('T', ' ') : null,
                score:       s.score ?? null,
              };
            }));
          }
        } catch { /* submissions 테이블 없음 */ }

      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [userId]);

  const submittedCount = assignRecords.filter(a => a.isSubmitted).length;

  const avatarBg: Record<MemberProfile['role'], string> = {
    ADMIN:  'bg-black',
    LEADER: 'bg-black/70',
    USER:   'bg-black/50',
  };

  /* ── 로딩 ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-black/30" />
      </div>
    );
  }

  /* ── 없음 ── */
  if (notFound || !member) {
    return (
      <div className="min-h-screen bg-white px-4 pt-14">
        <BackButton to="/admin/members" label="부원 목록으로" />
        <div className="py-24 text-center text-black/40">
          <Users className="w-10 h-10 mx-auto mb-4 opacity-40" />
          <p className="font-black text-lg text-black">부원을 찾을 수 없습니다</p>
          <p className="text-sm mt-1 font-medium">userId: {userId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-4 pt-14 pb-16">
      <div className="max-w-4xl mx-auto space-y-6">
        <BackButton to="/admin/members" label="부원 목록으로" />

        {/* ── 프로필 요약 카드 ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="bg-white rounded-3xl border border-black/15 p-6 flex flex-col sm:flex-row items-center sm:items-start gap-5"
        >
          <div className={`w-20 h-20 rounded-2xl ${avatarBg[member.role]}
                           flex items-center justify-center text-white text-3xl font-black shrink-0`}>
            {member.name[0]}
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <h1 className="text-2xl font-black text-black">{member.name}</h1>
              <RoleBadge role={member.role} />
            </div>
            <div className="flex flex-wrap gap-3 justify-center sm:justify-start text-sm text-black/50">
              <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {member.email}</span>
              {member.team && <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {member.team}</span>}
              {member.joinedAt && <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> 가입 {member.joinedAt}</span>}
            </div>
          </div>

          <div className="flex sm:flex-col gap-3 sm:gap-2 shrink-0">
            <div className="text-center px-4 py-2 bg-black/5 rounded-xl">
              <p className="text-lg font-black text-black">{attendRecords.filter(r => r.status === '출석').length}</p>
              <p className="text-[10px] text-black/50 font-bold">출석</p>
            </div>
            <div className="text-center px-4 py-2 bg-black/5 rounded-xl">
              <p className="text-lg font-black text-black/50">{attendRecords.filter(r => r.status === '결석').length}</p>
              <p className="text-[10px] text-black/40 font-bold">결석</p>
            </div>
            <div className="text-center px-4 py-2 bg-black/5 rounded-xl">
              <p className="text-lg font-black text-black">{submittedCount}/{assignRecords.length}</p>
              <p className="text-[10px] text-black/50 font-bold">제출</p>
            </div>
          </div>
        </motion.div>

        {/* ── 2분할 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* 출결 히스토리 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="bg-white rounded-3xl border border-black/15 overflow-hidden flex flex-col"
          >
            <div className="px-6 py-5 border-b border-black/10">
              <div className="flex items-center gap-2 mb-4">
                <CalendarDays className="w-4 h-4 text-black/50" />
                <h2 className="font-black text-black">출결 히스토리</h2>
                <span className="ml-auto text-xs text-black/40">최근 {attendRecords.length}회</span>
              </div>
              {attendRecords.length > 0
                ? <AttendSummary records={attendRecords} />
                : <p className="text-xs text-black/40 font-bold">출결 기록이 없습니다</p>
              }
            </div>
            {attendRecords.length > 0 && (
              <ul className="divide-y divide-black/8 overflow-y-auto max-h-80">
                {attendRecords.map((r, i) => {
                  const { bg, Icon } = statusStyle[r.status];
                  return (
                    <motion.li key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      className="flex items-center justify-between px-6 py-3 hover:bg-black/3 transition-colors">
                      <div>
                        <p className="text-sm font-bold text-black">{r.session}</p>
                        <p className="text-xs text-black/40">{r.date}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.time && <span className="text-xs text-black/40">{r.time}</span>}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${bg}`}>
                          <Icon className="w-3 h-3" /> {r.status}
                        </span>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </motion.div>

          {/* 과제 제출 현황 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="bg-white rounded-3xl border border-black/15 overflow-hidden flex flex-col"
          >
            <div className="px-6 py-5 border-b border-black/10 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-black/50" />
              <h2 className="font-black text-black">과제 제출 현황</h2>
              <span className="ml-auto text-xs text-black/40">{submittedCount}/{assignRecords.length} 제출</span>
            </div>

            {assignRecords.length > 0 && (
              <div className="px-6 py-3 border-b border-black/8">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-black/8 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round(submittedCount / assignRecords.length * 100)}%` }}
                      transition={{ delay: 0.3, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full rounded-full bg-black"
                    />
                  </div>
                  <span className="text-sm font-black text-black shrink-0">
                    {Math.round(submittedCount / assignRecords.length * 100)}%
                  </span>
                </div>
              </div>
            )}

            {assignRecords.length === 0 ? (
              <div className="py-14 text-center text-black/40">
                <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs font-bold">과제 기록이 없습니다</p>
              </div>
            ) : (
              <ul className="divide-y divide-black/8 overflow-y-auto max-h-80">
                {assignRecords.map((a, i) => (
                  <motion.li key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                    className="flex items-start justify-between px-6 py-3.5 hover:bg-black/3 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0
                                       ${a.isSubmitted ? 'bg-black/10' : 'bg-black/5'}`}>
                        {a.isSubmitted
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                          : <XCircle      className="w-3.5 h-3.5 text-black/40" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-black">{a.title}</p>
                        <p className="text-xs text-black/40">마감 {a.dueDate}</p>
                        {a.submittedAt && <p className="text-xs text-black/60 mt-0.5">{a.submittedAt} 제출</p>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {a.score !== null
                        ? <span className="text-sm font-black text-black">{a.score}점</span>
                        : a.isSubmitted
                          ? <span className="text-xs text-black/40">채점 전</span>
                          : <span className="text-xs font-bold text-black/40">미제출</span>
                      }
                    </div>
                  </motion.li>
                ))}
              </ul>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
