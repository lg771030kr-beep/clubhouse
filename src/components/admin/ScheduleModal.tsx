import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Calendar, Clock, MapPin, FileText,
  BookOpen, UploadCloud, File as FileIcon,
  Loader2, AlertCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
type ScheduleType = 'GENERAL' | 'ASSIGNMENT' | 'BOTH';

interface ScheduleModalProps {
  onClose: () => void;
  onSaved: (schedule: any) => void;
}

/* ─────────────────────────────────────────────
   Segment Tab 정의
───────────────────────────────────────────── */
const TABS: { type: ScheduleType; emoji: string; label: string }[] = [
  { type: 'GENERAL',    emoji: '🏃',  label: '활동 일정'    },
  { type: 'ASSIGNMENT', emoji: '📝',  label: '과제 전용'    },
  { type: 'BOTH',       emoji: '✨',  label: '활동 + 과제'  },
];

/* ─────────────────────────────────────────────
   Input className helper
───────────────────────────────────────────── */
const inputCls =
  'w-full px-4 py-3.5 rounded-2xl bg-white border border-black ' +
  'focus:border-black focus:ring-2 focus:ring-black/10 ' +
  'transition-all outline-none text-black placeholder:text-slate-400 text-sm';

/* ─────────────────────────────────────────────
   Section label
───────────────────────────────────────────── */
const Label = ({ icon, children, required }: {
  icon?: React.ReactNode; children: React.ReactNode; required?: boolean;
}) => (
  <label className="flex items-center gap-1.5 text-xs font-bold text-black uppercase tracking-wider mb-2">
    {icon}
    {children}
    {required && <span className="text-black ml-0.5">*</span>}
  </label>
);

/* ═══════════════════════════════════════════════════
   Component
═══════════════════════════════════════════════════ */
export function ScheduleModal({ onClose, onSaved }: ScheduleModalProps) {
  const { user } = useAuth();

  /* ── 관리자의 동아리 ID 자동 조회 ── */
  const [adminClubId, setAdminClubId] = useState<string | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('clubs')
      .select('id')
      .eq('admin_id', user.id)
      .maybeSingle()
      .then(({ data }) => { if (data?.id) setAdminClubId(data.id); });
  }, [user?.id]);

  /* ── 탭 상태 ── */
  const [activeType, setActiveType] = useState<ScheduleType>('GENERAL');

  /* ── 일반 일정 폼 ── */
  const [form, setForm] = useState({
    title: '', date: '', time: '', location: '', description: '',
  });
  const patch = (p: Partial<typeof form>) => setForm(f => ({ ...f, ...p }));

  /* ── 과제 폼 ── */
  const [assignForm, setAssignForm] = useState({
    assignment_title: '', assignment_due: '', assignment_note: '',
  });
  const patchAssign = (p: Partial<typeof assignForm>) =>
    setAssignForm(f => ({ ...f, ...p }));

  /* ── 파일 ── */
  const [file,       setFile]       = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSaving,   setIsSaving]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── 탭 변경 ── */
  const handleTabChange = (t: ScheduleType) => {
    setActiveType(t);
  };

  /* ── Submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);

      let assignment_template_url: string | null = null;
      if (activeType !== 'GENERAL' && file) {
        const ext = file.name.split('.').pop();
        const fileName = `template-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('assignments').upload(fileName, file);
        if (upErr) throw new Error(`파일 업로드 실패: ${upErr.message}`);
        const { data: urlData } = supabase.storage.from('assignments').getPublicUrl(fileName);
        assignment_template_url = urlData.publicUrl;
      }

      let insertData: Record<string, any> = {
        type:        activeType,
        is_approved: true,
        club_id:     adminClubId ?? null,   // 관리자 동아리 자동 연결
      };

      if (activeType === 'ASSIGNMENT') {
        const [dueDate = '', dueTime = ''] = assignForm.assignment_due.split('T');
        insertData = {
          ...insertData,
          title:       assignForm.assignment_title,
          date:        dueDate,
          time:        dueTime ? `${dueTime}:00` : '00:00:00',
          location:    '',
          description: assignForm.assignment_note,
          assignment_template_url,
        };
      } else if (activeType === 'BOTH') {
        const [dueDate = '', dueTime = ''] = assignForm.assignment_due.split('T');
        const assignNote =
          `[과제] ${assignForm.assignment_title}` +
          (dueDate ? ` · 마감 ${dueDate} ${dueTime}` : '') +
          (assignForm.assignment_note ? `\n${assignForm.assignment_note}` : '');
        insertData = {
          ...insertData,
          title:       form.title,
          date:        form.date,
          time:        form.time ? `${form.time}:00` : '00:00:00',
          location:    form.location,
          description: [form.description, assignNote].filter(Boolean).join('\n\n'),
          assignment_template_url,
        };
      } else {
        insertData = {
          ...insertData,
          title:       form.title,
          date:        form.date,
          time:        form.time ? `${form.time}:00` : '00:00:00',
          location:    form.location,
          description: form.description,
          assignment_template_url: null,
        };
      }

      const { data, error } = await supabase
        .from('schedules').insert([insertData]).select().single();
      if (error) throw error;

      onSaved(data);
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(`등록 실패: ${err.message || ''}`);
    } finally {
      setIsSaving(false);
    }
  };

  /* ── 날짜 preview ── */
  const dueDatePreview = assignForm.assignment_due
    ? new Date(assignForm.assignment_due).toLocaleString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }) + ' 까지'
    : null;

  /* ──────────────────────────────────────────
     Render
  ────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      {/* Sheet */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className="relative bg-white w-full sm:max-w-lg rounded-t-[2rem] sm:rounded-3xl
                   shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh]"
      >
        {/* ── 드래그 핸들 (모바일) ── */}
        <div className="flex justify-center pt-3 pb-0 sm:hidden">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* ── 헤더 ── */}
        <div className="px-7 pt-6 pb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">새 일정 등록</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeType === 'GENERAL'    && '활동 세션 일정을 추가합니다'}
              {activeType === 'ASSIGNMENT' && '과제 마감을 등록합니다'}
              {activeType === 'BOTH'       && '활동과 과제를 함께 등록합니다'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100
                       hover:bg-slate-200 transition-colors shrink-0 mt-0.5"
          >
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        {/* ── 세그먼트 탭 ── */}
        <div className="px-7 pb-5">
          <div className="relative flex bg-slate-200 rounded-2xl p-1 gap-0.5">
            {/* 슬라이딩 배경 */}
            {TABS.map((tab, idx) => {
              const isActive = activeType === tab.type;
              return (
                <button
                  key={tab.type}
                  type="button"
                  onClick={() => handleTabChange(tab.type)}
                  className="relative flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2
                             text-xs font-bold rounded-xl z-10 transition-colors duration-200
                             select-none"
                  style={{ color: isActive ? '#000000' : '#64748b' }}
                >
                  {/* 활성 배경 */}
                  {isActive && (
                    <motion.div
                      layoutId="segment-bg"
                      className="absolute inset-0 bg-white rounded-xl shadow-sm border border-black"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 text-sm">{tab.emoji}</span>
                  <span className="relative z-10 whitespace-nowrap">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 폼 ── */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-7 pb-2 space-y-5">

            {/* ────────────────────────────────
                활동 일정 섹션 (GENERAL / BOTH)
            ──────────────────────────────── */}
            <AnimatePresence initial={false}>
              {activeType !== 'ASSIGNMENT' && (
                <motion.div
                  key="general"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden space-y-5"
                >
                  {/* 일정 제목 */}
                  <div>
                    <Label icon={<FileText size={11} />} required>일정 제목</Label>
                    <input
                      required
                      type="text"
                      value={form.title}
                      onChange={e => patch({ title: e.target.value })}
                      placeholder="예: 정기 세션 4주차"
                      className={inputCls}
                    />
                  </div>

                  {/* 날짜 + 시간 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label icon={<Calendar size={11} />} required>날짜</Label>
                      <input
                        required
                        type="date"
                        value={form.date}
                        onChange={e => patch({ date: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <Label icon={<Clock size={11} />} required>시간</Label>
                      <input
                        required
                        type="time"
                        value={form.time}
                        onChange={e => patch({ time: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  {/* 장소 */}
                  <div>
                    <Label icon={<MapPin size={11} />}>장소 <span className="font-normal normal-case text-slate-300 ml-1">(선택)</span></Label>
                    <input
                      type="text"
                      value={form.location}
                      onChange={e => patch({ location: e.target.value })}
                      placeholder="예: 공학관 302호"
                      className={inputCls}
                    />
                  </div>

                  {/* 메모 */}
                  <div>
                    <Label>메모 <span className="font-normal normal-case text-slate-300 ml-1">(선택)</span></Label>
                    <textarea
                      value={form.description}
                      onChange={e => patch({ description: e.target.value })}
                      placeholder="일정에 대한 상세 내용을 적어주세요..."
                      rows={3}
                      className={`${inputCls} resize-none`}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ────────────────────────────────
                BOTH 구분선
            ──────────────────────────────── */}
            <AnimatePresence initial={false}>
              {activeType === 'BOTH' && (
                <motion.div
                  key="divider"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3"
                >
                  <div className="flex-1 h-px bg-slate-300" />
                  <span className="text-xs font-bold text-black uppercase tracking-widest">
                    과제 추가 정보
                  </span>
                  <div className="flex-1 h-px bg-slate-300" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* ────────────────────────────────
                과제 섹션 (ASSIGNMENT / BOTH)
            ──────────────────────────────── */}
            <AnimatePresence initial={false}>
              {activeType !== 'GENERAL' && (
                <motion.div
                  key="assignment"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden space-y-5"
                >
                  {/* 과제 제목 */}
                  <div>
                    <Label icon={<BookOpen size={11} />} required>과제 제목</Label>
                    <input
                      required
                      type="text"
                      value={assignForm.assignment_title}
                      onChange={e => patchAssign({ assignment_title: e.target.value })}
                      placeholder="예: 웹서버 구현 과제"
                      className={inputCls}
                    />
                  </div>

                  {/* 마감 기한 */}
                  <div>
                    <Label icon={<Clock size={11} />} required>마감 기한</Label>
                    <input
                      required
                      type="datetime-local"
                      value={assignForm.assignment_due}
                      onChange={e => patchAssign({ assignment_due: e.target.value })}
                      className={inputCls}
                    />
                    <AnimatePresence>
                      {dueDatePreview && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="mt-2 text-xs font-semibold text-black/60 flex items-center gap-1 pl-1"
                        >
                          <AlertCircle size={11} />
                          {dueDatePreview}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* 과제 상세 설명 */}
                  <div>
                    <Label>상세 설명 <span className="font-normal normal-case text-slate-300 ml-1">(선택)</span></Label>
                    <textarea
                      value={assignForm.assignment_note}
                      onChange={e => patchAssign({ assignment_note: e.target.value })}
                      placeholder="제출 방법, 유의사항 등을 적어주세요..."
                      rows={3}
                      className={`${inputCls} resize-none`}
                    />
                  </div>

                  {/* 파일 업로드 */}
                  <div>
                    <Label icon={<UploadCloud size={11} />}>양식 파일 <span className="font-normal normal-case text-slate-300 ml-1">(선택)</span></Label>
                    <div
                      onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                      onDragLeave={e => { e.preventDefault(); setIsDragOver(false); }}
                      onDrop={e => {
                        e.preventDefault(); setIsDragOver(false);
                        if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
                      }}
                      onClick={() => fileRef.current?.click()}
                      className={`relative flex items-center gap-4 p-4 rounded-2xl border-2 border-dashed
                                  cursor-pointer transition-all
                                  ${isDragOver
                                    ? 'border-black bg-slate-100'
                                    : 'border-black bg-white hover:border-black hover:bg-slate-50'}`}
                    >
                      <input
                        ref={fileRef}
                        type="file"
                        className="hidden"
                        onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]); }}
                      />
                      {file ? (
                        <>
                          <div className="w-10 h-10 bg-slate-200 text-black rounded-xl flex items-center justify-center shrink-0">
                            <FileIcon size={18} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-black truncate">{file.name}</p>
                            <p className="text-xs text-slate-600">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); setFile(null); }}
                            className="w-6 h-6 rounded-full bg-slate-300 hover:bg-red-200 hover:text-red-600
                                       flex items-center justify-center transition-colors shrink-0"
                          >
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="w-10 h-10 bg-slate-200 text-black rounded-xl flex items-center justify-center shrink-0">
                            <UploadCloud size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-black">클릭 또는 드래그해서 업로드</p>
                            <p className="text-xs text-slate-600 mt-0.5">PDF, Word, HWP · 최대 10MB</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>

          {/* ── 하단 버튼 ── */}
          <div className="px-7 py-6 border-t border-slate-200 shrink-0">
            <motion.button
              type="submit"
              disabled={isSaving}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 bg-black hover:bg-slate-800 text-white rounded-3xl
                         font-black text-base tracking-tight transition-colors
                         shadow-lg shadow-black/20 disabled:opacity-60
                         flex items-center justify-center gap-2.5"
            >
              {isSaving
                ? <><Loader2 size={20} className="animate-spin" />등록 중...</>
                : <>
                    {activeType === 'GENERAL'    && '🏃 활동 일정 등록'}
                    {activeType === 'ASSIGNMENT' && '📝 과제 등록'}
                    {activeType === 'BOTH'       && '✨ 활동 + 과제 등록'}
                  </>
              }
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
