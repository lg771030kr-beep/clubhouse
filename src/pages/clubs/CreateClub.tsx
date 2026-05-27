import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Save, Loader2, CheckCircle2, Camera, X, ChevronDown, FileText, ChevronLeft,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const CATEGORIES = ['문화/예술/공연', '봉사/사회활동', '학술/교양', '창업/취업', '어학', '체육', '친목', '기타'];

/* PDF → base64 변환 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // data:...;base64, 이후
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function CreateClub() {
  const { profile, refreshProfile } = useAuth();
  const navigate    = useNavigate();

  const [form, setForm] = useState({
    name:        '',
    affiliation: '',
    club_type:   '' as '' | '교내' | '연합',
    category:    '',
    description: '',
  });
  const [isSaving,    setIsSaving]    = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [toast,       setToast]       = useState<string | null>(null);
  const [catOpen,     setCatOpen]     = useState(false);

  /* 로고 */
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile,    setLogoFile]    = useState<File | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  /* 소개서 PDF */
  const [brochureFile, setBrochureFile] = useState<File | null>(null);
  const brochureRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { showToast('이미지 파일은 2MB 이하만 업로드 가능합니다.'); return; }
    if (!f.type.startsWith('image/')) { showToast('이미지 파일(JPG, PNG)만 업로드 가능합니다.'); return; }
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  };

  /* ── PDF 업로드 & Claude 자동 분석 (Edge Function 경유) ── */
  const handleBrochureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    // ── 클라이언트 사이드 유효성 검사 ──
    if (f.type !== 'application/pdf') { showToast('PDF 파일만 업로드 가능합니다.'); return; }
    if (f.size > 5 * 1024 * 1024) { showToast('PDF 파일은 5MB 이하만 업로드 가능합니다.'); return; }

    setBrochureFile(f);
    setIsAnalyzing(true);
    showToast('소개서 분석 중...');

    try {
      const base64 = await fileToBase64(f);

      // Supabase 세션 토큰 가져오기
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다.');

      // ✅ Anthropic API 키는 Edge Function 서버 측에서만 사용
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(
        `${supabaseUrl}/functions/v1/analyze-brochure`,
        {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey':        import.meta.env.VITE_SUPABASE_ANON_KEY as string,
          },
          body: JSON.stringify({ base64 }),
        }
      );

      if (!res.ok) throw new Error(`분석 서버 오류 (${res.status})`);
      const parsed = await res.json() as Record<string, unknown>;

      setForm(prev => ({
        name:        typeof parsed.name        === 'string' ? parsed.name        : prev.name,
        affiliation: typeof parsed.affiliation === 'string' ? parsed.affiliation : prev.affiliation,
        club_type:   (['교내', '연합'].includes(parsed.club_type as string) ? parsed.club_type : prev.club_type) as '' | '교내' | '연합',
        category:    CATEGORIES.includes(parsed.category as string) ? parsed.category as string : prev.category,
        description: typeof parsed.description === 'string' ? parsed.description : prev.description,
      }));
      showToast('✨ 소개서에서 자동 입력했습니다!');
    } catch {
      showToast('소개서 분석에 실패했습니다. 직접 입력해 주세요.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    if (!form.name.trim()) { showToast('동아리 이름을 입력해 주세요.'); return; }

    setIsSaving(true);
    try {
      /* 세션 확인 */
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showToast('로그인 세션이 만료됐습니다. 다시 로그인해 주세요.');
        setIsSaving(false);
        return;
      }

      /* 로고 업로드 */
      let logoUrl: string | null = null;
      if (logoFile) {
        const path = `clubs/logos/${profile.id}_${Date.now()}_${logoFile.name}`;
        const { error: upErr } = await supabase.storage
          .from('club-assets').upload(path, logoFile, { upsert: true });
        if (!upErr) {
          const { data } = supabase.storage.from('club-assets').getPublicUrl(path);
          logoUrl = data.publicUrl;
        }
      }

      /* 소개서 PDF 업로드 */
      let brochureUrl: string | null = null;
      if (brochureFile) {
        const path = `clubs/brochures/${profile.id}_${Date.now()}_${brochureFile.name}`;
        const { error: upErr } = await supabase.storage
          .from('club-assets').upload(path, brochureFile, { upsert: true });
        if (!upErr) {
          const { data } = supabase.storage.from('club-assets').getPublicUrl(path);
          brochureUrl = data.publicUrl;
        }
      }

      /* 동아리 생성 */
      const { data: clubData, error: clubErr } = await supabase
        .from('clubs')
        .insert({
          name:         form.name.trim(),
          affiliation:  form.affiliation.trim() || null,
          club_type:    form.club_type           || null,
          category:     form.category            || null,
          description:  form.description         || null,
          admin_id:     profile.id,
          logo_url:     logoUrl,
          brochure_url: brochureUrl,
          is_recruiting: false,
        })
        .select().single();
      if (clubErr) throw clubErr;

      /* 생성자 → club_members ADMIN (동아리 운영자) */
      const { error: memberErr } = await supabase.from('club_members').insert({
        club_id: clubData.id, user_id: profile.id, role: 'ADMIN',
      });
      if (memberErr) throw new Error(`[멤버 등록] ${memberErr.message}`);

      /* 프로필 role → ADMIN */
      const { error: roleErr } = await supabase
        .from('profiles').update({ role: 'ADMIN' }).eq('id', profile.id);
      if (roleErr) throw new Error(`[역할 업데이트] ${roleErr.message}`);

      /* AuthContext 즉시 갱신 */
      await refreshProfile();

      showToast('동아리가 생성되었습니다!');
      setTimeout(() => navigate('/dashboard'), 900);
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : JSON.stringify(err);
      console.error('[CreateClub]', err);
      showToast(`오류: ${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const inp = "w-full px-4 py-3 rounded-2xl bg-black/5 text-black text-sm font-medium outline-none focus:bg-black/8 transition-all placeholder:text-black/25";

  return (
    <div className="min-h-screen bg-white pb-24">

      {/* 헤더 */}
      <div className="bg-white text-black pt-12 pb-16 px-6 border-b border-black/8">
        <div className="max-w-2xl mx-auto">
          <button
            type="button"
            onClick={() => navigate('/welcome')}
            className="inline-flex items-center gap-1 mb-4 text-sm font-bold text-black/50 hover:text-black transition-colors group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            뒤로가기
          </button>
          <span className="inline-block mb-3 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase bg-black/10 border border-black/15 text-black">
            New Club
          </span>
          <h1 className="text-3xl font-black tracking-tight">동아리 만들기</h1>
          <p className="mt-1.5 text-black/50 text-sm font-medium">동아리를 개설하고 팀원을 모아보세요.</p>
        </div>
      </div>

      {/* 폼 */}
      <div className="max-w-2xl mx-auto px-6 -mt-8 relative z-10">
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-black/10 shadow-sm overflow-hidden">

          {/* ── 섹션: 기본 정보 ── */}
          <div className="px-8 pt-8 pb-4 border-b border-black/8">
            <h2 className="text-base font-black text-black">기본 정보</h2>
            <p className="text-xs text-black/40 font-medium mt-0.5">동아리의 핵심 아이덴티티를 설정하세요.</p>
          </div>

          <div className="px-8 py-7 space-y-6">

            {/* 로고 */}
            <div className="space-y-2">
              <label className="text-xs font-black text-black/50 block">동아리 로고</label>
              <div className="flex items-center gap-5">
                <div className="relative shrink-0">
                  <div
                    onClick={() => logoRef.current?.click()}
                    className="w-20 h-20 rounded-full bg-black/8 flex items-center justify-center overflow-hidden cursor-pointer hover:bg-black/12 transition-colors border-2 border-black/10"
                  >
                    {logoPreview
                      ? <img src={logoPreview} alt="로고" className="w-full h-full object-cover" />
                      : <span className="text-2xl select-none">{form.name?.[0] || '🏷'}</span>
                    }
                  </div>
                  <button
                    type="button"
                    onClick={() => logoRef.current?.click()}
                    className="absolute bottom-0 right-0 w-6 h-6 bg-black rounded-full flex items-center justify-center border-2 border-white shadow-sm hover:bg-black/80 transition-colors"
                  >
                    <Camera className="w-3 h-3 text-white" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-black">
                    {logoPreview ? '로고가 설정되어 있습니다' : '로고를 업로드해주세요'}
                  </p>
                  <p className="text-xs text-black/40 mt-0.5 font-medium">JPG, PNG · 최대 2MB 권장</p>
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    <button type="button" onClick={() => logoRef.current?.click()}
                      className="text-xs font-black text-black px-3 py-1.5 rounded-full bg-black/8 hover:bg-black/15 transition-colors">
                      {logoPreview ? '변경' : '업로드'}
                    </button>
                    {logoPreview && (
                      <button type="button" onClick={() => { setLogoPreview(null); setLogoFile(null); if (logoRef.current) logoRef.current.value = ''; }}
                        className="text-xs font-black text-black/40 hover:text-black px-3 py-1.5 rounded-full bg-black/5 hover:bg-black/10 transition-colors flex items-center gap-1">
                        <X className="w-3 h-3" /> 제거
                      </button>
                    )}
                    {/* 소개서 업로드 버튼 */}
                    <button
                      type="button"
                      onClick={() => brochureRef.current?.click()}
                      className="text-xs font-black flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors
                        border border-black/15 hover:border-black/30 hover:bg-black/5
                        text-black/50 hover:text-black"
                    >
                      {isAnalyzing
                        ? <><Loader2 className="w-3 h-3 animate-spin" /> 분석 중...</>
                        : brochureFile
                          ? <><FileText className="w-3 h-3 text-black" /><span className="text-black max-w-[100px] truncate">{brochureFile.name}</span><X className="w-3 h-3" /></>
                          : <><FileText className="w-3 h-3" /> 소개서 PDF</>
                      }
                    </button>
                    {brochureFile && !isAnalyzing && (
                      <button
                        type="button"
                        onClick={() => { setBrochureFile(null); if (brochureRef.current) brochureRef.current.value = ''; }}
                        className="sr-only"
                      />
                    )}
                  </div>
                </div>
              </div>
              <input ref={logoRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
              <input ref={brochureRef} type="file" accept="application/pdf" onChange={handleBrochureChange} className="hidden" />
            </div>

            <div className="border-t border-black/6" />

            {/* 동아리 이름 */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-black/50 block">
                동아리 이름 <span className="text-red-500">*</span>
              </label>
              <input
                required type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="예: Club DX"
                className={inp}
              />
            </div>

            {/* 소속 + 교내/연합 */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-black/50 block">
                소속 <span className="text-black/25 font-medium">(선택)</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={form.affiliation}
                  onChange={e => setForm({ ...form, affiliation: e.target.value })}
                  placeholder="예: 아주대학교"
                  className={`${inp} flex-1`}
                />
                <div className="flex shrink-0 rounded-2xl bg-black/5 p-1 gap-1">
                  {(['교내', '연합'] as const).map(type => (
                    <button
                      key={type} type="button"
                      onClick={() => setForm(f => ({ ...f, club_type: f.club_type === type ? '' : type }))}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all
                        ${form.club_type === type
                          ? 'bg-black text-white shadow-sm'
                          : 'text-black/40 hover:text-black/70'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 카테고리 */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-black/50 block">카테고리 (분야)</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCatOpen(o => !o)}
                  className={`${inp} text-left flex items-center justify-between`}
                >
                  <span className={form.category ? 'text-black' : 'text-black/25'}>
                    {form.category || '분야를 선택하세요'}
                  </span>
                  <ChevronDown size={15} className={`text-black/40 transition-transform ${catOpen ? 'rotate-180' : ''}`} />
                </button>
                {catOpen && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-black/10 rounded-2xl shadow-xl overflow-hidden">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat} type="button"
                        onClick={() => { setForm({ ...form, category: cat }); setCatOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-black/5 transition-colors
                          ${form.category === cat ? 'text-black font-black bg-black/5' : 'text-black/70'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 소개 */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-black/50 block">동아리 소개</label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="동아리를 간단히 소개해주세요."
                rows={3}
                className="w-full px-4 py-3 rounded-2xl bg-black/5 text-black text-sm font-medium outline-none focus:bg-black/8 transition-all placeholder:text-black/25 resize-none"
              />
            </div>
          </div>

          {/* 저장 버튼 */}
          <div className="px-8 pb-8 pt-2">
            <button
              type="submit"
              disabled={isSaving || isAnalyzing || !form.name.trim()}
              className="w-full py-3.5 rounded-2xl bg-black text-white font-black text-sm transition-all
                         hover:bg-black/85 disabled:opacity-40 disabled:cursor-not-allowed
                         active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {isSaving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> 생성 중...</>
                : <><Save className="w-4 h-4" /> 동아리 개설하기</>
              }
            </button>
          </div>

        </form>
      </div>

      {/* 토스트 */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2.5 px-5 py-3 bg-black text-white rounded-2xl shadow-xl font-bold text-sm whitespace-nowrap"
          >
            <CheckCircle2 className="w-4 h-4 text-white/70 shrink-0" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
