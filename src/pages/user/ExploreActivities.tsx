import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, ChevronDown, ExternalLink,
  X, Loader2, Check, ChevronRight,
  Megaphone, Trophy, PartyPopper, School,
  Users, Calendar, Building2, Send,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

/* ════════════════════════ 타입 ════════════════════════ */
type Category = '전체' | '공모전' | '대외활동' | '동아리' | '스터디·프로젝트';
type SortKey  = '등록일' | '진행기간' | 'D-day' | '진행사항';
type Status   = '접수중' | '접수예정' | '마감임박' | '마감';
type ProgramType = 'CLUB' | 'CAMPAIGN' | 'CONTEST' | 'EVENT';

interface OrgProgramSnap {
  id: string;
  type: ProgramType;
  description: string | null;
  questions:   { id: string; text: string }[] | null;
  capacity:    number | null;
  recruit_start: string | null;
  recruit_end:   string | null;
  org_name: string;
  field: string | null;
}

interface Activity {
  id: string;
  category: Exclude<Category, '전체'>;
  title: string;
  tags: string[];
  org: string;
  dday: number;
  startDate: string;
  endDate: string;
  status: Status;
  link?: string;
  registeredAt: string;
  /* org 프로그램 전용 */
  isOrgProgram?: boolean;
  orgSnap?: OrgProgramSnap;
}

/* ════════════════════════ 상수 ════════════════════════ */
const STATUS_STYLE: Record<Status, string> = {
  '접수중':   'text-orange-400',
  '접수예정': 'text-blue-400',
  '마감임박': 'text-red-400',
  '마감':    'text-white/30',
};

const TYPE_ICON: Record<ProgramType, React.ReactNode> = {
  CLUB:     <School      className="w-3.5 h-3.5" />,
  CAMPAIGN: <Megaphone   className="w-3.5 h-3.5" />,
  CONTEST:  <Trophy      className="w-3.5 h-3.5" />,
  EVENT:    <PartyPopper className="w-3.5 h-3.5" />,
};

const TYPE_LABEL: Record<ProgramType, string> = {
  CLUB: '동아리', CAMPAIGN: '서포터즈', CONTEST: '공모전', EVENT: '이벤트',
};

const TYPE_COLOR: Record<ProgramType, string> = {
  CLUB: 'text-blue-400', CAMPAIGN: 'text-purple-400',
  CONTEST: 'text-amber-400', EVENT: 'text-green-400',
};

const ORG_CAT: Record<ProgramType, Exclude<Category, '전체'>> = {
  CLUB: '동아리', CAMPAIGN: '대외활동', CONTEST: '공모전', EVENT: '대외활동',
};

const CATEGORIES: Category[] = ['전체', '공모전', '대외활동', '동아리', '스터디·프로젝트'];
const SORT_OPTIONS: SortKey[] = ['등록일', 'D-day', '진행기간', '진행사항'];

/* ════════════════════════ 헬퍼 ════════════════════════ */
const today = new Date().toISOString().slice(0, 10);

function calcDday(end: string): number {
  return Math.max(0, Math.ceil((new Date(end).getTime() - new Date(today).getTime()) / 86400000));
}

function calcStatus(start: string, dday: number): Status {
  if (start > today)  return '접수예정';
  if (dday <= 0)      return '마감';
  if (dday <= 7)      return '마감임박';
  return '접수중';
}

function toActivity(p: Record<string, unknown>, cat: Exclude<Category, '전체'>): Activity {
  const end  = (p.end_date ?? p.recruit_end ?? '') as string;
  const dday = end ? calcDday(end) : 999;
  const start = (p.start_date ?? p.recruit_start ?? today) as string;
  return {
    id:           String(p.id),
    category:     cat,
    title:        String(p.title ?? ''),
    tags:         (p.tags ?? []) as string[],
    org:          String(p.org ?? (p.profiles as Record<string,unknown>)?.full_name ?? '개인'),
    dday,
    startDate:    start,
    endDate:      end || today,
    status:       calcStatus(start, dday),
    link:         (p.link ?? p.recruit_url) as string | undefined,
    registeredAt: String((p.registered_at ?? p.created_at ?? '')).slice(0, 10),
  };
}

/* ════════════════════════ 지원 바텀시트 ════════════════════════ */
interface ApplySheetProps {
  snap: OrgProgramSnap;
  name: string;
  onClose: () => void;
}

function ApplySheet({ snap, name, onClose }: ApplySheetProps) {
  const { profile } = useAuth();

  const [form, setForm] = useState({
    name:  profile?.full_name ?? '',
    email: '',
    phone: '',
  });
  const [answers,   setAnswers]   = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState(false);

  /* 기존 지원 여부 확인 */
  useEffect(() => {
    if (!profile?.id) return;
    supabase.from('org_applications')
      .select('id').eq('program_id', snap.id).eq('user_id', profile.id).single()
      .then(({ data }) => { if (data) setAlreadyApplied(true); });
  }, [snap.id, profile?.id]);

  const questions = snap.questions ?? [];
  const canSubmit = form.name.trim() && form.email.trim() &&
    questions.every(q => (answers[q.id] ?? '').trim());

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const answersJson = questions.length > 0
        ? Object.fromEntries(questions.map(q => [`q_${q.id}`, answers[q.id] ?? '']))
        : null;

      const { error } = await supabase.from('org_applications').insert({
        program_id: snap.id,
        user_id:    profile?.id ?? null,
        name:       form.name.trim(),
        email:      form.email.trim(),
        phone:      form.phone.trim() || null,
        answers:    answersJson,
        status:     'PENDING',
      });

      if (error) throw error;
      setDone(true);
    } catch (e) {
      alert('지원 중 오류가 발생했어요. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* 딤 */}
      <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* 시트 */}
      <motion.div
        className="relative bg-[#111] rounded-t-3xl max-h-[90vh] flex flex-col"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
      >
        {/* 핸들 */}
        <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mt-4 mb-2 flex-shrink-0" />

        {/* 스크롤 영역 */}
        <div className="overflow-y-auto flex-1 px-5 pb-6">

          {/* 헤더 */}
          <div className="flex items-start justify-between gap-3 mb-5 pt-1">
            <div className="flex-1 min-w-0">
              <div className={`flex items-center gap-1.5 mb-1.5 text-xs font-black ${TYPE_COLOR[snap.type]}`}>
                {TYPE_ICON[snap.type]}
                {TYPE_LABEL[snap.type]}
              </div>
              <h2 className="text-lg font-black text-white leading-snug">{name}</h2>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-white/40">
                <Building2 className="w-3 h-3" />
                {snap.org_name}
                {snap.capacity && (
                  <>
                    <span className="text-white/20">·</span>
                    <Users className="w-3 h-3" />
                    {snap.capacity}명 모집
                  </>
                )}
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-1">
              <X className="w-4 h-4 text-white/70" />
            </button>
          </div>

          {/* 모집 기간 */}
          {(snap.recruit_start || snap.recruit_end) && (
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-4">
              <Calendar className="w-4 h-4 text-white/40 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-white/40 font-bold mb-0.5">모집 기간</p>
                <p className="text-xs text-white/80 font-medium">
                  {snap.recruit_start ?? '-'} ~ {snap.recruit_end ?? '-'}
                </p>
              </div>
            </div>
          )}

          {/* 소개 */}
          {snap.description && (
            <div className="mb-5">
              <p className="text-[10px] text-white/40 font-black tracking-wide mb-2">프로그램 소개</p>
              <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{snap.description}</p>
            </div>
          )}

          {/* 이미 지원 */}
          {alreadyApplied ? (
            <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-4 my-4">
              <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-black text-emerald-400">이미 지원했어요</p>
                <p className="text-xs text-white/40 mt-0.5">결과는 이메일로 안내드려요</p>
              </div>
            </div>
          ) : done ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-8 gap-3"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="w-7 h-7 text-emerald-400" />
              </div>
              <p className="font-black text-white text-base">지원 완료!</p>
              <p className="text-sm text-white/40 text-center">결과는 이메일로 안내드릴게요</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 px-6 py-2.5 bg-white/10 rounded-xl text-sm font-bold text-white/80"
              >
                닫기
              </button>
            </motion.div>
          ) : (
            <>
              {/* 지원 양식 */}
              <div className="space-y-3 mb-5">
                <p className="text-[10px] text-white/40 font-black tracking-wide">지원자 정보</p>

                <div className="space-y-2.5">
                  <SheetInput
                    label="이름 *"
                    value={form.name}
                    onChange={v => setForm(p => ({ ...p, name: v }))}
                    placeholder="실명을 입력하세요"
                  />
                  <SheetInput
                    label="이메일 *"
                    value={form.email}
                    onChange={v => setForm(p => ({ ...p, email: v }))}
                    placeholder="연락받을 이메일"
                    type="email"
                  />
                  <SheetInput
                    label="연락처"
                    value={form.phone}
                    onChange={v => setForm(p => ({ ...p, phone: v }))}
                    placeholder="010-0000-0000 (선택)"
                    type="tel"
                  />
                </div>
              </div>

              {/* 지원 질문 (CAMPAIGN 타입) */}
              {questions.length > 0 && (
                <div className="space-y-3 mb-6">
                  <p className="text-[10px] text-white/40 font-black tracking-wide">지원 질문</p>
                  {questions.map((q, i) => (
                    <div key={q.id}>
                      <p className="text-xs text-white/70 font-bold mb-1.5">
                        Q{i + 1}. {q.text} *
                      </p>
                      <textarea
                        value={answers[q.id] ?? ''}
                        onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                        placeholder="답변을 입력하세요"
                        rows={3}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80
                                   placeholder:text-white/20 outline-none focus:border-white/25 resize-none"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* 제출 버튼 */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="w-full py-3.5 rounded-2xl bg-white text-black font-black text-sm
                           disabled:opacity-30 flex items-center justify-center gap-2 transition-opacity"
              >
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" />지원 중...</>
                  : <><Send className="w-4 h-4" />지원하기</>
                }
              </button>

              <p className="text-center text-[10px] text-white/25 mt-3">
                지원 후 취소는 해당 기관에 직접 문의하세요
              </p>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── 시트용 인풋 ── */
function SheetInput({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string; value: string;
  onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div>
      <p className="text-[10px] text-white/40 font-bold mb-1">{label}</p>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80
                   placeholder:text-white/20 outline-none focus:border-white/25 transition-colors"
      />
    </div>
  );
}

/* ════════════════════════ 메인 ════════════════════════ */
export function ExploreActivities() {
  const navigate = useNavigate();

  const [selectedCat, setSelectedCat] = useState<Category>('전체');
  const [dbItems,     setDbItems]     = useState<Activity[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [sortKey,     setSortKey]     = useState<SortKey>('등록일');
  const [sortDesc,    setSortDesc]    = useState(true);
  const [showSort,    setShowSort]    = useState(false);
  const [showOrder,   setShowOrder]   = useState(false);
  const [showSearch,  setShowSearch]  = useState(false);

  /* 지원 시트 */
  const [applyTarget, setApplyTarget] = useState<{ snap: OrgProgramSnap; name: string } | null>(null);

  /* ── 데이터 로드 ── */
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);

      const [
        { data: acts },
        { data: projs },
        { data: orgProgs },
      ] = await Promise.all([
        supabase.from('activities').select('*').order('registered_at', { ascending: false }),
        supabase.from('projects')
          .select('id, title, field, tags, created_at, recruit_start, recruit_end, recruit_url, profiles!created_by(full_name)')
          .eq('is_recruiting', true),
        supabase.from('org_programs')
          .select('*, organizations(name)')
          .eq('phase', 'RECRUITING')
          .eq('is_public', true),
      ]);

      const actItems: Activity[] = (acts ?? []).map((a: Record<string,unknown>) =>
        toActivity(a, (a.category as Exclude<Category,'전체'>) ?? '대외활동')
      );

      const projItems: Activity[] = (projs ?? []).map((p: Record<string,unknown>) =>
        toActivity({
          ...p,
          org: (p.profiles as Record<string,unknown>)?.full_name ?? '개인',
        }, '스터디·프로젝트')
      );

      const orgItems: Activity[] = (orgProgs ?? []).map((p: Record<string,unknown>) => {
        const type = p.type as ProgramType;
        const orgRaw = p.organizations as Record<string,unknown> | null;
        const orgName = orgRaw?.name as string ?? '기관';
        const end  = (p.recruit_end ?? p.end_date ?? '') as string;
        const dday = end ? calcDday(end) : 999;
        const start = (p.recruit_start ?? p.start_date ?? today) as string;

        /* questions 파싱 */
        let questions: { id: string; text: string }[] | null = null;
        const rawQ = p.questions;
        if (Array.isArray(rawQ)) {
          questions = rawQ as { id: string; text: string }[];
        }

        const snap: OrgProgramSnap = {
          id:            String(p.id),
          type,
          description:   p.description as string | null,
          questions,
          capacity:      p.capacity as number | null,
          recruit_start: p.recruit_start as string | null,
          recruit_end:   p.recruit_end   as string | null,
          org_name:      orgName,
          field:         p.field as string | null,
        };

        const tags = [TYPE_LABEL[type]];
        if (p.field) tags.push(p.field as string);

        return {
          id:           String(p.id),
          category:     ORG_CAT[type],
          title:        String(p.name ?? ''),
          tags,
          org:          orgName,
          dday,
          startDate:    start,
          endDate:      end || today,
          status:       calcStatus(start, dday),
          registeredAt: String((p.created_at ?? '')).slice(0, 10),
          isOrgProgram: true,
          orgSnap:      snap,
        };
      });

      setDbItems([...actItems, ...projItems, ...orgItems]);
      setLoading(false);
    };
    void fetchAll();
  }, []);

  /* ── 필터 + 정렬 ── */
  const filtered = useMemo(() => {
    let list = dbItems.filter(a => {
      const matchCat = selectedCat === '전체' || a.category === selectedCat;
      const q = search.toLowerCase();
      const matchSearch = !q ||
        a.title.toLowerCase().includes(q) ||
        a.org.toLowerCase().includes(q) ||
        a.tags.some(t => t.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });

    list = [...list].sort((a, b) => {
      let diff = 0;
      if (sortKey === 'D-day')    diff = a.dday - b.dday;
      if (sortKey === '등록일')   diff = a.registeredAt.localeCompare(b.registeredAt);
      if (sortKey === '진행기간') diff = a.endDate.localeCompare(b.endDate);
      if (sortKey === '진행사항') diff = a.status.localeCompare(b.status);
      return sortDesc ? -diff : diff;
    });

    return list;
  }, [dbItems, selectedCat, search, sortKey, sortDesc]);

  /* ── 렌더 ── */
  return (
    <div className="min-h-screen bg-black text-white pb-28">

      {/* 타이틀 */}
      <div className="px-4 pt-6 pb-3">
        <h1 className="text-xl font-bold">비교과 탐색</h1>
        <p className="text-white/40 text-xs mt-0.5">공모전 · 대외활동 · 동아리 · 서포터즈</p>
      </div>

      {/* 카테고리 탭 */}
      <div className="flex gap-1.5 px-4 mb-3 overflow-x-auto scrollbar-hide">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCat(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all
              ${selectedCat === cat
                ? 'bg-white text-black border-white'
                : 'bg-white/5 text-white/50 border-white/10'
              }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 정렬 + 검색 */}
      <div className="flex items-center gap-2 px-4 mb-2">
        <div className="relative">
          <button
            onClick={() => { setShowSort(v => !v); setShowOrder(false); }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 text-xs text-white/70"
          >
            {sortKey} <ChevronDown className="h-3 w-3" />
          </button>
          {showSort && (
            <div className="absolute top-9 left-0 z-40 bg-[#1a1a1a] border border-white/15 rounded-xl overflow-hidden shadow-xl">
              {SORT_OPTIONS.map(opt => (
                <button key={opt} onClick={() => { setSortKey(opt); setShowSort(false); }}
                  className={`block w-full text-left px-4 py-2.5 text-xs transition-colors
                    ${sortKey === opt ? 'bg-white text-black font-bold' : 'text-white/70 hover:bg-white/10'}`}>
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => { setShowOrder(v => !v); setShowSort(false); }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 text-xs text-white/70"
          >
            {sortDesc ? '내림차순' : '오름차순'} <ChevronDown className="h-3 w-3" />
          </button>
          {showOrder && (
            <div className="absolute top-9 left-0 z-40 bg-[#1a1a1a] border border-white/15 rounded-xl overflow-hidden shadow-xl">
              {['내림차순', '오름차순'].map(opt => (
                <button key={opt} onClick={() => { setSortDesc(opt === '내림차순'); setShowOrder(false); }}
                  className={`block w-full text-left px-4 py-2.5 text-xs transition-colors
                    ${(sortDesc ? '내림차순' : '오름차순') === opt ? 'bg-white text-black font-bold' : 'text-white/70 hover:bg-white/10'}`}>
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1" />

        <button onClick={() => setShowSearch(v => !v)}
          className="p-1.5 rounded-lg border border-white/15 bg-white/5 text-white/70">
          <Search className="h-4 w-4" />
        </button>
      </div>

      {showSearch && (
        <div className="px-4 mb-2">
          <input
            autoFocus
            placeholder="검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5
                       text-sm text-white placeholder-white/30 outline-none focus:border-white/30 transition-all"
          />
        </div>
      )}

      <div className="px-4 mb-1">
        <span className="text-[11px] text-white/30">
          {loading ? '불러오는 중...' : `총 ${filtered.length}건`}
        </span>
      </div>

      {/* 목록 */}
      <div className="px-4 flex flex-col divide-y divide-white/6">
        {loading ? (
          <div className="py-20 flex items-center justify-center gap-2 text-white/30">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">불러오는 중...</span>
          </div>
        ) : filtered.map(item => (
          <div
            key={`${item.isOrgProgram ? 'org' : 'act'}-${item.id}`}
            className="py-3.5 cursor-pointer active:bg-white/3 rounded-lg transition-colors"
            onClick={() => {
              if (item.isOrgProgram && item.orgSnap) {
                setApplyTarget({ snap: item.orgSnap, name: item.title });
              } else {
                navigate(`/explore/activities/${item.id}`);
              }
            }}
          >
            {/* 제목 + 링크 */}
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <p className="text-[13.5px] font-semibold leading-snug flex-1">{item.title}</p>
              {item.isOrgProgram ? (
                /* org 프로그램: 지원 화살표 */
                <div className="shrink-0 mt-0.5 flex items-center gap-0.5 text-white/30">
                  <span className="text-[10px]">지원</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              ) : item.link ? (
                <a href={item.link} target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="shrink-0 mt-0.5 text-white/30 hover:text-white transition-colors">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </div>

            {/* 태그 */}
            <div className="flex flex-wrap gap-1 mb-2">
              {/* org 프로그램은 타입 뱃지 강조 */}
              {item.isOrgProgram && item.orgSnap && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded bg-white/8 font-black flex items-center gap-1 ${TYPE_COLOR[item.orgSnap.type]}`}>
                  {TYPE_ICON[item.orgSnap.type]}
                  {TYPE_LABEL[item.orgSnap.type]}
                </span>
              )}
              {item.tags
                .filter(t => !item.isOrgProgram || t !== TYPE_LABEL[item.orgSnap!.type])
                .map(tag => (
                  <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/30">
                    {tag}
                  </span>
                ))}
            </div>

            {/* 메타 */}
            <div className="flex items-center gap-3 text-[11px]">
              <span className="text-white/40 truncate max-w-[100px]">{item.org}</span>
              <span className="text-white/25">|</span>
              <span className={`font-bold ${item.dday <= 7 ? 'text-red-400' : 'text-white/50'}`}>
                D-{item.dday === 999 ? '?' : item.dday}
              </span>
              <span className="text-white/25">|</span>
              <span className="text-white/35">{item.startDate} ~ {item.endDate}</span>
              <span className="text-white/25">|</span>
              <span className={`font-semibold ${STATUS_STYLE[item.status]}`}>{item.status}</span>
            </div>
          </div>
        ))}

        {!loading && filtered.length === 0 && (
          <div className="py-20 text-center text-white/30 text-sm">검색 결과가 없습니다</div>
        )}
      </div>

      {/* 지원 바텀시트 */}
      <AnimatePresence>
        {applyTarget && (
          <ApplySheet
            snap={applyTarget.snap}
            name={applyTarget.name}
            onClose={() => setApplyTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
