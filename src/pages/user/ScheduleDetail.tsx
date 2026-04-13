/**
 * 월 단위 캘린더 + 동아리(club_name)별 그룹 목록.
 * 주차/주별 뷰는 사용하지 않습니다.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DayPicker, type DayButtonProps } from 'react-day-picker';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Loader2, X } from 'lucide-react';
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

  const ym = yearMonthKey(displayMonth);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data: clubsRaw } = await supabase.from('clubs').select('*');
      const clubList = (clubsRaw as Club[] | null) ?? [];
      const byId = new Map(clubList.map((c) => [c.id, c]));
      const myClub = clubList.find((c) => c.name === profile?.univ_name) ?? null;

      // time 컬럼 null 가능 → .order('time') 제거, 클라이언트 정렬로 처리
      const schRes = await supabase
        .from('schedules')
        .select('*, clubs(*)')
        .eq('is_approved', true)
        .order('date', { ascending: true });

      let scheduleRows: DbSchedule[] = [];
      if (schRes.error) {
        const plain = await supabase
          .from('schedules')
          .select('*')
          .eq('is_approved', true)
          .order('date', { ascending: true });
        scheduleRows = (plain.data as DbSchedule[] | null) ?? [];
      } else {
        scheduleRows = (schRes.data as DbSchedule[] | null) ?? [];
      }

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
        club: resolveClub(s, byId, myClub),
      }));

      const asgJoin = await supabase.from('assignments').select('*, clubs(*)');
      let asgRows: DbAssignment[] = [];
      if (asgJoin.error) {
        const p = await supabase.from('assignments').select('*');
        asgRows = (p.data as DbAssignment[] | null) ?? [];
      } else {
        asgRows = (asgJoin.data as DbAssignment[] | null) ?? [];
      }

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
            club: resolveClub(a, byId, myClub),
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
  }, [profile?.univ_name]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

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
