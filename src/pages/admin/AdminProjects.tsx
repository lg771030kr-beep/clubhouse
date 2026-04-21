import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, X, Paperclip, ChevronLeft, ChevronRight,
  Rocket, Clock, CheckCircle2, XCircle, Upload, Search,
  Zap, Users, Hash, Calendar, ChevronDown, Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth,
         eachDayOfInterval, isSameMonth, isSameDay, isWithinInterval,
         startOfWeek, endOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { BackButton } from '../../components/common/BackButton';
import { EmptyState } from '../../components/common/EmptyState';

/* ══════════════════════════════════════════
   타입
══════════════════════════════════════════ */
interface Member {
  id: string;
  full_name: string;
  role?: string;
  avatar_url?: string;
}

interface Team {
  id: string;
  name: string;
  leaderId: string;
  memberIds: string[];
}

interface ScheduleItem {
  id: string;
  title: string;
  date: string;
  type?: string;
}

interface Project {
  id: string;
  title: string;
  emoji: string;
  description: string;
  detail: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'closed' | 'draft';
  thumbnail_url?: string;
  participants: Member[];
  techStack: string[];
  tags: string[];
  created_at: string;
  relatedScheduleIds?: string[];
  teams?: Team[];
}

/* ══════════════════════════════════════════
   유틸
══════════════════════════════════════════ */
const EMOJI_OPTIONS = ['📱','💻','🚀','🎨','📊','🔧','🌐','⚡','🎯','🏆','💡','🔬','🎬','📝','🛠️'];

/* ══════════════════════════════════════════
   미니 달력
══════════════════════════════════════════ */
function MiniCalendar({
  selectedStart, selectedEnd, onSelect,
}: {
  selectedStart: Date | null;
  selectedEnd: Date | null;
  onSelect: (d: Date) => void;
}) {
  const [viewMonth, setViewMonth] = useState(new Date());
  const monthStart = startOfMonth(viewMonth);
  const monthEnd   = endOfMonth(viewMonth);
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd     = endOfWeek(monthEnd,     { weekStartsOn: 0 });
  const days       = eachDayOfInterval({ start: calStart, end: calEnd });
  const isInRange = (d: Date) =>
    selectedStart && selectedEnd
      ? isWithinInterval(d, { start: selectedStart, end: selectedEnd })
      : false;

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => setViewMonth(subMonths(viewMonth, 1))}
          className="p-1 rounded-lg hover:bg-black/8 transition-colors">
          <ChevronLeft size={16} className="text-black/50" />
        </button>
        <span className="text-sm font-bold text-black">
          {format(viewMonth, 'yyyy년 M월', { locale: ko })}
        </span>
        <button type="button" onClick={() => setViewMonth(addMonths(viewMonth, 1))}
          className="p-1 rounded-lg hover:bg-black/8 transition-colors">
          <ChevronRight size={16} className="text-black/50" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['일','월','화','수','목','금','토'].map(d => (
          <div key={d} className="text-center text-[11px] font-bold text-black/40 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map(day => {
          const isStart = selectedStart && isSameDay(day, selectedStart);
          const isEnd   = selectedEnd   && isSameDay(day, selectedEnd);
          const inRange = isInRange(day);
          const isThis  = isSameMonth(day, viewMonth);
          return (
            <button type="button" key={day.toISOString()} onClick={() => onSelect(day)}
              className={[
                'text-xs h-7 w-full rounded-lg transition-colors font-medium',
                !isThis ? 'text-black/20' : 'text-black/70',
                (isStart || isEnd) ? 'bg-black !text-white font-bold'
                  : inRange ? 'bg-black/10 text-black'
                  : 'hover:bg-black/8',
              ].join(' ')}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   상태 뱃지
══════════════════════════════════════════ */
function StatusBadge({ status }: { status: Project['status'] }) {
  const map = {
    active: { label: '진행중', cls: 'bg-black text-white',        icon: CheckCircle2 },
    closed: { label: '완료',   cls: 'bg-black/8 text-black/60 border border-black/15', icon: XCircle      },
    draft:  { label: '준비중', cls: 'bg-black/8 text-black/60 border border-black/15', icon: Clock        },
  } as const;
  const { label, cls, icon: Icon } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${cls}`}>
      <Icon size={11} />{label}
    </span>
  );
}

/* ══════════════════════════════════════════
   참가자 아바타
══════════════════════════════════════════ */
const Avatar: React.FC<{ member: Member; size?: 'sm' | 'md' }> = ({ member, size = 'sm' }) => {
  const s = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs';
  return (
    <div className={`${s} rounded-full bg-black text-white font-bold flex items-center justify-center shrink-0 border-2 border-white overflow-hidden`}>
      {member.avatar_url
        ? <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
        : member.full_name.slice(0, 1)
      }
    </div>
  );
};

/* ══════════════════════════════════════════
   새 프로젝트 모달
══════════════════════════════════════════ */
function CreateModal({
  open, onClose, onSubmit, isSubmitting, clubId,
}: {
  open: boolean; onClose: () => void;
  onSubmit: (data: Omit<Project, 'id' | 'created_at'>) => void;
  isSubmitting: boolean;
  clubId: string | null;
}) {
  /* 폼 상태 */
  const [title,        setTitle]        = useState('');
  const [emoji,        setEmoji]        = useState('📱');
  const [showEmoji,    setShowEmoji]    = useState(false);
  const [description,  setDescription]  = useState('');
  const [detail,       setDetail]       = useState('');
  const [status,       setStatus]       = useState<Project['status']>('active');
  const [startDate,    setStartDate]    = useState<Date | null>(null);
  const [endDate,      setEndDate]      = useState<Date | null>(null);
  const [dateStep,     setDateStep]     = useState<'start' | 'end'>('start');
  const [techInput,    setTechInput]    = useState('');
  const [techStack,    setTechStack]    = useState<string[]>([]);
  const [tagsInput,    setTagsInput]    = useState('');
  const [thumbnail,    setThumbnail]    = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [attachments,  setAttachments]  = useState<File[]>([]);

  /* 팀원 */
  const [allMembers,       setAllMembers]       = useState<Member[]>([]);
  const [memberQuery,      setMemberQuery]      = useState('');
  const [selectedMembers,  setSelectedMembers]  = useState<Member[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(false);

  /* 관련 일정 */
  const [allSchedules,       setAllSchedules]       = useState<ScheduleItem[]>([]);
  const [relatedScheduleIds, setRelatedScheduleIds] = useState<string[]>([]);
  const [schedulesLoading,   setSchedulesLoading]   = useState(false);
  const [scheduleSearch,     setScheduleSearch]     = useState('');
  const [scheduleOpen,       setScheduleOpen]       = useState(true);

  /* 팀 구성 */
  const [teams,             setTeams]             = useState<Team[]>([]);
  const [teamMemberSearch,  setTeamMemberSearch]  = useState<Record<string, string>>({});
  const [teamMemberOpen,    setTeamMemberOpen]    = useState<Record<string, boolean>>({});

  const thumbRef  = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLInputElement>(null);

  const parsedTags = tagsInput.split(/[,#\s]+/).map(t => t.trim()).filter(Boolean);

  /* ── 멤버 로드 ── */
  const fetchMembers = useCallback(async () => {
    setIsMembersLoading(true);
    try {
      if (clubId) {
        const { data } = await supabase
          .from('club_members')
          .select('user_id, profiles(id, full_name, role, avatar_url)')
          .eq('club_id', clubId);
        interface MemberJoinRow { profiles: Member | Member[] | null; }
        if (data && data.length > 0) {
          const members = (data as MemberJoinRow[]).map((d) => {
            const p = d.profiles;
            return Array.isArray(p) ? p[0] : p;
          }).filter((p): p is Member => p != null);
          setAllMembers(members);
          return;
        }
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, avatar_url')
        .order('full_name');
      if (!error && data) setAllMembers(data as Member[]);
    } catch {
      /* 빈 목록 유지 */
    } finally {
      setIsMembersLoading(false);
    }
  }, [clubId]);

  /* ── 일정 로드 ── */
  const fetchSchedules = useCallback(async () => {
    if (!clubId) return;
    setSchedulesLoading(true);
    try {
      const { data } = await supabase
        .from('schedules')
        .select('id, title, date, type')
        .eq('club_id', clubId)
        .order('date', { ascending: false })
        .limit(60);
      setAllSchedules(data ?? []);
    } catch { /* silent */ } finally {
      setSchedulesLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    if (open) {
      fetchMembers();
      fetchSchedules();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open, fetchMembers, fetchSchedules]);

  const filteredMembers = allMembers.filter(m =>
    m.full_name.includes(memberQuery) && !selectedMembers.some(s => s.id === m.id),
  );

  const filteredSchedules = allSchedules.filter(s =>
    s.title.toLowerCase().includes(scheduleSearch.toLowerCase()),
  );

  /* 오늘 기준 가까운 순 정렬 → 다가오는 5개 우선, 부족하면 지난 일정으로 채움 */
  const _todayStr = new Date().toISOString().slice(0, 10);
  const _upcoming = [...allSchedules]
    .filter(s => s.date >= _todayStr)
    .sort((a, b) => a.date.localeCompare(b.date));
  const _past = [...allSchedules]
    .filter(s => s.date < _todayStr)
    .sort((a, b) => b.date.localeCompare(a.date));
  const recentSchedules = [..._upcoming, ..._past].slice(0, 5);
  const displaySchedules = scheduleSearch.trim() ? filteredSchedules : recentSchedules;

  const reset = () => {
    setTitle(''); setEmoji('📱'); setShowEmoji(false);
    setDescription(''); setDetail(''); setStatus('active');
    setStartDate(null); setEndDate(null); setDateStep('start');
    setTechInput(''); setTechStack([]); setTagsInput('');
    setThumbnail(null); setThumbPreview(null); setAttachments([]);
    setSelectedMembers([]); setMemberQuery('');
    setRelatedScheduleIds([]); setScheduleSearch(''); setScheduleOpen(true);
    setTeams([]); setTeamMemberSearch({}); setTeamMemberOpen({});
  };

  const handleClose = () => { onClose(); reset(); };

  const handleDateSelect = (day: Date) => {
    if (dateStep === 'start') {
      setStartDate(day); setEndDate(null); setDateStep('end');
    } else {
      if (startDate && day < startDate) {
        setStartDate(day); setEndDate(null); setDateStep('end');
      } else {
        setEndDate(day);
      }
    }
  };

  const addTech = () => {
    const t = techInput.trim();
    if (t && !techStack.includes(t)) setTechStack(prev => [...prev, t]);
    setTechInput('');
  };

  /* ── 팀 관련 헬퍼 ── */
  const addTeam = () => {
    const id = crypto.randomUUID();
    setTeams(prev => [...prev, { id, name: '', leaderId: '', memberIds: [] }]);
  };
  const removeTeam = (idx: number) => setTeams(prev => prev.filter((_, i) => i !== idx));
  const updateTeam = (idx: number, updates: Partial<Team>) =>
    setTeams(prev => prev.map((t, i) => i === idx ? { ...t, ...updates } : t));
  const toggleTeamMember = (idx: number, memberId: string) =>
    setTeams(prev => prev.map((t, i) => {
      if (i !== idx) return t;
      const has = t.memberIds.includes(memberId);
      return { ...t, memberIds: has ? t.memberIds.filter(id => id !== memberId) : [...t.memberIds, memberId] };
    }));

  /* ── 일정 체크박스 토글 ── */
  const toggleSchedule = (id: string) =>
    setRelatedScheduleIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !detail || !startDate || selectedMembers.length < 2) return;
    onSubmit({
      title, emoji, description, detail, status,
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date:   endDate ? format(endDate, 'yyyy-MM-dd') : '',
      thumbnail_url: thumbPreview ?? undefined,
      participants: selectedMembers,
      techStack,
      tags: parsedTags,
      relatedScheduleIds,
      teams,
    });
    reset();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-2xl max-h-[92vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden">

        {/* 헤더 */}
        <div className="shrink-0 flex items-center justify-between px-6 py-5 border-b border-black/10">
          <div>
            <h2 className="text-lg font-black text-black">새 프로젝트 만들기</h2>
          </div>
          <button type="button" onClick={handleClose}
            className="p-2 hover:bg-black/8 rounded-xl transition-colors">
            <X size={20} className="text-black/50" />
          </button>
        </div>

        {/* 본문 */}
        <form onSubmit={handleSubmit} className="flex flex-1 overflow-hidden">

          {/* ── 입력 폼 ── */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* 제목 정보 */}
            <div>
              <p className="text-[11px] font-black text-black/40 uppercase tracking-widest mb-3">제목 정보</p>
              <div className="space-y-3">

                {/* 이모지 + 프로젝트 이름 */}
                <div className="flex gap-2 items-start">
                  <div className="relative shrink-0">
                    <button type="button"
                      onClick={() => setShowEmoji(v => !v)}
                      className="w-12 h-12 rounded-2xl bg-black/5 text-2xl flex items-center justify-center hover:bg-black/10 transition-colors">
                      {emoji}
                    </button>
                    {showEmoji && (
                      <div className="absolute top-full left-0 mt-1 z-10 bg-white rounded-2xl shadow-xl border border-black/10 p-2 grid grid-cols-5 gap-1 w-48">
                        {EMOJI_OPTIONS.map(e => (
                          <button key={e} type="button"
                            onClick={() => { setEmoji(e); setShowEmoji(false); }}
                            className="text-lg h-8 w-8 rounded-lg hover:bg-black/8 flex items-center justify-center transition-colors">
                            {e}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    required value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="프로젝트 이름"
                    className="flex-1 px-4 py-3 rounded-2xl bg-black/5 text-black placeholder:text-black/30 text-sm font-bold outline-none focus:bg-black/8 transition-colors"
                  />
                </div>

                {/* 모집 상태 */}
                <div>
                  <p className="text-[11px] font-bold text-black/40 mb-2">프로젝트 상태 <span className="text-red-500">*</span></p>
                  <div className="flex gap-2">
                    {(['active', 'draft', 'closed'] as const).map(s => {
                      const labels = { active: '진행중', draft: '준비중', closed: '완료' };
                      return (
                        <button key={s} type="button"
                          onClick={() => setStatus(s)}
                          className={`px-4 py-2 rounded-2xl text-sm font-bold transition-colors ${
                            status === s ? 'bg-black text-white' : 'bg-black/5 text-black/50 hover:bg-black/10'
                          }`}
                        >
                          {labels[s]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 프로젝트 소개 */}
            <div>
              <p className="text-[11px] font-black text-black/40 uppercase tracking-widest mb-3">프로젝트 소개 <span className="text-red-500">*</span></p>
              <textarea
                required value={description} onChange={e => setDescription(e.target.value)}
                placeholder="한 줄 소개 (카드에 표시됩니다)"
                rows={2}
                className="w-full px-4 py-3 rounded-2xl bg-black/5 text-black placeholder:text-black/30 text-sm font-medium outline-none focus:bg-black/8 transition-colors resize-none"
              />
            </div>

            {/* 상세 내용 */}
            <div>
              <p className="text-[11px] font-black text-black/40 uppercase tracking-widest mb-3">상세 내용 <span className="text-red-500">*</span></p>
              <textarea
                required value={detail} onChange={e => setDetail(e.target.value)}
                placeholder="프로젝트 목표, 기대 결과물 등을 자세히 입력하세요."
                rows={4}
                className="w-full px-4 py-3 rounded-2xl bg-black/5 text-black placeholder:text-black/30 text-sm font-medium outline-none focus:bg-black/8 transition-colors resize-none"
              />
            </div>

            {/* 팀원 선택 */}
            <div>
              <p className="text-[11px] font-black text-black/40 uppercase tracking-widest mb-1">팀원 선택 <span className="text-red-500">*</span></p>
              <p className="text-[10px] text-black/30 font-medium mb-3">최소 2인 이상 선택해주세요 {selectedMembers.length > 0 && <span className={selectedMembers.length >= 2 ? 'text-black/50 font-black' : 'text-red-400 font-black'}>({selectedMembers.length}명 선택됨)</span>}</p>
              {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedMembers.map(m => (
                    <span key={m.id}
                      className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full bg-black text-white text-xs font-bold">
                      <Avatar member={m} size="sm" />
                      {m.full_name}
                      <button type="button"
                        onClick={() => setSelectedMembers(prev => prev.filter(x => x.id !== m.id))}
                        className="ml-0.5 text-white/60 hover:text-white">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="relative mb-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
                <input type="text" value={memberQuery} onChange={e => setMemberQuery(e.target.value)}
                  placeholder="이름으로 검색"
                  className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-black/5 text-black placeholder:text-black/30 text-sm font-medium outline-none focus:bg-black/8 transition-colors"
                />
              </div>
              {memberQuery && (
                <div className="rounded-2xl bg-black/3 overflow-hidden max-h-32 overflow-y-auto">
                  {isMembersLoading ? (
                    <p className="text-xs text-black/40 text-center py-4">불러오는 중...</p>
                  ) : filteredMembers.length === 0 ? (
                    <p className="text-xs text-black/40 text-center py-4">검색 결과 없음</p>
                  ) : filteredMembers.slice(0, 5).map(m => (
                    <button key={m.id} type="button" onClick={() => {
                      setSelectedMembers(prev => [...prev, m]); setMemberQuery('');
                    }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-black/5 transition-colors text-left">
                      <Avatar member={m} size="sm" />
                      <span className="text-sm font-bold text-black">{m.full_name}</span>
                      <Plus size={13} className="text-black/30 ml-auto" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── 관련 일정 ── */}
            <div>
              {/* 헤더 토글 버튼 */}
              <button
                type="button"
                onClick={() => setScheduleOpen(p => !p)}
                className="w-full flex items-center justify-between mb-3 group"
              >
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-black text-black/40 uppercase tracking-widest">관련 일정</p>
                  {relatedScheduleIds.length > 0 && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-black text-white">
                      {relatedScheduleIds.length}개 선택
                    </span>
                  )}
                </div>
                <ChevronDown
                  size={14}
                  className={`text-black/30 transition-transform duration-200 ${scheduleOpen ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence initial={false}>
                {scheduleOpen && (
                  <motion.div
                    key="schedule-panel"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2 pb-1">
                      {/* 검색 입력 */}
                      <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30 pointer-events-none" />
                        <input
                          type="text"
                          value={scheduleSearch}
                          onChange={e => setScheduleSearch(e.target.value)}
                          placeholder="일정 검색..."
                          className="w-full pl-8 pr-8 py-2 rounded-xl bg-black/5 text-black placeholder:text-black/30 text-sm font-medium outline-none focus:bg-black/8 transition-colors"
                        />
                        {scheduleSearch && (
                          <button
                            type="button"
                            onClick={() => setScheduleSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 hover:text-black text-base leading-none"
                          >
                            ×
                          </button>
                        )}
                      </div>

                      {/* 일정 목록 패널 */}
                      {schedulesLoading ? (
                        <p className="text-xs text-black/30 text-center py-4">불러오는 중...</p>
                      ) : (
                        <div className="rounded-2xl border border-black/8 overflow-hidden">
                          {/* 라벨 행 */}
                          <div className="px-4 py-2 bg-black/3 border-b border-black/6 flex items-center justify-between">
                            <p className="text-[10px] font-black text-black/30 uppercase tracking-widest">
                              {scheduleSearch.trim()
                                ? `검색 결과 ${filteredSchedules.length}건`
                                : `최근 일정 ${recentSchedules.length}개`}
                            </p>
                            {!scheduleSearch && allSchedules.length > 5 && (
                              <p className="text-[10px] text-black/25 font-medium">
                                검색으로 더 찾기 ({allSchedules.length}개 전체)
                              </p>
                            )}
                          </div>

                          {/* 스크롤 목록 */}
                          <div className="max-h-52 overflow-y-auto overscroll-contain">
                            {displaySchedules.length === 0 ? (
                              <p className="text-xs text-black/30 text-center py-5">
                                {scheduleSearch ? '검색 결과가 없습니다' : '등록된 일정이 없습니다'}
                              </p>
                            ) : (
                              displaySchedules.map(s => {
                                const checked = relatedScheduleIds.includes(s.id);
                                const dateStr = s.date
                                  ? (() => {
                                      const d = new Date(s.date + 'T00:00:00');
                                      return `${d.getMonth() + 1}/${d.getDate()}`;
                                    })()
                                  : '';
                                const isPastItem = s.date < _todayStr;
                                return (
                                  <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => toggleSchedule(s.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-black/5 transition-colors text-left border-b border-black/5 last:border-0
                                      ${checked ? 'bg-black/[0.04]' : ''}`}
                                  >
                                    {/* 체크박스 */}
                                    <div className={`w-4 h-4 rounded-[5px] border-2 flex items-center justify-center shrink-0 transition-colors ${
                                      checked ? 'bg-black border-black' : 'border-black/25'
                                    }`}>
                                      {checked && (
                                        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                                          <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                      )}
                                    </div>
                                    <Calendar size={13} className={`shrink-0 ${isPastItem ? 'text-black/20' : 'text-black/40'}`} />
                                    <span className={`text-sm font-bold flex-1 truncate ${isPastItem ? 'text-black/40' : 'text-black'}`}>
                                      {s.title}
                                    </span>
                                    <span className={`text-[11px] font-medium shrink-0 ${isPastItem ? 'text-black/20' : 'text-black/40'}`}>
                                      {dateStr}
                                    </span>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── 팀 구성 ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-black text-black/40 uppercase tracking-widest">팀 구성</p>
                  {teams.length > 0 && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-black/8 text-black/60">
                      {teams.length}팀
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={addTeam}
                  className="flex items-center gap-1.5 text-xs font-black text-black px-3 py-1.5 rounded-xl bg-black/5 hover:bg-black/10 transition-colors"
                >
                  <Plus size={12} /> 팀 추가
                </button>
              </div>

              {teams.length === 0 && (
                <p className="text-xs text-black/30 font-medium text-center py-3 bg-black/3 rounded-2xl">
                  팀을 추가해 프로젝트 내 팀 구성을 관리하세요
                </p>
              )}

              <div className="space-y-3">
                {teams.map((team, ti) => {
                  const searchKey = team.id;
                  const search = teamMemberSearch[searchKey] ?? '';
                  const isOpen = teamMemberOpen[searchKey] ?? false;
                  const leaderMember = allMembers.find(m => m.id === team.leaderId);
                  const teamMembers = allMembers.filter(m => team.memberIds.includes(m.id));
                  const filteredForTeam = allMembers.filter(m =>
                    m.full_name.includes(search) && m.id !== team.leaderId,
                  );

                  return (
                    <div key={team.id} className="border border-black/10 rounded-2xl p-4 space-y-3 bg-white">
                      {/* 팀 이름 + 삭제 */}
                      <div className="flex items-center gap-2">
                        <input
                          value={team.name}
                          onChange={e => updateTeam(ti, { name: e.target.value })}
                          placeholder="팀 이름 (예: 기획팀, 개발팀)"
                          className="flex-1 px-3 py-2 rounded-xl bg-black/5 text-sm font-bold text-black placeholder:text-black/30 outline-none focus:bg-black/8 transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => removeTeam(ti)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-black/30 hover:text-red-500 transition-colors shrink-0"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      {/* 팀장 선택 */}
                      <div>
                        <p className="text-[10px] font-black text-black/40 mb-1.5">팀장</p>
                        {leaderMember ? (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black text-white">
                            <Avatar member={leaderMember} size="sm" />
                            <span className="text-sm font-bold flex-1">{leaderMember.full_name}</span>
                            <button
                              type="button"
                              onClick={() => updateTeam(ti, { leaderId: '' })}
                              className="text-white/50 hover:text-white"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <select
                            value={team.leaderId}
                            onChange={e => updateTeam(ti, { leaderId: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-black/5 text-sm font-bold text-black outline-none focus:bg-black/8 transition-colors cursor-pointer"
                          >
                            <option value="">팀장을 선택하세요</option>
                            {allMembers.map(m => (
                              <option key={m.id} value={m.id}>{m.full_name}</option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* 팀원 선택 */}
                      <div>
                        <p className="text-[10px] font-black text-black/40 mb-1.5">
                          팀원
                          {teamMembers.length > 0 && (
                            <span className="ml-1.5 text-black/50">{teamMembers.length}명</span>
                          )}
                        </p>
                        {teamMembers.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {teamMembers.map(m => (
                              <span
                                key={m.id}
                                className="inline-flex items-center gap-1 pl-1 pr-2 py-0.5 rounded-full bg-black/8 text-xs font-bold text-black"
                              >
                                <Avatar member={m} size="sm" />
                                {m.full_name}
                                <button
                                  type="button"
                                  onClick={() => toggleTeamMember(ti, m.id)}
                                  className="ml-0.5 text-black/30 hover:text-black"
                                >
                                  <X size={10} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="relative">
                          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
                          <input
                            type="text"
                            value={search}
                            onChange={e => {
                              setTeamMemberSearch(prev => ({ ...prev, [searchKey]: e.target.value }));
                              setTeamMemberOpen(prev => ({ ...prev, [searchKey]: true }));
                            }}
                            onFocus={() => setTeamMemberOpen(prev => ({ ...prev, [searchKey]: true }))}
                            placeholder="팀원 이름 검색"
                            className="w-full pl-8 pr-4 py-2 rounded-xl bg-black/5 text-sm font-bold text-black placeholder:text-black/30 outline-none focus:bg-black/8 transition-colors"
                          />
                        </div>
                        {isOpen && search && (
                          <div className="mt-1 rounded-xl bg-white border border-black/10 shadow-sm overflow-hidden max-h-28 overflow-y-auto">
                            {filteredForTeam.length === 0 ? (
                              <p className="text-xs text-black/30 text-center py-3">검색 결과 없음</p>
                            ) : filteredForTeam.slice(0, 5).map(m => {
                              const alreadyIn = team.memberIds.includes(m.id);
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => {
                                    toggleTeamMember(ti, m.id);
                                    setTeamMemberSearch(prev => ({ ...prev, [searchKey]: '' }));
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/5 transition-colors text-left"
                                >
                                  <Avatar member={m} size="sm" />
                                  <span className="text-sm font-bold text-black flex-1">{m.full_name}</span>
                                  {alreadyIn
                                    ? <X size={12} className="text-black/40" />
                                    : <Plus size={12} className="text-black/30" />
                                  }
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 프로젝트 기간 */}
            <div>
              <p className="text-[11px] font-black text-black/40 uppercase tracking-widest mb-1">
                프로젝트 기간 <span className="text-red-500">*</span>
              </p>
              <p className="text-[10px] text-black/30 font-medium mb-3">
                {dateStep === 'start' ? '시작일을 선택하세요' : '종료일을 선택하세요 (없으면 미정으로 처리됩니다)'}
              </p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[{ label: '시작일', date: startDate, required: true }, { label: '종료일', date: endDate, required: false }].map(({ label, date, required }) => (
                  <div key={label} className={`px-3 py-2 rounded-2xl text-sm font-medium transition-colors ${
                    date ? 'bg-black text-white' : required ? 'bg-black/5 text-black/30' : 'bg-black/3 text-black/20'
                  }`}>
                    <span className="text-[10px] font-bold block mb-0.5 opacity-60">{label}{required && <span className="text-red-400 ml-0.5">*</span>}</span>
                    {date ? format(date, 'yyyy. M. d (eee)', { locale: ko }) : (required ? '선택 안 됨' : '미정')}
                  </div>
                ))}
              </div>
              <div className="bg-black/3 rounded-2xl p-4">
                <MiniCalendar selectedStart={startDate} selectedEnd={endDate} onSelect={handleDateSelect} />
              </div>
              {startDate && (
                <button type="button"
                  onClick={() => { setStartDate(null); setEndDate(null); setDateStep('start'); }}
                  className="text-xs text-black/30 hover:text-black transition-colors mt-2">
                  날짜 초기화
                </button>
              )}
            </div>

            {/* 기술 스택 */}
            <div>
              <p className="text-[11px] font-black text-black/40 uppercase tracking-widest mb-3">기술 스택</p>
              <div className="flex gap-2 mb-2">
                <input
                  value={techInput} onChange={e => setTechInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTech(); } }}
                  placeholder="예: React, Supabase, Figma"
                  className="flex-1 px-4 py-2.5 rounded-2xl bg-black/5 text-black placeholder:text-black/30 text-sm font-medium outline-none focus:bg-black/8 transition-colors"
                />
                <button type="button" onClick={addTech}
                  className="px-4 py-2.5 rounded-2xl bg-black text-white text-sm font-bold hover:bg-black/80 transition-colors">
                  추가
                </button>
              </div>
              {techStack.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {techStack.map(t => (
                    <span key={t} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/8 text-xs font-bold text-black">
                      <Zap size={10} /> {t}
                      <button type="button" onClick={() => setTechStack(prev => prev.filter(x => x !== t))}>
                        <X size={10} className="text-black/40 hover:text-black ml-0.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 태그 */}
            <div>
              <p className="text-[11px] font-black text-black/40 uppercase tracking-widest mb-3">태그</p>
              <div className="relative">
                <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
                <input
                  value={tagsInput} onChange={e => setTagsInput(e.target.value)}
                  placeholder="CLUBDX, 메인앱개발, 개발 (쉼표/공백으로 구분)"
                  className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-black/5 text-black placeholder:text-black/30 text-sm font-medium outline-none focus:bg-black/8 transition-colors"
                />
              </div>
              {parsedTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {parsedTags.map(t => (
                    <span key={t} className="text-xs font-bold text-black/50 bg-black/5 px-2.5 py-1 rounded-full">#{t}</span>
                  ))}
                </div>
              )}
            </div>

            {/* 썸네일 */}
            <div>
              <p className="text-[11px] font-black text-black/40 uppercase tracking-widest mb-3">대표 이미지</p>
              <div
                onClick={() => thumbRef.current?.click()}
                className="relative w-full h-32 rounded-2xl bg-black/5 hover:bg-black/8 transition-colors cursor-pointer flex items-center justify-center overflow-hidden">
                {thumbPreview
                  ? <img src={thumbPreview} alt="" className="w-full h-full object-cover" />
                  : (
                    <div className="flex flex-col items-center gap-1.5 text-black/30">
                      <Upload size={20} />
                      <span className="text-xs font-medium">클릭하여 이미지 선택</span>
                    </div>
                  )
                }
                {thumbPreview && (
                  <button type="button"
                    onClick={e => { e.stopPropagation(); setThumbnail(null); setThumbPreview(null); }}
                    className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-lg text-white">
                    <X size={13} />
                  </button>
                )}
              </div>
              <input ref={thumbRef} type="file" accept="image/*"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setThumbnail(f);
                  setThumbPreview(URL.createObjectURL(f));
                }}
                className="hidden" />
            </div>

            {/* 첨부파일 */}
            <div className="pb-2">
              <p className="text-[11px] font-black text-black/40 uppercase tracking-widest mb-3">관련 첨부파일</p>
              <button type="button" onClick={() => attachRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-black/5 text-sm font-bold text-black/50 hover:bg-black/10 hover:text-black transition-colors">
                <Paperclip size={14} /> 파일 첨부
              </button>
              <input ref={attachRef} type="file" accept=".pdf,.doc,.docx,.hwp,.pptx" multiple
                onChange={e => setAttachments(prev => [...prev, ...Array.from(e.target.files || [])])}
                className="hidden" />
              {attachments.length > 0 && (
                <ul className="space-y-1.5 mt-2">
                  {attachments.map((f, i) => (
                    <li key={i} className="flex items-center justify-between px-3 py-2 rounded-xl bg-black/5">
                      <span className="text-xs font-medium text-black/70 truncate">{f.name}</span>
                      <button type="button" onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}>
                        <X size={13} className="text-black/30 hover:text-black ml-2 shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

          </div>

        </form>

        {/* 푸터 */}
        <div className="shrink-0 flex gap-3 px-6 py-4 border-t border-black/10 bg-white">
          <button type="button" onClick={handleClose}
            className="flex-1 py-3 rounded-2xl border border-black/15 text-sm font-bold text-black/60 hover:bg-black/5 hover:text-black transition-colors">
            취소
          </button>
          <button
            type="button"
            disabled={isSubmitting || !title || !description || !detail || !startDate || selectedMembers.length < 2}
            onClick={() => {
              if (!title || !description || !detail || !startDate || selectedMembers.length < 2) return;
              const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
              handleSubmit(fakeEvent);
            }}
            className="flex-[2] py-3 rounded-2xl bg-black text-white font-bold text-sm transition-all hover:bg-black/85 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]">
            {isSubmitting ? '저장 중...' : '🚀 프로젝트 등록하기'}
          </button>
        </div>

      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   메인 페이지
══════════════════════════════════════════ */
export function AdminProjects() {
  const navigate = useNavigate();
  const { activeClubId } = useAuth();
  const clubId = activeClubId;   // context에서 직접 — 동아리별 독립 보장

  const [projects,    setProjects]    = useState<Project[]>([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [isModalOpen,  setIsModalOpen]  = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* 프로젝트 목록 로드 */
  useEffect(() => {
    if (!clubId) { setIsLoading(false); return; }
    setIsLoading(true);
    supabase.from('projects')
      .select('id, title, emoji, description, detail, start_date, end_date, status, thumbnail_url, created_at')
      .eq('club_id', clubId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        interface ProjectRow {
          id: string;
          title: string;
          emoji: string;
          description: string;
          detail: string;
          start_date: string;
          end_date: string;
          status: 'active' | 'closed' | 'draft';
          thumbnail_url?: string;
          created_at: string;
          tech_stack?: string[];
          tags?: string[];
        }
        if (data) {
          setProjects((data as ProjectRow[]).map((p) => ({
            ...p,
            techStack: p.tech_stack ?? [],
            tags: p.tags ?? [],
            participants: [],
          })));
        }
        setIsLoading(false);
      });
  }, [clubId]);

  const handleCreate = async (data: Omit<Project, 'id' | 'created_at'>) => {
    setIsSubmitting(true);
    try {
      if (clubId) {
        /* Supabase 저장 */
        const { data: inserted, error } = await supabase.from('projects').insert({
          club_id:       clubId,
          title:         data.title,
          emoji:         data.emoji,
          description:   data.description,
          detail:        data.detail,
          status:        data.status,
          start_date:    data.start_date,
          end_date:      data.end_date || null,
          thumbnail_url: data.thumbnail_url ?? null,
          tech_stack:    data.techStack,
          tags:          data.tags,
        }).select('id').single();

        if (error) throw error;

        /* 확장 컬럼 저장 (없으면 무시) */
        if (inserted?.id) {
          await supabase.from('projects').update({
            related_schedule_ids: data.relatedScheduleIds ?? [],
            teams:                data.teams ?? [],
          }).eq('id', inserted.id).then(() => {}); // silent fail if columns missing

          /* 로컬 상태 업데이트 */
          const newProject: Project = {
            id: inserted.id,
            ...data,
            created_at: format(new Date(), 'yyyy-MM-dd'),
          };
          setProjects(prev => [newProject, ...prev]);
        }
      } else {
        /* clubId 없을 때 로컬 전용 */
        const newProject: Project = {
          id: crypto.randomUUID(),
          ...data,
          created_at: format(new Date(), 'yyyy-MM-dd'),
        };
        setProjects(prev => [newProject, ...prev]);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* 통계 */
  const stats = {
    active: projects.filter(p => p.status === 'active').length,
    closed: projects.filter(p => p.status === 'closed').length,
    draft:  projects.filter(p => p.status === 'draft').length,
  };

  return (
    <div className="bg-white min-h-screen pb-12">
      <div className="max-w-5xl mx-auto px-4 pt-16 space-y-6">
        <BackButton to="/admin" label="뒤로가기" />

        {/* 헤더 배너 */}
        <div className="relative overflow-hidden rounded-3xl border border-black/10 bg-white px-8 pt-8 pb-10">
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full border-[3px] border-black/5 pointer-events-none" />
          <div className="absolute -bottom-6 right-20 w-24 h-24 rounded-full border-[3px] border-black/5 pointer-events-none" />
          <h1 className="text-4xl font-black text-black mb-1">🚀 프로젝트 관리</h1>
          <p className="text-sm text-black/50 font-medium mb-6">동아리 프로젝트를 등록하고 팀을 구성하세요.</p>
          {/* 통계 */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '진행중', value: stats.active },
              { label: '완료',   value: stats.closed },
              { label: '준비중', value: stats.draft  },
            ].map(({ label, value }) => (
              <div key={label} className="bg-black/3 rounded-2xl p-4 text-center">
                <p className="text-2xl font-black text-black">{value}</p>
                <p className="text-xs text-black/40 font-bold mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 새 프로젝트 버튼 */}
        <div className="flex justify-end">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-3 bg-black text-white font-bold text-sm rounded-2xl hover:bg-black/85 active:scale-95 transition-all">
            <Plus size={16} /> 새 프로젝트 만들기
          </button>
        </div>

        {/* 프로젝트 목록 */}
        <div className="space-y-3">
          {isLoading ? (
            /* 로딩 스피너 */
            <div className="bg-white rounded-3xl border border-black/10 py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-black/30" />
              <p className="text-sm font-bold text-black/40">프로젝트 불러오는 중...</p>
            </div>
          ) : projects.length === 0 ? (
            /* Empty state */
            <div className="bg-white rounded-3xl border border-black/10 py-20 flex flex-col items-center justify-center gap-3">
              <Rocket className="w-10 h-10 text-black/20" />
              <p className="text-sm font-bold text-black/40">등록된 프로젝트가 없습니다</p>
              <p className="text-xs text-black/30">위의 버튼을 눌러 첫 프로젝트를 만들어보세요</p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-2 flex items-center gap-1.5 px-4 py-2 bg-black text-white text-sm font-bold rounded-full hover:bg-black/85 transition-colors"
              >
                <Plus size={14} /> 새 프로젝트 만들기
              </button>
            </div>
          ) : (
            projects.map(project => (
              <div
                key={project.id}
                onClick={() => navigate(`/admin/projects/${project.id}`)}
                className="bg-white rounded-3xl border border-black/10 hover:border-black/30 hover:-translate-y-0.5 p-5 flex gap-4 cursor-pointer transition-all"
              >
                {/* 아이콘/썸네일 */}
                <div className="w-16 h-16 rounded-2xl bg-black/5 overflow-hidden shrink-0 flex items-center justify-center text-3xl">
                  {project.thumbnail_url
                    ? <img src={project.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    : project.emoji
                  }
                </div>
                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-black text-black truncate">{project.title}</h3>
                    <StatusBadge status={project.status} />
                  </div>
                  <p className="text-sm text-black/50 font-medium line-clamp-1 mb-2">{project.description}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-black/30 font-medium">
                      {project.start_date} ~ {project.end_date || '미정'}
                    </span>
                    {project.participants.length > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="flex -space-x-1.5">
                          {project.participants.slice(0, 4).map(m => (
                            <Avatar key={m.id} member={m} size="sm" />
                          ))}
                        </div>
                        <span className="text-xs text-black/30 ml-1 font-medium">
                          {project.participants.length}명
                        </span>
                      </div>
                    )}
                    {project.tags.slice(0, 2).map(t => (
                      <span key={t} className="text-[11px] text-black/30 font-medium">#{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <CreateModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreate}
        isSubmitting={isSubmitting}
        clubId={clubId}
      />
    </div>
  );
}
