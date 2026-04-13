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

/* ── 목 데이터 (Supabase fallback) ── */
const MOCK_ASSIGNMENTS: Assignment[] = [
  { id: 'mock_a1', title: '웹서버 구현 과제',    dueDate: '2026-03-18', totalMembers: 8 },
  { id: 'mock_a2', title: 'UI 컴포넌트 설계',   dueDate: '2026-03-25', totalMembers: 8 },
  { id: 'mock_a3', title: '데이터베이스 모델링', dueDate: '2026-04-01', totalMembers: 8 },
];

const SUBMISSIONS: Record<string, MemberSubmission[]> = {
  a1: [
    { id: 1, name: '김철수', studentId: '20210001', submittedAt: '2026-03-17 22:14', isSubmitted: true,
      fileName: 'webserver_kimcs.zip', fileSize: '2.4 MB',
      content: 'Node.js + Express로 REST API 서버를 구현했습니다.\n\n- GET /users, POST /users 엔드포인트 구현\n- JWT 인증 미들웨어 추가\n- PostgreSQL 연동 (pg 라이브러리 사용)\n\n실행 방법은 README.md를 참고해주세요.' },
    { id: 2, name: '이영희', studentId: '20210042', submittedAt: '2026-03-18 09:30', isSubmitted: true,
      fileName: 'hw1_leeyh.pdf', fileSize: '841 KB',
      content: 'FastAPI를 사용하여 Python 기반 웹서버를 구현하였습니다. 비동기 처리와 Pydantic 모델을 활용했습니다.' },
    { id: 3, name: '박민준', studentId: '20200118', submittedAt: null, isSubmitted: false },
    { id: 4, name: '최지은', studentId: '20220055', submittedAt: '2026-03-16 18:00', isSubmitted: true,
      fileName: 'server_choije.tar.gz', fileSize: '1.1 MB',
      content: 'Go언어의 net/http 패키지를 활용한 서버 구현입니다.\n라우팅은 gorilla/mux를 사용하였고, 미들웨어 체인을 직접 구성해봤습니다.' },
    { id: 5, name: '정현우', studentId: '20210099', submittedAt: null, isSubmitted: false },
    { id: 6, name: '한소희', studentId: '20230011', submittedAt: '2026-03-17 14:55', isSubmitted: true,
      fileName: 'hansh_webserver.zip', fileSize: '3.2 MB',
      content: 'Spring Boot로 MVC 패턴 기반 서버를 구현했습니다.\nJPA를 통한 ORM 연동과 Swagger API 문서 자동화까지 포함하였습니다.' },
    { id: 7, name: '윤서연', studentId: '20210077', submittedAt: null, isSubmitted: false },
    { id: 8, name: '강도현', studentId: '20200033', submittedAt: '2026-03-18 08:01', isSubmitted: true,
      fileName: 'kangdh_submission.zip', fileSize: '980 KB',
      content: 'Rust의 Actix-web 프레임워크로 구현했습니다. 처음 써보는 언어라 어려웠지만 성능이 좋아 만족스럽습니다.' },
  ],
  a2: [
    { id: 1, name: '김철수', studentId: '20210001', submittedAt: '2026-03-24 20:00', isSubmitted: true,
      fileName: 'ui_components_kimcs.zip', fileSize: '4.7 MB',
      content: 'React + TypeScript로 공통 UI 컴포넌트 라이브러리를 설계했습니다.\n\n- Button, Input, Modal, Toast 등 16개 컴포넌트\n- Storybook 문서화 완료\n- 다크모드 대응 (CSS Variables 사용)' },
    { id: 2, name: '이영희', studentId: '20210042', submittedAt: null, isSubmitted: false },
    { id: 3, name: '박민준', studentId: '20200118', submittedAt: '2026-03-23 11:30', isSubmitted: true,
      fileName: 'component_design_pmj.pdf', fileSize: '2.1 MB',
      content: 'Figma를 활용해 디자인 시스템을 먼저 구성한 뒤 컴포넌트를 개발했습니다. Atomic Design 원칙을 따랐습니다.' },
    { id: 4, name: '최지은', studentId: '20220055', submittedAt: null, isSubmitted: false },
    { id: 5, name: '정현우', studentId: '20210099', submittedAt: null, isSubmitted: false },
    { id: 6, name: '한소희', studentId: '20230011', submittedAt: '2026-03-22 17:10', isSubmitted: true,
      fileName: 'hansh_ui.zip', fileSize: '5.3 MB',
      content: 'Vue 3 Composition API로 재사용 가능한 컴포넌트를 구현했습니다. props/emits 타입 정의도 꼼꼼히 했습니다.' },
    { id: 7, name: '윤서연', studentId: '20210077', submittedAt: '2026-03-25 00:42', isSubmitted: true,
      fileName: 'yoonsy_components.zip', fileSize: '3.8 MB',
      content: '마감 직전에 제출해서 죄송합니다.\nSvelte로 구현했는데 번들 크기가 많이 작아져서 좋은 경험이었습니다.' },
    { id: 8, name: '강도현', studentId: '20200033', submittedAt: null, isSubmitted: false },
  ],
  a3: [
    { id: 1, name: '김철수', studentId: '20210001', submittedAt: null, isSubmitted: false },
    { id: 2, name: '이영희', studentId: '20210042', submittedAt: null, isSubmitted: false },
    { id: 3, name: '박민준', studentId: '20200118', submittedAt: null, isSubmitted: false },
    { id: 4, name: '최지은', studentId: '20220055', submittedAt: null, isSubmitted: false },
    { id: 5, name: '정현우', studentId: '20210099', submittedAt: null, isSubmitted: false },
    { id: 6, name: '한소희', studentId: '20230011', submittedAt: null, isSubmitted: false },
    { id: 7, name: '윤서연', studentId: '20210077', submittedAt: null, isSubmitted: false },
    { id: 8, name: '강도현', studentId: '20200033', submittedAt: null, isSubmitted: false },
  ],
};

/* ═══════════════════════════════════════════════
   Component
════════════════════════════════════════════════ */
export function AssignmentStatus() {
  /* ── DB 연동 상태 ── */
  const [assignments,      setAssignments]      = useState<Assignment[]>(MOCK_ASSIGNMENTS);
  const [memberRows,       setMemberRows]       = useState<MemberSubmission[]>([]);
  const [dbLoading,        setDbLoading]        = useState(true);
  const [rowsLoading,      setRowsLoading]      = useState(false);
  const [usingMock,        setUsingMock]        = useState(false);

  /* ── UI 상태 ── */
  const [selectedId,        setSelectedId]        = useState(MOCK_ASSIGNMENTS[0].id);
  const [search,            setSearch]            = useState('');
  const [reminded,          setReminded]          = useState<Set<number>>(new Set());
  const [allReminded,       setAllReminded]       = useState(false);
  const [modalUserId,       setModalUserId]       = useState<string | null>(null);
  const [submissionDetail,  setSubmissionDetail]  = useState<MemberSubmission | null>(null);

  /* ── URL 필터 ── */
  const [searchParams, setSearchParams] = useSearchParams();
  const filterPending = searchParams.get('filter') === 'pending';
  const clearFilter = () => { const p = new URLSearchParams(searchParams); p.delete('filter'); setSearchParams(p, { replace: true }); };

  /* ── assignments 목록 fetch ── */
  useEffect(() => {
    async function fetchAssignments() {
      setDbLoading(true);
      try {
        const { data, error } = await supabase
          .from('assignments')
          .select('id, title, due_date, club_id')
          .eq('is_active', true)
          .order('due_date', { ascending: false });

        if (!error && data && data.length > 0) {
          const mapped: Assignment[] = data.map((a: any) => ({
            id:           a.id,
            title:        a.title,
            dueDate:      a.due_date,
            totalMembers: 0,   // 멤버 수는 rows fetch 시 계산
            clubId:       a.club_id,
          }));
          setAssignments(mapped);
          setSelectedId(mapped[0].id);
          setUsingMock(false);
        } else {
          // assignments 테이블 미준비 → 목 데이터
          setUsingMock(true);
          setAssignments(MOCK_ASSIGNMENTS);
          setSelectedId(MOCK_ASSIGNMENTS[0].id);
        }
      } catch {
        setUsingMock(true);
        setAssignments(MOCK_ASSIGNMENTS);
        setSelectedId(MOCK_ASSIGNMENTS[0].id);
      } finally {
        setDbLoading(false);
      }
    }
    fetchAssignments();
  }, []);

  /* ── 선택된 과제의 멤버 제출 현황 fetch ── */
  const fetchMemberRows = useCallback(async (asgId: string, clubId?: string) => {
    if (usingMock || asgId.startsWith('mock_')) {
      // mock_a1 → a1, mock_a2 → a2 등으로 변환
      const mockKey = asgId.startsWith('mock_') ? asgId.replace('mock_', '') : asgId;
      setMemberRows(SUBMISSIONS[mockKey] ?? []);
      return;
    }
    setRowsLoading(true);
    try {
      // 1. 제출 목록
      const { data: subs } = await supabase
        .from('submissions')
        .select('user_id, content, file_url, file_name, file_size, submitted_at')
        .eq('assignment_id', asgId);
      const subMap = new Map((subs ?? []).map((s: any) => [s.user_id, s]));

      // 2. 클럽 멤버 (members 테이블 → 없으면 profiles 전체)
      let profiles: any[] = [];
      if (clubId) {
        const { data: memData } = await supabase
          .from('members')
          .select('user_id, profiles(id, full_name, email)')
          .eq('club_id', clubId);
        if (memData && memData.length > 0) {
          profiles = memData.map((m: any) => m.profiles).filter(Boolean);
        }
      }
      if (profiles.length === 0) {
        const { data: allP } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .order('created_at');
        profiles = allP ?? [];
      }

      // 3. 크로스 조인 → MemberSubmission[]
      const rows: MemberSubmission[] = profiles.map((p: any, i: number) => {
        const sub = subMap.get(p.id);
        return {
          id:          i + 1,
          userId:      p.id,
          name:        p.full_name ?? '멤버',
          studentId:   p.email    ?? p.id,
          submittedAt: sub ? new Date(sub.submitted_at).toLocaleString('ko-KR', { hour12: false }) : null,
          isSubmitted: !!sub,
          fileName:    sub?.file_name  ?? undefined,
          fileSize:    sub?.file_size  ?? undefined,
          content:     sub?.content    ?? undefined,
        };
      });

      // totalMembers 업데이트
      setAssignments(prev => prev.map(a =>
        a.id === asgId ? { ...a, totalMembers: rows.length } : a
      ));
      setMemberRows(rows);
    } catch {
      const mockKey = asgId.startsWith('mock_') ? asgId.replace('mock_', '') : asgId;
      setMemberRows(SUBMISSIONS[mockKey] ?? []);
    } finally {
      setRowsLoading(false);
    }
  }, [usingMock]);

  useEffect(() => {
    if (!selectedId) return;
    const found = assignments.find(a => a.id === selectedId);
    fetchMemberRows(selectedId, found?.clubId);
  }, [selectedId, fetchMemberRows]);   // ← assignments 제거: fetchMemberRows 내부에서 setAssignments 호출 → 무한루프 방지

  const assignment  = assignments.find(a => a.id === selectedId) ?? assignments[0] ?? { id: '', title: '', dueDate: '-', totalMembers: 0 };
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
  };

  /* 제출률 색상 - 모두 검은색 */
  const barColor =
    submitRate === 100 ? 'bg-black' :
    submitRate >= 60   ? 'bg-black'    : 'bg-black/60';

  /* 멤버 행 공통 컴포넌트 */
  const MemberRow = ({
    m, i, avatarGrad, rightSlot,
  }: {
    m: MemberSubmission; i: number;
    avatarGrad: string;
    rightSlot: React.ReactNode;
  }) => (
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

      {/* ══ 상단 헤더 배너 (White) ══ */}
      <div className="bg-white text-black pt-12 pb-16 px-6 shadow-sm" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <div className="relative z-10 max-w-5xl mx-auto">
          <BackButton to="/admin" className="mb-4" />
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <span className="inline-block mb-3 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase
                               bg-black/15 border border-black/20 text-black">
                Assignments
              </span>
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

        {/* ── 목 데이터 사용 중 배너 ── */}
        {!dbLoading && usingMock && (
          <div className="bg-black/5 border border-black/20 rounded-2xl px-5 py-3 flex items-center gap-2 text-xs font-black text-black/60">
            <span className="w-2 h-2 rounded-full bg-black/30 shrink-0" />
            assignments 테이블 미연결 — 목 데이터로 표시 중
          </div>
        )}

        {/* ── 필터 활성 배지 ── */}
        {!dbLoading && filterPending && (
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
        {!dbLoading && <motion.div
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
        </motion.div>}

        {/* ── 2-컬럼 그리드: 제출 완료 | 미제출 ── */}
        {!dbLoading && <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

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

            {submitted.length === 0 ? (
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
              {notSubmitted.length === 0 ? (
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

            {/* 행 로딩 오버레이 */}
            {rowsLoading && (
              <div className="py-10 flex items-center justify-center gap-2 text-black/40">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-black">불러오는 중...</span>
              </div>
            )}
          </motion.div>
        </div>}
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
