import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Loader2, CalendarDays, ClipboardList } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { Club } from '../../types';
import { getClubAccentHex } from '../../lib/clubColors';

const MAX_ITEMS = 6;
const WINDOW_DAYS = 20;

type ScheduleRow = {
  id: string;
  club_id?: string | null;
  title: string;
  date: string;
  time?: string | null;
  type: 'GENERAL' | 'ASSIGNMENT';
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

export const ThreeWeekSummaryCard: React.FC = () => {
  const { profile } = useAuth();
  const [items, setItems] = useState<Enriched[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: clubsData }, { data: schData }] = await Promise.all([
        supabase.from('clubs').select('*'),
        supabase
          .from('schedules')
          .select('id, club_id, title, date, time, type')
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

  return (
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
            return (
              <li key={s.id} className="flex gap-3 py-3.5 first:pt-0 last:pb-0">
                <div
                  className="mt-0.5 w-1 shrink-0 self-stretch min-h-[3rem] rounded-full bg-white/20"
                  title={clubName}
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
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
