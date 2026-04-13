import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, X, ImageIcon, Calendar, ChevronLeft, ChevronRight,
  Megaphone, Clock, CheckCircle2, XCircle, Upload, PenLine,
  Trash2, Plus as PlusIcon, Minus,
} from 'lucide-react';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameMonth, isSameDay, isWithinInterval,
  startOfWeek, endOfWeek,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { BackButton } from '../../components/common/BackButton';

/* ══ 타입 ══ */
interface Announcement {
  id: string;
  clubName: string;
  generation: string;
  subTitle: string;
  coreValue: string;
  category: string;
  title: string;
  content: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'closed' | 'draft';
  thumbnail_url?: string;
  created_at: string;
  appLink: string;
  tags: string[];
  memberCount: string;
  requirements: string[];
  processSteps: string[];
}

/* ── 상태 배지 ── */
function StatusBadge({ status }: { status: Announcement['status'] }) {
  const map = {
    active: { label: '모집중',   icon: CheckCircle2, cls: 'bg-black text-white' },
    closed: { label: '마감',     icon: XCircle,      cls: 'bg-black/10 text-black/60 border border-black/20' },
    draft:  { label: '임시저장', icon: Clock,        cls: 'bg-black/8 text-black/60 border border-black/20' },
  } as const;
  const { label, icon: Icon, cls } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${cls}`}>
      <Icon className="w-3 h-3" />{label}
    </span>
  );
}

/* ── 미니 달력 ── */
function MiniCalendar({ selectedStart, selectedEnd, onSelect }: {
  selectedStart: Date | null; selectedEnd: Date | null; onSelect: (d: Date) => void;
}) {
  const [viewMonth, setViewMonth] = useState(new Date());
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 0 }),
    end:   endOfWeek(endOfMonth(viewMonth),     { weekStartsOn: 0 }),
  });
  const isInRange = (d: Date) =>
    selectedStart && selectedEnd ? isWithinInterval(d, { start: selectedStart, end: selectedEnd }) : false;
  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setViewMonth(subMonths(viewMonth, 1))} className="p-1.5 rounded-xl hover:bg-black/8 transition-colors">
          <ChevronLeft className="w-4 h-4 text-black/60" />
        </button>
        <span className="text-sm font-black text-black">{format(viewMonth, 'yyyy년 M월', { locale: ko })}</span>
        <button onClick={() => setViewMonth(addMonths(viewMonth, 1))} className="p-1.5 rounded-xl hover:bg-black/8 transition-colors">
          <ChevronRight className="w-4 h-4 text-black/60" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['일','월','화','수','목','금','토'].map(d => (
          <div key={d} className="text-center text-[11px] font-black text-black/30 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map(day => {
          const isStart = selectedStart && isSameDay(day, selectedStart);
          const isEnd   = selectedEnd   && isSameDay(day, selectedEnd);
          const inRange = isInRange(day);
          const isThis  = isSameMonth(day, viewMonth);
          return (
            <button key={day.toISOString()} onClick={() => onSelect(day)}
              className={['text-xs h-7 w-full rounded-lg transition-colors font-medium',
                !isThis ? 'text-black/20' : 'text-black',
                (isStart || isEnd) ? 'bg-black !text-white font-black'
                  : inRange ? 'bg-black/10' : 'hover:bg-black/8',
              ].join(' ')}>
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   새 공고 작성 모달 (Split Layout)
════════════════════════════════════════ */
function CreateModal({ open, onClose, onSave }: {
  open: boolean;
  onClose: () => void;
  onSave: (item: Announcement) => void;
}) {
  const [clubName,      setClubName]      = useState('CLUB DX');
  const [generation,    setGeneration]    = useState('');
  const [subTitle,      setSubTitle]      = useState('');
  const [coreValue,     setCoreValue]     = useState('');
  const [category,      setCategory]      = useState('개발');
  const [content,       setContent]       = useState('');
  const [status,        setStatus]        = useState<Announcement['status']>('active');
  const [appLink,       setAppLink]       = useState('');
  const [tagsInput,     setTagsInput]     = useState('');
  const [memberCount,   setMemberCount]   = useState('');
  const [startDate,     setStartDate]     = useState<Date | null>(null);
  const [endDate,       setEndDate]       = useState<Date | null>(null);
  const [dateStep,      setDateStep]      = useState<'start'|'end'>('start');
  const [thumbPreview,  setThumbPreview]  = useState<string | null>(null);
  const [thumbnail,     setThumbnail]     = useState<File | null>(null);
  const [requirements,  setRequirements]  = useState(['기초 프로그래밍 경험 (언어 무관)', '매주 정기 세션 참여 가능자', '협업을 좋아하는 분']);
  const [processSteps,  setProcessSteps]  = useState(['서류 접수', '코딩 테스트 (선택)', '면담', '최종 합격']);
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const thumbRef = useRef<HTMLInputElement>(null);

  const parsedTags = tagsInput.split(/[,\s]+/).map(t => t.trim()).filter(Boolean);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const reset = () => {
    setClubName('CLUB DX'); setGeneration(''); setSubTitle(''); setCoreValue('');
    setCategory('개발'); setContent(''); setStatus('active'); setAppLink('');
    setTagsInput(''); setMemberCount('');
    setStartDate(null); setEndDate(null); setDateStep('start');
    setThumbPreview(null); setThumbnail(null);
    setRequirements(['기초 프로그래밍 경험 (언어 무관)', '매주 정기 세션 참여 가능자', '협업을 좋아하는 분']);
    setProcessSteps(['서류 접수', '코딩 테스트 (선택)', '면담', '최종 합격']);
  };
  const handleClose = () => { onClose(); reset(); };

  const handleDateSelect = (day: Date) => {
    if (dateStep === 'start') { setStartDate(day); setEndDate(null); setDateStep('end'); }
    else {
      if (startDate && day < startDate) { setStartDate(day); setEndDate(null); setDateStep('end'); }
      else setEndDate(day);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!generation || !startDate || !endDate) return;
    setIsSubmitting(true);
    try {
      let thumbnailUrl: string | undefined;
      if (thumbnail) {
        const path = `recruitment/thumbnails/${Date.now()}_${thumbnail.name}`;
        const { error } = await supabase.storage.from('club-assets').upload(path, thumbnail, { upsert: true });
        if (!error) {
          const { data } = supabase.storage.from('club-assets').getPublicUrl(path);
          thumbnailUrl = data.publicUrl;
        }
      }
      const title = `✨ ${clubName} ${generation}기 신입 부원 모집!`;
      onSave({
        id: crypto.randomUUID(), clubName, generation, subTitle, coreValue,
        category, title, content, appLink, status,
        tags: parsedTags, memberCount,
        requirements: requirements.filter(r => r.trim()),
        processSteps: processSteps.filter(s => s.trim()),
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date:   format(endDate,   'yyyy-MM-dd'),
        thumbnail_url: thumbnailUrl,
        created_at: format(new Date(), 'yyyy-MM-dd'),
      });
      handleClose();
    } catch (err) { console.error(err); }
    finally { setIsSubmitting(false); }
  };

  /* 리스트 유틸 */
  const updateList = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, i: number, val: string) => {
    const next = [...list]; next[i] = val; setList(next);
  };
  const addItem    = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>) => setList([...list, '']);
  const removeItem = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, i: number) =>
    setList(list.filter((_, idx) => idx !== i));

  /* 공통 입력 스타일 */
  const inp = "w-full px-4 py-2.5 rounded-2xl bg-black/5 text-black text-sm font-medium outline-none focus:bg-black/8 transition-all placeholder:text-black/25";

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className="relative w-full max-w-2xl max-h-[92vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-black/8 shrink-0">
          <div>
            <h2 className="text-lg font-black text-black">새 모집공고 작성</h2>
          </div>
          <button onClick={handleClose} className="w-9 h-9 rounded-full bg-black/8 hover:bg-black/15 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-black" />
          </button>
        </div>

        {/* 바디 — 좌우 분할 */}
        <div className="flex flex-1 min-h-0">

          {/* ── 왼쪽: 입력 폼 ── */}
          <form id="create-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-8 py-6 space-y-5">

            {/* 제목 정보 */}
            <section className="space-y-3">
              <p className="text-[10px] font-black text-black/30 uppercase tracking-widest">제목 정보</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black text-black/50 block mb-1">동아리 이름 <span className="text-red-500">*</span></label>
                  <input value={clubName} onChange={e => setClubName(e.target.value)}
                    placeholder="CLUB DX" className={inp} required />
                </div>
                <div>
                  <label className="text-xs font-black text-black/50 block mb-1">기수</label>
                  <input value={generation} onChange={e => setGeneration(e.target.value)}
                    placeholder="12" className={inp} />
                </div>
              </div>
              {generation && (
                <div className="px-4 py-2.5 rounded-2xl bg-black text-white text-sm font-black">
                  ✨ {clubName} {generation}기 신입 부원 모집!
                </div>
              )}
            </section>

            {/* 서브타이틀 / 핵심가치 */}
            <section className="space-y-3">
              <p className="text-[10px] font-black text-black/30 uppercase tracking-widest">소개</p>
              <div>
                <label className="text-xs font-black text-black/50 block mb-1">서브 타이틀</label>
                <input value={subTitle} onChange={e => setSubTitle(e.target.value)}
                  placeholder="개발과 성장을 함께할 열정적인 당신을 기다립니다!" className={inp} />
              </div>
              <div>
                <label className="text-xs font-black text-black/50 block mb-1">핵심 가치</label>
                <input value={coreValue} onChange={e => setCoreValue(e.target.value)}
                  placeholder="개발과 성장의 즐거움을 함께할 팀원" className={inp} />
              </div>
            </section>

            {/* 카테고리 / 모집 인원 / 상태 */}
            <section className="space-y-3">
              <p className="text-[10px] font-black text-black/30 uppercase tracking-widest">기본 정보</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black text-black/50 block mb-1">카테고리 <span className="text-red-500">*</span></label>
                  <input value={category} onChange={e => setCategory(e.target.value)}
                    placeholder="개발" className={inp} required />
                </div>
                <div>
                  <label className="text-xs font-black text-black/50 block mb-1">모집 인원 (명)</label>
                  <input value={memberCount} onChange={e => setMemberCount(e.target.value)}
                    placeholder="10" type="number" min="1" className={inp} />
                </div>
              </div>
              <div>
                <label className="text-xs font-black text-black/50 block mb-1.5">모집 상태 <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  {(['active','closed','draft'] as const).map(s => {
                    const labels = { active: '모집중', closed: '마감', draft: '임시저장' };
                    return (
                      <button key={s} type="button" onClick={() => setStatus(s)}
                        className={`px-3 py-1.5 rounded-full text-xs font-black transition-all ${
                          status === s ? 'bg-black text-white' : 'bg-black/8 text-black/50 hover:bg-black/12'
                        }`}>
                        {labels[s]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* 이미지 업로드 */}
            <section className="space-y-2">
              <p className="text-[10px] font-black text-black/30 uppercase tracking-widest">공고 이미지</p>
              <div onClick={() => thumbRef.current?.click()}
                className="relative w-full h-28 rounded-2xl bg-black/5 hover:bg-black/8 transition-all cursor-pointer flex items-center justify-center overflow-hidden">
                {thumbPreview
                  ? <img src={thumbPreview} alt="" className="w-full h-full object-cover" />
                  : <div className="flex flex-col items-center gap-1.5 text-black/30">
                      <Upload className="w-5 h-5" />
                      <span className="text-xs font-medium">클릭하여 이미지 선택</span>
                    </div>
                }
                {thumbPreview && (
                  <button type="button" onClick={e => { e.stopPropagation(); setThumbPreview(null); setThumbnail(null); }}
                    className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <input ref={thumbRef} type="file" accept="image/*"
                onChange={e => { const f = e.target.files?.[0]; if (f) { setThumbnail(f); setThumbPreview(URL.createObjectURL(f)); }}}
                className="hidden" />
            </section>

            {/* 모집 기간 */}
            <section className="space-y-2">
              <p className="text-[10px] font-black text-black/30 uppercase tracking-widest">
                모집 기간 <span className="text-red-500">*</span>
                <span className="text-black/20 normal-case font-medium">
                  &nbsp;— {dateStep === 'start' ? '시작일 선택' : '종료일 선택'}
                </span>
              </p>
              <div className="grid grid-cols-2 gap-3 mb-2">
                {[{ label: '시작일', date: startDate }, { label: '종료일', date: endDate }].map(({ label, date }) => (
                  <div key={label} className={`px-4 py-2.5 rounded-2xl text-sm font-medium transition-colors ${
                    date ? 'bg-black text-white' : 'bg-black/5 text-black/30'
                  }`}>
                    <span className="text-[9px] font-black block mb-0.5 opacity-60 uppercase tracking-wider">{label}</span>
                    {date ? format(date, 'yyyy. M. d (eee)', { locale: ko }) : '미선택'}
                  </div>
                ))}
              </div>
              <div className="bg-black/5 rounded-2xl p-4">
                <MiniCalendar selectedStart={startDate} selectedEnd={endDate} onSelect={handleDateSelect} />
              </div>
              {startDate && endDate && (
                <button type="button" onClick={() => { setStartDate(null); setEndDate(null); setDateStep('start'); }}
                  className="text-xs text-black/30 hover:text-black transition-colors">날짜 초기화</button>
              )}
            </section>

            {/* 지원 자격 */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-black/30 uppercase tracking-widest">지원 자격</p>
                <button type="button" onClick={() => addItem(requirements, setRequirements)}
                  className="text-[10px] font-black text-black/40 hover:text-black flex items-center gap-0.5 transition-colors">
                  <PlusIcon className="w-3 h-3" /> 추가
                </button>
              </div>
              {requirements.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-black/30 shrink-0" />
                  <input value={r} onChange={e => updateList(requirements, setRequirements, i, e.target.value)}
                    placeholder="지원 자격 입력"
                    className="flex-1 px-3 py-2 rounded-xl bg-black/5 text-black text-xs font-medium outline-none focus:bg-black/8 placeholder:text-black/20 transition-all" />
                  {requirements.length > 1 && (
                    <button type="button" onClick={() => removeItem(requirements, setRequirements, i)}>
                      <Minus className="w-3.5 h-3.5 text-black/30 hover:text-black transition-colors" />
                    </button>
                  )}
                </div>
              ))}
            </section>

            {/* 전형 과정 */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-black/30 uppercase tracking-widest">전형 과정</p>
                <button type="button" onClick={() => addItem(processSteps, setProcessSteps)}
                  className="text-[10px] font-black text-black/40 hover:text-black flex items-center gap-0.5 transition-colors">
                  <PlusIcon className="w-3 h-3" /> 추가
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {processSteps.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-black/30 shrink-0 w-4 text-right">{i+1}.</span>
                    <input value={s} onChange={e => updateList(processSteps, setProcessSteps, i, e.target.value)}
                      placeholder="단계 입력"
                      className="flex-1 px-3 py-2 rounded-xl bg-black/5 text-black text-xs font-medium outline-none focus:bg-black/8 placeholder:text-black/20 transition-all" />
                    {processSteps.length > 1 && (
                      <button type="button" onClick={() => removeItem(processSteps, setProcessSteps, i)}>
                        <Minus className="w-3.5 h-3.5 text-black/30 hover:text-black transition-colors" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* 상세 설명 */}
            <section className="space-y-2">
              <p className="text-[10px] font-black text-black/30 uppercase tracking-widest">상세 설명 <span className="text-red-500">*</span></p>
              <textarea value={content} onChange={e => setContent(e.target.value)}
                placeholder="모집 자격, 지원 방법, 활동 안내 등 상세 내용을 입력하세요." rows={4} required
                className="w-full px-4 py-3 rounded-2xl bg-black/5 text-black placeholder:text-black/25 text-sm font-medium outline-none focus:bg-black/8 transition-all resize-none" />
            </section>

            {/* 신청 링크 */}
            <section className="space-y-2">
              <p className="text-[10px] font-black text-black/30 uppercase tracking-widest">신청 링크 <span className="text-red-500">*</span></p>
              <input value={appLink} onChange={e => setAppLink(e.target.value)}
                placeholder="link.com" className={inp} required />
            </section>

            {/* 태그 */}
            <section className="space-y-2">
              <p className="text-[10px] font-black text-black/30 uppercase tracking-widest">태그</p>
              <input value={tagsInput} onChange={e => setTagsInput(e.target.value)}
                placeholder="#CLUBDX, #신입모집, #개발, #성장" className={inp} />
              {parsedTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {parsedTags.map((t, i) => (
                    <span key={i} className="text-[11px] font-black text-black/50 px-2.5 py-1 rounded-full bg-black/8">
                      {t.startsWith('#') ? t : `#${t}`}
                    </span>
                  ))}
                </div>
              )}
            </section>

            <div className="h-4" />
          </form>

        </div>

        {/* 푸터 */}
        <div className="shrink-0 border-t border-black/8 px-8 py-4 flex gap-3">
          <button type="button" onClick={handleClose}
            className="flex-1 py-3 rounded-2xl border border-black/20 text-sm font-black text-black/50 hover:bg-black/5 hover:text-black transition-colors">
            취소
          </button>
          <button form="create-form" type="submit"
            disabled={isSubmitting || !clubName || !category || !startDate || !endDate || !content || !appLink}
            className="flex-[3] py-3 rounded-2xl bg-black text-white font-black text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-black/90 active:scale-[0.98]">
            {isSubmitting ? '저장 중...' : '📣 공고 등록하기'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ════════════════════════════════════════
   메인 페이지
════════════════════════════════════════ */
export function AdminRecruitment() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([
    {
      id: '1', clubName: 'CLUB DX', generation: '12',
      title: '✨ CLUB DX 12기 신입 부원 모집!',
      subTitle: '개발과 성장을 함께할 열정적인 당신을 기다립니다!',
      coreValue: '개발과 성장의 즐거움을 함께할 팀원',
      content: '저희 동아리와 함께할 열정적인 부원을 모집합니다!',
      start_date: '2026-03-01', end_date: '2026-03-31', status: 'active',
      created_at: '2026-03-01', category: '개발', appLink: 'link.com',
      tags: ['#CLUBDX', '#신입모집', '#개발', '#성장'], memberCount: '10',
      requirements: ['기초 프로그래밍 경험 (언어 무관)', '매주 정기 세션 참여 가능자', '협업을 좋아하는 분'],
      processSteps: ['서류 접수', '코딩 테스트 (선택)', '면담', '최종 합격'],
    },
    {
      id: '2', clubName: 'CLUB DX', generation: '11',
      title: '✨ CLUB DX 11기 디자인 트랙 추가 모집',
      subTitle: '', coreValue: '',
      content: 'UI/UX 디자인에 관심 있는 분들을 추가 모집합니다.',
      start_date: '2026-02-01', end_date: '2026-02-28', status: 'closed',
      created_at: '2026-02-01', category: '디자인', appLink: '',
      tags: ['#디자인', '#CLUBDX'], memberCount: '3',
      requirements: ['UI/UX 디자인 관심자'], processSteps: ['서류 접수', '면담', '최종 합격'],
    },
  ]);

  const [isCreateOpen, setIsCreateOpen]  = useState(false);
  const [viewingItem,  setViewingItem]   = useState<Announcement | null>(null);
  const [editingItem,  setEditingItem]   = useState<Announcement | null>(null);

  /* 편집 상태 */
  const [editTitle,     setEditTitle]     = useState('');
  const [editContent,   setEditContent]   = useState('');
  const [editStatus,    setEditStatus]    = useState<Announcement['status']>('active');
  const [editStartDate, setEditStartDate] = useState<Date | null>(null);
  const [editEndDate,   setEditEndDate]   = useState<Date | null>(null);
  const [editDateStep,  setEditDateStep]  = useState<'start'|'end'>('start');
  const [editThumbPrev, setEditThumbPrev] = useState<string | null>(null);
  const [editThumbnail, setEditThumbnail] = useState<File | null>(null);
  const [isEditSaving,  setIsEditSaving]  = useState(false);
  const editThumbRef = useRef<HTMLInputElement>(null);

  const openEdit = (item: Announcement) => {
    setEditingItem(item);
    setEditTitle(item.title); setEditContent(item.content); setEditStatus(item.status);
    setEditStartDate(item.start_date ? new Date(item.start_date) : null);
    setEditEndDate(item.end_date     ? new Date(item.end_date)   : null);
    setEditDateStep('start'); setEditThumbPrev(item.thumbnail_url ?? null); setEditThumbnail(null);
  };
  const closeEdit = () => setEditingItem(null);

  const handleEditDateSelect = (day: Date) => {
    if (editDateStep === 'start') { setEditStartDate(day); setEditEndDate(null); setEditDateStep('end'); }
    else {
      if (editStartDate && day < editStartDate) { setEditStartDate(day); setEditEndDate(null); setEditDateStep('end'); }
      else setEditEndDate(day);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editTitle || !editStartDate || !editEndDate) return;
    setIsEditSaving(true);
    try {
      let thumbnailUrl = editingItem.thumbnail_url;
      if (editThumbnail) {
        const path = `recruitment/thumbnails/${Date.now()}_${editThumbnail.name}`;
        const { error } = await supabase.storage.from('club-assets').upload(path, editThumbnail, { upsert: true });
        if (!error) {
          const { data } = supabase.storage.from('club-assets').getPublicUrl(path);
          thumbnailUrl = data.publicUrl;
        }
      }
      setAnnouncements(prev => prev.map(a =>
        a.id === editingItem.id
          ? { ...a, title: editTitle, content: editContent, status: editStatus,
              start_date: format(editStartDate, 'yyyy-MM-dd'),
              end_date:   format(editEndDate,   'yyyy-MM-dd'),
              thumbnail_url: thumbnailUrl }
          : a
      ));
      closeEdit();
    } catch (err) { console.error(err); }
    finally { setIsEditSaving(false); }
  };

  const handleDelete = (id: string) => {
    if (!confirm('이 공고를 삭제하시겠습니까?')) return;
    setAnnouncements(prev => prev.filter(a => a.id !== id));
    closeEdit();
  };

  const counts = {
    active: announcements.filter(a => a.status === 'active').length,
    closed: announcements.filter(a => a.status === 'closed').length,
    draft:  announcements.filter(a => a.status === 'draft').length,
  };

  return (
    <div className="min-h-screen bg-white pb-24">

      {/* ══ 헤더 ══ */}
      <div className="bg-white text-black pt-12 pb-16 px-6 shadow-sm" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <div className="max-w-5xl mx-auto">
          <BackButton to="/admin" label="뒤로가기" className="mb-4 text-black/70 hover:text-black" />
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span className="inline-block mb-3 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase bg-black/15 border border-black/20 text-black">Recruitment</span>
              <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                <Megaphone className="w-8 h-8 opacity-90" /> 모집공고 관리
              </h1>
              <p className="mt-1.5 text-black/70 text-sm font-medium">동아리 모집공고를 작성하고 관리하세요.</p>
            </div>
            <div className="grid grid-cols-3 divide-x divide-black/20 bg-black/5 border border-black/20 rounded-2xl py-4 shrink-0">
              {[['모집중', counts.active], ['마감', counts.closed], ['임시저장', counts.draft]].map(([label, count]) => (
                <div key={label as string} className="text-center px-4">
                  <p className="text-2xl font-black text-black">{count}</p>
                  <p className="text-[10px] text-black/70 font-black uppercase tracking-wider">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ══ 콘텐츠 ══ */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-8 relative z-20 space-y-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex justify-end">
          <button onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-5 py-3 bg-black text-white rounded-full font-black text-sm hover:bg-black/90 transition-all active:scale-95 shadow-sm">
            <Plus className="w-4 h-4" /> 새 공고 만들기
          </button>
        </motion.div>

        <AnimatePresence mode="popLayout">
          {announcements.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-white rounded-3xl border border-black/20 py-20 text-center text-black/40">
              <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-black">등록된 모집공고가 없습니다</p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {announcements.map((item, i) => (
                <motion.div key={item.id}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35, delay: i * 0.05 }}
                  onClick={() => setViewingItem(item)}
                  className="bg-white rounded-3xl border border-black/20 p-5 flex gap-4 hover:shadow-sm hover:-translate-y-0.5 transition-all cursor-pointer group"
                >
                  <div className="w-20 h-20 rounded-2xl bg-black/5 border border-black/10 overflow-hidden shrink-0 flex items-center justify-center">
                    {item.thumbnail_url
                      ? <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      : <ImageIcon className="w-7 h-7 text-black/25" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <p className="text-[10px] font-black text-black/40">{item.clubName} · {item.generation}기</p>
                        <h3 className="font-black text-black text-sm mt-0.5 truncate">{item.title}</h3>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={item.status} />
                        <button onClick={e => { e.stopPropagation(); openEdit(item); }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-black/20 text-xs font-black text-black/60 hover:text-black hover:bg-black/5 transition-all active:scale-95">
                          <PenLine className="w-3 h-3" /> 편집
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-black/40 font-medium flex-wrap">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{item.start_date} ~ {item.end_date}</span>
                      {item.memberCount && <span>👥 {item.memberCount}명</span>}
                      {item.tags.slice(0,2).map(t => <span key={t} className="px-2 py-0.5 rounded-full bg-black/5 text-[10px]">{t}</span>)}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* ══ 새 공고 작성 모달 (Split) ══ */}
      <AnimatePresence>
        {isCreateOpen && (
          <CreateModal
            open={isCreateOpen}
            onClose={() => setIsCreateOpen(false)}
            onSave={item => { setAnnouncements(prev => [item, ...prev]); }}
          />
        )}
      </AnimatePresence>

      {/* ══ 공고 상세 모달 ══ */}
      <AnimatePresence>
        {viewingItem && (
          <>
            <motion.div key="v-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setViewingItem(null)} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]" />
            <motion.div key="v-modal"
              initial={{ opacity: 0, y: 32, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="fixed inset-x-4 bottom-0 sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl z-[201] overflow-hidden shadow-2xl max-h-[85vh] flex flex-col"
            >
              <div className="sticky top-0 flex items-center justify-between px-6 py-5 border-b border-black/10 bg-white">
                <div className="flex items-center gap-2">
                  <StatusBadge status={viewingItem.status} />
                  <span className="text-xs text-black/40 font-medium">공고 상세</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setViewingItem(null); openEdit(viewingItem); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-black/20 text-xs font-black text-black/60 hover:text-black hover:bg-black/5 transition-all">
                    <PenLine className="w-3 h-3" /> 편집
                  </button>
                  <button onClick={() => setViewingItem(null)}
                    className="w-8 h-8 rounded-full bg-black/8 hover:bg-black/15 flex items-center justify-center transition-colors">
                    <X className="w-4 h-4 text-black" />
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                {viewingItem.thumbnail_url && (
                  <div className="w-full h-44 overflow-hidden bg-black/5">
                    <img src={viewingItem.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="px-6 py-6 space-y-4">
                  <div>
                    <p className="text-xs font-black text-black/40">{viewingItem.clubName} · {viewingItem.generation}기</p>
                    <h2 className="text-xl font-black text-black mt-1 leading-tight">{viewingItem.title}</h2>
                    {viewingItem.subTitle && <p className="text-sm text-black/60 mt-1 font-medium">{viewingItem.subTitle}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-black/50 font-medium flex-wrap">
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{viewingItem.start_date} ~ {viewingItem.end_date}</span>
                      {viewingItem.memberCount && <span>👥 모집 인원 {viewingItem.memberCount}명</span>}
                    </div>
                  </div>
                  <div className="h-px bg-black/8" />
                  {viewingItem.requirements.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-black/40 uppercase tracking-wider mb-2">지원 자격</p>
                      <ul className="space-y-1.5">
                        {viewingItem.requirements.map((r, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-black/70 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-black/40 shrink-0 mt-0.5" /> {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {viewingItem.processSteps.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-black/40 uppercase tracking-wider mb-2">전형 과정</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {viewingItem.processSteps.map((s, i, arr) => (
                          <React.Fragment key={i}>
                            <span className="text-xs font-black px-3 py-1.5 rounded-full border border-black/20 text-black/70">{i+1}. {s}</span>
                            {i < arr.length - 1 && <span className="text-black/30">›</span>}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}
                  {viewingItem.content && (
                    <div>
                      <p className="text-[10px] font-black text-black/40 uppercase tracking-wider mb-2">상세 내용</p>
                      <p className="text-sm text-black/70 leading-relaxed whitespace-pre-wrap font-medium">{viewingItem.content}</p>
                    </div>
                  )}
                  {viewingItem.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {viewingItem.tags.map((t, i) => (
                        <span key={i} className="text-[11px] font-black text-black/50 px-2.5 py-1 rounded-full bg-black/8">
                          {t.startsWith('#') ? t : `#${t}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="border-t border-black/8 px-6 py-4">
                <button onClick={() => setViewingItem(null)}
                  className="w-full py-3 rounded-2xl bg-black text-white font-black text-sm hover:bg-black/90 transition-all active:scale-[0.98]">
                  닫기
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ══ 공고 수정 모달 ══ */}
      <AnimatePresence>
        {editingItem && (
          <>
            <motion.div key="e-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeEdit} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]" />
            <motion.div key="e-modal"
              initial={{ opacity: 0, y: 32, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="fixed inset-x-4 bottom-0 sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl z-[201] overflow-hidden shadow-2xl max-h-[85vh] flex flex-col"
            >
              <div className="sticky top-0 flex items-center justify-between px-6 py-5 border-b border-black/10 bg-white">
                <div>
                  <h2 className="text-lg font-black text-black">공고 수정하기</h2>
                  <p className="text-xs text-black/40 mt-0.5">RECRUITMENT EDIT · 운영진 전용</p>
                </div>
                <button onClick={closeEdit} className="w-8 h-8 rounded-full bg-black/8 hover:bg-black/15 flex items-center justify-center transition-colors">
                  <X className="w-4 h-4 text-black" />
                </button>
              </div>
              <form id="edit-form" onSubmit={handleEditSubmit} className="overflow-y-auto flex-1 px-6 py-6 space-y-5">
                <div>
                  <label className="text-xs font-black text-black/50 block mb-1.5">공고 제목 *</label>
                  <input required value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-black/5 text-black text-sm font-medium outline-none focus:bg-black/8 transition-all" />
                </div>
                <div>
                  <label className="text-xs font-black text-black/50 block mb-1.5">공고 상태</label>
                  <div className="flex gap-2">
                    {(['active','closed','draft'] as const).map(s => {
                      const labels = { active: '모집중', closed: '마감', draft: '임시저장' };
                      return (
                        <button key={s} type="button" onClick={() => setEditStatus(s)}
                          className={`px-4 py-2 rounded-full text-sm font-black transition-all ${
                            editStatus === s ? 'bg-black text-white' : 'bg-black/8 text-black/50 hover:bg-black/12'
                          }`}>{labels[s]}</button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-black text-black/50 block mb-1.5">썸네일 이미지</label>
                  <div onClick={() => editThumbRef.current?.click()}
                    className="relative w-full h-28 rounded-2xl bg-black/5 hover:bg-black/8 cursor-pointer flex items-center justify-center overflow-hidden transition-all">
                    {editThumbPrev
                      ? <img src={editThumbPrev} alt="" className="w-full h-full object-cover" />
                      : <div className="flex flex-col items-center gap-1.5 text-black/30"><Upload className="w-5 h-5" /><span className="text-xs">클릭하여 변경</span></div>
                    }
                    {editThumbPrev && (
                      <button type="button" onClick={e => { e.stopPropagation(); setEditThumbPrev(null); setEditThumbnail(null); }}
                        className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <input ref={editThumbRef} type="file" accept="image/*"
                    onChange={e => { const f = e.target.files?.[0]; if (f) { setEditThumbnail(f); setEditThumbPrev(URL.createObjectURL(f)); }}}
                    className="hidden" />
                </div>
                <div>
                  <label className="text-xs font-black text-black/50 block mb-1.5 flex items-center gap-2">
                    모집 기간 * <span className="text-black/30 font-medium text-[10px]">— {editDateStep === 'start' ? '시작일 선택' : '종료일 선택'}</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {[{ label: '시작일', date: editStartDate }, { label: '종료일', date: editEndDate }].map(({ label, date }) => (
                      <div key={label} className={`px-4 py-2.5 rounded-2xl text-sm font-medium ${date ? 'bg-black text-white' : 'bg-black/5 text-black/30'}`}>
                        <span className="text-[9px] font-black block mb-0.5 opacity-60 uppercase tracking-wider">{label}</span>
                        {date ? format(date, 'yyyy. M. d (eee)', { locale: ko }) : '미선택'}
                      </div>
                    ))}
                  </div>
                  <div className="bg-black/5 rounded-2xl p-4">
                    <MiniCalendar selectedStart={editStartDate} selectedEnd={editEndDate} onSelect={handleEditDateSelect} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-black text-black/50 block mb-1.5">공고 내용</label>
                  <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={5}
                    className="w-full px-4 py-3 rounded-2xl bg-black/5 text-black text-sm font-medium outline-none focus:bg-black/8 resize-none transition-all" />
                </div>
                <button type="button" onClick={() => handleDelete(editingItem.id)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-black/15 text-sm font-black text-black/35 hover:text-black hover:border-black/30 hover:bg-black/5 transition-all">
                  <Trash2 className="w-4 h-4" /> 이 공고 삭제
                </button>
              </form>
              <div className="border-t border-black/8 px-6 py-4 flex gap-3">
                <button type="button" onClick={closeEdit}
                  className="flex-1 py-3 rounded-2xl border border-black/20 text-sm font-black text-black/50 hover:bg-black/5 transition-colors">취소</button>
                <button form="edit-form" type="submit" disabled={isEditSaving || !editTitle || !editStartDate || !editEndDate}
                  className="flex-[2] py-3 rounded-2xl bg-black text-white font-black text-sm disabled:opacity-40 hover:bg-black/90 active:scale-[0.98] transition-all">
                  {isEditSaving ? '저장 중...' : '✏️ 수정 완료'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
