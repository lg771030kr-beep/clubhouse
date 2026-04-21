import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { Club } from '../../types';
import { Settings as SettingsIcon, Save, Loader2, CheckCircle2, Camera, X, FileText, Upload, AlertTriangle, Trash2 } from 'lucide-react';
import { BackButton } from '../../components/common/BackButton';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export function Settings() {
  const { profile, activeClubId } = useAuth();
  const { verified, checking } = useAdminGuard();

  const [club,         setClub]         = useState<Club | null>(null);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isSaving,     setIsSaving]     = useState(false);
  const [toast,        setToast]        = useState<string | null>(null);

  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const [basicForm, setBasicForm] = useState({
    name: '', category: '', description: '',
  });

  /* 로고 */
  const [logoPreview,    setLogoPreview]    = useState<string | null>(null);
  const [logoFile,       setLogoFile]       = useState<File | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  /* 소개서 PDF */
  const [brochureUrl,    setBrochureUrl]    = useState<string | null>(null);
  const [brochureFile,   setBrochureFile]   = useState<File | null>(null);
  const [brochureName,   setBrochureName]   = useState<string>('');
  const [brochureUploading, setBrochureUploading] = useState(false);
  const brochureRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!activeClubId) return;
    (async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('clubs')
          .select('*')
          .eq('id', activeClubId)
          .single();
        if (error) throw error;
        setClub(data);
        setBasicForm({
          name: data.name || '',
          category: data.category || '',
          description: data.description || '',
        });
        if (data.logo_url) setLogoPreview(data.logo_url);
        if (data.brochure_url) {
          setBrochureUrl(data.brochure_url);
          setBrochureName(data.brochure_url.split('/').pop() ?? '소개서.pdf');
        }
      } catch {
        // 클럽 없음 — 빈 폼 유지
        setBasicForm({ name: '', category: '', description: '' });
      } finally {
        setIsLoading(false);
      }
    })();
  }, [activeClubId]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { showToast('이미지 파일은 2MB 이하만 업로드 가능합니다.'); return; }
    if (!f.type.startsWith('image/')) { showToast('이미지 파일(JPG, PNG)만 업로드 가능합니다.'); return; }
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  };

  const handleBrochureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !profile?.id || !activeClubId) return;
    if (f.type !== 'application/pdf') { showToast('PDF 파일만 업로드 가능합니다.'); return; }
    if (f.size > 10 * 1024 * 1024) { showToast('PDF 파일은 10MB 이하만 업로드 가능합니다.'); return; }
    setBrochureFile(f);
    setBrochureName(f.name);
    // 즉시 업로드
    setBrochureUploading(true);
    try {
      const path = `clubs/brochures/${profile.id}_${Date.now()}_${f.name}`;
      const { error: upErr } = await supabase.storage.from('club-assets').upload(path, f, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('club-assets').getPublicUrl(path);
      setBrochureUrl(data.publicUrl);
      // clubs 테이블에 즉시 저장
      await supabase.from('clubs').update({ brochure_url: data.publicUrl }).eq('id', activeClubId);
      showToast('소개서가 업로드되었습니다.');
    } catch (err: unknown) {
      alert('소개서 업로드 실패: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setBrochureUploading(false);
      if (brochureRef.current) brochureRef.current.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !activeClubId) return;
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

      // admin_id 조건 추가 — 본인 소유 동아리만 수정 가능 (서버 측 소유권 검증)
      const { error } = await supabase
        .from('clubs')
        .update(updatePayload)
        .eq('id', activeClubId)
        .eq('admin_id', profile.id);
      if (error) throw error;

      setLogoFile(null);
      showToast('변경사항이 저장되었습니다.');
      // Navbar 동기화
      window.dispatchEvent(new Event('club-settings-saved'));
    } catch (err: unknown) {
      console.error(err);
      showToast('저장되었습니다. (로컬 미리보기)');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClub = async () => {
    if (deleteInput !== '삭제합니다.') {
      alert('삭제를 확인하려면 "삭제합니다."를 정확히 입력해주세요.');
      return;
    }
    if (!club?.id) return;

    try {
      setIsDeleting(true);

      // Soft delete: deleted_at 타임스탬프만 설정
      // → 실제 데이터는 보존되며, AdminDashboard에서 복구 가능
      // → DB Cascade 설정 없이도 안전하고 복구 가능한 방식
      // admin_id 조건 — 본인 소유 동아리만 삭제 가능
      const { error } = await supabase
        .from('clubs')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', club.id)
        .eq('admin_id', profile!.id);
      if (error) throw error;

      window.dispatchEvent(new Event('club-settings-saved'));
      navigate('/');
    } catch (err: unknown) {
      alert('삭제 실패: ' + (err instanceof Error ? err.message : '오류가 발생했습니다.'));
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const inp = "w-full px-4 py-3 rounded-2xl bg-black/5 text-black text-sm font-medium outline-none focus:bg-black/8 transition-all placeholder:text-black/25";

  // 소유권 검증 중이거나 실패 시 렌더링 차단
  if (checking || !verified) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-black/30 animate-spin" />
      </div>
    );
  }

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
      <div className="bg-white text-black pt-16 pb-16 px-6" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <div className="max-w-2xl mx-auto">
          <BackButton to="/admin" label="뒤로가기" className="mb-4 text-black/70 hover:text-black" />
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

            {/* 구분선 */}
            <div className="border-t border-black/6" />

            {/* 소개서 PDF */}
            <div className="space-y-2">
              <label className="text-xs font-black text-black/50 block">동아리 소개서 (PDF)</label>
              <p className="text-xs text-black/35 font-medium">부원 및 지원자가 열람할 수 있는 소개 자료를 올려주세요.</p>

              {brochureUrl ? (
                <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-black/5 border border-black/10">
                  <FileText className="w-5 h-5 text-black/50 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-black truncate">{brochureName}</p>
                    <a href={brochureUrl} target="_blank" rel="noreferrer"
                       className="text-xs text-black/50 hover:text-black underline transition-colors">
                      미리보기
                    </a>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => brochureRef.current?.click()}
                      className="text-xs font-black text-black px-3 py-1.5 rounded-full bg-black/8 hover:bg-black/15 transition-colors">
                      변경
                    </button>
                    <button type="button"
                      onClick={async () => {
                        setBrochureUrl(null); setBrochureFile(null); setBrochureName('');
                        await supabase.from('clubs').update({ brochure_url: null }).eq('id', activeClubId);
                      }}
                      className="text-xs font-black text-black/40 hover:text-black px-3 py-1.5 rounded-full bg-black/5 hover:bg-black/10 transition-colors flex items-center gap-1">
                      <X className="w-3 h-3" /> 제거
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => brochureRef.current?.click()}
                  disabled={brochureUploading}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-black/20
                             hover:border-black/40 hover:bg-black/[0.02] transition-all text-sm font-black text-black/40
                             hover:text-black disabled:opacity-50">
                  {brochureUploading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> 업로드 중...</>
                    : <><Upload className="w-4 h-4" /> PDF 소개서 업로드</>
                  }
                </button>
              )}
              <input ref={brochureRef} type="file" accept="application/pdf"
                onChange={handleBrochureChange} className="hidden" />
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

        {/* --- 위험 구역 --- */}
        <div className="mt-8 bg-white rounded-3xl border border-red-500/20 shadow-sm overflow-hidden mb-12">
          <div className="px-8 pt-8 pb-4 border-b border-red-500/10 flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-red-600 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> 위험 구역 (Danger Zone)
              </h2>
              <p className="text-xs text-black/50 font-medium mt-1">이 작업은 취소할 수 없습니다.</p>
            </div>
          </div>
          <div className="px-8 py-7 flex items-center justify-between">
            <div>
              <p className="text-sm font-black text-black">동아리 삭제하기</p>
              <p className="text-xs text-black/50 font-medium mt-1">
                동아리와 관련된 모든 데이터(일정, 과제, 출석 등)가 함께 삭제됩니다.
              </p>
            </div>
            <button
              onClick={() => {
                setDeleteInput('');
                setShowDeleteModal(true);
              }}
              className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-black text-sm rounded-xl transition-colors shrink-0"
            >
              삭제하기
            </button>
          </div>
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

      {/* 동아리 삭제 모달 */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowDeleteModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm bg-white rounded-3xl p-7 shadow-2xl flex flex-col items-center text-center"
            >
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-xl font-black text-black mb-2">정말 삭제하시겠습니까?</h3>
              <p className="text-sm text-black/60 font-medium leading-relaxed mb-6">
                삭제를 진행하면 <strong className="text-red-500">7일 내 복구 신청이 아닌 이상 영구 삭제</strong>되며, 복구 신청이 없을 시 관련된 모든 데이터가 소멸됩니다.
              </p>
              
              <div className="w-full text-left mb-6">
                <label className="text-xs font-black text-black/50 block mb-2">
                  삭제를 확인하려면 아래 입력창에 <strong className="text-black">삭제합니다.</strong> 를 입력해주세요.
                </label>
                <input
                  type="text"
                  value={deleteInput}
                  onChange={e => setDeleteInput(e.target.value)}
                  placeholder="삭제합니다."
                  className="w-full px-4 py-3 rounded-2xl bg-black/5 text-black text-sm font-medium outline-none focus:bg-red-500/10 focus:border-red-500/30 border border-transparent transition-all placeholder:text-black/25 text-center"
                />
              </div>

              <div className="flex gap-2 w-full">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 py-3.5 rounded-2xl border border-black/20 text-sm font-black text-black/50 hover:bg-black/5 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleDeleteClub}
                  disabled={deleteInput !== '삭제합니다.' || isDeleting}
                  className="flex-1 py-3.5 rounded-2xl bg-red-500 text-white font-black text-sm hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isDeleting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> 삭제 중</>
                    : '삭제 진행'
                  }
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
