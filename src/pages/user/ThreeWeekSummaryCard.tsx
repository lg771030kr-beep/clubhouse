import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight, Loader2, CalendarDays, ClipboardList,
  X, UserX, Paperclip, Check, Clock,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { Club } from '../../types';
import { getClubAccentHex } from '../../lib/clubColors';
import { SessionCollab } from './SessionCollab';

const MAX_ITEMS = 6;
const WINDOW_DAYS = 20;

type ScheduleRow = {
  id: string;
  club_id?: string | null;
  title: string;
  date: string;
  time?: string | null;
  type: 'GENERAL' | 'ASSIGNMENT' | 'BOTH';
  description?: string | null;
  location?: string | null;
  assignment_template_url?: string | null;
};
type Enriched = ScheduleRow & { club: Club | null };

function pad2(n: number) { return String(n).padStart(2, '0'); }

function todayYMD(): string {
  const t = new Date();
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
}
function addDaysYMD(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}
function parseYMD(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
function formatListLine(dateStr: string, timeStr: string | null | undefined): string {
  const d = parseYMD(dateStr);
  const wd = WEEKDAYS[d.getDay()];
  const md = `${d.getMonth() + 1}/${d.getDate()}`;
  const t = timeStr ? String(timeStr).slice(0, 5) : null;
  return t && t.length >= 4 ? `${md} (${wd}) ${t}` : `${md} (${wd})`;
}
function sortKey(s: Enriched): string {
  const t = (s.time || '00:00:00').toString().slice(0, 8);
  return `${s.date}T${t}`;
}
function formatKoMonthDay(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}월 ${d}일`;
}

export const ThreeWeekSummaryCard: React.FC = () => {
  const { profile } = useAuth();
  const [items,   setItems]   = useState<Enriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Enriched | null>(null);

  /* ── 선택된 일정의 내 클럽 역할 ── */
  const [selectedClubRole, setSelectedClubRole] = useState<string>('MEMBER');

  useEffect(() => {
    if (!selected?.club?.id || !profile?.id) { setSelectedClubRole('MEMBER'); return; }
    supabase
      .from('club_members')
      .select('role')
      .eq('club_id', selected.club.id)
      .eq('user_id', profile.id)
      .single()
      .then(({ data }) => { setSelectedClubRole(data?.role ?? 'MEMBER'); });
  }, [selected?.id, selected?.club?.id, profile?.id]);

  /* ── 지각/불참 신고 상태 ── */
  const [reportType,       setReportType]       = useState<'late' | 'absent' | null>(null);
  const [reportReason,     setReportReason]     = useState('');
  const [reportFile,       setReportFile]       = useState<File | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportDone,       setReportDone]       = useState(false);
  const [reportError,      setReportError]      = useState('');
  const reportFileRef = useRef<HTMLInputElement>(null);

  /* 모달이 바뀌면 신고 폼 초기화 */
  useEffect(() => {
    setReportType(null);
    setReportReason('');
    setReportFile(null);
    setReportSubmitting(false);
    setReportDone(false);
    setReportError('');
  }, [selected?.id]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: clubsData }, { data: schData }] = await Promise.all([
        supabase.from('clubs').select('*'),
        supabase
          .from('schedules')
          .select('id, club_id, title, date, time, type, description, location, assignment_template_url')
          .eq('is_approved', true)
          .order('date', { ascending: true }),
      ]);
      const clubMap = new Map<string, Club>((clubsData as Club[] | null)?.map((c) => [c.id, c]) || []);
      const defaultClub = (clubsData as Club[] | null)?.find((c) => c.name === profile?.univ_name) || null;
      const list = (schData as ScheduleRow[] | null) || [];
      const enriched: Enriched[] = list.map((s) => ({
        ...s,
        club: s.club_id ? clubMap.get(s.club_id) || null : defaultClub,
      }));
      const start = todayYMD();
      const end   = addDaysYMD(start, WINDOW_DAYS);
      const inWindow = enriched
        .filter((s) => s.date >= start && s.date <= end)
        .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
      setItems(inWindow.slice(0, MAX_ITEMS));
    } catch (e) {
      console.error('ThreeWeekSummaryCard load error:', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.univ_name]);

  useEffect(() => { void load(); }, [load]);

  const endLabel = useMemo(() => {
    const e = addDaysYMD(todayYMD(), WINDOW_DAYS);
    const d = parseYMD(e);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }, []);

  /* ── 신고 제출 ── */
  const submitReport = async () => {
    if (!reportType)          { setReportError('신고 유형을 선택해주세요.'); return; }
    if (!reportReason.trim()) { setReportError('사유를 입력해주세요.'); return; }
    if (!selected || !profile?.id) return;
    setReportSubmitting(true);
    setReportError('');
    try {
      let attachmentUrl: string | null = null;
      if (reportFile) {
        const ext  = reportFile.name.split('.').pop() ?? 'bin';
        const path = `${profile.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('reports').upload(path, reportFile);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('reports').getPublicUrl(path);
        attachmentUrl = urlData.publicUrl;
      }
      const clubId = selected.club?.id ?? null;
      const { error: insertErr } = await supabase.from('absence_reports').insert({
        schedule_id:    selected.id,
        user_id:        profile.id,
        club_id:        clubId,
        type:           reportType,
        reason:         reportReason.trim(),
        attachment_url: attachmentUrl,
      });
      if (insertErr) throw insertErr;

      if (clubId) {
        const { data: admins } = await supabase
          .from('club_members')
          .select('user_id')
          .eq('club_id', clubId)
          .in('role', ['ADMIN', 'LEADER', 'CAPTAIN', 'admin', 'leader', 'captain']);
        if (admins && admins.length > 0) {
          const typeLabel = reportType === 'late' ? '지각' : '불참';
          const userName  = (profile as Record<string, string>).full_name
                         || (profile as Record<string, string>).name
                         || profile.email
                         || '부원';
          await supabase.from('notifications').insert(
            (admins as { user_id: string }[]).map(a => ({
              user_id: a.user_id,
              title:   `[${typeLabel} 신고] ${userName}`,
              body:    `${selected.title} · ${reportReason.trim().slice(0, 50)}`,
              type:    'attendance',
              link:    '/admin',
            }))
          );
        }
      }
      setReportDone(true);
    } catch (e) {
      console.error(e);
      setReportError('제출 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setReportSubmitting(false);
    }
  };

  return (
    <>
      <section className="bg-black rounded-3xl border border-white/10 p-5 md:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-black tracking-tight text-white">3주 핵심 요약</h2>
            <p className="mt-0.5 text-xs font-medium text-white/50">향후 3주간의 일정 &amp; 과제</p>
            <p className="mt-1 text-[10px] text-white/30">
              오늘부터 약 3주 안의 항목을 시간순으로 최대 {MAX_ITEMS}개까지 요약합니다. (~ {endLabel})
            </p>
          </div>
          <Link
            to="/schedule/calendar"
            className="inline-flex h-8 w-full shrink-0 items-center justify-center gap-0.5 rounded-xl
                       border border-white/15 bg-white/5 px-4 text-xs font-black text-white/60
                       transition-colors hover:bg-white/10 focus:outline-none sm:w-auto sm:justify-start"
          >
            상세 일정 보기
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-white/25" />
          </div>
        ) : items.length === 0 ? (
          <p className="rounded-2xl bg-white/5 py-10 text-center text-sm text-white/30">
            표시할 일정·과제가 없습니다.
          </p>
        ) : (
          <ul className="space-y-0 divide-y divide-white/8">
            {items.map((s) => {
              const clubName = s.club?.name || '동아리';
              const bar = getClubAccentHex(s.club);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(s)}
                    className="flex w-full gap-3 py-3.5 first:pt-0 last:pb-0 text-left
                               hover:bg-white/5 rounded-xl px-2 -mx-2 transition-colors"
                  >
                    <div
                      className="mt-0.5 w-1 shrink-0 self-stretch min-h-[3rem] rounded-full"
                      style={{ backgroundColor: bar }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <p className="text-[10px] font-bold text-white/40">{formatListLine(s.date, s.time)}</p>
                        {(s.type === 'ASSIGNMENT' || s.type === 'BOTH') && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-black
                                           px-1.5 py-0.5 rounded-full bg-white text-black">
                            <ClipboardList className="w-2.5 h-2.5" />과제
                          </span>
                        )}
                        {s.type === 'GENERAL' && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-black
                                           px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">
                            <CalendarDays className="w-2.5 h-2.5" />일정
                          </span>
                        )}
                        {s.type === 'BOTH' && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-black
                                           px-1.5 py-0.5 rounded-full bg-white/15 text-white/70">
                            활동+과제
                          </span>
                        )}
                      </div>
                      <p className="truncate font-black text-white text-sm">{s.title}</p>
                      <p className="text-xs font-medium text-white/40">{clubName}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── 상세 모달 ── */}
      {selected && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-t-3xl sm:rounded-3xl
                       bg-black border border-white/15"
            onClick={e => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex flex-row items-start justify-between border-b border-white/10 px-6 py-5">
              <div className="min-w-0 pr-2">
                <p className="text-xs font-bold text-white/50">{selected.club?.name || '동아리 미지정'}</p>
                <p className="mt-1 text-xl font-black text-white">{selected.title}</p>
                <p className="mt-2 text-xs font-black text-white/60">
                  [{selected.type === 'ASSIGNMENT' ? '과제' : '활동'}] {formatKoMonthDay(selected.date)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="p-2 rounded-xl hover:bg-white/8 transition-colors text-white/40"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 스크롤 내용 */}
            <div className="max-h-[60vh] space-y-4 overflow-y-auto p-6">

              {/* 일시 */}
              <div className="text-sm">
                <span className="font-black text-white/60 text-xs uppercase tracking-wide">일시</span>
                <p className="mt-1 text-white">
                  {selected.date}
                  {selected.time ? ` ${String(selected.time).slice(0, 5)}` : ''}
                </p>
              </div>

              {/* 장소 */}
              {selected.location && (
                <div className="text-sm">
                  <span className="font-black text-white/60 text-xs uppercase tracking-wide">장소</span>
                  <p className="mt-1 text-white">{selected.location}</p>
                </div>
              )}

              {/* 내용 */}
              <div className="text-sm">
                <span className="font-black text-white/60 text-xs uppercase tracking-wide">내용</span>
                <p className="mt-1 whitespace-pre-wrap text-white/70">
                  {selected.description?.trim() || '상세 설명이 없습니다.'}
                </p>
              </div>

              {/* 협업 기능: 공유 회의록 / 액션 아이템 / 작업 링크 */}
              {selected.club?.id && (
                <SessionCollab
                  scheduleId={selected.id}
                  clubId={selected.club.id}
                  isAdmin={['ADMIN', 'LEADER', 'CAPTAIN'].includes(selectedClubRole)}
                />
              )}

              {/* 지각/불참 신고 — GENERAL 일정만 */}
              {selected.type === 'GENERAL' && (
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <UserX className="w-4 h-4 text-white/40" />
                    <span className="text-[11px] font-black text-white/50 uppercase tracking-wide">지각 / 불참 신고</span>
                  </div>
                  {reportDone ? (
                    <div className="flex flex-col items-center justify-center py-4 gap-2">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <Check className="w-5 h-5 text-emerald-400" />
                      </div>
                      <p className="text-sm font-black text-white/70">신고가 제출되었습니다.</p>
                      <p className="text-xs text-white/35">운영진에게 알림이 전송되었습니다.</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2 mb-3">
                        <button
                          type="button"
                          onClick={() => setReportType('late')}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black transition-colors
                            ${reportType === 'late' ? 'bg-amber-500 text-black' : 'bg-white/8 text-white/45 hover:bg-white/12'}`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          지각
                        </button>
                        <button
                          type="button"
                          onClick={() => setReportType('absent')}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black transition-colors
                            ${reportType === 'absent' ? 'bg-red-500 text-white' : 'bg-white/8 text-white/45 hover:bg-white/12'}`}
                        >
                          <UserX className="w-3.5 h-3.5" />
                          불참
                        </button>
                      </div>
                      <textarea
                        value={reportReason}
                        onChange={e => setReportReason(e.target.value)}
                        placeholder="사유를 입력해주세요..."
                        rows={3}
                        className="w-full rounded-xl bg-white/8 border border-white/10 text-white text-xs font-medium
                                   placeholder:text-white/25 p-3 resize-none outline-none focus:border-white/25 mb-2"
                      />
                      <div className="flex items-center gap-2 mb-3">
                        <button
                          type="button"
                          onClick={() => reportFileRef.current?.click()}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/8 hover:bg-white/12
                                     text-white/45 text-xs font-black transition-colors max-w-[200px]"
                        >
                          <Paperclip className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{reportFile ? reportFile.name : '증거 첨부'}</span>
                        </button>
                        {reportFile && (
                          <button
                            type="button"
                            onClick={() => { setReportFile(null); if (reportFileRef.current) reportFileRef.current.value = ''; }}
                            className="text-white/30 hover:text-white/60 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <input
                          ref={reportFileRef}
                          type="file"
                          className="hidden"
                          accept="image/*,video/*,.pdf"
                          onChange={e => setReportFile(e.target.files?.[0] ?? null)}
                        />
                      </div>
                      {reportError && (
                        <p className="text-[11px] text-red-400 font-medium mb-2">{reportError}</p>
                      )}
                      <button
                        type="button"
                        onClick={submitReport}
                        disabled={reportSubmitting}
                        className="w-full py-2.5 rounded-xl bg-white text-black font-black text-xs
                                   hover:bg-white/90 transition-colors disabled:opacity-50
                                   flex items-center justify-center gap-1.5"
                      >
                        {reportSubmitting
                          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />제출 중...</>
                          : '신고 제출'}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* 과제 양식 */}
              {(selected.type === 'ASSIGNMENT' || selected.type === 'BOTH') && selected.assignment_template_url && (
                <button
                  type="button"
                  onClick={() => window.open(selected.assignment_template_url!, '_blank', 'noopener,noreferrer')}
                  className="w-full py-3 rounded-2xl bg-white text-black font-black text-sm transition-colors hover:bg-white/90"
                >
                  자료 / 양식 열기
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelected(null)}
                className="w-full py-3 rounded-2xl border border-white/15 text-white/50 font-black text-sm
                           hover:bg-white/5 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
