import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, ChevronRight, Check,
  School, Megaphone, Trophy, PartyPopper,
  Calendar, Users, Globe, Lock,
  Plus, X, GripVertical, Loader2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { ProgramType } from './OrgDashboard';

/* ════════════════════════ 상수 ════════════════════════ */
const PROGRAM_TYPES: {
  type: ProgramType;
  icon: React.ReactNode;
  label: string;
  desc: string;
  color: string;
  border: string;
  selectedBg: string;
}[] = [
  {
    type: 'CLUB',
    icon: <School className="w-6 h-6" />,
    label: '동아리',
    desc: '정기 모임, 출석·과제·회비 관리',
    color: 'text-blue-600',
    border: 'border-blue-200',
    selectedBg: 'bg-blue-50',
  },
  {
    type: 'CAMPAIGN',
    icon: <Megaphone className="w-6 h-6" />,
    label: '서포터즈 / 대외활동',
    desc: '모집 공고 → 지원자 선발 → 미션 운영',
    color: 'text-purple-600',
    border: 'border-purple-200',
    selectedBg: 'bg-purple-50',
  },
  {
    type: 'CONTEST',
    icon: <Trophy className="w-6 h-6" />,
    label: '공모전',
    desc: '출품 접수 → 심사 → 수상자 발표',
    color: 'text-amber-600',
    border: 'border-amber-200',
    selectedBg: 'bg-amber-50',
  },
  {
    type: 'EVENT',
    icon: <PartyPopper className="w-6 h-6" />,
    label: '이벤트',
    desc: '단발성 행사, 참가 신청 관리',
    color: 'text-green-600',
    border: 'border-green-200',
    selectedBg: 'bg-green-50',
  },
];

const FIELDS = ['마케팅', '기술/IT', '디자인', '기획', '영업', '콘텐츠', '연구', '교육', '사회공헌', '기타'];

/* ════════════════════════ 입력 헬퍼 ════════════════════════ */
const inputCls =
  'w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 text-sm font-medium ' +
  'placeholder-gray-300 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition-all';
const labelCls = 'block text-xs font-black text-gray-500 mb-1.5 uppercase tracking-wide';

/* ════════════════════════ 폼 상태 타입 ════════════════════════ */
interface FormData {
  /* step 1 */
  type: ProgramType | null;
  /* step 2 */
  name: string;
  description: string;
  field: string;
  capacity: string;
  start_date: string;
  end_date: string;
  recruit_start: string;
  recruit_end: string;
  /* step 3 — 세부 */
  // CLUB
  club_category: string;
  club_has_fee: boolean;
  // CAMPAIGN / CONTEST / EVENT
  app_questions: string[];          // 지원서 질문
  submission_types: string[];       // 출품 항목 (공모전)
  event_location: string;
  event_is_online: boolean;
  /* step 4 */
  is_public: boolean;
}

const INIT: FormData = {
  type: null,
  name: '', description: '', field: '', capacity: '',
  start_date: '', end_date: '', recruit_start: '', recruit_end: '',
  club_category: '', club_has_fee: false,
  app_questions: ['지원 동기를 작성해주세요.', '자신을 소개해주세요.'],
  submission_types: ['제출 파일 (PDF/ZIP)'],
  event_location: '', event_is_online: false,
  is_public: true,
};

/* ════════════════════════ 스텝 정의 ════════════════════════ */
const STEP_LABELS = ['유형 선택', '기본 정보', '세부 설정', '공개 설정'];

/* ════════════════════════ 컴포넌트 ════════════════════════ */
export function OrgProgramCreate() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [step,    setStep]    = useState(0);
  const [form,    setForm]    = useState<FormData>(INIT);
  const [dir,     setDir]     = useState<1 | -1>(1);   // 슬라이드 방향
  const [saving,  setSaving]  = useState(false);
  const [newQ,    setNewQ]    = useState('');            // 새 질문 입력

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  /* ── 스텝 이동 ── */
  const goNext = () => { setDir(1);  setStep(s => s + 1); };
  const goPrev = () => { setDir(-1); setStep(s => s - 1); };

  /* ── 유효성 ── */
  const canNext = () => {
    if (step === 0) return !!form.type;
    if (step === 1) return !!form.name.trim() && !!form.start_date;
    return true;
  };

  /* ── 저장 ── */
  const handleCreate = async () => {
    if (!profile?.id) return;
    setSaving(true);
    try {
      /* 기관 조회 */
      const { data: orgData } = await supabase
        .from('organizations')
        .select('id')
        .eq('owner_id', profile.id)
        .single();

      if (!orgData) {
        alert('기관 정보를 찾을 수 없습니다. 설정에서 기관을 먼저 등록해주세요.');
        return;
      }

      const { data: created, error } = await supabase
        .from('org_programs')
        .insert({
          org_id:        orgData.id,
          name:          form.name.trim(),
          type:          form.type,
          phase:         'DRAFT',
          description:   form.description.trim() || null,
          field:         form.field || null,
          capacity:      form.capacity ? parseInt(form.capacity) : null,
          start_date:    form.start_date || null,
          end_date:      form.end_date || null,
          recruit_start: form.recruit_start || null,
          recruit_end:   form.recruit_end || null,
          is_public:     form.is_public,
        })
        .select('id')
        .single();

      if (error) throw error;
      navigate(`/org/programs/${created.id}`, { replace: true });
    } catch (e) {
      alert('생성 실패: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setSaving(false);
    }
  };

  /* ════════════════════════ 렌더 ════════════════════════ */
  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      {/* ── 헤더 ── */}
      <div className="bg-white border-b border-gray-200 px-4 pt-safe">
        <div className="max-w-lg mx-auto flex items-center gap-3 py-4">
          <button
            onClick={() => step === 0 ? navigate(-1) : goPrev()}
            className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">새 프로그램</p>
            <h1 className="text-sm font-black text-gray-900">{STEP_LABELS[step]}</h1>
          </div>
          <span className="text-xs font-black text-gray-400">{step + 1} / {STEP_LABELS.length}</span>
        </div>

        {/* 프로그레스 바 */}
        <div className="max-w-lg mx-auto pb-0">
          <div className="flex gap-1 pb-3">
            {STEP_LABELS.map((_, i) => (
              <div key={i} className="flex-1 h-1 rounded-full overflow-hidden bg-gray-100">
                <motion.div
                  className="h-full bg-gray-900 rounded-full"
                  initial={false}
                  animate={{ width: i <= step ? '100%' : '0%' }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 콘텐츠 ── */}
      <div className="max-w-lg mx-auto px-4 py-6 overflow-hidden">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={{
              enter:  (d: number) => ({ x: d * 40, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit:   (d: number) => ({ x: d * -40, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            {step === 0 && <Step1 form={form} set={set} />}
            {step === 1 && <Step2 form={form} set={set} />}
            {step === 2 && <Step3 form={form} set={set} newQ={newQ} setNewQ={setNewQ} />}
            {step === 3 && <Step4 form={form} set={set} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── 하단 버튼 ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 pb-safe">
        <div className="max-w-lg mx-auto">
          {step < STEP_LABELS.length - 1 ? (
            <button
              onClick={goNext}
              disabled={!canNext()}
              className="w-full py-3.5 rounded-2xl bg-gray-900 text-white font-black text-sm
                         disabled:opacity-30 hover:bg-gray-800 transition-all
                         flex items-center justify-center gap-2"
            >
              다음 <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={saving || !canNext()}
              className="w-full py-3.5 rounded-2xl bg-gray-900 text-white font-black text-sm
                         disabled:opacity-30 hover:bg-gray-800 transition-all
                         flex items-center justify-center gap-2"
            >
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" />생성 중...</>
                : <><Check className="w-4 h-4" />프로그램 만들기</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   STEP 1 — 유형 선택
══════════════════════════════════════ */
function Step1({ form, set }: { form: FormData; set: <K extends keyof FormData>(k: K, v: FormData[K]) => void }) {
  return (
    <div className="space-y-3">
      <div className="mb-5">
        <h2 className="text-xl font-black text-gray-900">어떤 프로그램인가요?</h2>
        <p className="text-sm text-gray-400 font-medium mt-1">유형에 따라 관리 기능이 달라집니다</p>
      </div>
      {PROGRAM_TYPES.map(({ type, icon, label, desc, color, border, selectedBg }) => {
        const selected = form.type === type;
        return (
          <motion.button
            key={type}
            type="button"
            onClick={() => set('type', type)}
            whileTap={{ scale: 0.98 }}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all
              ${selected
                ? `${selectedBg} ${border} ring-2 ring-offset-1 ring-current ${color}`
                : 'bg-white border-gray-100 hover:border-gray-200'
              }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors
              ${selected ? `bg-white shadow-sm ${color}` : 'bg-gray-50 text-gray-400'}`}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-black text-sm ${selected ? 'text-gray-900' : 'text-gray-700'}`}>{label}</p>
              <p className={`text-xs font-medium mt-0.5 ${selected ? 'text-gray-500' : 'text-gray-400'}`}>{desc}</p>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
              ${selected ? `bg-current border-current ${color}` : 'border-gray-200'}`}>
              {selected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════
   STEP 2 — 기본 정보
══════════════════════════════════════ */
function Step2({ form, set }: { form: FormData; set: <K extends keyof FormData>(k: K, v: FormData[K]) => void }) {
  const isCampaignOrContest = form.type === 'CAMPAIGN' || form.type === 'CONTEST' || form.type === 'EVENT';
  const tm = PROGRAM_TYPES.find(t => t.type === form.type)!;

  return (
    <div className="space-y-5">
      <div className="mb-5">
        <div className={`inline-flex items-center gap-1.5 text-xs font-black px-2.5 py-1 rounded-full border mb-3 ${tm.color} ${tm.border} ${tm.selectedBg}`}>
          {tm.icon}{tm.label}
        </div>
        <h2 className="text-xl font-black text-gray-900">기본 정보를 입력하세요</h2>
      </div>

      {/* 이름 */}
      <div>
        <label className={labelCls}>프로그램 이름 <span className="text-red-400">*</span></label>
        <input
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder={
            form.type === 'CLUB'     ? '예: 스타트 창업 동아리 7기' :
            form.type === 'CAMPAIGN' ? '예: 2026 브랜드 서포터즈' :
            form.type === 'CONTEST'  ? '예: 제3회 청년 창업 아이디어 공모전' :
                                       '예: 2026 신입생 오리엔테이션'
          }
          className={inputCls}
        />
      </div>

      {/* 설명 */}
      <div>
        <label className={labelCls}>프로그램 소개</label>
        <textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="프로그램을 간략하게 소개해주세요..."
          rows={3}
          className={inputCls + ' resize-none'}
        />
      </div>

      {/* 분야 */}
      <div>
        <label className={labelCls}>분야</label>
        <div className="flex flex-wrap gap-2">
          {FIELDS.map(f => (
            <button
              key={f} type="button"
              onClick={() => set('field', form.field === f ? '' : f)}
              className={`px-3 py-1.5 rounded-full text-xs font-black transition-all
                ${form.field === f
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* 모집 기간 (공고형) */}
      {isCampaignOrContest && (
        <div>
          <label className={labelCls}>모집 기간</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-gray-400 font-bold mb-1">시작</p>
              <input type="date" value={form.recruit_start}
                onChange={e => set('recruit_start', e.target.value)}
                className={inputCls} />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold mb-1">마감</p>
              <input type="date" value={form.recruit_end}
                onChange={e => set('recruit_end', e.target.value)}
                className={inputCls} />
            </div>
          </div>
        </div>
      )}

      {/* 활동 기간 */}
      <div>
        <label className={labelCls}>활동 기간 <span className="text-red-400">*</span></label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] text-gray-400 font-bold mb-1">시작</p>
            <input type="date" value={form.start_date}
              onChange={e => set('start_date', e.target.value)}
              className={inputCls} />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-bold mb-1">종료</p>
            <input type="date" value={form.end_date}
              onChange={e => set('end_date', e.target.value)}
              className={inputCls} />
          </div>
        </div>
      </div>

      {/* 모집 인원 */}
      <div>
        <label className={labelCls}>모집 인원</label>
        <div className="flex items-center gap-2">
          <input
            type="number" min="1"
            value={form.capacity}
            onChange={e => set('capacity', e.target.value)}
            placeholder="예: 20"
            className={inputCls + ' w-32'}
          />
          <span className="text-sm text-gray-400 font-medium">명</span>
          <span className="text-xs text-gray-300 font-medium">(미입력 시 제한 없음)</span>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   STEP 3 — 세부 설정 (타입별)
══════════════════════════════════════ */
function Step3({
  form, set, newQ, setNewQ,
}: {
  form: FormData;
  set: <K extends keyof FormData>(k: K, v: FormData[K]) => void;
  newQ: string;
  setNewQ: (v: string) => void;
}) {
  const addQuestion = () => {
    if (!newQ.trim()) return;
    set('app_questions', [...form.app_questions, newQ.trim()]);
    setNewQ('');
  };
  const removeQuestion = (i: number) =>
    set('app_questions', form.app_questions.filter((_, idx) => idx !== i));

  const addSubmissionType = () => {
    if (!newQ.trim()) return;
    set('submission_types', [...form.submission_types, newQ.trim()]);
    setNewQ('');
  };
  const removeSubmissionType = (i: number) =>
    set('submission_types', form.submission_types.filter((_, idx) => idx !== i));

  /* ── 동아리 ── */
  if (form.type === 'CLUB') {
    const CATEGORIES = ['학술', '체육', '문화/예술', '봉사', '창업', '취미', '종교', '기타'];
    return (
      <div className="space-y-5">
        <div className="mb-5">
          <h2 className="text-xl font-black text-gray-900">동아리 설정</h2>
          <p className="text-sm text-gray-400 font-medium mt-1">기본 운영 방식을 설정하세요</p>
        </div>

        <div>
          <label className={labelCls}>카테고리</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(c => (
              <button key={c} type="button"
                onClick={() => set('club_category', form.club_category === c ? '' : c)}
                className={`px-3 py-1.5 rounded-full text-xs font-black transition-all
                  ${form.club_category === c
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-white border border-gray-200">
          <div>
            <p className="text-sm font-black text-gray-800">회비 관리</p>
            <p className="text-xs text-gray-400 font-medium mt-0.5">회비 내역을 앱에서 관리합니다</p>
          </div>
          <button type="button" onClick={() => set('club_has_fee', !form.club_has_fee)}
            className={`w-12 h-6 rounded-full transition-all relative ${form.club_has_fee ? 'bg-blue-600' : 'bg-gray-200'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${form.club_has_fee ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>
      </div>
    );
  }

  /* ── 서포터즈/대외활동 ── */
  if (form.type === 'CAMPAIGN') {
    return (
      <div className="space-y-5">
        <div className="mb-5">
          <h2 className="text-xl font-black text-gray-900">지원서 구성</h2>
          <p className="text-sm text-gray-400 font-medium mt-1">지원자가 답변할 질문을 설정하세요</p>
        </div>

        <div className="space-y-2">
          {form.app_questions.map((q, i) => (
            <div key={i} className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5">
              <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
              <span className="flex-1 text-sm font-medium text-gray-700">{q}</span>
              <button type="button" onClick={() => removeQuestion(i)}
                className="text-gray-300 hover:text-red-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            value={newQ}
            onChange={e => setNewQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addQuestion()}
            placeholder="새 질문 입력..."
            className={inputCls + ' flex-1'}
          />
          <button type="button" onClick={addQuestion} disabled={!newQ.trim()}
            className="px-4 py-3 rounded-xl bg-gray-900 text-white font-black text-sm
                       disabled:opacity-30 hover:bg-gray-800 transition-colors shrink-0">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[10px] text-gray-400 font-medium">
          * 이름, 연락처, 학교 등 기본 정보는 자동으로 수집됩니다
        </p>
      </div>
    );
  }

  /* ── 공모전 ── */
  if (form.type === 'CONTEST') {
    return (
      <div className="space-y-5">
        <div className="mb-5">
          <h2 className="text-xl font-black text-gray-900">출품 항목 설정</h2>
          <p className="text-sm text-gray-400 font-medium mt-1">참가자가 제출할 항목을 설정하세요</p>
        </div>

        <div className="space-y-2">
          {form.submission_types.map((s, i) => (
            <div key={i} className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5">
              <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
              <span className="flex-1 text-sm font-medium text-gray-700">{s}</span>
              <button type="button" onClick={() => removeSubmissionType(i)}
                className="text-gray-300 hover:text-red-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            value={newQ}
            onChange={e => setNewQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSubmissionType()}
            placeholder="예: 사업계획서 (HWP/PDF)"
            className={inputCls + ' flex-1'}
          />
          <button type="button" onClick={addSubmissionType} disabled={!newQ.trim()}
            className="px-4 py-3 rounded-xl bg-gray-900 text-white font-black text-sm
                       disabled:opacity-30 hover:bg-gray-800 transition-colors shrink-0">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  /* ── 이벤트 ── */
  return (
    <div className="space-y-5">
      <div className="mb-5">
        <h2 className="text-xl font-black text-gray-900">이벤트 설정</h2>
        <p className="text-sm text-gray-400 font-medium mt-1">행사 진행 방식을 설정하세요</p>
      </div>

      <div className="flex items-center justify-between p-4 rounded-xl bg-white border border-gray-200">
        <div className="flex items-center gap-3">
          <Globe className={`w-5 h-5 ${form.event_is_online ? 'text-blue-500' : 'text-gray-400'}`} />
          <div>
            <p className="text-sm font-black text-gray-800">온라인 행사</p>
            <p className="text-xs text-gray-400 font-medium mt-0.5">오프라인이면 끄세요</p>
          </div>
        </div>
        <button type="button" onClick={() => set('event_is_online', !form.event_is_online)}
          className={`w-12 h-6 rounded-full transition-all relative ${form.event_is_online ? 'bg-blue-500' : 'bg-gray-200'}`}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${form.event_is_online ? 'left-6' : 'left-0.5'}`} />
        </button>
      </div>

      {!form.event_is_online && (
        <div>
          <label className={labelCls}>장소</label>
          <input
            value={form.event_location}
            onChange={e => set('event_location', e.target.value)}
            placeholder="예: 서울시 강남구 테헤란로 123"
            className={inputCls}
          />
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════
   STEP 4 — 공개 설정 + 미리보기
══════════════════════════════════════ */
function Step4({ form, set }: { form: FormData; set: <K extends keyof FormData>(k: K, v: FormData[K]) => void }) {
  const tm = PROGRAM_TYPES.find(t => t.type === form.type)!;

  return (
    <div className="space-y-5">
      <div className="mb-5">
        <h2 className="text-xl font-black text-gray-900">공개 설정</h2>
        <p className="text-sm text-gray-400 font-medium mt-1">플랫폼에 공개 홍보할지 선택하세요</p>
      </div>

      {/* 공개 / 비공개 카드 */}
      <div className="grid grid-cols-2 gap-3">
        {[
          {
            val: true,
            icon: <Globe className="w-5 h-5" />,
            title: '공개',
            desc: '플랫폼에 노출되어 누구나 볼 수 있습니다',
          },
          {
            val: false,
            icon: <Lock className="w-5 h-5" />,
            title: '비공개',
            desc: '링크를 아는 사람만 접근할 수 있습니다',
          },
        ].map(({ val, icon, title, desc }) => (
          <button key={String(val)} type="button"
            onClick={() => set('is_public', val)}
            className={`p-4 rounded-2xl border-2 text-left transition-all
              ${form.is_public === val
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3
              ${form.is_public === val ? 'bg-white/15' : 'bg-gray-100'}`}>
              {icon}
            </div>
            <p className="font-black text-sm">{title}</p>
            <p className={`text-[11px] font-medium mt-1 leading-snug
              ${form.is_public === val ? 'text-white/60' : 'text-gray-400'}`}>
              {desc}
            </p>
          </button>
        ))}
      </div>

      {/* 요약 미리보기 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">생성 요약</p>
        <div className={`inline-flex items-center gap-1.5 text-xs font-black px-2.5 py-1 rounded-full border ${tm.color} ${tm.border} ${tm.selectedBg}`}>
          {tm.icon}{tm.label}
        </div>
        <div className="space-y-2">
          {[
            ['이름',     form.name],
            ['분야',     form.field  || '—'],
            ['모집 인원', form.capacity ? `${form.capacity}명` : '제한 없음'],
            ['활동 기간', form.start_date
              ? `${form.start_date}${form.end_date ? ` ~ ${form.end_date}` : ' ~'}`
              : '—'],
            ...(form.recruit_start ? [['모집 기간', `${form.recruit_start} ~ ${form.recruit_end || '미정'}`] as [string, string]] : []),
            ['공개 여부', form.is_public ? '공개' : '비공개'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-gray-400 font-medium">{label}</span>
              <span className="text-gray-900 font-black truncate max-w-[60%] text-right">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 p-3.5 rounded-xl bg-gray-50 border border-gray-200">
        <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
        <p className="text-xs text-gray-500 font-medium">
          생성 후 <strong className="text-gray-700">임시저장</strong> 상태로 시작합니다.
          준비가 완료되면 대시보드에서 <strong className="text-gray-700">모집 시작</strong>으로 변경하세요.
        </p>
      </div>
    </div>
  );
}
