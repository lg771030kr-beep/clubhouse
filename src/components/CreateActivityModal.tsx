import React, { useState, useEffect, useRef } from 'react';
import {
  X, Loader2, CheckCircle2, Plus, Camera, BookOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

/* ── 상수 ── */
const ACTIVITY_FIELDS = [
  '스터디', '프로젝트', '동아리', '기타',
];
const STACK_TAGS = [
  'React', 'TypeScript', 'JavaScript', 'Python', 'Next.js', 'Vue',
  'Flutter', 'Swift', 'Kotlin', 'Spring', 'FastAPI', 'Django',
  'PostgreSQL', 'Supabase', 'Firebase', 'TailwindCSS', 'Figma', 'AI/ML',
];

/* ── 공통 스타일 ── */
const inp = `w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3
  text-white placeholder-white/25 text-sm outline-none
  focus:border-white/30 focus:bg-white/[0.08] transition-all`;
const lbl = 'text-white/50 text-[11px] font-black uppercase tracking-widest';

/* ══════════════════════════════════════════════ */
interface Props { onClose: () => void; onSuccess?: () => void; }

export function CreateActivityModal({ onClose, onSuccess }: Props) {
  const { user, profile, refreshProfile } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);
  const [error,      setError]      = useState('');

  /* 공통 */
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [field,       setField]       = useState('');
  const [startDate,   setStartDate]   = useState('');
  const [endDate,     setEndDate]     = useState('');
  const [imageFile,   setImageFile]   = useState<File | null>(null);
  const [imagePreview,setImagePreview]= useState<string | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  /* 동아리 전용 */
  const [affiliation, setAffiliation] = useState('');
  const [clubType,    setClubType]    = useState<'' | '교내' | '연합'>('');

  /* 기술 스택 (동아리 제외) */
  const [tags,     setTags]     = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [githubUrl,setGithubUrl]= useState('');
  const [demoUrl,  setDemoUrl]  = useState('');

  /* 활동 연결 (동아리 제외) */
  type ActivityOption = { id: string; name: string; kind: 'club' | 'project' };
  const [linkActivity,       setLinkActivity]       = useState(false);
  const [activityOptions,    setActivityOptions]    = useState<ActivityOption[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [selectedKind,       setSelectedKind]       = useState<'club' | 'project'>('club');

  const isClub = field === '동아리';

  /* 연결 가능 활동 fetch */
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const [{ data: memberships }, { data: projects }] = await Promise.all([
        supabase.from('club_members').select('clubs(id, name)').eq('user_id', user.id),
        supabase.from('projects')
          .select('id, title')
          .eq('created_by', user.id)
          .is('club_id', null)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      const clubs = ((memberships ?? []) as any[])
        .map((m: any) => Array.isArray(m.clubs) ? m.clubs[0] : m.clubs)
        .filter(Boolean)
        .map((c: any) => ({ id: c.id, name: c.name, kind: 'club' as const }));

      const projs = ((projects ?? []) as any[])
        .map((p: any) => ({ id: p.id, name: p.title, kind: 'project' as const }));

      const opts: ActivityOption[] = [...clubs, ...projs];
      setActivityOptions(opts);
      if (opts.length > 0) { setSelectedActivityId(opts[0].id); setSelectedKind(opts[0].kind); }
    })();
  }, [user?.id]);

  /* 분야 변경 시 초기화 */
  const handleField = (f: string) => {
    setField(p => p === f ? '' : f);
    setError('');
    if (f === '동아리') { setGithubUrl(''); setDemoUrl(''); setTags([]); setLinkActivity(false); }
    else { setAffiliation(''); setClubType(''); }
  };

  /* 이미지 */
  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { setError('이미지는 2MB 이하만 가능합니다.'); return; }
    setImageFile(f); setImagePreview(URL.createObjectURL(f)); setError('');
  };

  /* 태그 */
  const addTag = (t: string) => {
    const tag = t.trim();
    if (tag && !tags.includes(tag) && tags.length < 10) setTags(p => [...p, tag]);
    setTagInput('');
  };

  /* 제출 */
  const handleSubmit = async () => {
    setError('');
    if (!title.trim()) { setError('활동명을 입력해 주세요.'); return; }
    if (!field)        { setError('분야를 선택해 주세요.'); return; }
    setSubmitting(true);
    try {
      /* 이미지 업로드 */
      let imageUrl: string | null = null;
      if (imageFile && (user?.id || profile?.id)) {
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
        /* 동아리 생성 */
        if (!profile?.id) throw new Error('로그인이 필요합니다.');
        const { data: clubData, error: clubErr } = await supabase
          .from('clubs').insert({
            name:          title.trim(),
            affiliation:   affiliation.trim() || null,
            club_type:     clubType || null,
            description:   description.trim() || null,
            admin_id:      profile.id,
            logo_url:      imageUrl,
            is_recruiting: false,
          }).select().single();
        if (clubErr) throw clubErr;
        await supabase.from('club_members').insert({ club_id: clubData.id, user_id: profile.id, role: 'ADMIN' });
        await supabase.from('profiles').update({ role: 'ADMIN' }).eq('id', profile.id);
        await refreshProfile();

      } else {
        /* 활동 연결 정보 */
        const linked = linkActivity && selectedActivityId
          ? activityOptions.find(a => a.id === selectedActivityId) ?? null
          : null;

        /* 프로젝트 등록 */
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
          club_id:           linked?.kind === 'club'    ? linked.id : null,
          club_approved:     linked?.kind === 'club'    ? null      : true,
          parent_project_id: linked?.kind === 'project' ? linked.id : null,
        });
        if (pErr) throw pErr;
      }

      setDone(true);
      setTimeout(() => { onSuccess?.(); onClose(); }, 1400);
    } catch (e: any) {
      setError(e.message ?? '저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* 딤 */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
      />

      {/* 바텀시트 */}
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
        className="fixed inset-x-0 bottom-0 z-50 bg-[#111] border-t border-white/10
                   rounded-t-3xl shadow-2xl max-h-[95vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 드래그 핸들 */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 shrink-0" />

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 shrink-0">
          <h3 className="text-base font-black text-white">활동 만들기</h3>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {done ? (
          /* 완료 */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-16">
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 18, stiffness: 260 }}
              className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center"
            >
              <CheckCircle2 className="w-7 h-7 text-white" />
            </motion.div>
            <p className="text-white font-black">활동이 등록됐습니다!</p>
          </div>
        ) : (
          /* 폼 */
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

            {/* 에러 */}
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* 이미지 */}
            <div className="space-y-1.5">
              <p className={lbl}>{isClub ? '로고 이미지' : '대표 이미지'}</p>
              <input ref={imageRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
              <button type="button" onClick={() => imageRef.current?.click()}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl
                           bg-white/5 border border-dashed border-white/15
                           hover:bg-white/[0.08] hover:border-white/25 transition-all">
                {imagePreview
                  ? <img src={imagePreview} className="w-9 h-9 rounded-xl object-cover shrink-0" alt="" />
                  : <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                      <Camera className="w-4 h-4 text-white/40" />
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

            {/* 기본 정보 */}
            <div className="space-y-2">
              <p className={lbl}>기본 정보</p>
              <input placeholder="활동명 *" value={title} onChange={e => setTitle(e.target.value)} className={inp} />
              <textarea placeholder="활동 설명 (선택)" rows={3} value={description}
                onChange={e => setDescription(e.target.value)}
                className={`${inp} resize-none`} />
            </div>

            {/* 분야 */}
            <div className="space-y-2">
              <p className={lbl}>분야 *</p>
              <div className="flex flex-wrap gap-2">
                {ACTIVITY_FIELDS.map(f => (
                  <button key={f} type="button" onClick={() => handleField(f)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      field === f
                        ? 'bg-white text-black'
                        : 'bg-white/8 text-white/60 border border-white/10 hover:bg-white/15'
                    }`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* 동아리 전용: 소속/유형 */}
            <AnimatePresence>
              {isClub && (
                <motion.div key="club-extra"
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}
                  className="space-y-2 overflow-hidden">
                  <p className={lbl}>소속 / 유형</p>
                  <input placeholder="소속 대학/기관 (선택)" value={affiliation}
                    onChange={e => setAffiliation(e.target.value)} className={inp} />
                  <div className="flex gap-2">
                    {(['교내', '연합'] as const).map(t => (
                      <button key={t} type="button"
                        onClick={() => setClubType(p => p === t ? '' : t)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${
                          clubType === t ? 'bg-white text-black' : 'bg-white/8 text-white/50 border border-white/10 hover:bg-white/12'
                        }`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 기간 */}
            <div className="space-y-2">
              <p className={lbl}>기간</p>
              <div className="flex items-center gap-2">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className={`${inp} flex-1 [color-scheme:dark]`} />
                <span className="text-white/30 font-bold shrink-0">~</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className={`${inp} flex-1 [color-scheme:dark]`} />
              </div>
            </div>

            {/* 동아리 제외: 링크 */}
            <AnimatePresence>
              {!isClub && (
                <motion.div key="links"
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}
                  className="space-y-2 overflow-hidden">
                  <p className={lbl}>링크</p>
                  <input placeholder="GitHub URL" value={githubUrl}
                    onChange={e => setGithubUrl(e.target.value)} className={inp} />
                  <input placeholder="Demo / 배포 URL" value={demoUrl}
                    onChange={e => setDemoUrl(e.target.value)} className={inp} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* 동아리 제외: 기술 스택 */}
            <AnimatePresence>
              {!isClub && (
                <motion.div key="stack"
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}
                  className="space-y-2 overflow-hidden">
                  <p className={lbl}>기술 스택</p>
                  <div className="flex flex-wrap gap-1.5">
                    {STACK_TAGS.filter(t => !tags.includes(t)).slice(0, 10).map(t => (
                      <button key={t} type="button" onClick={() => addTag(t)}
                        className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/6 border border-white/10
                                   text-white/50 hover:bg-white/12 hover:text-white/80 transition-all">
                        + {t}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input placeholder="직접 입력 후 Enter" value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); }}}
                      className={`${inp} flex-1`} />
                    <button type="button" onClick={() => addTag(tagInput)}
                      className="px-3 bg-white/10 border border-white/15 rounded-xl text-white/60 hover:bg-white/20 transition-all">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map(t => (
                        <span key={t} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white text-black text-[11px] font-black">
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

            {/* 동아리 제외: 활동 연결 */}
            <AnimatePresence>
              {!isClub && activityOptions.length > 0 && (
                <motion.div key="link-activity"
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}
                  className="overflow-hidden">
                  {/* 토글 헤더 */}
                  <button type="button"
                    onClick={() => setLinkActivity(p => !p)}
                    className="w-full flex items-center gap-3 py-3 px-3 rounded-xl bg-white/[0.04] border border-white/8 hover:bg-white/[0.07] transition-all">
                    <span className={`p-2 rounded-lg transition-all ${linkActivity ? 'bg-white text-black' : 'bg-white/10 text-white/40'}`}>
                      <BookOpen className="w-4 h-4" />
                    </span>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-black text-white">활동 연결</p>
                      <p className="text-[11px] text-white/40">상위 활동의 하위 활동으로 연결됩니다</p>
                    </div>
                    <div className={`w-10 h-[22px] rounded-full transition-colors relative ${linkActivity ? 'bg-white' : 'bg-white/15'}`}>
                      <div className={`absolute top-[3px] w-4 h-4 rounded-full transition-all ${linkActivity ? 'left-[22px] bg-black' : 'left-[3px] bg-white/50'}`} />
                    </div>
                  </button>

                  {/* 선택 칩 목록 */}
                  <AnimatePresence>
                    {linkActivity && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                        className="overflow-hidden mt-2 pl-2 space-y-2">
                        <p className="text-[11px] text-white/30 font-medium px-1">
                          연결할 상위 활동 선택
                          <span className="ml-1.5 text-white/20">· 이미 하위 활동인 항목은 제외됩니다</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {activityOptions.map(opt => (
                            <button key={opt.id} type="button"
                              onClick={() => { setSelectedActivityId(opt.id); setSelectedKind(opt.kind); }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                                selectedActivityId === opt.id
                                  ? 'bg-white text-black'
                                  : 'bg-white/8 text-white/60 border border-white/10 hover:bg-white/15'
                              }`}>
                              <span>{opt.kind === 'club' ? '🏫' : '📁'}</span>
                              <span className="max-w-[110px] truncate">{opt.name}</span>
                            </button>
                          ))}
                        </div>
                        {selectedActivityId && (
                          <p className="text-[11px] text-white/25 px-1">
                            {selectedKind === 'club'
                              ? '동아리 운영진 승인 후 연결이 완료됩니다'
                              : '선택한 프로젝트의 하위 활동으로 바로 연결됩니다'}
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 등록 버튼 */}
            <button onClick={handleSubmit} disabled={submitting}
              className="w-full py-4 bg-white text-black font-black rounded-2xl text-sm
                         hover:bg-white/90 active:scale-[0.98] transition-all
                         disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? '등록 중...' : '활동 등록하기'}
            </button>

          </div>
        )}
      </motion.div>
    </>
  );
}
