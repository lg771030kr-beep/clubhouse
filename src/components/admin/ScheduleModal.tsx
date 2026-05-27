import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, BookOpen, UploadCloud, File as FileIcon,
  Loader2, AlertCircle, Plus, CalendarDays, ClipboardList, Layers,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

type ScheduleType = 'GENERAL' | 'ASSIGNMENT' | 'BOTH';

interface SavedSchedule {
  id: string;
  title: string;
  date: string;
  time: string;
  type: ScheduleType;
  location?: string | null;
  description?: string | null;
  assignment_template_url?: string | null;
  is_approved?: boolean | null;
  club_id?: string | null;
  created_at?: string;
}

interface ScheduleModalProps {
  onClose: () => void;
  onSaved: (schedule: SavedSchedule) => void;
}

const TABS: { type: ScheduleType; icon: React.ReactNode; label: string; sub: string }[] = [
  {
    type: 'GENERAL',
    icon: <CalendarDays size={15} />,
    label: '일정만',
    sub: '활동·모임 일정',
  },
  {
    type: 'ASSIGNMENT',
    icon: <ClipboardList size={15} />,
    label: '과제만',
    sub: '제출·마감 과제',
  },
  {
    type: 'BOTH',
    icon: <Layers size={15} />,
    label: '일정+과제',
    sub: '동시 등록',
  },
];

const inp =
  'w-full px-4 py-3 rounded-2xl bg-black/5 text-black text-sm font-medium outline-none ' +
  'focus:bg-black/8 transition-all placeholder:text-black/25';

const Label = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label className="text-xs font-black text-black/50 block mb-1.5">
    {children}
    {required && <span className="text-red-500 ml-0.5">*</span>}
  </label>
);

export function ScheduleModal({ onClose, onSaved }: ScheduleModalProps) {
  const { activeClubId } = useAuth();

  const [activeType, setActiveType] = useState<ScheduleType>('GENERAL');

  const [form, setForm] = useState({
    title: '', date: '', time: '', location: '', description: '',
  });
  const patch = (p: Partial<typeof form>) => setForm(f => ({ ...f, ...p }));

  const [assignForm, setAssignForm] = useState({
    assignment_title: '', assignment_due: '', assignment_note: '',
  });
  const patchAssign = (p: Partial<typeof assignForm>) =>
    setAssignForm(f => ({ ...f, ...p }));

  const [file,       setFile]       = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSaving,   setIsSaving]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

      let insertData: Record<string, unknown> = {
        type: activeType, is_approved: true, club_id: activeClubId ?? null,
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
      onSaved(data as SavedSchedule);
      onClose();
    } catch (err: unknown) {
      console.error(err);
      alert(`등록 실패: ${err instanceof Error ? err.message : ''}`);
    } finally {
      setIsSaving(false);
    }
  };

  const dueDatePreview = assignForm.assignment_due
    ? new Date(assignForm.assignment_due).toLocaleString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }) + ' 까지'
    : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
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
        {/* 드래그 핸들 (모바일) */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 bg-black/15 rounded-full" />
        </div>

        {/* 헤더 */}
        <div className="shrink-0 flex items-start justify-between px-7 pt-6 pb-5 border-b border-black/8">
          <div>
            <h3 className="text-xl font-black text-black tracking-tight">새 일정 등록</h3>
            <p className="text-xs text-black/40 mt-0.5 font-medium">
              {activeType === 'GENERAL'    && '활동 세션 일정을 추가합니다'}
              {activeType === 'ASSIGNMENT' && '과제 마감을 등록합니다'}
              {activeType === 'BOTH'       && '활동과 과제를 함께 등록합니다'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-black/8
                       hover:bg-black/15 transition-colors shrink-0 mt-0.5"
          >
            <X size={16} className="text-black" />
          </button>
        </div>

        {/* 세그먼트 탭 */}
        <div className="px-7 pt-5 pb-1 shrink-0">
          <div className="flex bg-black/6 rounded-2xl p-1 gap-1">
            {TABS.map(tab => {
              const isActive = activeType === tab.type;
              return (
                <button
                  key={tab.type}
                  type="button"
                  onClick={() => setActiveType(tab.type)}
                  className={`relative flex-1 flex flex-col items-center justify-center gap-0.5
                               py-2.5 px-1 rounded-xl transition-all duration-200 select-none
                               ${isActive ? 'bg-black text-white shadow-sm' : 'text-black/40 hover:text-black'}`}
                >
                  <span className={isActive ? 'text-white' : 'text-black/40'}>{tab.icon}</span>
                  <span className="text-[11px] font-black whitespace-nowrap">{tab.label}</span>
                  <span className={`text-[9px] font-medium whitespace-nowrap
                    ${isActive ? 'text-white/60' : 'text-black/25'}`}>
                    {tab.sub}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-7 py-5 space-y-4">

            {/* 활동 일정 섹션 */}
            <AnimatePresence initial={false}>
              {activeType !== 'ASSIGNMENT' && (
                <motion.div
                  key="general"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden space-y-4"
                >
                  <div>
                    <Label required>일정 제목</Label>
                    <input
                      required type="text"
                      value={form.title}
                      onChange={e => patch({ title: e.target.value })}
                      placeholder="예: 정기 세션 4주차"
                      className={inp}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label required>날짜</Label>
                      <input required type="date"
                        value={form.date}
                        onChange={e => patch({ date: e.target.value })}
                        className={inp}
                      />
                    </div>
                    <div>
                      <Label required>시간</Label>
                      <input required type="time"
                        value={form.time}
                        onChange={e => patch({ time: e.target.value })}
                        className={inp}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>장소 <span className="font-normal normal-case text-black/25">(선택)</span></Label>
                    <input type="text"
                      value={form.location}
                      onChange={e => patch({ location: e.target.value })}
                      placeholder="예: 공학관 302호"
                      className={inp}
                    />
                  </div>
                  <div>
                    <Label>메모 <span className="font-normal normal-case text-black/25">(선택)</span></Label>
                    <textarea
                      value={form.description}
                      onChange={e => patch({ description: e.target.value })}
                      placeholder="일정에 대한 상세 내용을 적어주세요..."
                      rows={3}
                      className={`${inp} resize-none`}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* BOTH 구분선 */}
            <AnimatePresence initial={false}>
              {activeType === 'BOTH' && (
                <motion.div
                  key="divider"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-3"
                >
                  <div className="flex-1 h-px bg-black/10" />
                  <span className="text-[10px] font-black text-black/40 uppercase tracking-widest">과제 추가 정보</span>
                  <div className="flex-1 h-px bg-black/10" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* 과제 섹션 */}
            <AnimatePresence initial={false}>
              {activeType !== 'GENERAL' && (
                <motion.div
                  key="assignment"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden space-y-4"
                >
                  <div>
                    <Label required>과제 제목</Label>
                    <input required type="text"
                      value={assignForm.assignment_title}
                      onChange={e => patchAssign({ assignment_title: e.target.value })}
                      placeholder="예: 웹서버 구현 과제"
                      className={inp}
                    />
                  </div>
                  <div>
                    <Label required>마감 기한</Label>
                    <input required type="datetime-local"
                      value={assignForm.assignment_due}
                      onChange={e => patchAssign({ assignment_due: e.target.value })}
                      className={inp}
                    />
                    <AnimatePresence>
                      {dueDatePreview && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="mt-2 text-xs font-medium text-black/50 flex items-center gap-1 pl-1"
                        >
                          <AlertCircle size={11} />
                          {dueDatePreview}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                  <div>
                    <Label>상세 설명 <span className="font-normal normal-case text-black/25">(선택)</span></Label>
                    <textarea
                      value={assignForm.assignment_note}
                      onChange={e => patchAssign({ assignment_note: e.target.value })}
                      placeholder="제출 방법, 유의사항 등을 적어주세요..."
                      rows={3}
                      className={`${inp} resize-none`}
                    />
                  </div>

                  {/* 파일 업로드 */}
                  <div>
                    <Label>양식 파일 <span className="font-normal normal-case text-black/25">(선택)</span></Label>
                    <div
                      onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                      onDragLeave={e => { e.preventDefault(); setIsDragOver(false); }}
                      onDrop={e => {
                        e.preventDefault(); setIsDragOver(false);
                        if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
                      }}
                      onClick={() => fileRef.current?.click()}
                      className={`flex items-center gap-4 p-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all
                        ${isDragOver ? 'border-black bg-black/5' : 'border-black/20 hover:border-black/40 hover:bg-black/[0.02]'}`}
                    >
                      <input ref={fileRef} type="file" className="hidden"
                        onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} />
                      {file ? (
                        <>
                          <div className="w-9 h-9 bg-black/8 rounded-xl flex items-center justify-center shrink-0">
                            <FileIcon size={16} className="text-black" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-black truncate">{file.name}</p>
                            <p className="text-xs text-black/40 font-medium">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                          <button type="button"
                            onClick={e => { e.stopPropagation(); setFile(null); }}
                            className="w-6 h-6 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center transition-colors shrink-0">
                            <X size={12} className="text-black" />
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="w-9 h-9 bg-black/8 rounded-xl flex items-center justify-center shrink-0">
                            <UploadCloud size={16} className="text-black/50" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-black/60">클릭 또는 드래그해서 업로드</p>
                            <p className="text-xs text-black/30 font-medium mt-0.5">PDF, Word, HWP · 최대 10MB</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 하단 버튼 */}
          <div className="px-7 py-5 border-t border-black/8 shrink-0">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-4 bg-black hover:bg-black/85 text-white rounded-2xl
                         font-black text-sm tracking-tight transition-all
                         disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {isSaving
                ? <><Loader2 size={18} className="animate-spin" /> 등록 중...</>
                : <>
                    {activeType === 'GENERAL'    && <><CalendarDays size={16}/> 일정 등록</>}
                    {activeType === 'ASSIGNMENT' && <><ClipboardList size={16}/> 과제 등록</>}
                    {activeType === 'BOTH'       && <><Layers size={16}/> 일정 + 과제 등록</>}
                  </>
              }
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
