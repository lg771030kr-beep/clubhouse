import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, UserCheck, UserX, Clock3, CheckCircle2, XCircle,
  Mail, Users, ShieldCheck, Award, User as UserIcon,
  CalendarDays, ClipboardList, Loader2,
} from 'lucide-react';
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
const DonutChart = ({ records }: { records: AttendRecord[] }) => {
  const counts = {
    출석: records.filter(r => r.status === '출석').length,
    지각: records.filter(r => r.status === '지각').length,
    결석: records.filter(r => r.status === '결석').length,
  };
  const total = records.length || 1;
  const r = 32, cx = 40, cy = 40, sw = 8;
  const circ = 2 * Math.PI * r;
  const e = (counts.출석 / total) * circ;
  const j = (counts.지각  / total) * circ;
  const a = (counts.결석 / total) * circ;

  return (
    <div className="flex items-center gap-5">
      <svg width={80} height={80} className="shrink-0 -rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={sw} />
        {counts.출석 > 0 && <circle cx={cx} cy={cy} r={r} fill="none" stroke="#000000" strokeWidth={sw}
          strokeDasharray={`${e} ${circ}`} strokeDashoffset={0} />}
        {counts.지각 > 0 && <circle cx={cx} cy={cy} r={r} fill="none" stroke="#555555" strokeWidth={sw}
          strokeDasharray={`${j} ${circ}`} strokeDashoffset={-e} />}
        {counts.결석 > 0 && <circle cx={cx} cy={cy} r={r} fill="none" stroke="#aaaaaa" strokeWidth={sw}
          strokeDasharray={`${a} ${circ}`} strokeDashoffset={-(e + j)} />}
      </svg>
      <div className="space-y-1.5">
        {([
          { label: '출석', count: counts.출석, color: 'text-black',     dot: 'bg-black'    },
          { label: '지각', count: counts.지각,  color: 'text-black/60', dot: 'bg-black/50' },
          { label: '결석', count: counts.결석, color: 'text-black/40',  dot: 'bg-black/30' },
        ] as const).map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${item.dot}`} />
            <span className="text-xs text-black/50 w-7">{item.label}</span>
            <span className={`text-sm font-black ${item.color}`}>{item.count}</span>
            <span className="text-xs text-black/40">회</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const statusStyle = {
  출석: { bg: 'bg-black/8 text-black border border-black/15',         Icon: UserCheck },
  지각: { bg: 'bg-black/8 text-black/60 border border-black/15',     Icon: Clock3    },
  결석: { bg: 'bg-black/5 text-black/40 border border-black/10',     Icon: UserX     },
};

/* ── Props ── */
interface MemberDetailModalProps {
  userId: string | null;
  onClose: () => void;
}

/* ════════════════════════════════════════════════
   Modal Component
════════════════════════════════════════════════ */
export function MemberDetailModal({ userId, onClose }: MemberDetailModalProps) {
  const [member,        setMember]        = useState<MemberProfile | null>(null);
  const [attendRecords, setAttendRecords] = useState<AttendRecord[]>([]);
  const [assignRecords, setAssignRecords] = useState<AssignRecord[]>([]);
  const [loading,       setLoading]       = useState(false);

  /* body scroll lock */
  React.useEffect(() => {
    if (userId) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [userId]);

  /* ── Supabase fetch ── */
  useEffect(() => {
    if (!userId) {
      setMember(null);
      setAttendRecords([]);
      setAssignRecords([]);
      return;
    }

    async function load() {
      setLoading(true);
      try {
        // 1. 프로필
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name, email, role, created_at, univ_name, team_name')
          .eq('id', userId)
          .single();

        interface ProfileRow {
          full_name: string | null; email: string | null; role: string | null;
          created_at: string | null; univ_name: string | null; team_name: string | null;
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

        if (prof) {
          const p = prof as ProfileRow;
          setMember({
            name:     p.full_name ?? '멤버',
            email:    p.email     ?? '',
            role:     (p.role?.toUpperCase() as MemberProfile['role']) ?? 'USER',
            joinedAt: p.created_at ? p.created_at.substring(0, 10) : '',
            team:     p.team_name ?? p.univ_name ?? '',
          });
        }

        // 2. 출결 기록
        const { data: attData } = await supabase
          .from('attendance')
          .select('status, marked_at, schedules(title, date)')
          .eq('user_id', userId)
          .order('marked_at', { ascending: false })
          .limit(10);

        if (attData && attData.length > 0) {
          const statusMap: Record<string, AttendStatus> = { PRESENT: '출석', LATE: '지각', ABSENT: '결석' };
          setAttendRecords((attData as unknown as AttendanceWithSchedule[]).map(r => {
            const sched = Array.isArray(r.schedules) ? r.schedules[0] : r.schedules;
            return {
              date:    sched?.date  ?? '',
              session: sched?.title ?? '일정',
              status:  statusMap[r.status] ?? '결석',
              time:    r.marked_at
                ? new Date(r.marked_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
                : null,
            };
          }));
        }

        // 3. 과제 제출 현황 (submissions 테이블 optional)
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
                submittedAt: s.submitted_at
                  ? s.submitted_at.substring(0, 16).replace('T', ' ')
                  : null,
                score: s.score ?? null,
              };
            }));
          }
        } catch { /* submissions 테이블 없음 — 빈 상태 유지 */ }

      } catch { /* silent */ } finally {
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

  return (
    <AnimatePresence>
      {userId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">

          {/* ── Overlay ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* ── Modal Sheet ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 24 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{   opacity: 0, scale: 0.95, y: 16  }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            className="relative bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl
                       flex flex-col max-h-[90vh] overflow-hidden"
          >
            {/* ── Sticky 헤더 ── */}
            <div className="shrink-0 flex items-center justify-between px-7 py-5
                            border-b border-black/10 bg-white/95 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                {member && (
                  <div className={`w-10 h-10 rounded-xl ${avatarBg[member.role]}
                                   flex items-center justify-center text-white font-black text-lg shrink-0`}>
                    {member.name[0]}
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-black text-black leading-tight">
                    {member?.name ?? '부원 정보'}
                  </h2>
                  {member && <p className="text-xs text-black/40">{member.email}</p>}
                </div>
                {member && <RoleBadge role={member.role} />}
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-black/5 rounded-xl transition-colors ml-4 shrink-0"
                aria-label="닫기"
              >
                <X className="w-5 h-5 text-black/50" />
              </button>
            </div>

            {/* ── 스크롤 영역 ── */}
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="py-20 flex items-center justify-center gap-2 text-black/40">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-sm font-black">불러오는 중...</span>
                </div>
              ) : !member ? (
                <div className="py-20 text-center text-black/40">
                  <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="font-bold">부원 정보를 찾을 수 없습니다</p>
                </div>
              ) : (
                <div className="p-7 space-y-6">

                  {/* ── 프로필 요약 카드 ── */}
                  <div className="bg-black/3 rounded-2xl p-5 flex flex-col sm:flex-row items-center sm:items-start gap-5">
                    <div className={`w-16 h-16 rounded-2xl ${avatarBg[member.role]}
                                     flex items-center justify-center text-white text-2xl font-black shrink-0`}>
                      {member.name[0]}
                    </div>
                    <div className="flex-1 text-center sm:text-left space-y-1.5">
                      <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
                        <span className="text-xl font-black text-black">{member.name}</span>
                        <RoleBadge role={member.role} />
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center sm:justify-start text-sm text-black/50">
                        <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{member.email}</span>
                        {member.team && (
                          <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{member.team}</span>
                        )}
                        {member.joinedAt && (
                          <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />가입 {member.joinedAt}</span>
                        )}
                      </div>
                    </div>

                    {/* 미니 스탯 */}
                    <div className="flex sm:flex-col gap-2 shrink-0">
                      <div className="text-center px-3 py-2 bg-black/5 rounded-xl">
                        <p className="text-base font-black text-black">{attendRecords.filter(r => r.status === '출석').length}</p>
                        <p className="text-[10px] text-black/50 font-bold">출석</p>
                      </div>
                      <div className="text-center px-3 py-2 bg-black/5 rounded-xl">
                        <p className="text-base font-black text-black/50">{attendRecords.filter(r => r.status === '결석').length}</p>
                        <p className="text-[10px] text-black/40 font-bold">결석</p>
                      </div>
                      <div className="text-center px-3 py-2 bg-black/5 rounded-xl">
                        <p className="text-base font-black text-black">{submittedCount}/{assignRecords.length}</p>
                        <p className="text-[10px] text-black/50 font-bold">과제</p>
                      </div>
                    </div>
                  </div>

                  {/* ── 2분할: 출결 + 과제 ── */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                    {/* 출결 히스토리 */}
                    <div className="bg-white border border-black/10 rounded-2xl overflow-hidden">
                      <div className="px-5 py-4 border-b border-black/10">
                        <div className="flex items-center gap-2 mb-4">
                          <CalendarDays className="w-4 h-4 text-black/50" />
                          <span className="font-black text-black text-sm">출결 히스토리</span>
                          <span className="ml-auto text-xs text-black/40">최근 {attendRecords.length}회</span>
                        </div>
                        {attendRecords.length > 0
                          ? <DonutChart records={attendRecords} />
                          : <p className="text-xs text-black/40 font-bold">출결 기록이 없습니다</p>
                        }
                      </div>
                      {attendRecords.length > 0 && (
                        <ul className="divide-y divide-black/8 max-h-56 overflow-y-auto">
                          {attendRecords.map((rec, i) => {
                            const { bg, Icon } = statusStyle[rec.status];
                            return (
                              <li key={i} className="flex items-center justify-between px-5 py-2.5 hover:bg-black/3 transition-colors">
                                <div>
                                  <p className="text-sm font-bold text-black">{rec.session}</p>
                                  <p className="text-xs text-black/40">{rec.date}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {rec.time && <span className="text-xs text-black/40">{rec.time}</span>}
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${bg}`}>
                                    <Icon className="w-3 h-3" />{rec.status}
                                  </span>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    {/* 과제 제출 현황 */}
                    <div className="bg-white border border-black/10 rounded-2xl overflow-hidden">
                      <div className="px-5 py-4 border-b border-black/10">
                        <div className="flex items-center gap-2 mb-3">
                          <ClipboardList className="w-4 h-4 text-black/50" />
                          <span className="font-black text-black text-sm">과제 제출 현황</span>
                          <span className="ml-auto text-xs text-black/40">{submittedCount}/{assignRecords.length} 제출</span>
                        </div>
                        {assignRecords.length > 0 ? (
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-black/8 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.round(submittedCount / assignRecords.length * 100)}%` }}
                                transition={{ delay: 0.3, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                                className="h-full rounded-full bg-black"
                              />
                            </div>
                            <span className="text-xs font-black text-black/70 shrink-0">
                              {Math.round(submittedCount / assignRecords.length * 100)}%
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-black/40 font-bold">과제 기록이 없습니다</p>
                        )}
                      </div>
                      {assignRecords.length > 0 && (
                        <ul className="divide-y divide-black/8 max-h-64 overflow-y-auto">
                          {assignRecords.map((a, i) => (
                            <li key={i} className="flex items-start justify-between px-5 py-3 hover:bg-black/3 transition-colors">
                              <div className="flex items-start gap-2.5">
                                <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0
                                                ${a.isSubmitted ? 'bg-black/10' : 'bg-black/5'}`}>
                                  {a.isSubmitted
                                    ? <CheckCircle2 className="w-3 h-3 text-black" />
                                    : <XCircle      className="w-3 h-3 text-black/40" />}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-black leading-tight">{a.title}</p>
                                  <p className="text-xs text-black/40">마감 {a.dueDate}</p>
                                  {a.submittedAt && (
                                    <p className="text-xs text-black/60 mt-0.5">{a.submittedAt} 제출</p>
                                  )}
                                </div>
                              </div>
                              <div className="shrink-0 text-right ml-2">
                                {a.score !== null
                                  ? <span className="text-sm font-black text-black">{a.score}점</span>
                                  : a.isSubmitted
                                    ? <span className="text-xs text-black/40">채점 전</span>
                                    : <span className="text-xs font-bold text-black/40">미제출</span>
                                }
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
