/**
 * 월 단위 캘린더 + 동아리(club_name)별 그룹 목록.
 * 주차/주별 뷰는 사용하지 않습니다.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DayPicker, type DayButtonProps } from 'react-day-picker';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Loader2, X, Paperclip, Check, Clock, UserX } from 'lucide-react';
import { BackButton } from '../../components/common/BackButton';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { Club } from '../../types';
import { getClubAccentHex } from '../../lib/clubColors';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import 'react-day-picker/style.css';

export type CalendarItem = {
  id: string;
  source: 'schedule' | 'assignment';
  date: string;
  time?: string | null;
  title: string;
  description?: string | null;
  location?: string | null;
  assignment_template_url?: string | null;
  kind: 'GENERAL' | 'ASSIGNMENT';
  club: Club | null;
};

type DbSchedule = {
  id: string;
  club_id?: string | null;
  title: string;
  description?: string | null;
  date: string;
  time?: string | null;
  type: 'GENERAL' | 'ASSIGNMENT';
  location?: string | null;
  assignment_template_url?: string | null;
  clubs?: Club | Club[] | null;
};

type DbAssignment = {
  id: string;
  club_id?: string | null;
  title: string;
  description?: string | null;
  due_date?: string | null;
  date?: string | null;
  time?: string | null;
  assignment_template_url?: string | null;
  clubs?: Club | Club[] | null;
};

function resolveClub(
  row: { club_id?: string | null; clubs?: Club | Club[] | null },
  byId: Map<string, Club>,
  fallback: Club | null
): Club | null {
  const embedded = row.clubs;
  if (embedded) {
    const c = Array.isArray(embedded) ? embedded[0] : embedded;
    if (c?.id) return c;
  }
  if (row.club_id) return byId.get(row.club_id) ?? null;
  return fallback;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function yearMonthKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function sortByDateTime(a: CalendarItem, b: CalendarItem) {
  const aKey = `${a.date}T${(a.time || '00:00:00').toString().slice(0, 8)}`;
  const bKey = `${b.date}T${(b.time || '00:00:00').toString().slice(0, 8)}`;
  return aKey.localeCompare(bKey);
}

function getClubName(item: CalendarItem): string {
  return item.club?.name?.trim() || '동아리 미지정';
}

function labelForItem(item: CalendarItem): '과제' | '일정' | '활동' {
  if (item.kind === 'ASSIGNMENT') return '과제';
  const t = (item.title || '').toLowerCase();
  if (/공연|콘서트|행사|축제|ot|정기\s*공연/.test(t)) return '일정';
  return '활동';
}

function formatKoMonthDay(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}월 ${d}일`;
}

/** 현재 표시 중인 달에 속한 항목만 → 날짜 문자열 → 목록 (캘린더 점용) */
function mapDateToItemsForMonth(items: CalendarItem[], ym: string): Map<string, CalendarItem[]> {
  const m = new Map<string, CalendarItem[]>();
  for (const it of items) {
    if (!it.date.startsWith(ym)) continue;
    const arr = m.get(it.date) ?? [];
    arr.push(it);
    m.set(it.date, arr);
  }
  return m;
}

/** club_name 기준 그룹 (reduce), 그룹 내 날짜순 */
function groupByClubName(itemsInMonth: CalendarItem[]): { name: string; rows: CalendarItem[]; accentClub: Club | null }[] {
  const bucket = itemsInMonth.reduce<Record<string, CalendarItem[]>>((acc, it) => {
    const name = getClubName(it);
    if (!acc[name]) acc[name] = [];
    acc[name].push(it);
    return acc;
  }, {});
  for (const k of Object.keys(bucket)) {
    bucket[k].sort(sortByDateTime);
  }
  const names = Object.keys(bucket).sort((a, b) => {
    const fa = bucket[a][0]?.date ?? '';
    const fb = bucket[b][0]?.date ?? '';
    if (fa !== fb) return fa.localeCompare(fb);
    return a.localeCompare(b);
  });
  return names.map((name) => ({
    name,
    rows: bucket[name],
    accentClub: bucket[name][0]?.club ?? null,
  }));
}

function DayButtonWithDotsFactory(byDate: Map<string, CalendarItem[]>) {
  return function DayButtonWithDots(props: DayButtonProps) {
    const { day, children: _c, ...rest } = props;
    const ymd = format(day.date, 'yyyy-MM-dd');
    const list = byDate.get(ymd) ?? [];
    const dotColors = [...new Set(list.map((x) => getClubAccentHex(x.club)))];
    return (
      <button
        type="button"
        {...rest}
        className="flex w-full h-[3.5rem] flex-col items-center justify-center gap-0.5 bg-transparent border-0 outline-none cursor-pointer"
      >
        <span className="flex h-7 w-7 items-center justify-center text-sm font-bold text-white leading-none">
          {day.date.getDate()}
        </span>
        <span className="flex h-2.5 items-center justify-center gap-0.5">
          {dotColors.slice(0, 5).map((hex, i) => (
            <span
              key={i}
              className="size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: hex }}
            />
          ))}
        </span>
      </button>
    );
  };
}

export const ScheduleDetail: React.FC = () => {
  const { profile } = useAuth();
  const [displayMonth, setDisplayMonth] = useState(() => new Date());
  const [allItems, setAllItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CalendarItem | null>(null);

  /* ── 지각/불참 신고 상태 ── */
  const [reportType,       setReportType]       = useState<'late' | 'absent' | null>(null);
  const [reportReason,     setReportReason]     = useState('');
  const [reportFile,       setReportFile]       = useState<File | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportDone,       setReportDone]       = useState(false);
  const [reportError,      setReportError]      = useState('');
  const reportFileRef = useRef<HTMLInputElement>(null);

  const ym = yearMonthKey(displayMonth);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data: clubsRaw } = await supabase.from('clubs').select('*');
      const clubList = (clubsRaw as Club[] | null) ?? [];
      const byId = new Map(clubList.map((c) => [c.id, c]));

      // 사용자 소속 클럽을 club_members 테이블에서 조회
      const { data: memberRows } = await supabase
        .from('club_members')
        .select('club_id')
        .eq('user_id', profile?.id ?? '');
      const myClubIds = new Set((memberRows ?? []).map((r: { club_id: string }) => r.club_id));
      const myClub = clubList.find((c) => myClubIds.has(c.id)) ?? null;

      // time 컬럼 null 가능 → .order('time') 제거, 클라이언트 정렬로 처리
      const schRes = await supabase
        .from('schedules')
        .select('*')
        .eq('is_approved', true)
        .order('date', { ascending: true });

      const scheduleRows: DbSchedule[] = (schRes.data as DbSchedule[] | null) ?? [];

      const fromSchedules: CalendarItem[] = scheduleRows.map((s) => ({
        id: `s:${s.id}`,
        source: 'schedule',
        date: s.date,
        time: s.time,
        title: s.title,
        description: s.description,
        location: s.location,
        assignment_template_url: s.assignment_template_url,
        kind: s.type === 'ASSIGNMENT' ? 'ASSIGNMENT' : 'GENERAL',
        // club_id로 직접 매핑, 없으면 소속 클럽 fallback
        club: s.club_id ? (byId.get(s.club_id) ?? myClub) : myClub,
      }));

      const { data: asgData } = await supabase.from('assignments').select('*');
      const asgRows: DbAssignment[] = (asgData as DbAssignment[] | null) ?? [];

      const fromAssignments: CalendarItem[] = asgRows
        .map((a) => {
          const date = a.due_date || a.date || '';
          return {
            id: `a:${a.id}`,
            source: 'assignment' as const,
            date,
            time: a.time,
            title: a.title,
            description: a.description,
            location: null,
            assignment_template_url: a.assignment_template_url,
            kind: 'ASSIGNMENT' as const,
            club: a.club_id ? (byId.get(a.club_id) ?? myClub) : myClub,
          };
        })
        .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.date));

      setAllItems([...fromSchedules, ...fromAssignments]);
    } catch (e) {
      console.error(e);
      setAllItems([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  /* 모달이 바뀌면 신고 폼 초기화 */
  useEffect(() => {
    setReportType(null);
    setReportReason('');
    setReportFile(null);
    setReportSubmitting(false);
    setReportDone(false);
    setReportError('');
  }, [selected?.id]);

  /* ── 신고 제출 ── */
  const submitReport = async () => {
    if (!reportType)          { setReportError('신고 유형을 선택해주세요.'); return; }
    if (!reportReason.trim()) { setReportError('사유를 입력해주세요.'); return; }
    if (!selected || !profile?.id) return;
    setReportSubmitting(true);
    setReportError('');
    try {
      /* 파일 업로드 */
      let attachmentUrl: string | null = null;
      if (reportFile) {
        const ext  = reportFile.name.split('.').pop() ?? 'bin';
        const path = `${profile.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('reports').upload(path, reportFile);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('reports').getPublicUrl(path);
        attachmentUrl = urlData.publicUrl;
      }

      /* absence_reports 삽입 */
      const scheduleId = selected.id.startsWith('s:') ? selected.id.slice(2) : selected.id;
      const clubId     = selected.club?.id ?? null;
      const { error: insertErr } = await supabase.from('absence_reports').insert({
        schedule_id:    scheduleId,
        user_id:        profile.id,
        club_id:        clubId,
        type:           reportType,
        reason:         reportReason.trim(),
        attachment_url: attachmentUrl,
      });
      if (insertErr) throw insertErr;

      /* 운영진에게 알림 발송 */
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

  const inThisMonth = useMemo(() => allItems.filter((i) => i.date.startsWith(ym)), [allItems, ym]);
  const byDate = useMemo(() => mapDateToItemsForMonth(allItems, ym), [allItems, ym]);
  const clubSections = useMemo(() => groupByClubName(inThisMonth), [inThisMonth]);
  const DayBtn = useMemo(() => DayButtonWithDotsFactory(byDate), [byDate]);

  const monthCaption = format(displayMonth, 'yyyy년 M월', { locale: ko });

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-36 pt-4 md:max-w-2xl md:px-6 md:pb-40 md:pt-6">
      <div className="mb-4">
        <BackButton />
      </div>

      <h1 className="mb-8 text-center text-2xl font-black text-white md:text-3xl">일정 캘린더</h1>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-white/30" />
        </div>
      ) : (
        <>
          {/* ── 상단: 월 캘린더 ── */}
          <div className="mb-10 rounded-3xl bg-black border border-white/10 px-2 py-6 md:px-6 md:py-8">
            <div className="relative mx-auto w-full max-w-md md:max-w-lg">
              <DayPicker
                mode="single"
                locale={ko}
                month={displayMonth}
                onMonthChange={setDisplayMonth}
                showOutsideDays
                fixedWeeks
                components={{ DayButton: DayBtn }}
                classNames={{
                  root: 'w-full',
                  months: 'w-full',
                  month: 'relative w-full space-y-4',
                  month_caption: 'relative flex h-14 items-center justify-center',
                  caption_label: 'text-xl font-black text-white',
                  nav: 'absolute inset-x-0 top-0 flex justify-between z-10 pointer-events-none',
                  button_previous:
                    'pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-black hover:bg-white/90 active:scale-95 transition-all cursor-pointer shadow-sm',
                  button_next:
                    'pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-black hover:bg-white/90 active:scale-95 transition-all cursor-pointer shadow-sm',
                  month_grid: 'w-full table-fixed border-collapse',
                  weekdays: 'w-full',
                  weekday: 'w-[14.2857%] py-3 text-center text-xs font-bold text-white/40',
                  week: 'w-full',
                  day: 'w-[14.2857%] p-0 align-middle',
                  day_button: '',
                }}
              />
            </div>
            <p className="mt-4 text-center text-xs text-white/30">날짜 아래 점: 해당 날 일정이 있는 동아리 색상</p>
          </div>

          {/* ── 하단: 동아리별 그룹 ── */}
          <h2 className="mb-4 text-center text-lg font-black text-white">{monthCaption} · 동아리별</h2>

          {clubSections.length === 0 ? (
            <div className="rounded-3xl bg-white/5 border border-white/10 py-16 text-center text-sm text-white/40">
              이 달에 등록된 일정·과제가 없습니다.
            </div>
          ) : (
            <ul className="flex flex-col gap-6">
              {clubSections.map(({ name, rows, accentClub }) => {
                const bar = getClubAccentHex(accentClub);
                return (
                  <li key={name} className="flex overflow-hidden rounded-3xl bg-black border border-white/10">
                    <div className="w-1.5 shrink-0 self-stretch md:w-2" style={{ backgroundColor: bar }} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="border-b border-white/8 px-4 py-3 md:px-5">
                        <h3 className="text-lg font-black text-white">[{name}]</h3>
                      </div>
                      <ul className="divide-y divide-white/8">
                        {rows.map((row) => (
                          <li key={row.id}>
                            <button
                              type="button"
                              onClick={() => setSelected(row)}
                              className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-white/5 md:px-5 transition-colors"
                            >
                              <span
                                className="mt-1.5 size-2 shrink-0 rounded-full"
                                style={{ backgroundColor: getClubAccentHex(row.club) }}
                                aria-hidden
                              />
                              <span className="min-w-0 flex-1 text-sm font-semibold text-white md:text-base">
                                <span className="text-white/50">{formatKoMonthDay(row.date)}</span>
                                <span className="text-white/30"> · </span>
                                <span className="text-white/70">[{labelForItem(row)}]</span> {row.title}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {selected && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
             onClick={() => setSelected(null)}>
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-t-3xl sm:rounded-3xl
                       bg-black border border-white/15"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-row items-start justify-between border-b border-white/10 px-6 py-5">
              <div className="min-w-0 pr-2">
                <p className="text-xs font-bold text-white/50">{getClubName(selected)}</p>
                <p className="mt-1 text-xl font-black text-white">{selected.title}</p>
                <p className="mt-2 text-xs font-black text-white/60">
                  [{labelForItem(selected)}] {formatKoMonthDay(selected.date)}
                </p>
              </div>
              <button type="button" onClick={() => setSelected(null)}
                className="p-2 rounded-xl hover:bg-white/8 transition-colors text-white/40">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[60vh] space-y-4 overflow-y-auto p-6">

              {/* ── 지각/불참 신고 ── */}
              {selected.kind === 'GENERAL' && selected.source === 'schedule' && (
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
                      {/* 유형 선택 */}
                      <div className="flex gap-2 mb-3">
                        <button
                          type="button"
                          onClick={() => setReportType('late')}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black transition-colors
                            ${reportType === 'late'
                              ? 'bg-amber-500 text-black'
                              : 'bg-white/8 text-white/45 hover:bg-white/12'}`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          지각
                        </button>
                        <button
                          type="button"
                          onClick={() => setReportType('absent')}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black transition-colors
                            ${reportType === 'absent'
                              ? 'bg-red-500 text-white'
                              : 'bg-white/8 text-white/45 hover:bg-white/12'}`}
                        >
                          <UserX className="w-3.5 h-3.5" />
                          불참
                        </button>
                      </div>

                      {/* 사유 입력 */}
                      <textarea
                        value={reportReason}
                        onChange={e => setReportReason(e.target.value)}
                        placeholder="사유를 입력해주세요..."
                        rows={3}
                        className="w-full rounded-xl bg-white/8 border border-white/10 text-white text-xs font-medium
                                   placeholder:text-white/25 p-3 resize-none outline-none focus:border-white/25 mb-2"
                      />

                      {/* 파일 첨부 */}
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
                                   hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {reportSubmitting
                          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />제출 중...</>
                          : '신고 제출'}
                      </button>
                    </>
                  )}
                </div>
              )}

              <div className="text-sm">
                <span className="font-black text-white/60 text-xs uppercase tracking-wide">일시</span>
                <p className="mt-1 text-white">
                  {selected.date}
                  {selected.time ? ` ${String(selected.time).slice(0, 5)}` : ''}
                </p>
              </div>
              {selected.location && (
                <div className="text-sm">
                  <span className="font-black text-white/60 text-xs uppercase tracking-wide">장소</span>
                  <p className="mt-1 text-white">{selected.location}</p>
                </div>
              )}
              <div className="text-sm">
                <span className="font-black text-white/60 text-xs uppercase tracking-wide">내용</span>
                <p className="mt-1 whitespace-pre-wrap text-white/70">
                  {selected.description?.trim() || '상세 설명이 없습니다.'}
                </p>
              </div>
              {selected.kind === 'ASSIGNMENT' && selected.assignment_template_url && (
                <button type="button"
                  onClick={() => window.open(selected.assignment_template_url!, '_blank', 'noopener,noreferrer')}
                  className="w-full py-3 rounded-2xl bg-white text-black font-black text-sm transition-colors hover:bg-white/90">
                  자료 / 양식 열기
                </button>
              )}
              <button type="button" onClick={() => setSelected(null)}
                className="w-full py-3 rounded-2xl border border-white/15 text-white/50 font-black text-sm hover:bg-white/5 transition-colors">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
