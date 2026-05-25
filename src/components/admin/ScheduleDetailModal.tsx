import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Calendar, MapPin, QrCode,
  Pencil, Trash2, BookOpen, Save, Loader2,
  Plus, CheckCircle2, AlertCircle, UploadCloud, File as FileIcon,
  ToggleLeft, ToggleRight, Users, Check,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

/* ──────────────────────────────────
   Types
────────────────────────────────── */
export interface ScheduleDetail {
  id: string;
  title: string;
  type: 'GENERAL' | 'ASSIGNMENT' | 'BOTH';
  date: string;
  time: string;
  location?: string;
  description?: string;
  assignment_template_url?: string;
  is_approved?: boolean;
  related_project_ids?: string[];
  created_at: string;
}

interface Project {
  id: string;
  title: string;
  emoji?: string;
}

interface ClubMember {
  user_id: string;
  role: string;
  full_name: string | null;
  email: string | null;
}

interface Props {
  schedule: ScheduleDetail;
  onClose: () => void;
  onQR: (id: string) => void;
  onDeleted: (id: string) => void;
  onUpdated: (s: ScheduleDetail) => void;
}

/* ──────────────────────────────────
   Helpers
────────────────────────────────── */
const typeStyle = {
  GENERAL:    { label: '일정',      badge: 'bg-black/8 text-black border border-black/20' },
  ASSIGNMENT: { label: '과제',      badge: 'bg-black text-white border border-black' },
  BOTH:       { label: '일정 + 과제', badge: 'bg-black/80 text-white border border-black/80' },
} as const;

const inputCls =
  'w-full px-4 py-3 rounded-2xl bg-black/5 text-black text-sm font-medium outline-none ' +
  'focus:bg-black/8 transition-all placeholder:text-black/25';

function formatDate(dateStr: string, timeStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
  const dow = weekDays[d.getDay()];
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const time = timeStr ? timeStr.slice(0, 5) : '';
  return `${month}월 ${day}일 (${dow})${time ? '  ' + time : ''}`;
}

/* ══════════════════════════════════════════
   Component
══════════════════════════════════════════ */
export function ScheduleDetailModal({ schedule: initialSchedule, onClose, onQR, onDeleted, onUpdated }: Props) {
  const { profile, activeClubId } = useAuth();

  const [schedule, setSchedule] = useState<ScheduleDetail>(initialSchedule);
  const [mode, setMode] = useState<'view' | 'edit' | 'assign' | 'members'>('view');

  /* Edit form */
  const [editForm, setEditForm] = useState({
    title: initialSchedule.title,
    date: initialSchedule.date,
    time: initialSchedule.time ? initialSchedule.time.slice(0, 5) : '',
    location: initialSchedule.location || '',
    description: initialSchedule.description || '',
  });

  /* Assignment form */
  const [assignForm, setAssignForm] = useState({
    title: '',
    due_date: initialSchedule.date,
    due_time: '23:59',
    note: '',
  });
  const [assignFile,          setAssignFile]          = useState<File | null>(null);
  const [assignFileUploading, setAssignFileUploading] = useState(false);
  const [acceptsSubmission,   setAcceptsSubmission]   = useState(true);
  const assignFileRef = useRef<HTMLInputElement>(null);

  /* Related projects */
  const [projects, setProjects] = useState<Project[]>([]);
  const [relatedIds, setRelatedIds] = useState<string[]>(initialSchedule.related_project_ids ?? []);
  const [projectPickerOpen,     setProjectPickerOpen]     = useState(false);
  const [editProjectPickerOpen, setEditProjectPickerOpen] = useState(false);

  /* Member assignment */
  const [clubMembers,     setClubMembers]     = useState<ClubMember[]>([]);
  const [membersLoaded,   setMembersLoaded]   = useState(false);
  const [assignToAll,     setAssignToAll]     = useState(true);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [assignSaving,    setAssignSaving]    = useState(false);

  useEffect(() => {
    if (mode !== 'members' || membersLoaded || !activeClubId) return;
    (async () => {
      // 클럽 멤버 로드
      const { data: mData } = await supabase
        .from('club_members')
        .select('user_id, role, profiles(full_name, email)')
        .eq('club_id', activeClubId);
      type RawM = { user_id: string; role: string; profiles: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null };
      const members: ClubMember[] = ((mData ?? []) as unknown as RawM[]).map(m => {
        const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
        return { user_id: m.user_id, role: m.role, full_name: p?.full_name ?? null, email: p?.email ?? null };
      });
      setClubMembers(members);

      // 기존 지정 현황 로드
      const { data: aData } = await supabase
        .from('schedule_assignments')
        .select('user_id')
        .eq('schedule_id', schedule.id);
      if (aData && aData.length > 0) {
        setAssignToAll(false);
        setSelectedUserIds(new Set((aData as { user_id: string }[]).map(a => a.user_id)));
      } else {
        setAssignToAll(true);
        setSelectedUserIds(new Set());
      }
      setMembersLoaded(true);
    })();
  }, [mode, membersLoaded, activeClubId, schedule.id]);

  const handleSaveAssignments = async () => {
    setAssignSaving(true);
    try {
      // 기존 지정 전부 삭제
      await supabase.from('schedule_assignments').delete().eq('schedule_id', schedule.id);

      if (!assignToAll && selectedUserIds.size > 0) {
        // 선택된 부원만 insert
        await supabase.from('schedule_assignments').insert(
          [...selectedUserIds].map(uid => ({
            schedule_id: schedule.id,
            user_id:     uid,
            club_id:     activeClubId,
            assigned_by: profile?.id,
          }))
        );
      }
      showToast(assignToAll ? '전체 부원에게 적용되었습니다.' : `${selectedUserIds.size}명에게 지정되었습니다.`);
      setMode('view');
    } catch (e) {
      alert('저장 실패: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setAssignSaving(false);
    }
  };

  const toggleMember = (uid: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  };

  /* Loading states */
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  /* Fetch related projects for club */
  useEffect(() => {
    if (!activeClubId) return;
    (async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, title, emoji')
        .eq('club_id', activeClubId)
        .order('created_at', { ascending: false });
      setProjects(data ?? []);
    })();
  }, [activeClubId]);

  /* ── Save edit ── */
  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('schedules')
        .update({
          title: editForm.title,
          date: editForm.date,
          time: editForm.time ? `${editForm.time}:00` : '00:00:00',
          location: editForm.location || null,
          description: editForm.description || null,
        })
        .eq('id', schedule.id)
        .select()
        .single();
      if (error) throw error;
      const updated = { ...schedule, ...data };
      setSchedule(updated);
      onUpdated(updated);
      setMode('view');
      showToast('저장되었습니다.');
    } catch (err: unknown) {
      alert('저장 실패: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setIsSaving(false);
    }
  };

  /* ── Save assignment ── */
  const handleSaveAssign = async () => {
    setIsSaving(true);
    try {
      const newType = schedule.type === 'GENERAL' ? 'BOTH' : schedule.type;

      // 양식 파일 업로드
      let templateUrl: string | null = schedule.assignment_template_url ?? null;
      if (assignFile) {
        setAssignFileUploading(true);
        const ext = assignFile.name.split('.').pop();
        const path = `assignments/template-${schedule.id}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('assignments').upload(path, assignFile, { upsert: true });
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('assignments').getPublicUrl(path);
          templateUrl = urlData.publicUrl;
        }
        setAssignFileUploading(false);
      }

      const assignNote = [
        `[과제] ${assignForm.title}`,
        assignForm.due_date ? `마감: ${assignForm.due_date} ${assignForm.due_time}` : '',
        assignForm.note,
      ].filter(Boolean).join('\n');

      const currentDesc = schedule.description || '';
      const newDesc = currentDesc ? `${currentDesc}\n\n${assignNote}` : assignNote;

      const updatePayload: Record<string, unknown> = {
        type: newType,
        description: newDesc,
        assignment_template_url: templateUrl,
      };
      // accepts_submission 컬럼이 있는 경우 저장 (없어도 silent)
      try {
        await supabase.from('schedules')
          .update({ accepts_submission: acceptsSubmission })
          .eq('id', schedule.id);
      } catch { /* column may not exist */ }

      const { data, error } = await supabase
        .from('schedules')
        .update(updatePayload)
        .eq('id', schedule.id)
        .select()
        .single();
      if (error) throw error;
      const updated = { ...schedule, ...data };
      setSchedule(updated);
      onUpdated(updated);
      setMode('view');
      showToast('과제가 추가되었습니다.');
    } catch (err: unknown) {
      alert('과제 추가 실패: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setIsSaving(false);
      setAssignFileUploading(false);
    }
  };

  /* ── Delete ── */
  const handleDelete = async () => {
    if (!window.confirm('이 일정을 삭제하시겠습니까?')) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('schedules').delete().eq('id', schedule.id);
      if (error) throw error;
      onDeleted(schedule.id);
      onClose();
    } catch (err: unknown) {
      alert('삭제 실패: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setIsDeleting(false);
    }
  };

  /* ── Toggle related project ── */
  const toggleProject = async (projectId: string) => {
    const next = relatedIds.includes(projectId)
      ? relatedIds.filter(id => id !== projectId)
      : [...relatedIds, projectId];
    setRelatedIds(next);
    try {
      await supabase
        .from('schedules')
        .update({ related_project_ids: next })
        .eq('id', schedule.id);
    } catch {
      /* silent - column may not exist yet */
    }
  };

  const ts = typeStyle[schedule.type] ?? typeStyle.GENERAL;
  const isPast = schedule.date < new Date().toISOString().slice(0, 10);

  const relatedProjects = projects.filter(p => relatedIds.includes(p.id));

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ type: 'spring', stiffness: 360, damping: 32 }}
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between px-7 pt-6 pb-5 border-b border-black/8">
          <div className="flex-1 min-w-0 pr-4">
            <span className={`inline-block text-[10px] font-black px-2.5 py-1 rounded-full mb-2 ${ts.badge}`}>
              {ts.label}
            </span>
            {mode === 'view' && (
              <h2 className="text-xl font-black text-black leading-tight">{schedule.title}</h2>
            )}
            {mode === 'edit' && (
              <h2 className="text-base font-black text-black/60">일정 수정</h2>
            )}
            {mode === 'assign' && (
              <h2 className="text-base font-black text-black/60">과제 추가</h2>
            )}
            {mode === 'members' && (
              <h2 className="text-base font-black text-black/60">부원 지정</h2>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-black/8 hover:bg-black/15 flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-4 h-4 text-black" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── VIEW MODE ── */}
          {mode === 'view' && (
            <div className="px-7 py-5 space-y-5">

              {/* Date / time / location */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5 text-sm font-medium text-black">
                  <Calendar className="w-4 h-4 text-black/40 shrink-0" />
                  <span>{formatDate(schedule.date, schedule.time)}</span>
                </div>
                {schedule.location && (
                  <div className="flex items-center gap-2.5 text-sm font-medium text-black">
                    <MapPin className="w-4 h-4 text-black/40 shrink-0" />
                    <span>{schedule.location}</span>
                  </div>
                )}
              </div>

              {/* Description */}
              {schedule.description && (
                <div className="p-4 rounded-2xl bg-black/[0.03] border border-black/8">
                  <p className="text-xs font-black text-black/40 uppercase tracking-wider mb-1.5">메모</p>
                  <p className="text-sm text-black/80 font-medium whitespace-pre-wrap leading-relaxed">
                    {schedule.description}
                  </p>
                </div>
              )}

              {/* Related projects */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-black text-black/40 uppercase tracking-wider">연관 프로젝트</p>
                  {projects.length > 0 && (
                    <button
                      onClick={() => setProjectPickerOpen(p => !p)}
                      className="flex items-center gap-1 text-xs font-black text-black/50 hover:text-black transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      추가
                    </button>
                  )}
                </div>

                {relatedProjects.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {relatedProjects.map(p => (
                      <span key={p.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black text-white text-xs font-black"
                      >
                        <span>{p.emoji || '🚀'}</span>
                        <span>{p.title}</span>
                        <button
                          onClick={() => toggleProject(p.id)}
                          className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-black/30 font-medium">연관된 프로젝트가 없습니다</p>
                )}

                {/* Project picker dropdown */}
                <AnimatePresence>
                  {projectPickerOpen && projects.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="mt-2 rounded-2xl border border-black/15 overflow-hidden bg-white shadow-lg"
                    >
                      {projects.map(p => (
                        <button
                          key={p.id}
                          onClick={() => toggleProject(p.id)}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-black/5 transition-colors text-left"
                        >
                          <span className="text-base">{p.emoji || '🚀'}</span>
                          <span className="flex-1 text-sm font-medium text-black">{p.title}</span>
                          {relatedIds.includes(p.id) && (
                            <CheckCircle2 className="w-4 h-4 text-black shrink-0" />
                          )}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Action buttons */}
              <div className="border-t border-black/8 pt-4 flex flex-wrap gap-2">
                {!isPast && (
                  <button
                    onClick={() => onQR(schedule.id)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-black/8 hover:bg-black/15 text-xs font-black text-black transition-colors"
                  >
                    <QrCode className="w-3.5 h-3.5" /> QR 출석
                  </button>
                )}
                <button
                  onClick={() => setMode('edit')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-black/8 hover:bg-black/15 text-xs font-black text-black transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" /> 수정
                </button>
                <button
                  onClick={() => { setMembersLoaded(false); setMode('members'); }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-black/8 hover:bg-black/15 text-xs font-black text-black transition-colors"
                >
                  <Users className="w-3.5 h-3.5" /> 부원 지정
                </button>
                {schedule.type === 'GENERAL' && (
                  <button
                    onClick={() => setMode('assign')}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-black text-white hover:bg-black/85 text-xs font-black transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5" /> 과제 추가
                  </button>
                )}
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-red-50 hover:bg-red-100 text-xs font-black text-red-500 transition-colors disabled:opacity-50 ml-auto"
                >
                  {isDeleting
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Trash2 className="w-3.5 h-3.5" />
                  }
                  삭제
                </button>
              </div>
            </div>
          )}

          {/* ── EDIT MODE ── */}
          {mode === 'edit' && (
            <div className="px-7 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-black/50 block">제목 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className={inputCls}
                  placeholder="일정 제목"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-black/50 block">날짜</label>
                  <input type="date" value={editForm.date}
                    onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                    className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-black/50 block">시간</label>
                  <input type="time" value={editForm.time}
                    onChange={e => setEditForm(f => ({ ...f, time: e.target.value }))}
                    className={inputCls} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black text-black/50 block">장소</label>
                <input type="text" value={editForm.location}
                  onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="예: 공학관 302호"
                  className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black text-black/50 block">메모</label>
                <textarea value={editForm.description}
                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  rows={3} placeholder="상세 내용"
                  className="w-full px-4 py-3 rounded-2xl bg-black/5 text-black text-sm font-medium outline-none focus:bg-black/8 transition-all placeholder:text-black/25 resize-none" />
              </div>

              {/* 연관 프로젝트 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-black/50 block">연관 프로젝트</label>
                  {projects.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setEditProjectPickerOpen(p => !p)}
                      className="flex items-center gap-1 text-xs font-black text-black/50 hover:text-black transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      {editProjectPickerOpen ? '닫기' : '추가'}
                    </button>
                  )}
                </div>

                {/* 선택된 프로젝트 태그 */}
                {relatedIds.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {projects.filter(p => relatedIds.includes(p.id)).map(p => (
                      <span key={p.id}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black text-white text-xs font-black"
                      >
                        <span>{p.emoji || '🚀'}</span>
                        <span>{p.title}</span>
                        <button
                          type="button"
                          onClick={() => toggleProject(p.id)}
                          className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-black/30 font-medium">선택된 프로젝트가 없습니다</p>
                )}

                {/* 프로젝트 선택 드롭다운 */}
                <AnimatePresence>
                  {editProjectPickerOpen && projects.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="rounded-2xl border border-black/15 overflow-hidden bg-white shadow-lg"
                    >
                      {projects.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleProject(p.id)}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-black/5 transition-colors text-left"
                        >
                          <span className="text-base">{p.emoji || '🚀'}</span>
                          <span className="flex-1 text-sm font-medium text-black">{p.title}</span>
                          {relatedIds.includes(p.id) && (
                            <CheckCircle2 className="w-4 h-4 text-black shrink-0" />
                          )}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {projects.length === 0 && (
                  <p className="text-xs text-black/25 font-medium">등록된 프로젝트가 없습니다</p>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => setMode('view')}
                  className="flex-1 py-3 rounded-2xl border border-black/20 text-sm font-black text-black/50 hover:bg-black/5 transition-colors">
                  취소
                </button>
                <button onClick={handleSaveEdit} disabled={isSaving || !editForm.title}
                  className="flex-[2] py-3 rounded-2xl bg-black text-white font-black text-sm disabled:opacity-40 hover:bg-black/85 transition-all flex items-center justify-center gap-2">
                  {isSaving
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> 저장 중...</>
                    : <><Save className="w-4 h-4" /> 저장</>
                  }
                </button>
              </div>
            </div>
          )}

          {/* ── ASSIGN MODE ── */}
          {mode === 'assign' && (
            <div className="px-7 py-5 space-y-4">
              <div className="p-3.5 rounded-2xl bg-black/5 border border-black/10 flex items-center gap-2 text-xs font-medium text-black/60">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                이 일정에 과제를 추가하면 유형이 <strong className="text-black">일정 + 과제</strong>로 변경됩니다.
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black text-black/50 block">과제 제목 <span className="text-red-500">*</span></label>
                <input type="text" value={assignForm.title}
                  onChange={e => setAssignForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="예: 웹서버 구현 과제"
                  className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-black/50 block">마감일</label>
                  <input type="date" value={assignForm.due_date}
                    onChange={e => setAssignForm(f => ({ ...f, due_date: e.target.value }))}
                    className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-black/50 block">마감 시간</label>
                  <input type="time" value={assignForm.due_time}
                    onChange={e => setAssignForm(f => ({ ...f, due_time: e.target.value }))}
                    className={inputCls} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black text-black/50 block">상세 설명</label>
                <textarea value={assignForm.note}
                  onChange={e => setAssignForm(f => ({ ...f, note: e.target.value }))}
                  rows={3} placeholder="제출 방법, 유의사항 등"
                  className="w-full px-4 py-3 rounded-2xl bg-black/5 text-black text-sm font-medium outline-none focus:bg-black/8 transition-all placeholder:text-black/25 resize-none" />
              </div>

              {/* 양식 파일 첨부 */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-black/50 block">
                  양식 파일 <span className="font-normal text-black/25">(선택)</span>
                </label>
                <div
                  onClick={() => assignFileRef.current?.click()}
                  className="flex items-center gap-3 p-3.5 rounded-2xl border-2 border-dashed border-black/20
                             hover:border-black/40 hover:bg-black/[0.02] transition-all cursor-pointer"
                >
                  {assignFile ? (
                    <>
                      <div className="w-8 h-8 bg-black/8 rounded-xl flex items-center justify-center shrink-0">
                        <FileIcon className="w-4 h-4 text-black" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-black truncate">{assignFile.name}</p>
                        <p className="text-xs text-black/40">{(assignFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <button type="button"
                        onClick={e => { e.stopPropagation(); setAssignFile(null); }}
                        className="w-6 h-6 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center shrink-0 transition-colors">
                        <X className="w-3 h-3 text-black" />
                      </button>
                    </>
                  ) : schedule.assignment_template_url ? (
                    <>
                      <div className="w-8 h-8 bg-black/8 rounded-xl flex items-center justify-center shrink-0">
                        <FileIcon className="w-4 h-4 text-black/60" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-black truncate">기존 양식 있음</p>
                        <a href={schedule.assignment_template_url} target="_blank" rel="noreferrer"
                           className="text-[11px] text-black/40 hover:text-black underline" onClick={e => e.stopPropagation()}>
                          미리보기
                        </a>
                      </div>
                      <span className="text-[10px] font-black text-black/40">클릭하여 교체</span>
                    </>
                  ) : (
                    <>
                      <div className="w-8 h-8 bg-black/8 rounded-xl flex items-center justify-center shrink-0">
                        <UploadCloud className="w-4 h-4 text-black/40" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-black/50">클릭하여 파일 업로드</p>
                        <p className="text-xs text-black/25 mt-0.5">PDF, Word, HWP · 최대 10MB</p>
                      </div>
                    </>
                  )}
                </div>
                <input ref={assignFileRef} type="file" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) setAssignFile(e.target.files[0]); }} />
              </div>

              {/* 제출 받기 토글 */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/5 border border-black/10">
                <div>
                  <p className="text-sm font-black text-black">제출 받기</p>
                  <p className="text-xs text-black/40 font-medium mt-0.5">부원이 앱에서 과제를 제출할 수 있습니다</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAcceptsSubmission(p => !p)}
                  className="shrink-0 transition-colors"
                >
                  {acceptsSubmission
                    ? <ToggleRight className="w-9 h-9 text-black" />
                    : <ToggleLeft className="w-9 h-9 text-black/25" />
                  }
                </button>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => setMode('view')}
                  className="flex-1 py-3 rounded-2xl border border-black/20 text-sm font-black text-black/50 hover:bg-black/5 transition-colors">
                  취소
                </button>
                <button onClick={handleSaveAssign} disabled={isSaving || !assignForm.title}
                  className="flex-[2] py-3 rounded-2xl bg-black text-white font-black text-sm disabled:opacity-40 hover:bg-black/85 transition-all flex items-center justify-center gap-2">
                  {isSaving || assignFileUploading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> {assignFileUploading ? '파일 업로드 중...' : '저장 중...'}</>
                    : <><BookOpen className="w-4 h-4" /> 과제 추가</>
                  }
                </button>
              </div>
            </div>
          )}

          {/* ── MEMBERS MODE ── */}
          {mode === 'members' && (
            <div className="px-7 py-5 space-y-4">

              {/* 안내 */}
              <div className="p-3.5 rounded-2xl bg-black/5 border border-black/10 flex items-start gap-2 text-xs font-medium text-black/60">
                <Users className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  특정 부원에게만 이 일정·과제를 적용합니다.
                  <strong className="text-black"> 전체 부원</strong>으로 설정하면 모두에게 보입니다.
                </span>
              </div>

              {/* 전체 / 개별 토글 */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/5 border border-black/10">
                <div>
                  <p className="text-sm font-black text-black">전체 부원에게 적용</p>
                  <p className="text-xs text-black/40 font-medium mt-0.5">
                    {assignToAll ? '모든 부원이 이 일정을 볼 수 있습니다' : '아래에서 개별 지정합니다'}
                  </p>
                </div>
                <button type="button" onClick={() => setAssignToAll(p => !p)} className="shrink-0 transition-colors">
                  {assignToAll
                    ? <ToggleRight className="w-9 h-9 text-black" />
                    : <ToggleLeft  className="w-9 h-9 text-black/25" />
                  }
                </button>
              </div>

              {/* 멤버 리스트 (전체 아닐 때만) */}
              {!assignToAll && (
                <div className="space-y-1.5">
                  {/* 전체 선택/해제 */}
                  <div className="flex items-center justify-between px-1 mb-2">
                    <span className="text-xs font-black text-black/40">
                      {selectedUserIds.size > 0 ? `${selectedUserIds.size}명 선택됨` : '부원을 선택하세요'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedUserIds.size === clubMembers.length) {
                          setSelectedUserIds(new Set());
                        } else {
                          setSelectedUserIds(new Set(clubMembers.map(m => m.user_id)));
                        }
                      }}
                      className="text-xs font-black text-black/40 hover:text-black transition-colors"
                    >
                      {selectedUserIds.size === clubMembers.length ? '전체 해제' : '전체 선택'}
                    </button>
                  </div>

                  {/* 운영진 그룹 */}
                  {clubMembers.filter(m => ['ADMIN','LEADER','CAPTAIN'].includes(m.role)).length > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-black/30 uppercase tracking-widest px-1 mb-1">운영진</p>
                      {clubMembers.filter(m => ['ADMIN','LEADER','CAPTAIN'].includes(m.role)).map(m => (
                        <MemberCheckRow
                          key={m.user_id}
                          member={m}
                          checked={selectedUserIds.has(m.user_id)}
                          onToggle={() => toggleMember(m.user_id)}
                        />
                      ))}
                    </div>
                  )}

                  {/* 부원 그룹 */}
                  {clubMembers.filter(m => !['ADMIN','LEADER','CAPTAIN'].includes(m.role)).length > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-black/30 uppercase tracking-widest px-1 mb-1 mt-3">
                        부원 ({clubMembers.filter(m => !['ADMIN','LEADER','CAPTAIN'].includes(m.role)).length}명)
                      </p>
                      {clubMembers.filter(m => !['ADMIN','LEADER','CAPTAIN'].includes(m.role)).map(m => (
                        <MemberCheckRow
                          key={m.user_id}
                          member={m}
                          checked={selectedUserIds.has(m.user_id)}
                          onToggle={() => toggleMember(m.user_id)}
                        />
                      ))}
                    </div>
                  )}

                  {clubMembers.length === 0 && !membersLoaded && (
                    <div className="flex justify-center py-6">
                      <Loader2 className="w-5 h-5 animate-spin text-black/25" />
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setMode('view')}
                  className="flex-1 py-3 rounded-2xl border border-black/20 text-sm font-black text-black/50 hover:bg-black/5 transition-colors">
                  취소
                </button>
                <button
                  onClick={handleSaveAssignments}
                  disabled={assignSaving || (!assignToAll && selectedUserIds.size === 0)}
                  className="flex-[2] py-3 rounded-2xl bg-black text-white font-black text-sm
                             disabled:opacity-40 hover:bg-black/85 transition-all flex items-center justify-center gap-2"
                >
                  {assignSaving
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> 저장 중...</>
                    : <><Users className="w-4 h-4" /> 저장</>
                  }
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 bg-black text-white rounded-2xl shadow-xl font-bold text-xs whitespace-nowrap"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-white/70" />
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

/* ─────────────────────────────
   MemberCheckRow
───────────────────────────── */
function MemberCheckRow({
  member, checked, onToggle,
}: {
  member: ClubMember;
  checked: boolean;
  onToggle: () => void;
  [key: string]: unknown;
}) {
  const isLeader = ['ADMIN', 'LEADER', 'CAPTAIN'].includes(member.role);
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border transition-all text-left
        ${checked
          ? 'border-black bg-black/[0.04] ring-1 ring-black/15'
          : 'border-black/10 bg-white hover:bg-black/[0.02]'
        }`}
    >
      {/* 체크박스 */}
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
        ${checked ? 'bg-black border-black' : 'border-black/25'}`}>
        {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </div>

      {/* 아바타 */}
      <div className="w-8 h-8 rounded-full bg-black/8 flex items-center justify-center shrink-0">
        <span className="text-xs font-black text-black/50">
          {(member.full_name ?? '?').slice(0, 1)}
        </span>
      </div>

      {/* 이름 + 역할 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-black text-black truncate">
            {member.full_name || '이름 미설정'}
          </span>
          {isLeader && (
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-black text-white shrink-0">
              Leader
            </span>
          )}
        </div>
        {member.email && (
          <p className="text-[11px] text-black/35 font-medium truncate">{member.email}</p>
        )}
      </div>
    </button>
  );
}
