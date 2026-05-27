import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown, ChevronRight, Award, Loader2,
  CheckCircle2, X, Plus, Paperclip, AlertCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { CreateActivityModal } from '../../components/CreateActivityModal';
import { ActivityDetailSheet } from './ActivityDetailSheet';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

/* ══════════════════════════════════════════
   타입
══════════════════════════════════════════ */
export interface SessionItem {
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

export interface ClubActivity {
  id: string;            // clubId_year
  clubId: string;
  clubName: string;
  clubRole: string;      // ADMIN | LEADER | CAPTAIN | MEMBER
  clubCategory?: string | null;
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

/* ══════════════════════════════════════════
   기존 활동 추가 모달
══════════════════════════════════════════ */
interface AddActivityModalProps { userId: string; onClose: () => void; }

function AddActivityModal({ userId, onClose }: AddActivityModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: '', orgName: '', startDate: '', endDate: '', description: '',
  });
  const [file,    setFile]    = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [done,    setDone]    = useState(false);

  /* ── 연관 활동 ── */
  type LinkedItem = { id: string; name: string; kind: 'club' | 'project' };
  const [linkedId,   setLinkedId]   = useState<string | null>(null);
  const [linkedKind, setLinkedKind] = useState<'club' | 'project' | null>(null);
  const [linkedList, setLinkedList] = useState<LinkedItem[]>([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [{ data: memberships }, { data: projects }] = await Promise.all([
        supabase.from('club_members').select('clubs(id, name)').eq('user_id', userId),
        supabase.from('projects').select('id, title').eq('created_by', userId)
          .order('created_at', { ascending: false }).limit(15),
      ]);

      const clubs = ((memberships ?? []) as { clubs: { id: string; name: string } | { id: string; name: string }[] | null }[])
        .map(m => (Array.isArray(m.clubs) ? m.clubs[0] : m.clubs))
        .filter(Boolean)
        .map(c => ({ id: c!.id, name: c!.name, kind: 'club' as const }));

      const projs = ((projects ?? []) as { id: string; title: string }[])
        .map(p => ({ id: p.id, name: p.title, kind: 'project' as const }));

      setLinkedList([...clubs, ...projs]);
    })();
  }, [userId]);

  const toggleLinked = (item: LinkedItem) => {
    if (linkedId === item.id) { setLinkedId(null); setLinkedKind(null); }
    else { setLinkedId(item.id); setLinkedKind(item.kind); }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) { setError('활동명을 입력해 주세요.'); return; }
    if (!userId) { setError('로그인 정보를 확인해 주세요.'); return; }

    setLoading(true);
    try {
      let fileUrl: string | null = null;

      /* 파일 업로드 */
      if (file) {
        const ext  = file.name.split('.').pop() ?? 'bin';
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('activity-files')
          .upload(path, file, { upsert: false });
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage
            .from('activity-files')
            .getPublicUrl(path);
          fileUrl = publicUrl;
        }
      }

      /* 활동 기록 저장 */
      const { error: dbErr } = await supabase.from('activity_logs').insert({
        user_id:   userId,
        title:     form.title.trim(),
        content:   JSON.stringify({
          orgName:     form.orgName,
          startDate:   form.startDate,
          endDate:     form.endDate,
          description: form.description,
          linkedId,
          linkedKind,
        }),
        image_url: fileUrl,
      });
      if (dbErr) throw dbErr;

      setDone(true);
    } catch {
      setError('저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
      />
      <motion.div
        key="sheet"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 360, damping: 34 }}
        className="fixed inset-x-0 bottom-0 z-50 bg-[#111] border-t border-white/10
                   rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col"
      >
        {/* 드래그 핸들 */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-1 shrink-0" />

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 shrink-0">
          <h3 className="text-base font-black text-white">기존 활동 추가</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {done ? (
          /* 완료 화면 */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
            <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-white font-black text-lg">추가 완료!</p>
              <p className="text-white/40 text-sm mt-1">활동이 기록에 저장되었습니다.</p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 w-full py-3 bg-white text-black font-black rounded-2xl text-sm hover:bg-white/90 transition-all"
            >
              확인
            </button>
          </div>
        ) : (
          /* 입력 폼 */
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle size={15} className="shrink-0" /> {error}
              </div>
            )}

            {/* 연관 활동 */}
            {linkedList.length > 0 && (
              <div className="space-y-2">
                <label className="text-white/50 text-xs font-black uppercase tracking-widest">연관 활동</label>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {linkedList.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleLinked(item)}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        linkedId === item.id
                          ? 'bg-white text-black'
                          : 'bg-white/8 text-white/60 border border-white/10 hover:bg-white/15'
                      }`}
                    >
                      <span>{item.kind === 'club' ? '🏫' : '📁'}</span>
                      <span className="max-w-[100px] truncate">{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 활동명 */}
            <div className="space-y-1.5">
              <label className="text-white/50 text-xs font-black uppercase tracking-widest">활동명 *</label>
              <input
                type="text" value={form.title} required
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="예) ○○ 공모전 참가, ○○ 자격증 취득"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3
                           text-white placeholder-white/25 text-sm outline-none
                           focus:border-white/30 focus:bg-white/[0.08] transition-all"
              />
            </div>

            {/* 기관/조직명 */}
            <div className="space-y-1.5">
              <label className="text-white/50 text-xs font-black uppercase tracking-widest">기관 / 조직명</label>
              <input
                type="text" value={form.orgName}
                onChange={e => setForm(p => ({ ...p, orgName: e.target.value }))}
                placeholder="예) 한국창업진흥원, ○○대학교"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3
                           text-white placeholder-white/25 text-sm outline-none
                           focus:border-white/30 focus:bg-white/[0.08] transition-all"
              />
            </div>

            {/* 기간 */}
            <div className="space-y-1.5">
              <label className="text-white/50 text-xs font-black uppercase tracking-widest">기간</label>
              <div className="flex items-center gap-2">
                <input
                  type="date" value={form.startDate}
                  onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3
                             text-white text-sm outline-none focus:border-white/30 transition-all
                             [color-scheme:dark]"
                />
                <span className="text-white/30 text-sm font-bold shrink-0">~</span>
                <input
                  type="date" value={form.endDate}
                  onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3
                             text-white text-sm outline-none focus:border-white/30 transition-all
                             [color-scheme:dark]"
                />
              </div>
            </div>

            {/* 활동 내용 */}
            <div className="space-y-1.5">
              <label className="text-white/50 text-xs font-black uppercase tracking-widest">활동 내용</label>
              <textarea
                rows={3} value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="활동 내용, 역할, 성과 등을 자유롭게 입력하세요"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3
                           text-white placeholder-white/25 text-sm outline-none resize-none
                           focus:border-white/30 focus:bg-white/[0.08] transition-all"
              />
            </div>

            {/* 파일 첨부 */}
            <div className="space-y-1.5">
              <label className="text-white/50 text-xs font-black uppercase tracking-widest">파일 첨부</label>
              <input ref={fileRef} type="file" onChange={handleFile} className="hidden"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip" />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl
                           bg-white/5 border border-dashed border-white/15
                           hover:bg-white/[0.08] hover:border-white/25 transition-all"
              >
                <Paperclip className="w-4 h-4 text-white/40 shrink-0" />
                <span className="text-sm text-white/50 truncate">
                  {file ? file.name : 'PDF, 이미지, 문서 파일 첨부'}
                </span>
                {file && (
                  <button type="button" onClick={e => { e.stopPropagation(); setFile(null); }}
                    className="ml-auto shrink-0 text-white/30 hover:text-white/60 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </button>
              <p className="text-white/25 text-xs pl-1">PDF · DOC · JPG · PNG · ZIP — 최대 10MB</p>
            </div>

            {/* 저장 버튼 */}
            <button
              type="submit" disabled={loading}
              className="w-full py-3.5 bg-white text-black font-black rounded-2xl text-sm
                         hover:bg-white/90 active:scale-[0.98] transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2 mt-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? '저장 중...' : '활동 추가하기'}
            </button>
          </form>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/* ══════════════════════════════════════════
   Component
══════════════════════════════════════════ */
export function Portfolio() {
  const { profile } = useAuth();
  const navigate    = useNavigate();
  const thisYear    = new Date().getFullYear();

  const [careerData,         setCareerData]         = useState<YearGroup[]>([]);
  const [loading,            setLoading]            = useState(true);
  const [expandedYears,      setExpandedYears]      = useState<string[]>([String(thisYear)]);
  const [selectedActivity,   setSelectedActivity]   = useState<ClubActivity | null>(null);
  const [showAddModal,       setShowAddModal]       = useState(false);
  const [showCreateModal,    setShowCreateModal]    = useState(false);

  /* ── 데이터 로드 ── */
  useEffect(() => {
    if (!profile?.id) return;
    load();
  }, [profile?.id]);

  async function load() {
    setLoading(true);
    try {
      const today = todayStr();

      /* 1. 유저가 가입한 동아리 + 역할 + 카테고리 */
      const { data: memberships, error: memErr } = await supabase
        .from('club_members')
        .select('club_id, role, clubs(id, name, category)')
        .eq('user_id', profile!.id);

      if (memErr || !memberships || memberships.length === 0) {
        setCareerData([]);
        return;
      }

      interface MembershipRow {
        club_id: string;
        role: string;
        clubs: { id: string; name: string; category?: string | null }
             | { id: string; name: string; category?: string | null }[]
             | null;
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

      // clubId → { name, role, category }
      const clubInfoMap: Record<string, { name: string; role: string; category?: string | null }> = {};
      (memberships as MembershipRow[]).forEach((m) => {
        const club = Array.isArray(m.clubs) ? m.clubs[0] : m.clubs;
        if (club) clubInfoMap[club.id] = { name: club.name, role: m.role, category: club.category };
      });
      const clubIds = Object.keys(clubInfoMap);

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
          const info = clubInfoMap[s.club_id];
          actMap.set(key, {
            id:           key,
            clubId:       s.club_id,
            clubName:     info?.name     ?? '동아리',
            clubRole:     info?.role     ?? 'MEMBER',
            clubCategory: info?.category ?? null,
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
          const key  = `${clubId}_${thisYear}`;
          const info = clubInfoMap[clubId];
          actMap.set(key, {
            id:           key,
            clubId,
            clubName:     info?.name     ?? '동아리',
            clubRole:     info?.role     ?? 'MEMBER',
            clubCategory: info?.category ?? null,
            year:         String(thisYear),
            isCompleted:  false,
            sessions:     [],
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

  return (
    <div className="min-h-screen bg-black font-sans w-full mx-auto max-w-lg relative pb-36">

      {/* ── 헤더 ── */}
      <header className="bg-black px-6 py-4 flex items-center justify-between border-b border-white/10 sticky top-0 z-20">
        <h1 className="text-lg font-black text-white">내 활동</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-black
                     font-black text-xs hover:bg-white/90 active:scale-[0.97] transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          새로운 활동 만들기
        </button>
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
                              const presentCount = activity.sessions.filter(s => s.attendStatus === 'PRESENT').length;
                              return (
                                <button
                                  key={activity.id}
                                  onClick={() => setSelectedActivity(activity)}
                                  className="w-full bg-white/5 rounded-2xl border border-white/8 p-4
                                             flex items-start sm:items-center justify-between
                                             hover:bg-white/8 hover:border-white/15 transition-colors text-left group"
                                >
                                  <div className="flex-1 pr-4">
                                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                                      {activity.isCompleted ? (
                                        <span className="bg-white text-black text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                          <CheckCircle2 className="w-3 h-3" /> 수료 완료
                                        </span>
                                      ) : (
                                        <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> 진행중
                                        </span>
                                      )}
                                      {['ADMIN', 'LEADER', 'CAPTAIN'].includes(activity.clubRole) ? (
                                        <span className="bg-white/15 text-white text-[10px] font-black px-2 py-0.5 rounded-full border border-white/25 shrink-0">Leader</span>
                                      ) : (
                                        <span className="bg-white/5 text-white/40 text-[10px] font-black px-2 py-0.5 rounded-full border border-white/10 shrink-0">부원</span>
                                      )}
                                      {activity.clubCategory && (
                                        <span className="text-[10px] text-white/30 font-bold shrink-0">{activity.clubCategory}</span>
                                      )}
                                      <span className="text-[11px] text-white/30 font-bold">{activity.year}년 활동</span>
                                    </div>
                                    <h4 className="font-black text-white text-sm">{activity.clubName}</h4>
                                    <p className="text-xs text-white/30 mt-0.5">
                                      동아리 · {activity.sessions.length}개 활동 · 출석 {presentCount}회
                                    </p>
                                  </div>
                                  <ChevronRight className="w-5 h-5 mt-1 sm:mt-0 text-white/30 group-hover:text-white/60 transition-colors shrink-0" />
                                </button>
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

      {/* 활동 상세 시트 */}
      <AnimatePresence>
        {selectedActivity && (
          <ActivityDetailSheet
            activity={selectedActivity}
            onClose={() => setSelectedActivity(null)}
          />
        )}
      </AnimatePresence>

      {/* 기존 활동 추가하기 모달 */}
      {showAddModal && (
        <AddActivityModal
          userId={profile?.id ?? ''}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* 새로운 활동 만들기 모달 */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateActivityModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => { setShowCreateModal(false); load(); }}
          />
        )}
      </AnimatePresence>

      {/* 하단 고정 버튼 */}
      <div className="fixed bottom-[4.5rem] left-0 right-0 px-4 z-30 pointer-events-none">
        <div className="max-w-lg mx-auto pointer-events-auto">
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl
                       bg-white/[0.07] border border-white/15 backdrop-blur-md
                       text-white font-black text-sm
                       hover:bg-white/[0.12] hover:border-white/25
                       active:scale-[0.98] transition-all"
          >
            <Paperclip className="w-4 h-4 text-white/60" />
            기존 활동 추가하기
          </button>
        </div>
      </div>
    </div>
  );
}
