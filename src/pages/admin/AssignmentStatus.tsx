import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ClipboardList, CheckCircle2, XCircle, ChevronDown, ChevronRight,
  Send, Bell, Search, Users, Calendar, FileText, Download, X, Loader2,
} from 'lucide-react';
import { BackButton } from '../../components/common/BackButton';
import { MemberDetailModal } from '../../components/admin/MemberDetailModal';
import { supabase } from '../../lib/supabase';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/* ── 타입 ── */
interface Assignment {
  id: string;
  title: string;
  dueDate: string;
  totalMembers: number;
  clubId?: string;
}

interface MemberSubmission {
  id: number;
  userId?: string;
  name: string;
  studentId: string;
  submittedAt: string | null;
  isSubmitted: boolean;
  fileName?: string;
  fileSize?: string;
  content?: string;
}

/* ── 제출 상세 팝업 ── */
function SubmissionModal({
  submission,
  assignmentTitle,
  onClose,
}: {
  submission: MemberSubmission | null;
  assignmentTitle: string;
  onClose: () => void;
}) {
  if (!submission) return null;
  return (
    <AnimatePresence>
      {submission && (
        <>
          {/* 오버레이 */}
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />
          {/* 모달 */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="fixed inset-x-4 bottom-0 sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2
                       sm:w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl z-50 overflow-hidden shadow-2xl"
          >
            {/* 헤더 */}
            <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-black/10">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-black flex items-center justify-center text-white text-base font-black shrink-0">
                  {submission.name[0]}
                </div>
                <div>
                  <p className="font-black text-black text-base leading-tight">{submission.name}</p>
                  <p className="text-xs text-black/50 mt-0.5">{submission.studentId}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-black/8 hover:bg-black/15 flex items-center justify-center transition-colors shrink-0 mt-0.5"
              >
                <X className="w-4 h-4 text-black" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
              {/* 제출 정보 */}
              <div className="flex items-center gap-2 text-xs text-black/60 font-medium bg-black/5 rounded-2xl px-4 py-2.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-black shrink-0" />
                <span className="font-black text-black">{assignmentTitle}</span>
                <span className="ml-auto shrink-0">제출: {submission.submittedAt}</span>
              </div>

              {/* 제출 파일 */}
              {submission.fileName && (
                <div>
                  <p className="text-xs font-black text-black/60 uppercase tracking-wider mb-2">첨부 파일</p>
                  <div className="flex items-center justify-between gap-3 border border-black/20 rounded-2xl px-4 py-3 hover:bg-black/5 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-black/8 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-black/70" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-black leading-tight">{submission.fileName}</p>
                        {submission.fileSize && (
                          <p className="text-[11px] text-black/50 mt-0.5">{submission.fileSize}</p>
                        )}
                      </div>
                    </div>
                    <button className="flex items-center gap-1 text-xs font-black text-black/60 hover:text-black px-2.5 py-1.5 rounded-xl hover:bg-black/10 transition-all shrink-0">
                      <Download className="w-3.5 h-3.5" />
                      다운로드
                    </button>
                  </div>
                </div>
              )}

              {/* 제출 내용 */}
              {submission.content && (
                <div>
                  <p className="text-xs font-black text-black/60 uppercase tracking-wider mb-2">제출 내용</p>
                  <div className="bg-black/5 rounded-2xl px-4 py-4 text-sm text-black/80 leading-relaxed whitespace-pre-wrap font-medium">
                    {submission.content}
                  </div>
                </div>
              )}

              {!submission.fileName && !submission.content && (
                <div className="py-6 text-center text-black/40">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-black">첨부 파일 또는 내용이 없습니다</p>
                </div>
              )}
            </div>

            {/* 하단 버튼 */}
            <div className="px-6 py-4 border-t border-black/10">
              <button
                onClick={onClose}
                className="w-full py-3 rounded-2xl bg-black text-white font-black text-sm hover:bg-black/90 transition-all active:scale-[0.98]"
              >
                닫기
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════
   Component
════════════════════════════════════════════════ */
export function AssignmentStatus() {
  const { activeClubId } = useAuth();

  /* ── DB 연동 상태 ── */
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [memberRows,  setMemberRows]  = useState<MemberSubmission[]>([]);
  const [dbLoading,   setDbLoading]   = useState(true);
  const [rowsLoading, setRowsLoading] = useState(false);

  /* ── UI 상태 ── */
  const [selectedId,       setSelectedId]       = useState('');
  const [search,           setSearch]           = useState('');
  const [reminded,         setReminded]         = useState<Set<number>>(new Set());
  const [allReminded,      setAllReminded]      = useState(false);
  const [modalUserId,      setModalUserId]      = useState<string | null>(null);
  const [submissionDetail, setSubmissionDetail] = useState<MemberSubmission | null>(null);

  /* ── URL 필터 ── */
  const [searchParams, setSearchParams] = useSearchParams();
  const filterPending = searchParams.get('filter') === 'pending';
  const clearFilter = () => {
    const p = new URLSearchParams(searchParams);
    p.delete('filter');
    setSearchParams(p, { replace: true });
  };

  /* ── 과제 일정 목록 fetch (schedules 테이블, type = ASSIGNMENT | BOTH) ── */
  useEffect(() => {
    if (!activeClubId) return;
    async function fetchAssignments() {
      setDbLoading(true);
      try {
        const { data, error } = await supabase
          .from('schedules')
          .select('id, title, date, club_id')
          .eq('club_id', activeClubId)
          .in('type', ['ASSIGNMENT', 'BOTH'])
          .order('date', { ascending: false });

        interface ScheduleRow {
          id: string;
          title: string;
          date: string | null;
          club_id: string | null;
        }
        if (!error && data && data.length > 0) {
          const mapped: Assignment[] = (data as ScheduleRow[]).map((s) => ({
            id:           s.id,
            title:        s.title,
            dueDate:      s.date ?? '-',
            totalMembers: 0,
            clubId:       s.club_id,
          }));
          setAssignments(mapped);
          setSelectedId(mapped[0].id);
        } else {
          setAssignments([]);
          setSelectedId('');
        }
      } catch (err) {
        console.error('[AssignmentStatus] schedules fetch 실패:', err);
        setAssignments([]);
        setSelectedId('');
      } finally {
        setDbLoading(false);
      }
    }
    fetchAssignments();
  }, [activeClubId]);

  /* ── 선택된 과제의 멤버 제출 현황 fetch ── */
  const fetchMemberRows = useCallback(async (scheduleId: string, clubId?: string) => {
    if (!scheduleId) return;
    setRowsLoading(true);
    try {
      // 1. submissions 테이블 — schedule_id 기준
      interface SubmissionRow {
        user_id: string;
        content: string | null;
        file_url: string | null;
        file_name: string | null;
        file_size: string | null;
        submitted_at: string;
      }
      const { data: subs } = await supabase
        .from('submissions')
        .select('user_id, content, file_url, file_name, file_size, submitted_at')
        .eq('schedule_id', scheduleId);
      const subMap = new Map((subs as SubmissionRow[] ?? []).map((s) => [s.user_id, s]));

      // 2. 해당 동아리 멤버 목록 (club_members → profiles)
      interface ProfileRow {
        id: string;
        full_name: string | null;
        email: string | null;
      }
      interface ClubMemberRow {
        user_id: string;
        profiles: ProfileRow | ProfileRow[] | null;
      }
      const cId = clubId ?? activeClubId;
      let profiles: ProfileRow[] = [];
      if (cId) {
        const { data: memData } = await supabase
          .from('club_members')
          .select('user_id, profiles(id, full_name, email)')
          .eq('club_id', cId);
        if (memData && memData.length > 0) {
          profiles = (memData as ClubMemberRow[]).map((m) => {
            const p = m.profiles;
            return Array.isArray(p) ? p[0] : p;
          }).filter((p): p is ProfileRow => p != null);
        }
      }

      // 3. 크로스 조인 → MemberSubmission[]
      const rows: MemberSubmission[] = profiles.map((p, i: number) => {
        const sub = subMap.get(p.id);
        return {
          id:          i + 1,
          userId:      p.id,
          name:        p.full_name ?? '멤버',
          studentId:   p.email    ?? p.id,
          submittedAt: sub
            ? new Date(sub.submitted_at).toLocaleString('ko-KR', { hour12: false })
            : null,
          isSubmitted: !!sub,
          fileName:    sub?.file_name ?? undefined,
          fileSize:    sub?.file_size ?? undefined,
          content:     sub?.content  ?? undefined,
        };
      });

      // totalMembers 업데이트
      setAssignments(prev =>
        prev.map(a => a.id === scheduleId ? { ...a, totalMembers: rows.length } : a)
      );
      setMemberRows(rows);
    } catch (err) {
      console.error('[AssignmentStatus] memberRows fetch 실패:', err);
      setMemberRows([]);
    } finally {
      setRowsLoading(false);
    }
  }, [activeClubId]);

  useEffect(() => {
    if (!selectedId) return;
    const found = assignments.find(a => a.id === selectedId);
    fetchMemberRows(selectedId, found?.clubId);
  }, [selectedId, fetchMemberRows]);  // assignments 제거: fetchMemberRows 내부에서 setAssignments 호출 → 무한루프 방지

  const assignment  = assignments.find(a => a.id === selectedId)
    ?? { id: '', title: '', dueDate: '-', totalMembers: 0 };
  const submissions = memberRows;

  const submitted    = submissions.filter(m => m.isSubmitted);
  const notSubmitted = submissions.filter(m => !m.isSubmitted).filter(
    m => m.name.includes(search) || m.studentId.includes(search)
  );
  const totalNotSubmitted = submissions.filter(m => !m.isSubmitted).length;

  const submitRate = submissions.length > 0
    ? Math.round((submitted.length / submissions.length) * 100)
    : 0;

  const sendRemind    = (id: number) => setReminded(prev => new Set([...prev, id]));
  const sendAllRemind = () => {
    setAllReminded(true);
    setReminded(new Set(notSubmitted.map(m => m.id)));
  };

  const onAssignmentChange = (val: string) => {
    setSelectedId(val);
    setSearch('');
    setAllReminded(false);
    setReminded(new Set());
    // 과제 변경 시 URL 필터 파라미터도 함께 클리어 (sync 유지)
    if (filterPending) clearFilter();
  };

  /* 제출률 색상 */
  const barColor =
    submitRate === 100 ? 'bg-black' :
    submitRate >= 60   ? 'bg-black'  : 'bg-black/60';

  /* 멤버 행 공통 컴포넌트 */
  const MemberRow: React.FC<{
    m: MemberSubmission; i: number;
    avatarGrad: string;
    rightSlot: React.ReactNode;
  }> = ({ m, i, avatarGrad, rightSlot }) => (
    <motion.li
      key={m.id}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ delay: i * 0.035 }}
      className="flex items-center justify-between px-6 py-4 hover:bg-black/5 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full ${avatarGrad}
                         flex items-center justify-center text-white text-sm font-black shrink-0 shadow-sm`}>
          {m.name[0]}
        </div>
        <div>
          <button
            onClick={() => setModalUserId(m.userId ?? null)}
            className="group flex items-center gap-0.5 font-black text-black text-sm
                       hover:text-black hover:bg-black/5 px-1.5 py-0.5 rounded-lg
                       transition-all -mx-1.5 active:scale-95"
          >
            {m.name}
            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
          </button>
          <p className="text-xs text-black/50 mt-0.5">{m.studentId}</p>
        </div>
      </div>
      {rightSlot}
    </motion.li>
  );

  return (
    <div className="min-h-screen bg-white pb-24">

      {/* ══ 상단 헤더 배너 ══ */}
      <div className="bg-white text-black pt-16 pb-16 px-6 shadow-sm" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <div className="relative z-10 max-w-5xl mx-auto">
          <BackButton to="/admin" className="mb-4" />
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                <ClipboardList className="w-8 h-8 opacity-90" />
                과제 제출 현황
              </h1>
              <p className="mt-1.5 text-black/70 text-sm font-medium">
                과제별 제출자·미제출자 명단을 확인하고 독촉 메시지를 보내세요.
              </p>
            </div>

            {/* 헤더 우측: 제출 요약 */}
            <div className="grid grid-cols-3 divide-x divide-black/20 bg-black/5 border border-black/20 rounded-2xl px-0 py-4 shrink-0">
              <div className="text-center px-4">
                <p className="text-2xl font-black text-black">{submitted.length}</p>
                <p className="text-[10px] text-black/70 font-black uppercase tracking-wider">제출</p>
              </div>
              <div className="text-center px-4">
                <p className="text-2xl font-black text-black">{totalNotSubmitted}</p>
                <p className="text-[10px] text-black/70 font-black uppercase tracking-wider">미제출</p>
              </div>
              <div className="text-center px-4">
                <p className="text-2xl font-black text-black">{submitRate}%</p>
                <p className="text-[10px] text-black/70 font-black uppercase tracking-wider">제출률</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ 콘텐츠 영역 ══ */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-8 relative z-20 space-y-5">

        {/* ── DB 로딩 중 스켈레톤 ── */}
        {dbLoading && (
          <div className="bg-white rounded-3xl border border-black/20 p-8 flex flex-col items-center gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-black/40" />
            <p className="text-sm font-black text-black/40">과제 목록을 불러오는 중...</p>
          </div>
        )}

        {/* ── 과제 없음 빈 상태 ── */}
        {!dbLoading && assignments.length === 0 && (
          <div className="bg-white rounded-3xl border border-black/20 py-20 flex flex-col items-center gap-3 text-center">
            <ClipboardList className="w-10 h-10 text-black/20" />
            <p className="text-base font-black text-black/40">등록된 과제가 없습니다</p>
            <p className="text-xs text-black/30 font-medium">
              일정 관리에서 과제 유형의 일정을 추가하면 여기에 표시됩니다.
            </p>
          </div>
        )}

        {/* ── 필터 활성 배지 ── */}
        {!dbLoading && filterPending && assignments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-5 py-3 bg-black border border-black rounded-2xl"
          >
            <span className="text-xs font-black text-white flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5" /> 필터: 미제출 과제
            </span>
            <button
              onClick={clearFilter}
              className="ml-auto flex items-center gap-1 text-[10px] font-black text-white/70 hover:text-white transition-colors"
            >
              <X className="w-3 h-3" /> 전체 보기
            </button>
          </motion.div>
        )}

        {/* ── 과제 선택 + 제출률 바 ── */}
        {!dbLoading && assignments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="bg-white rounded-3xl border border-black/20 p-5 space-y-4"
          >
            {/* 셀렉트 */}
            <div>
              <label className="text-xs font-black text-black/70 uppercase tracking-wider block mb-2">
                과제 선택
              </label>
              <div className="relative">
                <select
                  value={selectedId}
                  onChange={e => onAssignmentChange(e.target.value)}
                  className="w-full appearance-none bg-white border border-black/20 text-black
                             font-black py-3 pl-4 pr-10 rounded-2xl focus:outline-none
                             focus:ring-2 focus:ring-black/20 focus:border-black transition-all cursor-pointer"
                >
                  {assignments.map(a => (
                    <option key={a.id} value={a.id}>{a.title}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/60 pointer-events-none" />
              </div>
              <div className="flex items-center gap-4 mt-2.5 text-xs text-black/60 font-black">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> 마감: {assignment.dueDate}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> 총 {assignment.totalMembers}명
                </span>
              </div>
            </div>

            {/* 제출률 프로그레스 바 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-black text-black/70">전체 제출률</span>
                <span className="font-black text-black">{submitted.length} / {submissions.length}명</span>
              </div>
              <div className="w-full h-3 bg-black/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${submitRate}%` }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  className={`h-full rounded-full ${barColor}`}
                />
              </div>
              <div className="flex justify-between text-xs font-black">
                <span className="text-black/70">제출 {submitted.length}명</span>
                <span className="text-black">{submitRate}%</span>
                <span className="text-black/60">미제출 {totalNotSubmitted}명</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── 2-컬럼 그리드: 제출 완료 | 미제출 ── */}
        {!dbLoading && assignments.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* ── 제출 완료 카드 ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.07, ease: [0.22, 1, 0.36, 1] }}
              className="bg-white rounded-3xl border border-black/20 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-black/20 flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-black">
                  <CheckCircle2 className="w-4 h-4" /> 제출 완료
                </div>
                <span className="text-xs bg-black/8 text-black font-black px-2.5 py-0.5 rounded-full border border-black/20">
                  {submitted.length}명
                </span>
              </div>

              {rowsLoading ? (
                <div className="py-16 flex items-center justify-center gap-2 text-black/40">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm font-black">불러오는 중...</span>
                </div>
              ) : submitted.length === 0 ? (
                <div className="py-16 text-center text-black/50">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-black">아직 제출자가 없습니다</p>
                </div>
              ) : (
                <ul className="divide-y divide-black/20">
                  {submitted.map((m, i) => (
                    <motion.li
                      key={m.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ delay: i * 0.035 }}
                      onClick={() => setSubmissionDetail(m)}
                      className="flex items-center justify-between px-6 py-4 hover:bg-black/5 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white text-sm font-black shrink-0 shadow-sm">
                          {m.name[0]}
                        </div>
                        <div>
                          <p className="font-black text-black text-sm flex items-center gap-1">
                            {m.name}
                            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-60 -translate-x-1 group-hover:translate-x-0 transition-all" />
                          </p>
                          <p className="text-xs text-black/50 mt-0.5">{m.studentId}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-black/60 hidden sm:block font-medium">{m.submittedAt}</span>
                        <FileText className="w-3.5 h-3.5 text-black/30 group-hover:text-black/60 transition-colors shrink-0" />
                      </div>
                    </motion.li>
                  ))}
                </ul>
              )}
            </motion.div>

            {/* ── 미제출 카드 ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
              className={`bg-white rounded-3xl overflow-hidden transition-all duration-300 ${filterPending ? 'border-2 border-black shadow-md' : 'border border-black/20'}`}
            >
              {/* 카드 헤더 */}
              <div className="px-6 py-4 border-b border-black/20 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 font-black text-black">
                  <XCircle className="w-4 h-4" /> 미제출
                  <span className="text-xs bg-black/8 text-black font-black px-2.5 py-0.5 rounded-full border border-black/20 ml-1">
                    {totalNotSubmitted}명
                  </span>
                </div>
                <button
                  onClick={sendAllRemind}
                  disabled={allReminded || totalNotSubmitted === 0}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-black transition-all
                    ${allReminded
                      ? 'bg-black/5 text-black/40 cursor-not-allowed'
                      : 'bg-black text-white hover:bg-black/90 border border-black/20 active:scale-95'}`}
                >
                  <Bell className="w-3.5 h-3.5" />
                  {allReminded ? '전체 전송 완료' : '전체 독촉 전송'}
                </button>
              </div>

              {/* 검색 */}
              <div className="px-5 pt-4">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-black/50" />
                  <input
                    type="text"
                    placeholder="미제출자 검색..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-black/20 rounded-2xl text-black placeholder:text-black/50
                               text-sm outline-none focus:border-black focus:ring-2 focus:ring-black/20 transition-all"
                  />
                </div>
              </div>

              {/* 미제출 목록 */}
              <AnimatePresence mode="popLayout">
                {rowsLoading ? (
                  <div className="py-10 flex items-center justify-center gap-2 text-black/40">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm font-black">불러오는 중...</span>
                  </div>
                ) : notSubmitted.length === 0 ? (
                  <div className="py-14 text-center text-black/50">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-3" />
                    <p className="text-sm font-black">
                      {search ? '검색 결과가 없습니다' : '모든 부원이 제출 완료했습니다!'}
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-black/20 mt-2">
                    {notSubmitted.map((m, i) => (
                      <MemberRow
                        key={m.id} m={m} i={i}
                        avatarGrad="bg-black/60"
                        rightSlot={
                          <button
                            onClick={() => sendRemind(m.id)}
                            disabled={reminded.has(m.id)}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-black transition-all
                              ${reminded.has(m.id)
                                ? 'bg-black/5 text-black/40 cursor-not-allowed'
                                : 'bg-black text-white hover:bg-black/90 shadow-sm active:scale-95'}`}
                          >
                            <Send className="w-3 h-3" />
                            {reminded.has(m.id) ? '전송됨' : '독촉'}
                          </button>
                        }
                      />
                    ))}
                  </ul>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </div>

      {/* 부원 상세 모달 */}
      <MemberDetailModal userId={modalUserId} onClose={() => setModalUserId(null)} />

      {/* 제출 상세 팝업 */}
      <SubmissionModal
        submission={submissionDetail}
        assignmentTitle={assignment.title}
        onClose={() => setSubmissionDetail(null)}
      />
    </div>
  );
}
