import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { AttendanceQR } from './AttendanceQR';
import { ScheduleModal } from '../../components/admin/ScheduleModal';
import { BulkScheduleModal } from '../../components/admin/BulkScheduleModal';
import { ScheduleDetailModal, ScheduleDetail } from '../../components/admin/ScheduleDetailModal';
import {
  Calendar as CalendarIcon,
  Plus,
  QrCode,
  MapPin,
  Loader2,
  CalendarDays,
  TableProperties,
  ArrowUpDown,
  BookOpen,
  CheckSquare2,
  Square,
  Trash2,
  X,
  CheckCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BackButton } from '../../components/common/BackButton';

interface Schedule extends ScheduleDetail {}

type SortMode = 'upcoming' | 'latest';

function todayYMD(): string {
  const t = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

const typeStyle = {
  GENERAL:    { label: '일정',       badge: 'bg-black/8 text-black border border-black/20' },
  ASSIGNMENT: { label: '과제',       badge: 'bg-black text-white border border-black' },
  BOTH:       { label: '일정 + 과제', badge: 'bg-black/80 text-white border border-black/80' },
} as const;

function isPast(dateStr: string): boolean {
  return dateStr < todayYMD();
}

/* ─────────────────────────────
   Main component
───────────────────────────── */
export function Schedules() {
  const { activeClubId } = useAuth();
  const [schedules,      setSchedules]      = useState<Schedule[]>([]);
  const [isLoading,      setIsLoading]      = useState(true);
  const [isAdding,       setIsAdding]       = useState(false);
  const [isBulkOpen,     setIsBulkOpen]     = useState(false);
  const [selectedQR,     setSelectedQR]     = useState<string | null>(null);
  const [showPast,       setShowPast]       = useState(false);
  const [sortMode,       setSortMode]       = useState<SortMode>('upcoming');
  const [detailSchedule, setDetailSchedule] = useState<Schedule | null>(null);

  /* ── 선택 모드 ── */
  const [isSelectMode,   setIsSelectMode]   = useState(false);
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set());
  const [isDeleting,     setIsDeleting]     = useState(false);

  useEffect(() => { if (activeClubId) fetchSchedules(); }, [activeClubId]);

  const fetchSchedules = async () => {
    try {
      setIsLoading(true);
      if (!activeClubId) { setSchedules([]); return; }
      const { data, error } = await supabase
        .from('schedules').select('*')
        .eq('club_id', activeClubId)
        .order('date').order('time');
      if (error) { console.error(error); setSchedules([]); return; }
      setSchedules(data ?? []);
    } catch (e) {
      console.error(e);
      setSchedules([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaved = (newData: Schedule) => {
    setSchedules(prev =>
      [...prev, newData].sort((a, b) =>
        a.date === b.date ? (a.time ?? '').localeCompare(b.time ?? '') : a.date.localeCompare(b.date)
      )
    );
  };

  const handleUpdated = (updated: Schedule) => {
    setSchedules(prev =>
      prev.map(s => s.id === updated.id ? updated : s)
        .sort((a, b) =>
          a.date === b.date ? (a.time ?? '').localeCompare(b.time ?? '') : a.date.localeCompare(b.date)
        )
    );
    if (detailSchedule?.id === updated.id) setDetailSchedule(updated);
  };

  const handleDeleted = (id: string) => {
    setSchedules(prev => prev.filter(s => s.id !== id));
    if (detailSchedule?.id === id) setDetailSchedule(null);
  };

  const handleAddAssignment = (schedule: Schedule) => {
    setDetailSchedule(schedule);
  };

  /* ── Sort & filter (선택 함수보다 먼저 선언) ── */
  const today      = todayYMD();
  const upcoming   = schedules.filter(s => !isPast(s.date));
  const past       = schedules.filter(s =>  isPast(s.date));
  const latestList = [...schedules].sort((a, b) =>
    a.date === b.date ? (b.time ?? '').localeCompare(a.time ?? '') : b.date.localeCompare(a.date)
  );

  /* ── 선택 모드 진입/탈출 ── */
  const enterSelectMode = () => {
    setIsSelectMode(true);
    setSelectedIds(new Set());
  };
  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  };

  /* ── 개별 토글 ── */
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  /* ── 전체 선택 / 해제 ── */
  const allVisibleIds = (): string[] => {
    if (sortMode === 'latest') return latestList.map(s => s.id);
    const ids = upcoming.map(s => s.id);
    if (showPast) ids.push(...[...past].reverse().map(s => s.id));
    return ids;
  };

  const isAllSelected = allVisibleIds().length > 0 &&
    allVisibleIds().every(id => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allVisibleIds()));
    }
  };

  /* ── 선택 삭제 ── */
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`선택한 ${selectedIds.size}개 일정을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;

    setIsDeleting(true);
    try {
      const ids = [...selectedIds];
      const { error } = await supabase.from('schedules').delete().in('id', ids);
      if (error) throw error;
      setSchedules(prev => prev.filter(s => !selectedIds.has(s.id)));
      if (detailSchedule && selectedIds.has(detailSchedule.id)) setDetailSchedule(null);
      exitSelectMode();
    } catch {
      alert('일정 삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-28">
      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-16 space-y-6">

        {/* ── Header ── */}
        <BackButton to="/admin" label="뒤로가기" />
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-black flex items-center gap-3">
              <CalendarIcon className="w-8 h-8 opacity-80" />
              일정 관리
            </h1>
            <p className="text-black/60 mt-1 text-sm font-medium">
              등록된 일정을 시간 순서로 확인하세요.
            </p>
          </div>

          {/* 버튼 영역 */}
          <div className="flex items-center gap-2">
            {/* 선택 모드가 아닐 때: 일괄등록 / 새 일정 / 선택 */}
            {!isSelectMode ? (
              <>
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={() => setIsBulkOpen(true)}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-black text-sm
                             border border-black/20 text-black hover:bg-black/5 transition-all active:scale-95 shrink-0"
                >
                  <TableProperties size={16} />
                  일괄 등록
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={() => setIsAdding(true)}
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-black text-sm
                             bg-black text-white hover:bg-black/90 transition-all active:scale-95 shrink-0"
                >
                  <Plus size={18} />
                  새 일정 등록
                </motion.button>
                {schedules.length > 0 && (
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={enterSelectMode}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-black text-sm
                               border border-black/20 text-black hover:bg-black/5 transition-all active:scale-95 shrink-0"
                  >
                    <CheckSquare2 size={16} />
                    선택
                  </motion.button>
                )}
              </>
            ) : (
              /* 선택 모드일 때: 전체선택 / 취소 */
              <>
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 px-4 py-3 rounded-2xl font-black text-sm
                             border border-black/20 text-black hover:bg-black/5 transition-all shrink-0"
                >
                  {isAllSelected
                    ? <><CheckCheck size={15} /> 전체 해제</>
                    : <><Square size={15} /> 전체 선택</>
                  }
                </button>
                <button
                  onClick={exitSelectMode}
                  className="flex items-center gap-1.5 px-4 py-3 rounded-2xl font-black text-sm
                             bg-black/8 text-black hover:bg-black/15 transition-all shrink-0"
                >
                  <X size={15} />
                  취소
                </button>
              </>
            )}
          </div>
        </header>

        {/* ── 선택 모드 상태 바 ── */}
        {isSelectMode && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-black/5 border border-black/10"
          >
            <CheckSquare2 size={14} className="text-black/40 shrink-0" />
            <span className="text-xs font-black text-black/60">
              {selectedIds.size > 0
                ? `${selectedIds.size}개 선택됨`
                : '삭제할 일정을 선택하세요'}
            </span>
          </motion.div>
        )}

        {/* ── Sort toggle ── */}
        {schedules.length > 0 && !isSelectMode && (
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-black/30" />
            <div className="flex items-center bg-black/6 rounded-full p-1 gap-1">
              {(['upcoming', 'latest'] as SortMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setSortMode(m)}
                  className={`px-3 py-1 rounded-full text-xs font-black transition-all ${
                    sortMode === m
                      ? 'bg-black text-white shadow-sm'
                      : 'text-black/50 hover:text-black'
                  }`}
                >
                  {m === 'upcoming' ? '다가오는 일정순' : '최신순'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── List ── */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24 gap-3 text-black/40">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm font-black">불러오는 중...</span>
          </div>
        ) : schedules.length === 0 ? (
          <div className="bg-white rounded-3xl border border-black/20 py-20 text-center">
            <CalendarDays size={36} className="mx-auto mb-4 text-black/20" />
            <p className="text-sm font-black text-black/50">등록된 일정이 없습니다</p>
            <p className="text-xs text-black/30 mt-1.5">우측 상단에서 새 일정을 추가해보세요.</p>
          </div>
        ) : sortMode === 'latest' ? (
          /* ── Latest sort: flat list ── */
          <div className="space-y-2">
            {latestList.map((s, i) => (
              <ScheduleRow
                key={s.id}
                schedule={s}
                index={i}
                onDelete={handleDeleted}
                onQR={setSelectedQR}
                onAddAssignment={handleAddAssignment}
                onOpen={setDetailSchedule}
                past={isPast(s.date)}
                selectMode={isSelectMode}
                isSelected={selectedIds.has(s.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        ) : (
          /* ── Upcoming sort: grouped ── */
          <div className="space-y-8">
            {upcoming.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs font-black text-black/50 uppercase tracking-widest">다가오는 일정</span>
                  <span className="text-xs font-black px-2 py-0.5 rounded-full bg-black text-white">{upcoming.length}</span>
                </div>
                <div className="space-y-2">
                  {upcoming.map((s, i) => (
                    <ScheduleRow
                      key={s.id}
                      schedule={s}
                      index={i}
                      onDelete={handleDeleted}
                      onQR={setSelectedQR}
                      onAddAssignment={handleAddAssignment}
                      onOpen={setDetailSchedule}
                      selectMode={isSelectMode}
                      isSelected={selectedIds.has(s.id)}
                      onToggleSelect={toggleSelect}
                    />
                  ))}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section>
                <button
                  onClick={() => setShowPast(p => !p)}
                  className="flex items-center gap-2 text-xs font-black text-black/40 hover:text-black/60 transition-colors mb-4"
                >
                  <span className="uppercase tracking-widest">지난 일정 {past.length}건</span>
                  <span className={`transition-transform duration-200 ${showPast ? 'rotate-180' : ''}`}>▾</span>
                </button>

                <AnimatePresence>
                  {showPast && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-2 opacity-50">
                        {[...past].reverse().map((s, i) => (
                          <ScheduleRow
                            key={s.id}
                            schedule={s}
                            index={i}
                            onDelete={handleDeleted}
                            onQR={setSelectedQR}
                            onAddAssignment={handleAddAssignment}
                            onOpen={setDetailSchedule}
                            past
                            selectMode={isSelectMode}
                            isSelected={selectedIds.has(s.id)}
                            onToggleSelect={toggleSelect}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            )}
          </div>
        )}
      </div>

      {/* ── 선택 삭제 하단 고정 바 ── */}
      <AnimatePresence>
        {isSelectMode && (
          <motion.div
            initial={{ opacity: 0, y: 64 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 64 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-3
                       bg-gradient-to-t from-white via-white/95 to-white/0"
          >
            <div className="max-w-3xl mx-auto flex items-center gap-3">
              {/* 카운트 */}
              <div className="flex-1 px-4 py-3 rounded-2xl bg-black/5 border border-black/10">
                <p className="text-sm font-black text-black">
                  {selectedIds.size > 0
                    ? <><span className="text-lg">{selectedIds.size}</span>개 선택됨</>
                    : <span className="text-black/40">일정을 선택하세요</span>
                  }
                </p>
              </div>

              {/* 삭제 버튼 */}
              <motion.button
                whileHover={selectedIds.size > 0 ? { scale: 1.02 } : {}}
                whileTap={selectedIds.size > 0 ? { scale: 0.97 } : {}}
                onClick={handleBulkDelete}
                disabled={selectedIds.size === 0 || isDeleting}
                className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-black text-sm transition-all shrink-0
                  ${selectedIds.size > 0
                    ? 'bg-black text-white hover:bg-black/85 active:scale-95'
                    : 'bg-black/10 text-black/30 cursor-not-allowed'
                  }`}
              >
                {isDeleting
                  ? <Loader2 size={16} className="animate-spin" />
                  : <Trash2 size={16} />
                }
                {isDeleting ? '삭제 중...' : '선택 삭제'}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modals ── */}
      <AnimatePresence>
        {isAdding && (
          <ScheduleModal onClose={() => setIsAdding(false)} onSaved={handleSaved} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isBulkOpen && (
          <BulkScheduleModal
            onClose={() => setIsBulkOpen(false)}
            onSaved={() => { setIsBulkOpen(false); fetchSchedules(); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* 선택 모드에서는 상세 모달 열지 않음 */}
        {detailSchedule && !isSelectMode && (
          <ScheduleDetailModal
            schedule={detailSchedule}
            onClose={() => setDetailSchedule(null)}
            onQR={(id) => { setDetailSchedule(null); setSelectedQR(id); }}
            onDeleted={handleDeleted}
            onUpdated={handleUpdated}
          />
        )}
      </AnimatePresence>

      {selectedQR && (
        <AttendanceQR scheduleId={selectedQR} onClose={() => setSelectedQR(null)} />
      )}
    </div>
  );
}

/* ─────────────────────────────
   Schedule Row
───────────────────────────── */
interface ScheduleRowProps {
  schedule: Schedule;
  index: number;
  onDelete: (id: string) => void;
  onQR: (id: string) => void;
  onAddAssignment: (s: Schedule) => void;
  onOpen: (s: Schedule) => void;
  past?: boolean;
  /* 선택 모드 */
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}

const ScheduleRow: React.FC<ScheduleRowProps> = ({
  schedule, index, onDelete, onQR, onAddAssignment, onOpen, past = false,
  selectMode = false, isSelected = false, onToggleSelect,
}) => {
  const ts = typeStyle[schedule.type] ?? typeStyle.GENERAL;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('이 일정을 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('schedules').delete().eq('id', schedule.id);
      if (error) throw error;
      onDelete(schedule.id);
    } catch {
      alert('일정 삭제에 실패했습니다.');
    }
  };

  const handleClick = () => {
    if (selectMode) {
      onToggleSelect?.(schedule.id);
    } else {
      onOpen(schedule);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      onClick={handleClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all cursor-pointer
        ${selectMode && isSelected
          ? 'border-black bg-black/[0.04] ring-2 ring-black/20'
          : 'border-black/12 bg-white hover:bg-black/[0.02] group'
        }`}
    >
      {/* 선택 모드: 체크박스 */}
      {selectMode && (
        <div className="shrink-0">
          <motion.div
            initial={false}
            animate={{ scale: isSelected ? 1 : 0.9 }}
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
              ${isSelected
                ? 'bg-black border-black'
                : 'bg-white border-black/25 hover:border-black/50'
              }`}
          >
            {isSelected && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </motion.div>
        </div>
      )}

      {/* Date + Time block */}
      <div className="w-14 shrink-0 text-center">
        <div className="text-sm font-black text-black leading-none">
          {(() => {
            const d = new Date(schedule.date + 'T00:00:00');
            return `${d.getMonth() + 1}/${d.getDate()}`;
          })()}
        </div>
        <div className="text-[11px] font-medium text-black/40 mt-0.5 leading-none">
          {schedule.time ? schedule.time.slice(0, 5) : '—'}
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-9 bg-black/12 shrink-0" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${ts.badge}`}>
            {ts.label}
          </span>
          {schedule.is_approved === false && (
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full
                             bg-black/8 text-black/50 border border-black/15 shrink-0">
              승인 대기
            </span>
          )}
        </div>
        <p className="font-black text-black text-sm truncate">{schedule.title}</p>
        {schedule.location && (
          <p className="flex items-center gap-1 text-[11px] text-black/40 truncate mt-0.5">
            <MapPin className="w-2.5 h-2.5 shrink-0" />{schedule.location}
          </p>
        )}
      </div>

      {/* 일반 모드 hover 액션 */}
      {!selectMode && (
        <div
          className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={e => e.stopPropagation()}
        >
          {!past && (
            <button
              onClick={e => { e.stopPropagation(); onQR(schedule.id); }}
              className="p-1.5 rounded-xl hover:bg-black/8 text-black/40 hover:text-black transition-colors"
              title="QR 출석"
            >
              <QrCode size={14} />
            </button>
          )}
          {schedule.type === 'GENERAL' && (
            <button
              onClick={e => { e.stopPropagation(); onAddAssignment(schedule); }}
              className="p-1.5 rounded-xl hover:bg-black/8 text-black/40 hover:text-black transition-colors"
              title="과제 추가"
            >
              <BookOpen size={14} />
            </button>
          )}
          <button
            onClick={handleDelete}
            className="p-1.5 rounded-xl hover:bg-black/8 text-black/25 hover:text-black/60 transition-colors"
            title="삭제"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </motion.div>
  );
};
