import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, X, Paperclip, ChevronLeft, ChevronRight,
  Rocket, Clock, CheckCircle2, XCircle, Upload, Search,
  Zap, Users, Hash,
} from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth,
         eachDayOfInterval, isSameMonth, isSameDay, isWithinInterval,
         startOfWeek, endOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { BackButton } from '../../components/common/BackButton';
import { EmptyState } from '../../components/common/EmptyState';

/* ══════════════════════════════════════════
   타입
══════════════════════════════════════════ */
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
}

interface Member {
  id: string;
  full_name: string;
  role?: string;
  avatar_url?: string;
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
function Avatar({ member, size = 'sm' }: { member: Member; size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs';
  return (
    <div className={`${s} rounded-full bg-black text-white font-bold flex items-center justify-center shrink-0 border-2 border-white overflow-hidden`}>
      {member.avatar_url
        ? <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
        : member.full_name.slice(0, 1)
      }
    </div>
  );
}

/* ══════════════════════════════════════════
   새 프로젝트 모달
══════════════════════════════════════════ */
function CreateModal({
  open, onClose, onSubmit, isSubmitting,
}: {
  open: boolean; onClose: () => void;
  onSubmit: (data: Omit<Project, 'id' | 'created_at'>) => void;
  isSubmitting: boolean;
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
  const [allMembers,      setAllMembers]      = useState<Member[]>([]);
  const [memberQuery,     setMemberQuery]     = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Member[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(false);

  const thumbRef  = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLInputElement>(null);

  const parsedTags  = tagsInput.split(/[,#\s]+/).map(t => t.trim()).filter(Boolean);
  const parsedTech  = techStack;

  const fetchMembers = useCallback(async () => {
    setIsMembersLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, avatar_url')
        .order('full_name');
      if (!error && data) setAllMembers(data as Member[]);
      else setAllMembers([
        { id: 'demo1', full_name: '김철수', role: 'ADMIN' },
        { id: 'demo2', full_name: '이영희', role: 'MEMBER' },
        { id: 'demo3', full_name: '박민준', role: 'MEMBER' },
      ]);
    } catch {
      setAllMembers([
        { id: 'demo1', full_name: '김철수', role: 'ADMIN' },
        { id: 'demo2', full_name: '이영희', role: 'MEMBER' },
        { id: 'demo3', full_name: '박민준', role: 'MEMBER' },
      ]);
    } finally {
      setIsMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) { fetchMembers(); document.body.style.overflow = 'hidden'; }
    else       { document.body.style.overflow = ''; }
    return () => { document.body.style.overflow = ''; };
  }, [open, fetchMembers]);

  const filteredMembers = allMembers.filter(m =>
    m.full_name.includes(memberQuery) && !selectedMembers.some(s => s.id === m.id),
  );

  const reset = () => {
    setTitle(''); setEmoji('📱'); setShowEmoji(false);
    setDescription(''); setDetail(''); setStatus('active');
    setStartDate(null); setEndDate(null); setDateStep('start');
    setTechInput(''); setTechStack([]); setTagsInput('');
    setThumbnail(null); setThumbPreview(null); setAttachments([]);
    setSelectedMembers([]); setMemberQuery('');
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !detail || !startDate || selectedMembers.length < 2) return;
    onSubmit({
      title, emoji, description, detail, status,
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date:   endDate ? format(endDate, 'yyyy-MM-dd') : '',
      thumbnail_url: thumbPreview ?? undefined,
      participants: selectedMembers,
      techStack: parsedTech,
      tags: parsedTags,
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

        {/* 본문 (분할) */}
        <form onSubmit={handleSubmit} className="flex flex-1 overflow-hidden">

          {/* ── 왼쪽: 입력 폼 ── */}
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
                  placeholder="이름으로 검색 (미리보기에서 마스킹 처리됨)"
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
            <div>
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

  const [projects, setProjects] = useState<Project[]>([
    {
      id: '1', emoji: '💻', title: 'Club DX 메인 앱 개발',
      description: '동아리 관리 올인원 앱을 자체 개발합니다.',
      detail: '매 기수마다 반복되는 신입 부원 안내 메시지, 자료 배포, OT 일정 공유 등의 작업을 자동화하는 프로젝트입니다.\n\nSlack Bot + Notion API + Supabase를 연동해 구현할 예정입니다.',
      start_date: '2026-03-01', end_date: '2026-06-30', status: 'active',
      participants: [
        { id: 'a', full_name: '김철수' },
        { id: 'b', full_name: '이영희' },
        { id: 'c', full_name: '박민준' },
      ],
      techStack: ['React', 'TypeScript', 'Supabase'],
      tags: ['CLUBDX', '메인앱개발', '개발'],
      created_at: '2026-03-01',
    },
    {
      id: '2', emoji: '🎨', title: '브랜딩 리뉴얼 프로젝트',
      description: '동아리 BI/CI 아이덴티티를 새롭게 정의합니다.',
      detail: '동아리의 시각적 아이덴티티를 전면 재정비합니다.',
      start_date: '2026-01-15', end_date: '2026-02-28', status: 'closed',
      participants: [{ id: 'b', full_name: '이영희' }],
      techStack: ['Figma', 'Illustrator'],
      tags: ['디자인', '브랜딩'],
      created_at: '2026-01-15',
    },
    {
      id: '3', emoji: '📣', title: '마케팅 보이즈',
      description: '신입 온보딩 자동화 시스템 개발 프로젝트입니다.',
      detail: '매 기수마다 반복되는 신입 부원 안내 메시지, 자료 배포, OT 일정 공유 등의 작업을 자동화하는 프로젝트입니다.\n\nSlack Bot + Notion API + Supabase를 연동해 구현할 예정입니다.',
      start_date: '2026-04-01', end_date: '2026-09-30', status: 'draft',
      participants: [{ id: 'a', full_name: '김철수' }],
      techStack: ['Slack API', 'Notion API', 'Node.js', 'Automation'],
      tags: ['마케팅', '자동화'],
      created_at: '2026-03-15',
    },
  ]);

  const [isModalOpen,  setIsModalOpen]  = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (data: Omit<Project, 'id' | 'created_at'>) => {
    setIsSubmitting(true);
    try {
      let thumbnailUrl = data.thumbnail_url;
      const newProject: Project = {
        id:         crypto.randomUUID(),
        ...data,
        thumbnail_url: thumbnailUrl,
        created_at: format(new Date(), 'yyyy-MM-dd'),
      };
      setProjects(prev => [newProject, ...prev]);
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
      <div className="max-w-5xl mx-auto px-4 pt-6 space-y-6">
        <BackButton to="/admin" label="뒤로가기" />

        {/* 헤더 배너 */}
        <div className="relative overflow-hidden rounded-3xl border border-black/10 bg-white px-8 pt-8 pb-10">
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full border-[3px] border-black/5 pointer-events-none" />
          <div className="absolute -bottom-6 right-20 w-24 h-24 rounded-full border-[3px] border-black/5 pointer-events-none" />
          <span className="inline-block text-[11px] font-black tracking-widest uppercase text-black/40 border border-black/15 rounded-full px-3 py-1 mb-3">PROJECT</span>
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
          {projects.map(project => (
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
          ))}

          {projects.length === 0 && (
            <div className="bg-white rounded-3xl border border-black/10">
              <EmptyState
                icon={<Rocket className="w-10 h-10 text-black/20" />}
                message="등록된 프로젝트가 없습니다."
              />
            </div>
          )}
        </div>
      </div>

      <CreateModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreate}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
