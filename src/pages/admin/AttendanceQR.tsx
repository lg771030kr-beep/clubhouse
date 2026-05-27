import React, { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Users, CheckCircle2, ChevronDown, CalendarDays, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

/* ══════════════════════════════════════════
   Types
══════════════════════════════════════════ */
interface AttendanceQRProps {
  scheduleId?: string;
  onClose: () => void;
}

interface TodaySchedule {
  id: string;
  title: string;
  time: string | null;
  type: string;
  qr_code_token: string | null;
}

/* ══════════════════════════════════════════
   Helpers
══════════════════════════════════════════ */
function todayYMD(): string {
  const t = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

function fmtTime(t: string | null): string {
  if (!t) return '';
  return ` · ${String(t).slice(0, 5)}`;
}

/* ══════════════════════════════════════════
   Component
══════════════════════════════════════════ */
export function AttendanceQR({ scheduleId, onClose }: AttendanceQRProps) {
  const today = useMemo(() => todayYMD(), []);
  const { activeClubId } = useAuth();

  /* ── 오늘 일정 목록 ── */
  const [todaySchedules, setTodaySchedules] = useState<TodaySchedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);

  /* ── 선택된 일정 ── */
  const [activeId, setActiveId] = useState<string>(scheduleId ?? '');

  /* ── 출석 현황 ── */
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [totalMembers, setTotalMembers] = useState(0);
  const [isEnded, setIsEnded] = useState(false);

  /* ────── 오늘 일정 로드 (이 동아리 것만) ────── */
  useEffect(() => {
    async function loadToday() {
      setLoadingSchedules(true);
      let query = supabase
        .from('schedules')
        .select('id, title, time, type, qr_code_token')
        .eq('is_approved', true)
        .eq('date', today)
        .order('time');
      if (activeClubId) query = query.eq('club_id', activeClubId);

      const { data } = await query;
      const list = (data as TodaySchedule[] | null) ?? [];
      setTodaySchedules(list);

      if (!scheduleId && list.length > 0) setActiveId(list[0].id);
      setLoadingSchedules(false);
    }
    loadToday();
  }, [today, scheduleId, activeClubId]);

  /* ────── 동아리 멤버 수 로드 ────── */
  useEffect(() => {
    if (!activeClubId) return;
    supabase
      .from('club_members')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', activeClubId)
      .then(({ count }) => { if (count !== null) setTotalMembers(count); });
  }, [activeClubId]);

  /* ────── 출석 수 + Realtime ────── */
  useEffect(() => {
    if (!activeId) return;

    // 초기 카운트
    supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('schedule_id', activeId)
      .eq('status', 'PRESENT')
      .then(({ count }) => { if (count !== null) setAttendanceCount(count); });

    // Realtime 구독
    const channel = supabase
      .channel(`qr_attendance_${activeId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'attendance',
        filter: `schedule_id=eq.${activeId}`,
      }, (payload) => {
        if (payload.new.status === 'PRESENT') setAttendanceCount(p => p + 1);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'attendance',
        filter: `schedule_id=eq.${activeId}`,
      }, (payload) => {
        const wasPresent = payload.old.status === 'PRESENT';
        const isPresent  = payload.new.status === 'PRESENT';
        if (!wasPresent && isPresent)  setAttendanceCount(p => p + 1);
        if ( wasPresent && !isPresent) setAttendanceCount(p => p - 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeId]);

  /* ────── QR 데이터 (v3 — qr_code_token 사용) ──────
   * schedule_id(UUID) 대신 qr_code_token(랜덤 토큰)을 embed:
   *   - schedule_id 직접 노출 방지 → 스캐너가 토큰으로 일정 조회
   *   - date 바인딩 유지 → 오늘 날짜 QR만 유효
   * qr_code_token 이 없으면 v2 방식 fallback
   */
  const activeSched = todaySchedules.find(s => s.id === activeId) ?? null;
  const qrValue = useMemo(() => {
    if (activeSched?.qr_code_token) {
      return JSON.stringify({
        v:     3,
        token: activeSched.qr_code_token,   // 랜덤 토큰 — schedule_id 미노출
        date:  today,
      });
    }
    // fallback: qr_code_token 미존재 시 기존 v2
    return JSON.stringify({ v: 2, schedule_id: activeId, date: today });
  }, [activeSched, activeId, today]);

  /* ────── 선택된 일정 정보 (qrValue useMemo 내부에서 선언, 여기선 재선언 불필요) ────── */

  /* ════════════════════════════════════════
     Render
  ════════════════════════════════════════ */
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-black/15 relative overflow-hidden flex flex-col max-h-[92vh]">

        {/* ── 헤더 ── */}
        <div className="relative z-10 px-6 pt-8 pb-5 text-black text-center border-b border-black/10">
          <h1 className="text-2xl font-black tracking-tight text-black">출석 체크 진행 중</h1>
          <p className="text-black/60 mt-1 text-sm font-medium">
            부원들이 QR 코드를 스캔하도록 안내해주세요.
          </p>
        </div>

        {/* ── 스크롤 영역 ── */}
        <div className="relative z-10 flex-1 overflow-y-auto px-6 pb-6 space-y-4 pt-4">

          {!isEnded ? (
            <>
              {/* ── 일정 선택 ── */}
              <div className="bg-white rounded-2xl border border-black/15 p-4">
                <p className="text-[10px] font-black text-black/60 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" /> 오늘의 일정 선택
                </p>

                {loadingSchedules ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="w-5 h-5 animate-spin text-black" />
                  </div>
                ) : todaySchedules.length === 0 ? (
                  <div className="text-center py-3">
                    <p className="text-sm font-bold text-black/50">오늘 등록된 일정이 없습니다</p>
                    <p className="text-xs text-black/40 mt-0.5">
                      먼저 관리자 일정 등록에서 오늘 날짜로 일정을 추가해주세요.
                    </p>
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={activeId}
                      onChange={e => setActiveId(e.target.value)}
                      className="w-full appearance-none bg-white border border-black/20
                                 text-black font-bold py-3 pl-4 pr-9 rounded-xl
                                 focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black
                                 transition-all cursor-pointer text-sm"
                    >
                      {todaySchedules.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.type === 'ASSIGNMENT' ? '📝 ' : '🏃 '}
                          {s.title}{fmtTime(s.time)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black pointer-events-none" />
                  </div>
                )}
              </div>

              {/* ── QR 카드 ── */}
              {activeId && todaySchedules.length > 0 && (
                <div className="bg-white rounded-3xl p-6 border border-black/15 flex flex-col items-center">
                  {/* 일정명 표시 */}
                  {activeSched && (
                    <p className="text-xs font-black text-black mb-3 tracking-wide text-center">
                      {activeSched.title}{fmtTime(activeSched.time)}
                    </p>
                  )}

                  {/* QR 코드 */}
                  <div className="w-full aspect-square bg-white rounded-2xl flex items-center
                                  justify-center p-4 border-2 border-black/20 max-w-[260px]">
                    <QRCodeSVG
                      value={qrValue}
                      size={210}
                      level="H"
                      includeMargin={false}
                      fgColor="#000000"
                    />
                  </div>

                  {/* 날짜 유효성 안내 */}
                  <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-black/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                    {today} 당일만 유효한 QR
                  </div>

                  {/* 실시간 출석 현황 */}
                  <div className="mt-5 w-full bg-black/5 rounded-2xl p-4 flex items-center
                                  justify-between border border-black/10">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-black flex items-center justify-center text-white">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-black font-black text-sm leading-tight">실시간 출석</p>
                        <p className="text-black/50 text-[9px] font-black uppercase tracking-wider animate-pulse mt-0.5">
                          Live
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex items-baseline gap-0.5">
                      <span className="text-3xl font-black text-black">{attendanceCount}</span>
                      <span className="text-sm font-bold text-black/60">/ {totalMembers || '?'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 하단 버튼 ── */}
              <div className="space-y-3 pt-2">
                <button
                  onClick={() => setIsEnded(true)}
                  disabled={!activeId}
                  className="w-full bg-black hover:bg-black/90 text-white disabled:opacity-40
                             font-black text-base py-4 rounded-full
                             active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  출석 종료하기
                </button>
                <button
                  onClick={onClose}
                  className="w-full bg-white hover:bg-black/5 text-black font-bold
                             py-3.5 rounded-full border border-black/20 transition-colors"
                >
                  닫기
                </button>
              </div>
            </>
          ) : (
            /* ── 종료 화면 ── */
            <div className="bg-white rounded-3xl p-8 border border-black/15
                            flex flex-col items-center mt-2">
              <div className="w-20 h-20 bg-black text-white rounded-full
                              flex items-center justify-center mb-6">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-black mb-2 tracking-tight">출석 종료!</h2>
              <p className="text-black/60 text-sm mb-8 font-medium">최종 출석 통계가 저장되었습니다.</p>

              <div className="w-full space-y-3">
                <div className="bg-black/5 rounded-2xl p-5 flex justify-between items-center border border-black/10">
                  <span className="text-black font-bold text-sm">최종 출석 인원</span>
                  <span className="text-2xl font-black text-black">{attendanceCount}명</span>
                </div>
                <div className="bg-black/5 rounded-2xl p-5 flex justify-between items-center border border-black/10">
                  <span className="text-black font-bold text-sm">결석 및 미확인</span>
                  <span className="text-xl font-bold text-black/60">
                    {Math.max(0, (totalMembers || 0) - attendanceCount)}명
                  </span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full mt-6 font-black py-4 rounded-full bg-black text-white
                           hover:bg-black/90 active:scale-[0.98] transition-all"
              >
                닫기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
