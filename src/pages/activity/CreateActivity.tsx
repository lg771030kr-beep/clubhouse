import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, CheckCircle2, Plus, X, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

/* ── 통합 분야 칩 ── */
const ACTIVITY_FIELDS = [
  '스터디', '프로젝트', '해커톤', '공모전', '사이드프로젝트', '동아리', '기타',
];

const STACK_TAGS = [
  'React', 'TypeScript', 'JavaScript', 'Python', 'Next.js', 'Vue',
  'Flutter', 'Swift', 'Kotlin', 'Spring', 'FastAPI', 'Django',
  'PostgreSQL', 'Supabase', 'Firebase', 'TailwindCSS', 'Figma', 'AI/ML',
];

/* ── 공통 스타일 ── */
const inputCls = `w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3
  text-white placeholder-white/25 text-sm outline-none
  focus:border-white/30 focus:bg-white/[0.08] transition-all`;
const labelCls = 'text-white/50 text-xs font-black uppercase tracking-widest';

const slide = {
  initial:    { opacity: 0, height: 0 },
  animate:    { opacity: 1, height: 'auto' },
  exit:       { opacity: 0, height: 0 },
  transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
};

/* ══════════════════════════════════════════════
   메인 컴포넌트
══════════════════════════════════════════════ */
export function CreateActivity() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);
  const [error,      setError]      = useState('');

  /* ── 공통 필드 ── */
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [field,       setField]       = useState('');   // 분야 (ACTIVITY_FIELDS 중 하나)
  const [startDate,   setStartDate]   = useState('');
  const [endDate,     setEndDate]     = useState('');
  const [imageFile,   setImageFile]   = useState<File | null>(null);
  const [imagePreview,setImagePreview]= useState<string | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  /* ── 동아리 전용 (field === '동아리' 일 때만 표시) ── */
  const [affiliation, setAffiliation] = useState('');
  const [clubType,    setClubType]    = useState<'' | '교내' | '연합'>('');

  /* ── 프로젝트 계열 전용 (동아리가 아닐 때 표시) ── */
  const [githubUrl,  setGithubUrl]  = useState('');
  const [demoUrl,    setDemoUrl]    = useState('');
  const [tags,       setTags]       = useState<string[]>([]);
  const [tagInput,   setTagInput]   = useState('');
  const [isRecruit,  setIsRecruit]  = useState(false);
  const [recruit, setRecruit] = useState({
    start: '', end: '', url: '', headcount: '', eligibility: '',
  });

  const isClub = field === '동아리';

  /* ── 이미지 선택 ── */
  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { setError('이미지는 2MB 이하만 가능합니다.'); return; }
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
    setError('');
  };

  /* ── 분야 선택 시 전용 필드 초기화 ── */
  const handleFieldSelect = (f: string) => {
    setField(p => p === f ? '' : f);
    setError('');
    // 동아리 ↔ 기타 전환 시 각각 고유 값 리셋
    if (f !== '동아리') { setAffiliation(''); setClubType(''); }
    if (f === '동아리') { setGithubUrl(''); setDemoUrl(''); setTags([]); setIsRecruit(false); }
  };

  /* ── 태그 ── */
  const addTag = (t: string) => {
    const tag = t.trim();
    if (tag && !tags.includes(tag) && tags.length < 10) setTags(p => [...p, tag]);
    setTagInput('');
  };

  /* ── 제출 ── */
  const handleSubmit = async () => {
    setError('');
    if (!title.trim()) { setError('활동명을 입력해 주세요.'); return; }
    if (!field)        { setError('분야를 선택해 주세요.'); return; }

    setSubmitting(true);
    try {
      /* ── 이미지/로고 공통 업로드 ── */
      let imageUrl: string | null = null;
      if (imageFile && (user || profile?.id)) {
        const uid  = user?.id ?? profile?.id ?? 'anon';
        const path = `${isClub ? 'clubs/logos' : 'projects'}/${uid}_${Date.now()}_${imageFile.name}`;
        const { error: upErr } = await supabase.storage
          .from('club-assets').upload(path, imageFile, { upsert: true });
        if (!upErr) {
          const { data } = supabase.storage.from('club-assets').getPublicUrl(path);
          imageUrl = data.publicUrl;
        }
      }

      if (isClub) {
        /* ── 동아리 생성 ── */
        if (!profile?.id) throw new Error('로그인이 필요합니다.');
        const { data: clubData, error: clubErr } = await supabase
          .from('clubs').insert({
            name:          title.trim(),
            affiliation:   affiliation.trim() || null,
            club_type:     clubType || null,
            category:      null,
            description:   description.trim() || null,
            admin_id:      profile.id,
            logo_url:      imageUrl,
            is_recruiting: false,
          }).select().single();
        if (clubErr) throw clubErr;
        await supabase.from('club_members').insert({ club_id: clubData.id, user_id: profile.id, role: 'ADMIN' });
        await supabase.from('profiles').update({ role: 'ADMIN' }).eq('id', profile.id);
        await refreshProfile();
        setDone(true);
        setTimeout(() => navigate('/dashboard'), 1400);

      } else {
        /* ── 프로젝트/기타 활동 저장 ── */
        const { error: pErr } = await supabase.from('projects').insert({
          title:        title.trim(),
          description:  description.trim() || null,
          field,
          start_date:   startDate || null,
          end_date:     endDate   || null,
          github_url:   githubUrl || null,
          demo_url:     demoUrl   || null,
          image_url:    imageUrl,
          tags:         tags.length > 0 ? tags : null,
          is_personal:  true,
          created_by:   user!.id,
          is_recruiting: isRecruit,
          recruit_start:       isRecruit ? recruit.start       || null : null,
          recruit_end:         isRecruit ? recruit.end         || null : null,
          recruit_url:         isRecruit ? recruit.url         || null : null,
          recruit_headcount:   isRecruit ? recruit.headcount   || null : null,
          recruit_eligibility: isRecruit ? recruit.eligibility || null : null,
        });
        if (pErr) throw pErr;
        setDone(true);
        setTimeout(() => navigate('/portfolio'), 1400);
      }
    } catch (e: any) {
      setError(e.message ?? '저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── 완료 화면 ── */
  if (done) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1,   opacity: 1 }}
          transition={{ type: 'spring', damping: 18, stiffness: 260 }}
          className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center"
        >
          <CheckCircle2 className="w-8 h-8 text-white" />
        </motion.div>
        <p className="text-white font-black text-lg">활동이 등록됐습니다!</p>
        <p className="text-white/40 text-sm">잠시 후 이동합니다...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-32">

      {/* ── 헤더 ── */}
      <div className="sticky top-0 z-30 bg-black/90 backdrop-blur border-b border-white/8
                      flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-white/50 hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-black text-sm flex-1">활동 등록</span>
        <button
          onClick={handleSubmit} disabled={submitting}
          className="px-4 py-1.5 rounded-full bg-white text-black text-xs font-black
                     disabled:opacity-40 flex items-center gap-1.5"
        >
          {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {submitting ? '등록 중...' : '등록'}
        </button>
      </div>

      <div className="px-4 py-5 space-y-6 max-w-lg mx-auto">

        {/* ── 에러 ── */}
        <AnimatePresence>
          {error && (
            <motion.div {...slide}
              className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm overflow-hidden"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══ 이미지 ══ */}
        <div className="space-y-2">
          <p className={labelCls}>{isClub ? '로고 이미지' : '대표 이미지'}</p>
          <input ref={imageRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
          <button type="button" onClick={() => imageRef.current?.click()}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl
                       bg-white/5 border border-dashed border-white/15
                       hover:bg-white/[0.08] hover:border-white/25 transition-all">
            {imagePreview
              ? <img src={imagePreview} className="w-10 h-10 rounded-xl object-cover shrink-0" alt="preview" />
              : <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <Camera className="w-5 h-5 text-white/40" />
                </div>
            }
            <span className="text-sm text-white/50 flex-1 text-left">
              {imageFile ? imageFile.name : '이미지 선택 (선택 사항)'}
            </span>
            {imageFile && (
              <button type="button"
                onClick={e => { e.stopPropagation(); setImageFile(null); setImagePreview(null); }}
                className="text-white/30 hover:text-white/60 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </button>
        </div>

        {/* ══ 기본 정보 ══ */}
        <div className="space-y-3">
          <p className={labelCls}>기본 정보</p>
          <input
            placeholder="활동명 *"
            value={title} onChange={e => setTitle(e.target.value)}
            className={inputCls}
          />
          <textarea
            placeholder="활동 설명 (선택)"
            rows={3} value={description} onChange={e => setDescription(e.target.value)}
            className={`${inputCls} resize-none`}
          />
        </div>

        {/* ══ 분야 (통합 칩) ══ */}
        <div className="space-y-2">
          <p className={labelCls}>분야 *</p>
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_FIELDS.map(f => (
              <button key={f} type="button" onClick={() => handleFieldSelect(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  field === f
                    ? 'bg-white text-black'
                    : 'bg-white/8 text-white/60 hover:bg-white/15 border border-white/10'
                }`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* ── 동아리 선택 시: 소속/유형 ── */}
        <AnimatePresence>
          {isClub && (
            <motion.div key="club-fields" {...slide} className="space-y-3 overflow-hidden">
              <p className={labelCls}>소속 / 유형</p>
              <input placeholder="소속 대학/기관 (선택)" value={affiliation}
                onChange={e => setAffiliation(e.target.value)}
                className={inputCls} />
              <div className="flex gap-2">
                {(['교내', '연합'] as const).map(t => (
                  <button key={t} type="button"
                    onClick={() => setClubType(p => p === t ? '' : t)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${
                      clubType === t
                        ? 'bg-white text-black'
                        : 'bg-white/8 text-white/50 border border-white/10 hover:bg-white/12'
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══ 기간 ══ */}
        <div className="space-y-2">
          <p className={labelCls}>기간</p>
          <div className="flex items-center gap-2">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className={`${inputCls} flex-1 [color-scheme:dark]`} />
            <span className="text-white/30 font-bold shrink-0">~</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className={`${inputCls} flex-1 [color-scheme:dark]`} />
          </div>
        </div>

        {/* ── 동아리 외: 링크 ── */}
        <AnimatePresence>
          {!isClub && (
            <motion.div key="proj-links" {...slide} className="space-y-2 overflow-hidden">
              <p className={labelCls}>링크</p>
              <input placeholder="GitHub URL" value={githubUrl}
                onChange={e => setGithubUrl(e.target.value)} className={inputCls} />
              <input placeholder="Demo / 배포 URL" value={demoUrl}
                onChange={e => setDemoUrl(e.target.value)} className={inputCls} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 동아리 외: 기술 스택 ── */}
        <AnimatePresence>
          {!isClub && (
            <motion.div key="proj-stack" {...slide} className="space-y-2 overflow-hidden">
              <p className={labelCls}>기술 스택 태그</p>
              <div className="flex flex-wrap gap-1.5">
                {STACK_TAGS.filter(t => !tags.includes(t)).slice(0, 10).map(t => (
                  <button key={t} type="button" onClick={() => addTag(t)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-bold
                               bg-white/6 border border-white/10 text-white/50
                               hover:bg-white/12 hover:text-white/80 transition-all">
                    + {t}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input placeholder="직접 입력 후 Enter" value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); }}}
                  className={`${inputCls} flex-1`} />
                <button type="button" onClick={() => addTag(tagInput)}
                  className="px-3 py-2 bg-white/10 border border-white/15 rounded-xl text-white/60 hover:bg-white/20 transition-all">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map(t => (
                    <span key={t} className="flex items-center gap-1 px-2.5 py-1 rounded-full
                                             bg-white text-black text-[11px] font-black">
                      {t}
                      <button type="button" onClick={() => setTags(p => p.filter(x => x !== t))}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 동아리 외: 팀원 모집 ── */}
        <AnimatePresence>
          {!isClub && (
            <motion.div key="proj-recruit" {...slide} className="space-y-3 overflow-hidden">
              <div className="flex items-center justify-between">
                <p className={labelCls}>팀원 모집</p>
                <button type="button" onClick={() => setIsRecruit(p => !p)}
                  className={`relative w-10 h-[22px] rounded-full transition-colors ${isRecruit ? 'bg-white' : 'bg-white/20'}`}>
                  <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-black transition-all ${isRecruit ? 'left-[22px]' : 'left-[3px]'}`} />
                </button>
              </div>
              <AnimatePresence>
                {isRecruit && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
                    className="space-y-2 overflow-hidden">
                    <div className="flex gap-2">
                      <input type="date" placeholder="모집 시작" value={recruit.start}
                        onChange={e => setRecruit(p => ({ ...p, start: e.target.value }))}
                        className={`${inputCls} flex-1 [color-scheme:dark]`} />
                      <input type="date" placeholder="모집 마감" value={recruit.end}
                        onChange={e => setRecruit(p => ({ ...p, end: e.target.value }))}
                        className={`${inputCls} flex-1 [color-scheme:dark]`} />
                    </div>
                    <input placeholder="모집 인원 (예: 3명)" value={recruit.headcount}
                      onChange={e => setRecruit(p => ({ ...p, headcount: e.target.value }))}
                      className={inputCls} />
                    <input placeholder="지원 자격" value={recruit.eligibility}
                      onChange={e => setRecruit(p => ({ ...p, eligibility: e.target.value }))}
                      className={inputCls} />
                    <input placeholder="지원 링크 URL" value={recruit.url}
                      onChange={e => setRecruit(p => ({ ...p, url: e.target.value }))}
                      className={inputCls} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 하단 등록 버튼 ── */}
        <button
          onClick={handleSubmit} disabled={submitting}
          className="w-full py-4 bg-white text-black font-black rounded-2xl text-sm
                     hover:bg-white/90 active:scale-[0.98] transition-all
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? '등록 중...' : '활동 등록하기'}
        </button>

      </div>
    </div>
  );
}
