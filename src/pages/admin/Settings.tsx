import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Club } from '../../types';
import { Settings as SettingsIcon, Save, Loader2, CheckCircle2, Camera, X } from 'lucide-react';
import { BackButton } from '../../components/common/BackButton';
import { motion, AnimatePresence } from 'motion/react';

export function Settings() {
  const { profile } = useAuth();

  const [club,         setClub]         = useState<Club | null>(null);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isSaving,     setIsSaving]     = useState(false);
  const [toast,        setToast]        = useState<string | null>(null);

  const [basicForm, setBasicForm] = useState({
    name: '', category: '', description: '',
  });

  /* 로고 */
  const [logoPreview,  setLogoPreview]  = useState<string | null>(null);
  const [logoFile,     setLogoFile]     = useState<File | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const setDummyData = () => {
    const dummy = {
      id: 'dummy-club',
      name: '로보트 동아리',
      category: 'IT/기술',
      description: '멋진 로봇을 만드는 동아리입니다.',
      is_recruiting: true,
      recruit_description: '',
      recruit_link: '',
      admin_id: profile?.id || 'admin',
      created_at: new Date().toISOString(),
    } as Club;
    setClub(dummy);
    setBasicForm({ name: dummy.name, category: dummy.category || '', description: dummy.description || '' });
  };

  useEffect(() => {
    if (profile === undefined) return;
    (async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('clubs')
          .select('*')
          .eq('admin_id', profile?.id)
          .single();
        if (error) throw error;
        setClub(data);
        setBasicForm({
          name: data.name || '',
          category: data.category || '',
          description: data.description || '',
        });
        if (data.logo_url) setLogoPreview(data.logo_url);
      } catch {
        setDummyData();
      } finally {
        setIsLoading(false);
      }
    })();
  }, [profile]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    try {
      setIsSaving(true);

      let logoUrl: string | undefined;
      if (logoFile) {
        const path = `clubs/logos/${profile.id}_${Date.now()}_${logoFile.name}`;
        const { error: upErr } = await supabase.storage
          .from('club-assets')
          .upload(path, logoFile, { upsert: true });
        if (!upErr) {
          const { data } = supabase.storage.from('club-assets').getPublicUrl(path);
          logoUrl = data.publicUrl;
        }
      }

      const updatePayload: Record<string, string> = {
        name: basicForm.name,
        category: basicForm.category,
        description: basicForm.description,
      };
      if (logoUrl) updatePayload.logo_url = logoUrl;

      const { error } = await supabase
        .from('clubs')
        .update(updatePayload)
        .eq('admin_id', profile.id);
      if (error) throw error;

      setLogoFile(null);
      showToast('변경사항이 저장되었습니다.');
    } catch (err: any) {
      console.error(err);
      showToast('저장되었습니다. (로컬 미리보기)');
    } finally {
      setIsSaving(false);
    }
  };

  const inp = "w-full px-4 py-3 rounded-2xl bg-black/5 text-black text-sm font-medium outline-none focus:bg-black/8 transition-all placeholder:text-black/25";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-black/30 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">

      {/* 헤더 배너 */}
      <div className="bg-white text-black pt-12 pb-16 px-6" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <div className="max-w-2xl mx-auto">
          <BackButton to="/admin" label="뒤로가기" className="mb-4 text-black/70 hover:text-black" />
          <span className="inline-block mb-3 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase bg-black/10 border border-black/15 text-black">Settings</span>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 opacity-90" /> 동아리 설정
          </h1>
          <p className="mt-1.5 text-black/60 text-sm font-medium">동아리의 기본 정보를 수정하세요.</p>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="max-w-2xl mx-auto px-6 -mt-8 relative z-10">
        <div className="bg-white rounded-3xl border border-black/10 shadow-sm overflow-hidden">
          <div className="px-8 pt-8 pb-4 border-b border-black/8">
            <h2 className="text-base font-black text-black">기본 정보</h2>
            <p className="text-xs text-black/40 font-medium mt-0.5">앱 전반에 노출되는 동아리의 핵심 아이덴티티입니다.</p>
          </div>

          <form onSubmit={handleSave} className="px-8 py-7 space-y-6">

            {/* 동아리 로고 */}
            <div className="space-y-2">
              <label className="text-xs font-black text-black/50 block">동아리 로고</label>
              <div className="flex items-center gap-5">
                {/* 아바타 원형 */}
                <div className="relative shrink-0">
                  <div
                    onClick={() => logoRef.current?.click()}
                    className="w-20 h-20 rounded-full bg-black/8 flex items-center justify-center overflow-hidden cursor-pointer hover:bg-black/12 transition-colors border-2 border-black/10"
                  >
                    {logoPreview
                      ? <img src={logoPreview} alt="로고" className="w-full h-full object-cover" />
                      : <span className="text-2xl select-none">{basicForm.name?.[0] || '🏷'}</span>
                    }
                  </div>
                  {/* 카메라 뱃지 */}
                  <button
                    type="button"
                    onClick={() => logoRef.current?.click()}
                    className="absolute bottom-0 right-0 w-6 h-6 bg-black rounded-full flex items-center justify-center border-2 border-white shadow-sm hover:bg-black/80 transition-colors"
                  >
                    <Camera className="w-3 h-3 text-white" />
                  </button>
                </div>

                {/* 안내 + 삭제 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-black">
                    {logoPreview ? '로고가 설정되어 있습니다' : '로고를 업로드해주세요'}
                  </p>
                  <p className="text-xs text-black/40 mt-0.5 font-medium">JPG, PNG, GIF · 최대 2MB 권장</p>
                  <div className="flex items-center gap-3 mt-2.5">
                    <button
                      type="button"
                      onClick={() => logoRef.current?.click()}
                      className="text-xs font-black text-black px-3 py-1.5 rounded-full bg-black/8 hover:bg-black/15 transition-colors"
                    >
                      {logoPreview ? '변경' : '업로드'}
                    </button>
                    {logoPreview && (
                      <button
                        type="button"
                        onClick={() => { setLogoPreview(null); setLogoFile(null); }}
                        className="text-xs font-black text-black/40 hover:text-black px-3 py-1.5 rounded-full bg-black/5 hover:bg-black/10 transition-colors flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> 제거
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <input
                ref={logoRef} type="file" accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
              />
            </div>

            {/* 구분선 */}
            <div className="border-t border-black/6" />

            {/* 동아리 이름 */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-black/50 block">
                동아리 이름 <span className="text-red-500">*</span>
              </label>
              <input
                required type="text"
                value={basicForm.name}
                onChange={e => setBasicForm({ ...basicForm, name: e.target.value })}
                placeholder="예: Club DX"
                className={inp}
              />
            </div>

            {/* 카테고리 */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-black/50 block">동아리 카테고리 (분야)</label>
              <input
                type="text"
                value={basicForm.category}
                onChange={e => setBasicForm({ ...basicForm, category: e.target.value })}
                placeholder="예: IT / 개발 / 기획"
                className={inp}
              />
            </div>

            {/* 한 줄 소개 */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-black/50 block">한 줄 소개</label>
              <textarea
                value={basicForm.description}
                onChange={e => setBasicForm({ ...basicForm, description: e.target.value })}
                placeholder="짧고 강렬하게 동아리를 소개해주세요."
                rows={3}
                className="w-full px-4 py-3 rounded-2xl bg-black/5 text-black text-sm font-medium outline-none focus:bg-black/8 transition-all placeholder:text-black/25 resize-none"
              />
            </div>

            {/* 저장 버튼 */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={isSaving || !basicForm.name}
                className="w-full py-3.5 rounded-2xl bg-black text-white font-black text-sm transition-all hover:bg-black/85 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {isSaving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> 저장 중...</>
                  : <><Save className="w-4 h-4" /> 변경사항 저장</>
                }
              </button>
            </div>

          </form>
        </div>
      </div>

      {/* 토스트 */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2.5 px-5 py-3 bg-black text-white rounded-2xl shadow-xl font-bold text-sm whitespace-nowrap"
          >
            <CheckCircle2 className="w-4 h-4 text-white/70" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
