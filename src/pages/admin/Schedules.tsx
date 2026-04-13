import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { AttendanceQR } from './AttendanceQR';
import { ScheduleModal } from '../../components/admin/ScheduleModal';
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  QrCode,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  File as FileIcon,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BackButton } from '../../components/common/BackButton';

interface Schedule {
  id: string;
  title: string;
  type: 'GENERAL' | 'ASSIGNMENT' | 'BOTH';
  date: string;
  time: string;
  location: string;
  description: string;
  assignment_template_url?: string;
  is_approved?: boolean;
  created_at: string;
}

/* ── 유형별 스타일 ── */
const typeStyle = {
  GENERAL:    { label: '일반 세션',   badge: 'bg-black/8 text-black border border-black/20',    bar: 'bg-black'        },
  ASSIGNMENT: { label: '과제 전용',   badge: 'bg-black/15 text-black border border-black/25',   bar: 'bg-black/60'     },
  BOTH:       { label: '일반 + 과제', badge: 'bg-black text-white',                              bar: 'bg-black/80'     },
} as const;

export function Schedules() {
  const [schedules,   setSchedules]   = useState<Schedule[]>([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isAdding,    setIsAdding]    = useState(false);
  const [selectedQR,  setSelectedQR]  = useState<string | null>(null);

  useEffect(() => { fetchSchedules(); }, []);

  const fetchSchedules = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .order('date', { ascending: true });
      if (error) { console.error('Schedules fetch error:', error); setSchedules([]); return; }
      setSchedules(data ?? []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      setSchedules([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaved = (newData: Schedule) => {
    setSchedules(prev =>
      [...prev, newData].sort((a, b) =>
        a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)
      )
    );
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('정말로 이 일정을 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('schedules').delete().eq('id', id);
      if (error) throw error;
      setSchedules(schedules.filter(s => s.id !== id));
    } catch (error) {
      console.error('Error deleting schedule:', error);
      alert('일정 삭제에 실패했습니다.');
    }
  };

  /* ── 달력 계산 ── */
  const getDaysInMonth   = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const year        = currentDate.getFullYear();
  const month       = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay    = getFirstDayOfMonth(year, month);

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1));

  const formatDateString = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const todayStr  = formatDateString(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const monthNames = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const weekDays   = ['일','월','화','수','목','금','토'];

  return (
    <div className="min-h-screen bg-white pb-12">
      <div className="max-w-5xl mx-auto px-4 md:px-8 pt-12 space-y-6">

        {/* ── 헤더 ── */}
        <BackButton to="/admin" label="뒤로가기" />
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="inline-block mb-3 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase
                             bg-black/10 border border-black/20 text-black/70">
              Schedule
            </span>
            <h1 className="text-3xl font-black tracking-tight text-black flex items-center gap-3">
              <CalendarIcon className="w-8 h-8 opacity-80" />
              행사 및 일정 관리
            </h1>
            <p className="text-black/60 mt-1 text-sm font-medium">
              동아리의 일정을 관리하고 출석 QR 코드를 생성하세요.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setIsAdding(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-black text-sm
                       bg-black text-white hover:bg-black/90 transition-all active:scale-95 shrink-0"
          >
            <Plus size={18} />
            새 일정 등록
          </motion.button>
        </header>

        {/* ── 달력 카드 ── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="bg-white rounded-3xl border border-black/20 p-6 md:p-8"
        >
          {/* 월 헤더 */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-black">
              {year}년 {monthNames[month]}
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevMonth}
                className="p-2.5 hover:bg-black/5 rounded-xl transition-colors text-black/50 hover:text-black"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                onClick={handleNextMonth}
                className="p-2.5 hover:bg-black/5 rounded-xl transition-colors text-black/50 hover:text-black"
              >
                <ChevronRight size={22} />
              </button>
            </div>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 mb-2">
            {weekDays.map(d => (
              <div key={d} className="text-center text-xs font-black text-black/40 py-2">
                {d}
              </div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`e-${i}`} className="h-11 md:h-14" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day         = i + 1;
              const dateStr     = formatDateString(year, month, day);
              const daySchedules = schedules.filter(s => s.date === dateStr);
              const isToday     = dateStr === todayStr;
              const hasEvent    = daySchedules.length > 0;

              return (
                <div
                  key={day}
                  className={`relative h-11 md:h-14 rounded-2xl flex flex-col items-center justify-center transition-all
                    ${hasEvent
                      ? 'bg-black/8 border-2 border-black/30 cursor-pointer hover:bg-black/12'
                      : isToday
                        ? 'border-2 border-black bg-white'
                        : 'border border-black/10 bg-black/[0.02] hover:border-black/20'
                    }`}
                >
                  <span className={`text-sm font-black
                    ${hasEvent ? 'text-black' : isToday ? 'text-black' : 'text-black/40'}`}>
                    {day}
                  </span>
                  {hasEvent && (
                    <div className="flex gap-0.5 mt-0.5">
                      {daySchedules.slice(0, 3).map((s, idx) => (
                        <div
                          key={idx}
                          className={`w-1 h-1 rounded-full
                            ${s.type === 'ASSIGNMENT' ? 'bg-black/60' : 'bg-black'}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 범례 */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-black/10">
            <span className="flex items-center gap-1.5 text-xs font-black text-black/50">
              <span className="w-2.5 h-2.5 rounded-full bg-black inline-block" /> 일반 세션
            </span>
            <span className="flex items-center gap-1.5 text-xs font-black text-black/50">
              <span className="w-2.5 h-2.5 rounded-full bg-black/60 inline-block" /> 과제 포함
            </span>
          </div>
        </motion.section>

        {/* ── 일정 목록 ── */}
        <section className="space-y-4">
          <h2 className="text-xl font-black text-black flex items-center gap-2">
            <CalendarIcon size={20} className="text-black/60" />
            등록된 일정 목록
          </h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-black/40">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm font-black">불러오는 중...</span>
            </div>
          ) : schedules.length === 0 ? (
            <div className="bg-white rounded-3xl border border-black/20 py-16 text-center">
              <CalendarIcon size={32} className="mx-auto mb-3 text-black/20" />
              <p className="text-sm font-black text-black/50">등록된 일정이 없습니다</p>
              <p className="text-xs text-black/30 mt-1">우측 상단의 버튼을 눌러 새 일정을 추가해보세요.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {schedules.map((schedule, i) => {
                const ts = typeStyle[schedule.type] ?? typeStyle.GENERAL;
                return (
                  <motion.div
                    key={schedule.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className={`bg-white rounded-[2rem] border border-black/20 p-6 flex flex-col group
                                relative overflow-hidden hover:shadow-md transition-shadow
                                ${schedule.is_approved === false ? 'ring-1 ring-black/30' : ''}`}
                  >
                    {/* 유형 컬러 바 */}
                    <div className={`absolute top-0 left-0 w-full h-1.5 ${ts.bar}`} />

                    {/* 배지 + 삭제 */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex gap-2 items-center flex-wrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${ts.badge}`}>
                          {ts.label}
                        </span>
                        {schedule.is_approved === false && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider
                                           bg-black/8 text-black/60 border border-black/20 animate-pulse">
                            승인 대기
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(schedule.id)}
                        className="text-black/30 hover:text-black/70 transition-colors p-1 rounded-lg hover:bg-black/5"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <h3 className="text-base font-black text-black mb-3 line-clamp-2 leading-snug">
                      {schedule.title}
                    </h3>

                    <div className="space-y-2 mb-6 flex-1">
                      <div className="flex items-center gap-2 text-sm text-black/70 font-medium">
                        <CalendarIcon size={14} className="text-black/40 shrink-0" />
                        {schedule.date}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-black/70 font-medium">
                        <Clock size={14} className="text-black/40 shrink-0" />
                        {schedule.time?.substring(0, 5) ?? '--:--'}
                      </div>
                      {schedule.location && (
                        <div className="flex items-center gap-2 text-sm text-black/70 font-medium">
                          <MapPin size={14} className="text-black/40 shrink-0" />
                          <span className="line-clamp-1">{schedule.location}</span>
                        </div>
                      )}
                      {schedule.type !== 'GENERAL' && schedule.assignment_template_url && (
                        <div className="flex items-center gap-2 text-sm text-black font-bold mt-2
                                        bg-black/5 p-2 rounded-xl border border-black/15">
                          <FileIcon size={14} className="shrink-0" />
                          <a
                            href={schedule.assignment_template_url}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline line-clamp-1"
                          >
                            양식 첨부됨
                          </a>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setSelectedQR(schedule.id)}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm
                                 bg-black text-white hover:bg-black/90 transition-all active:scale-[0.98]"
                    >
                      <QrCode size={16} />
                      QR 생성
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ── 모달 ── */}
      <AnimatePresence>
        {isAdding && (
          <ScheduleModal
            onClose={() => setIsAdding(false)}
            onSaved={handleSaved}
          />
        )}
      </AnimatePresence>

      {selectedQR && (
        <AttendanceQR
          scheduleId={selectedQR}
          onClose={() => setSelectedQR(null)}
        />
      )}
    </div>
  );
}
