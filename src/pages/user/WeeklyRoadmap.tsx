import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { Club } from '../../types';
import { getClubAccentHex } from '../../lib/clubColors';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  Calendar,
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  X,
} from 'lucide-react';

type WeekSlot = 'prev' | 'current' | 'next';

type ScheduleRow = {
  id: string;
  club_id?: string | null;
  title: string;
  description?: string | null;
  date: string;
  time?: string | null;
  type: 'GENERAL' | 'ASSIGNMENT';
  location?: string | null;
  assignment_template_url?: string | null;
};

type EnrichedSchedule = ScheduleRow & { club: Club | null };

export type RoadmapDetail = {
  title: string;
  kind: 'GENERAL' | 'ASSIGNMENT';
  description?: string | null;
  date: string;
  time?: string | null;
  location?: string | null;
  assignment_template_url?: string | null;
  clubName: string;
  badge?: string;
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function todayYMD(): string {
  const t = new Date();
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
}

function parseYMD(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function startOfWeekMonday(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function formatWeekRange(monday: Date): string {
  const sun = addDays(monday, 6);
  const fmt = (x: Date) => `${x.getMonth() + 1}/${x.getDate()}`;
  return `${fmt(monday)} ~ ${fmt(sun)}`;
}

function getWeekSlot(scheduleDate: string, currMonday: Date): WeekSlot | null {
  const prevM = addDays(currMonday, -7);
  const nextM = addDays(currMonday, 7);
  const wm = startOfWeekMonday(parseYMD(scheduleDate));
  const t = wm.getTime();
  if (t === prevM.getTime()) return 'prev';
  if (t === currMonday.getTime()) return 'current';
  if (t === nextM.getTime()) return 'next';
  return null;
}

function sortByDateTime(a: EnrichedSchedule, b: EnrichedSchedule) {
  const ta = `${a.date}T${(a.time || '00:00:00').toString().slice(0, 8)}`;
  const tb = `${b.date}T${(b.time || '00:00:00').toString().slice(0, 8)}`;
  return ta.localeCompare(tb);
}

function scheduleTimeLabel(s: EnrichedSchedule) {
  const t = s.time ? String(s.time).slice(0, 5) : null;
  return t && t.length >= 4 ? t : '시간 미정';
}

type WeeklyRoadmapProps = {
  /** false면 상세 페이지 등에서 중복되는 섹션 제목을 숨깁니다. */
  showSectionHeader?: boolean;
};

export const WeeklyRoadmap: React.FC<WeeklyRoadmapProps> = ({ showSectionHeader = true }) => {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<EnrichedSchedule[]>([]);
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<RoadmapDetail | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: clubsData }, { data: schData }] = await Promise.all([
        supabase.from('clubs').select('*'),
        supabase
          .from('schedules')
          .select('*')
          .eq('is_approved', true)
          .order('date', { ascending: true }),   // time은 null 가능 → 클라이언트 정렬로 처리
      ]);

      const clubMap = new Map<string, Club>((clubsData as Club[] | null)?.map((c) => [c.id, c]) || []);
      const defaultClub =
        (clubsData as Club[] | null)?.find((c) => c.name === profile?.univ_name) || null;

      const list = (schData as ScheduleRow[] | null) || [];
      const enriched: EnrichedSchedule[] = list.map((s) => ({
        ...s,
        club: s.club_id ? clubMap.get(s.club_id) || null : defaultClub,
      }));

      setRows(enriched);

      if (user?.id) {
        const { data: subs } = await supabase.from('submissions').select('schedule_id').eq('user_id', user.id);
        setSubmittedIds(new Set((subs || []).map((x: { schedule_id: string }) => x.schedule_id)));
      } else {
        setSubmittedIds(new Set());
      }
    } catch (e) {
      console.error('WeeklyRoadmap load error:', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.univ_name, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const todayStr = useMemo(() => todayYMD(), []);
  const currMonday = useMemo(() => startOfWeekMonday(new Date()), []);
  const prevMonday = useMemo(() => addDays(currMonday, -7), [currMonday]);
  const nextMonday = useMemo(() => addDays(currMonday, 7), [currMonday]);

  const weekMeta: Record<
    WeekSlot,
    { title: string; subtitle: string; emphasize: boolean }
  > = {
    prev: {
      title: '지난 주차',
      subtitle: formatWeekRange(prevMonday),
      emphasize: false,
    },
    current: {
      title: '이번 주차',
      subtitle: formatWeekRange(currMonday),
      emphasize: true,
    },
    next: {
      title: '다음 주차',
      subtitle: formatWeekRange(nextMonday),
      emphasize: false,
    },
  };

  const bySlot = useMemo(() => {
    const empty = (): EnrichedSchedule[] => [];
    const acc: Record<WeekSlot, EnrichedSchedule[]> = {
      prev: empty(),
      current: empty(),
      next: empty(),
    };
    for (const s of rows) {
      const slot = getWeekSlot(s.date, currMonday);
      if (slot) acc[slot].push(s);
    }
    return acc;
  }, [rows, currMonday]);

  const openDetail = (s: EnrichedSchedule, badge?: string) => {
    setDetail({
      title: s.title,
      kind: s.type,
      description: s.description,
      date: s.date,
      time: s.time,
      location: s.location,
      assignment_template_url: s.assignment_template_url,
      clubName: s.club?.name || '동아리 미지정',
      badge,
    });
  };

  const renderEventCard = (s: EnrichedSchedule) => {
    const accent = getClubAccentHex(s.club);
    return (
      <div
        key={`e-${s.id}`}
        className="flex overflow-hidden rounded-xl bg-white shadow-sm"
      >
        <div className="w-1.5 shrink-0" style={{ backgroundColor: accent }} aria-hidden />
        <div className="min-w-0 flex-1 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                {s.club?.name || '동아리'}
              </p>
              <p className="font-bold text-slate-900">{s.title}</p>
              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-slate-500">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                {s.date} · {scheduleTimeLabel(s)}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => openDetail(s)}>
              상세보기
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderAssignmentCard = (s: EnrichedSchedule, sectionBadge: string) => {
    const accent = getClubAccentHex(s.club);
    const done = submittedIds.has(s.id);
    const overdue = !done && s.date < todayStr;

    return (
      <div
        key={`a-${s.id}-${sectionBadge}`}
        className="flex overflow-hidden rounded-xl bg-white shadow-sm"
      >
        <div className="w-1.5 shrink-0" style={{ backgroundColor: accent }} aria-hidden />
        <div className="min-w-0 flex-1 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  {s.club?.name || '동아리'}
                </p>
                {done && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" />
                    제출 완료
                  </span>
                )}
                {!done && overdue && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    <AlertTriangle className="h-3 w-3" />
                    마감 지남
                  </span>
                )}
                {!done && !overdue && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                    예정
                  </span>
                )}
              </div>
              <p className="font-bold text-slate-900">{s.title}</p>
              <p className="mt-1 text-xs font-medium text-slate-500">마감 {s.date}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => openDetail(s, sectionBadge)}
            >
              상세보기
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderWeekColumn = (slot: WeekSlot) => {
    const items = bySlot[slot];
    // BOTH 타입은 일정·과제 양쪽에 모두 표시
    const events      = items.filter((s) => s.type === 'GENERAL'    || s.type === 'BOTH').sort(sortByDateTime);
    const assignments = items.filter((s) => s.type === 'ASSIGNMENT' || s.type === 'BOTH').sort(sortByDateTime);

    const completed = assignments.filter((s) => submittedIds.has(s.id));
    const pendingFuture = assignments.filter((s) => !submittedIds.has(s.id) && s.date >= todayStr);
    const pendingPast = assignments.filter((s) => !submittedIds.has(s.id) && s.date < todayStr);

    const meta = weekMeta[slot];

    return (
      <div
        key={slot}
        className={`flex flex-col rounded-2xl p-4 ${
          meta.emphasize
            ? 'bg-white shadow-md ring-2 ring-black/10'
            : 'bg-white/80 shadow-sm'
        }`}
      >
        <div className="mb-4 border-b border-slate-100 pb-3">
          <h3 className="text-lg font-black text-slate-900">{meta.title}</h3>
          <p className="text-xs font-semibold text-slate-500">{meta.subtitle}</p>
        </div>

        <div className="space-y-6">
          <section>
            <div className="mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-black/50" />
              <h4 className="text-sm font-bold text-slate-800">일정</h4>
            </div>
            {events.length === 0 ? (
              <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">일정 없음</p>
            ) : (
              <div className="space-y-2">{events.map(renderEventCard)}</div>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-black/50" />
              <h4 className="text-sm font-bold text-slate-800">과제</h4>
            </div>

            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">예정 · 마감 임박</p>
                {pendingFuture.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-3 text-center text-xs text-slate-500">없음</p>
                ) : (
                  <div className="space-y-2">{pendingFuture.map((s) => renderAssignmentCard(s, '예정'))}</div>
                )}
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">완료</p>
                {completed.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-3 text-center text-xs text-slate-500">없음</p>
                ) : (
                  <div className="space-y-2">{completed.map((s) => renderAssignmentCard(s, '완료'))}</div>
                )}
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">과거 · 미제출</p>
                {pendingPast.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-3 text-center text-xs text-slate-500">없음</p>
                ) : (
                  <div className="space-y-2">{pendingPast.map((s) => renderAssignmentCard(s, '미제출'))}</div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  };

  return (
    <section className="w-full">
      {showSectionHeader && (
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight text-black md:text-2xl">주차별 통합 일정 &amp; 과제</h2>
            <p className="text-sm text-black/60">
              지난 주 · 이번 주 · 다음 주 기준으로 동아리 일정과 과제를 한 화면에서 확인하세요.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl bg-white py-20 shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-black/30" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
          {(['prev', 'current', 'next'] as const).map(renderWeekColumn)}
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="max-h-[90vh] w-full max-w-lg overflow-hidden shadow-2xl">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 border-b border-slate-100">
              <div className="space-y-1 pr-4">
                <p className="text-xs font-bold text-slate-500">{detail.clubName}</p>
                <CardTitle className="text-xl leading-snug">{detail.title}</CardTitle>
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                    {detail.kind === 'ASSIGNMENT' ? '과제' : '일정'}
                  </span>
                  {detail.badge && (
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                      {detail.badge}
                    </span>
                  )}
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => setDetail(null)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="max-h-[55vh] space-y-4 overflow-y-auto pt-4">
              <div className="space-y-1 text-sm">
                <p className="font-bold text-slate-800">일시</p>
                <p className="text-slate-600">
                  {detail.date}
                  {detail.time ? ` · ${String(detail.time).slice(0, 5)}` : ''}
                </p>
              </div>
              {detail.location ? (
                <div className="space-y-1 text-sm">
                  <p className="font-bold text-slate-800">장소</p>
                  <p className="text-slate-600">{detail.location}</p>
                </div>
              ) : null}
              <div className="space-y-1 text-sm">
                <p className="font-bold text-slate-800">내용</p>
                <p className="whitespace-pre-wrap text-slate-600">
                  {detail.description?.trim() || '등록된 상세 설명이 없습니다.'}
                </p>
              </div>
              {detail.kind === 'ASSIGNMENT' && detail.assignment_template_url ? (
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => window.open(detail.assignment_template_url!, '_blank', 'noopener,noreferrer')}
                >
                  과제 양식 / 자료 열기
                </Button>
              ) : null}
              <Button type="button" variant="outline" className="w-full" onClick={() => setDetail(null)}>
                닫기
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
};
