import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Plus, Search, Loader2, CheckCircle2,
  Calendar, ChevronDown, Crown, Users, Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

/* ── 타입 ── */
interface Member {
  id: string;
  full_name: string;
  avatar_url?: string | null;
}

interface TeamData {
  id: string;
  name: string;
  leaderId: string;
  memberIds: string[];
}

interface Schedule {
  id: string;
  title: string;
  date: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  clubId: string | null;
}

/* ── 아바타 ── */
const Avatar: React.FC<{ member: Member; size?: number }> = ({ member, size = 28 }) => (
  <div
    style={{ width: size, height: size, minWidth: size }}
    className="rounded-full bg-black text-white flex items-center justify-center
               text-[10px] font-black overflow-hidden border-2 border-white shrink-0"
  >
    {member.avatar_url
      ? <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
      : member.full_name.slice(0, 1)
    }
  </div>
);

/* ════════════════════════════════════════════════════════ */
export function AdminCreateProjectModal({ open, onClose, onSuccess, clubId }: Props) {
  const { activeClubId } = useAuth();
  const cid = clubId ?? activeClubId;

  /* ── 기본 정보 ── */
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'draft' | 'closed'>('active');
  const [startDate,   setStartDate]   = useState('');
  const [endDate,     setEndDate]     = useState('');

  /* ── 관련 일정 ── */
  const [schedules,          setSchedules]          = useState<Schedule[]>([]);
  const [schedulesLoading,   setSchedulesLoading]   = useState(false);
  const [selectedSchedules,  setSelectedSchedules]  = useState<string[]>([]);
  const [scheduleOpen,       setScheduleOpen]       = useState(false);
  const [scheduleSearch,     setScheduleSearch]     = useState('');

  /* ── 팀 구성 ── */
  const [allMembers,    setAllMembers]    = useState<Member[]>([]);
  const [membersLoading,setMembersLoading]= useState(false);
  const [teams,         setTeams]         = useState<TeamData[]>([]);

  /* 팀별 검색 입력 */
  const [teamSearch, setTeamSearch] = useState<Record<string, string>>({});

  /* ── 제출 ── */
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);
  const [error,      setError]      = useState('');

  /* ── 데이터 로드 ── */
  const fetchData = useCallback(async () => {
    if (!cid) return;
    setMembersLoading(true);
    setSchedulesLoading(true);

    const [memberRes, scheduleRes] = await Promise.all([
      supabase
        .from('club_members')
        .select('profiles(id, full_name, avatar_url)')
        .eq('club_id', cid),
      supabase
        .from('schedules')
        .select('id, title, date')
        .eq('club_id', cid)
        .order('date', { ascending: false })
        .limit(60),
    ]);

    /* 멤버 */
    const members = ((memberRes.data ?? []) as any[])
      .map((m: any) => Array.isArray(m.profiles) ? m.profiles[0] : m.profiles)
      .filter(Boolean) as Member[];
    setAllMembers(members);
    setMembersLoading(false);

    /* 일정 */
    setSchedules((scheduleRes.data ?? []) as Schedule[]);
    setSchedulesLoading(false);
  }, [cid]);

  useEffect(() => {
    if (open) {
      fetchData();
      document.body.style.overflow = 'hidden';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open, fetchData]);

  /* ── 팀 헬퍼 ── */
  const addTeam = () => {
    const id = crypto.randomUUID();
    setTeams(prev => [...prev, { id, name: '', leaderId: '', memberIds: [] }]);
    setTeamSearch(prev => ({ ...prev, [id]: '' }));
  };

  const removeTeam = (id: string) => {
    setTeams(prev => prev.filter(t => t.id !== id));
    setTeamSearch(prev => { const next = { ...prev }; delete next[id]; return next; });
  };

  const updateTeam = (id: string, patch: Partial<TeamData>) =>
    setTeams(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));

  const addMemberToTeam = (teamId: string, memberId: string) => {
    setTeams(prev => prev.map(t =>
      t.id === teamId && !t.memberIds.includes(memberId)
        ? { ...t, memberIds: [...t.memberIds, memberId] }
        : t,
    ));
    setTeamSearch(prev => ({ ...prev, [teamId]: '' }));
  };

  const removeMemberFromTeam = (teamId: string, memberId: string) => {
    setTeams(prev => prev.map(t => {
      if (t.id !== teamId) return t;
      return {
        ...t,
        memberIds: t.memberIds.filter(id => id !== memberId),
        leaderId:  t.leaderId === memberId ? '' : t.leaderId,
      };
    }));
  };

  const toggleLeader = (teamId: string, memberId: string) => {
    setTeams(prev => prev.map(t => {
      if (t.id !== teamId) return t;
      return { ...t, leaderId: t.leaderId === memberId ? '' : memberId };
    }));
  };

  const toggleSchedule = (id: string) =>
    setSelectedSchedules(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );

  /* ── 유효성 검사 ── */
  const invalidTeams = teams.filter(t => t.memberIds.length < 2);
  const canSubmit =
    title.trim() &&
    description.trim() &&
    startDate &&
    teams.length > 0 &&
    invalidTeams.length === 0;

  /* ── 제출 ── */
  const handleSubmit = async () => {
    setError('');
    if (!title.trim())      { setError('프로젝트 이름을 입력해 주세요.'); return; }
    if (!description.trim()){ setError('프로젝트 소개를 입력해 주세요.'); return; }
    if (!startDate)         { setError('시작일을 선택해 주세요.'); return; }
    if (teams.length === 0) { setError('팀을 최소 1개 이상 만들어 주세요.'); return; }
    if (invalidTeams.length > 0) {
      setError(`"${invalidTeams[0].name || '이름 없는 팀'}" 팀은 2명 이상이어야 합니다.`);
      return;
    }

    setSubmitting(true);
    try {
      /* 1. 프로젝트 삽입 */
      const { data: inserted, error: pErr } = await supabase
        .from('projects')
        .insert({
          club_id:     cid,
          title:       title.trim(),
          description: description.trim(),
          status,
          start_date:  startDate,
          end_date:    endDate || null,
          is_personal: false,
        })
        .select('id')
        .single();

      if (pErr) throw pErr;
      const projectId = inserted.id;

      /* 2. 팀 정보 + 관련 일정 확장 컬럼 저장 (없으면 silent) */
      await supabase
        .from('projects')
        .update({
          teams:                teams.map(t => ({ ...t })),
          related_schedule_ids: selectedSchedules,
        })
        .eq('id', projectId)
        .then(() => {});

      /* 3. 모든 팀원 → activity_logs 동기화 */
      const allTeamMembers = teams.flatMap(t =>
        t.memberIds.map(uid => ({
          user_id:   uid,
          title:     title.trim(),
          image_url: null,
          content:   JSON.stringify({
            project_id:  projectId,
            club_id:     cid,
            role:        t.leaderId === uid ? 'leader' : 'member',
            type:        'team_project',
            description: description.trim(),
            startDate,
            endDate: endDate || null,
          }),
        })),
      );

      /* 중복 제거 (같은 멤버가 여러 팀에 있는 경우 leader 우선) */
      const dedupedMap = new Map<string, typeof allTeamMembers[0]>();
      for (const log of allTeamMembers) {
        const existing = dedupedMap.get(log.user_id);
        if (!existing) {
          dedupedMap.set(log.user_id, log);
        } else {
          const existingRole = JSON.parse(existing.content).role;
          const newRole      = JSON.parse(log.content).role;
          if (newRole === 'leader' && existingRole !== 'leader') {
            dedupedMap.set(log.user_id, log);
          }
        }
      }

      if (dedupedMap.size > 0) {
        await supabase.from('activity_logs').insert([...dedupedMap.values()]);
      }

      setDone(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
        reset();
      }, 1200);
    } catch (e: any) {
      setError(e.message ?? '저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setTitle(''); setDescription(''); setStatus('active');
    setStartDate(''); setEndDate('');
    setSelectedSchedules([]); setScheduleOpen(false); setScheduleSearch('');
    setTeams([]); setTeamSearch({}); setDone(false); setError('');
  };

  const handleClose = () => { onClose(); reset(); };

  /* ── 일정 필터 ── */
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = [...schedules].filter(s => s.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past     = [...schedules].filter(s => s.date <  today).sort((a, b) => b.date.localeCompare(a.date));
  const sortedSchedules = [...upcoming, ...past];
  const displaySchedules = scheduleSearch.trim()
    ? sortedSchedules.filter(s => s.title.toLowerCase().includes(scheduleSearch.toLowerCase()))
    : sortedSchedules;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      {/* 딤 */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* 모달 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{    opacity: 0, scale: 0.95, y: 16  }}
        transition={{ type: 'spring', damping: 28, stiffness: 360 }}
        className="relative w-full max-w-xl max-h-[92vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="shrink-0 flex items-center justify-between px-6 py-5 border-b border-black/8">
          <h2 className="text-lg font-black text-black">팀 프로젝트 등록하기</h2>
          <button type="button" onClick={handleClose}
            className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors">
            <X size={16} className="text-black/60" />
          </button>
        </div>

        {done ? (
          /* 완료 화면 */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 16, stiffness: 260 }}
              className="w-16 h-16 rounded-full bg-black flex items-center justify-center"
            >
              <CheckCircle2 className="w-8 h-8 text-white" />
            </motion.div>
            <p className="text-base font-black text-black">팀 프로젝트가 등록됐습니다!</p>
            <p className="text-sm text-black/40">팀원들의 포트폴리오에 자동으로 반영됩니다</p>
          </div>
        ) : (
          <>
            {/* 본문 */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {/* 에러 */}
              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
                  {error}
                </div>
              )}

              {/* ── 기본 정보 ── */}
              <section className="space-y-3">
                <p className="text-[11px] font-black text-black/40 uppercase tracking-widest">기본 정보</p>

                <input
                  required value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="프로젝트 이름 *"
                  className="w-full px-4 py-3 rounded-2xl bg-black/5 text-black
                             placeholder:text-black/30 text-sm font-bold outline-none
                             focus:bg-black/8 transition-colors"
                />

                <textarea
                  required value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="프로젝트 한 줄 소개 *"
                  rows={2}
                  className="w-full px-4 py-3 rounded-2xl bg-black/5 text-black
                             placeholder:text-black/30 text-sm font-medium outline-none
                             focus:bg-black/8 transition-colors resize-none"
                />

                {/* 상태 */}
                <div className="flex gap-2">
                  {(['active', 'draft', 'closed'] as const).map(s => {
                    const label = { active: '진행중', draft: '준비중', closed: '완료' }[s];
                    return (
                      <button key={s} type="button" onClick={() => setStatus(s)}
                        className={`flex-1 py-2.5 rounded-2xl text-xs font-black transition-colors ${
                          status === s ? 'bg-black text-white' : 'bg-black/5 text-black/40 hover:bg-black/10'
                        }`}>
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* 기간 */}
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-black/30 mb-1 ml-1">시작일 *</p>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-black/5 text-black text-sm font-medium
                                 outline-none focus:bg-black/8 transition-colors [color-scheme:light]" />
                  </div>
                  <span className="text-black/20 font-bold mt-5 shrink-0">~</span>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-black/30 mb-1 ml-1">종료일 (선택)</p>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-black/5 text-black text-sm font-medium
                                 outline-none focus:bg-black/8 transition-colors [color-scheme:light]" />
                  </div>
                </div>
              </section>

              {/* ── 관련 일정 ── */}
              <section>
                <button type="button"
                  onClick={() => setScheduleOpen(p => !p)}
                  className="w-full flex items-center justify-between mb-2 group"
                >
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-black text-black/40 uppercase tracking-widest">관련 일정</p>
                    {selectedSchedules.length > 0 && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-black text-white">
                        {selectedSchedules.length}개 선택
                      </span>
                    )}
                  </div>
                  <ChevronDown size={14} className={`text-black/30 transition-transform ${scheduleOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence initial={false}>
                  {scheduleOpen && (
                    <motion.div
                      key="sch" initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-2">
                        {/* 검색 */}
                        <div className="relative">
                          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30 pointer-events-none" />
                          <input
                            value={scheduleSearch} onChange={e => setScheduleSearch(e.target.value)}
                            placeholder="일정 검색..."
                            className="w-full pl-8 pr-4 py-2 rounded-xl bg-black/5 text-sm font-medium
                                       text-black placeholder:text-black/30 outline-none focus:bg-black/8 transition-colors"
                          />
                        </div>

                        {/* 목록 */}
                        <div className="rounded-2xl border border-black/8 overflow-hidden max-h-48 overflow-y-auto">
                          {schedulesLoading ? (
                            <div className="flex items-center justify-center py-6 gap-2 text-black/30">
                              <Loader2 size={14} className="animate-spin" />
                              <span className="text-xs">불러오는 중...</span>
                            </div>
                          ) : displaySchedules.length === 0 ? (
                            <p className="text-xs text-black/30 text-center py-6">
                              {scheduleSearch ? '검색 결과가 없습니다' : '등록된 일정이 없습니다'}
                            </p>
                          ) : displaySchedules.map(s => {
                            const checked   = selectedSchedules.includes(s.id);
                            const isPast    = s.date < today;
                            const dateLabel = (() => {
                              const d = new Date(s.date + 'T00:00:00');
                              return `${d.getMonth() + 1}/${d.getDate()}`;
                            })();
                            return (
                              <button key={s.id} type="button"
                                onClick={() => toggleSchedule(s.id)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5
                                           border-b border-black/5 last:border-0 text-left
                                           hover:bg-black/[0.03] transition-colors ${checked ? 'bg-black/[0.03]' : ''}`}
                              >
                                <div className={`w-4 h-4 rounded-[5px] border-2 flex items-center justify-center shrink-0 transition-colors ${
                                  checked ? 'bg-black border-black' : 'border-black/25'
                                }`}>
                                  {checked && (
                                    <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                                      <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  )}
                                </div>
                                <Calendar size={12} className={`shrink-0 ${isPast ? 'text-black/20' : 'text-black/40'}`} />
                                <span className={`text-sm font-bold flex-1 truncate ${isPast ? 'text-black/35' : 'text-black'}`}>
                                  {s.title}
                                </span>
                                <span className={`text-[11px] font-medium shrink-0 ${isPast ? 'text-black/20' : 'text-black/35'}`}>
                                  {dateLabel}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* ── 팀 구성 ── */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-black text-black/40 uppercase tracking-widest">팀 구성</p>
                    {teams.length > 0 && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-black/8 text-black/60">
                        {teams.length}팀
                      </span>
                    )}
                  </div>
                  <button type="button" onClick={addTeam}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black text-white
                               text-xs font-black hover:bg-black/80 transition-colors">
                    <Plus size={12} /> 팀 추가
                  </button>
                </div>

                {teams.length === 0 && (
                  <div className="rounded-2xl border-2 border-dashed border-black/10
                                  py-10 flex flex-col items-center justify-center gap-2">
                    <Users size={24} className="text-black/15" />
                    <p className="text-xs font-bold text-black/30">팀을 추가해 팀원을 구성하세요</p>
                    <p className="text-[11px] text-black/20">각 팀은 최소 2명 이상 필요합니다</p>
                  </div>
                )}

                <div className="space-y-3">
                  {teams.map((team, _ti) => {
                    const search = teamSearch[team.id] ?? '';
                    const teamMembers = allMembers.filter(m => team.memberIds.includes(m.id));
                    const filtered = allMembers.filter(m =>
                      !team.memberIds.includes(m.id) &&
                      m.full_name.toLowerCase().includes(search.toLowerCase()),
                    );
                    const isUnderMin = team.memberIds.length < 2 && team.memberIds.length > 0;

                    return (
                      <div key={team.id}
                        className="rounded-2xl border border-black/10 bg-black/[0.02] p-4 space-y-3">
                        {/* 팀 이름 + 삭제 */}
                        <div className="flex items-center gap-2">
                          <input
                            value={team.name}
                            onChange={e => updateTeam(team.id, { name: e.target.value })}
                            placeholder="팀 이름 (예: 개발팀, 디자인팀)"
                            className="flex-1 px-3 py-2 rounded-xl bg-white border border-black/10
                                       text-sm font-bold text-black placeholder:text-black/25
                                       outline-none focus:border-black/30 transition-colors"
                          />
                          <button type="button" onClick={() => removeTeam(team.id)}
                            className="p-2 rounded-xl hover:bg-red-50 text-black/25 hover:text-red-500 transition-colors">
                            <Trash2 size={15} />
                          </button>
                        </div>

                        {/* 선택된 팀원 칩 */}
                        {teamMembers.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {teamMembers.map(m => {
                              const isLeader = team.leaderId === m.id;
                              return (
                                <span key={m.id}
                                  className={`inline-flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-full
                                             text-xs font-bold transition-all ${
                                    isLeader
                                      ? 'bg-amber-400 text-black ring-2 ring-amber-300'
                                      : 'bg-black text-white'
                                  }`}>
                                  <Avatar member={m} size={22} />
                                  <span>{m.full_name}</span>
                                  {isLeader && <span className="text-[9px] opacity-60 font-black">Leader</span>}
                                  {/* 리더 토글 */}
                                  <button type="button" onClick={() => toggleLeader(team.id, m.id)}
                                    title={isLeader ? '리더 해제' : '리더로 지정'}
                                    className={`transition-colors ${
                                      isLeader ? 'text-black/50 hover:text-black' : 'text-white/30 hover:text-amber-300'
                                    }`}>
                                    <Crown size={11} />
                                  </button>
                                  {/* 제거 */}
                                  <button type="button" onClick={() => removeMemberFromTeam(team.id, m.id)}
                                    className="text-current/40 hover:text-current transition-colors ml-0.5">
                                    <X size={11} />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {/* 2명 미만 경고 */}
                        {isUnderMin && (
                          <p className="text-[11px] text-red-500/80 font-medium flex items-center gap-1">
                            <span>⚠️</span> 팀원을 {2 - team.memberIds.length}명 더 추가해 주세요
                          </p>
                        )}

                        {/* 멤버 검색 */}
                        <div className="relative">
                          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30 pointer-events-none" />
                          <input
                            value={search}
                            onChange={e => setTeamSearch(prev => ({ ...prev, [team.id]: e.target.value }))}
                            placeholder="팀원 이름으로 검색하여 추가"
                            className="w-full pl-8 pr-4 py-2 rounded-xl bg-white border border-black/10
                                       text-sm font-medium text-black placeholder:text-black/25
                                       outline-none focus:border-black/30 transition-colors"
                          />
                        </div>

                        {/* 검색 결과 */}
                        {search.trim() && (
                          <div className="rounded-xl border border-black/8 overflow-hidden max-h-32 overflow-y-auto bg-white">
                            {membersLoading ? (
                              <p className="text-xs text-black/30 text-center py-3">불러오는 중...</p>
                            ) : filtered.length === 0 ? (
                              <p className="text-xs text-black/30 text-center py-3">검색 결과 없음</p>
                            ) : filtered.slice(0, 6).map(m => (
                              <button key={m.id} type="button"
                                onClick={() => addMemberToTeam(team.id, m.id)}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5
                                           hover:bg-black/[0.04] transition-colors text-left
                                           border-b border-black/5 last:border-0">
                                <Avatar member={m} size={26} />
                                <span className="text-sm font-bold text-black flex-1">{m.full_name}</span>
                                <Plus size={13} className="text-black/25" />
                              </button>
                            ))}
                          </div>
                        )}

                        {/* 팀원 수 표시 */}
                        <p className={`text-[11px] font-bold ${
                          team.memberIds.length >= 2 ? 'text-black/30' : 'text-black/20'
                        }`}>
                          {team.memberIds.length}명 선택됨
                          {team.memberIds.length >= 2 && (
                            <span className="ml-1 text-emerald-500">✓ 최소 인원 충족</span>
                          )}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

            </div>

            {/* 푸터 */}
            <div className="shrink-0 flex gap-2.5 px-6 py-4 border-t border-black/8 bg-white">
              <button type="button" onClick={handleClose}
                className="flex-1 py-3 rounded-2xl border border-black/12 text-sm font-bold
                           text-black/50 hover:bg-black/5 hover:text-black transition-colors">
                취소
              </button>
              <button type="button" onClick={handleSubmit}
                disabled={submitting || !canSubmit}
                className="flex-[2] py-3 rounded-2xl bg-black text-white font-black text-sm
                           transition-all hover:bg-black/80
                           disabled:opacity-35 disabled:cursor-not-allowed
                           active:scale-[0.98] flex items-center justify-center gap-2">
                {submitting && <Loader2 size={15} className="animate-spin" />}
                {submitting ? '등록 중...' : '🚀 팀 프로젝트 등록하기'}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
