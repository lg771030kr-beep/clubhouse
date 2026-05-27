import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Calendar, MapPin, MessageSquare, ClipboardList,
  FileText, Download, Users, Mail, Paperclip, Loader2,
  CheckCircle2, Clock3, UserX, HelpCircle, Check,
  ChevronRight, Lock, TrendingUp,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { ClubActivity, SessionItem } from './Portfolio';
import { SessionCollab } from './SessionCollab';

/* ════════════════════════ 로컬 타입 ════════════════════════ */
type DetailTab = '기본정보' | '일정' | '멤버' | '회비';

interface FullSession extends SessionItem {
  time?: string | null;
  isUpcoming: boolean;
  noteId: string | null;
  note: string;
  noteFileUrl: string | null;
  noteFileName: string | null;
}

interface MemberRow {
  user_id: string;
  role: string;
  full_name: string | null;
  email: string | null;
}

interface FeeCat  { id: string; name: string; type: string; }
interface FeeRecord { id: string; category_id: string; date: string | null; label: string | null; amount: number; note: string | null; }

/* ════════════════════════ 헬퍼 ════════════════════════ */
const TODAY = new Date().toISOString().slice(0, 10);

function fmtDate(d: string) {
  const dt = new Date(d + 'T00:00:00');
  const days = ['일','월','화','수','목','금','토'];
  return `${dt.getMonth()+1}월 ${dt.getDate()}일 (${days[dt.getDay()]})`;
}

const TYPE_LABEL: Record<string, string> = { GENERAL:'활동', ASSIGNMENT:'과제', BOTH:'활동+과제' };
const TYPE_BADGE: Record<string, string> = {
  GENERAL:    'bg-white/10 text-white/70 border-white/15',
  ASSIGNMENT: 'bg-white text-black border-transparent',
  BOTH:       'bg-white/20 text-white border-white/30',
};

function AttendBadge({ status }: { status: SessionItem['attendStatus'] }) {
  if (status === 'PRESENT') return (
    <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
      <CheckCircle2 className="w-3 h-3" />출석
    </span>
  );
  if (status === 'LATE') return (
    <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
      <Clock3 className="w-3 h-3" />지각
    </span>
  );
  if (status === 'ABSENT') return (
    <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25">
      <UserX className="w-3 h-3" />결석
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-white/5 text-white/30 border border-white/10">
      <HelpCircle className="w-3 h-3" />미인증
    </span>
  );
}

/* ════════════════════════ 세션 행 ════════════════════════ */
function SessionRow({ session, onClick }: { session: FullSession; onClick: () => void; [key: string]: unknown }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full bg-black rounded-xl border border-white/8 px-4 py-3
                 flex items-center justify-between gap-3 hover:border-white/20 hover:bg-white/5
                 transition-all text-left group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full border ${TYPE_BADGE[session.type] ?? TYPE_BADGE.GENERAL}`}>
            {TYPE_LABEL[session.type] ?? '활동'}
          </span>
          <span className="text-[10px] text-white/30 font-medium">{fmtDate(session.date)}</span>
          {session.note && (
            <span className="flex items-center gap-0.5 text-[10px] text-white/30 font-medium">
              <MessageSquare className="w-2.5 h-2.5" />메모
            </span>
          )}
        </div>
        <p className="text-sm font-black text-white truncate">{session.title}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!session.isUpcoming && <AttendBadge status={session.attendStatus} />}
        <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors" />
      </div>
    </button>
  );
}

/* ════════════════════════ 멤버 카드 ════════════════════════ */
function MemberCard({ member }: { member: MemberRow; [key: string]: unknown }) {
  const isLeader = ['ADMIN','LEADER','CAPTAIN'].includes(member.role);
  return (
    <div className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3">
      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
        <Users className="w-4 h-4 text-white/40" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-black text-white truncate">{member.full_name || '이름 미설정'}</p>
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0
            ${isLeader ? 'bg-white/15 text-white border border-white/25' : 'bg-white/5 text-white/40 border border-white/10'}`}>
            {isLeader ? 'Leader' : '부원'}
          </span>
        </div>
        {member.email && (
          <a href={`mailto:${member.email}`} onClick={e => e.stopPropagation()}
             className="text-xs text-white/35 hover:text-white/60 transition-colors flex items-center gap-1 mt-0.5">
            <Mail className="w-3 h-3" />{member.email}
          </a>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════ 세션 상세 + 메모/파일 ════════════════════════ */
function SessionDetailWithNote({
  session, clubId, clubRole, onClose, onNoteChange,
}: {
  session: FullSession;
  clubId: string;
  clubRole: string;
  onClose: () => void;
  onNoteChange: (id: string, note: string, fileUrl: string | null, fileName: string | null) => void;
}) {
  const isAdmin = ['ADMIN', 'LEADER', 'CAPTAIN'].includes(clubRole);
  const { profile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fileUploading, setFileUploading] = useState(false);
  const [fileUrl,       setFileUrl]       = useState(session.noteFileUrl);
  const [fileName,      setFileName]      = useState(session.noteFileName);

  const handleFileUpload = async (file: File) => {
    if (!profile?.id) return;
    setFileUploading(true);
    try {
      const ext  = file.name.split('.').pop() ?? 'bin';
      const path = `${profile.id}/${clubId}/${session.scheduleId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('activity-files').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('activity-files').getPublicUrl(path);

      // session_notes upsert (파일 정보만 업데이트, note 내용은 SessionCollab이 관리)
      await supabase.from('session_notes').upsert({
        user_id:     profile.id,
        schedule_id: session.scheduleId,
        club_id:     clubId,
        file_url:    publicUrl,
        file_name:   file.name,
        file_size:   file.size,
        updated_at:  new Date().toISOString(),
      }, { onConflict: 'user_id,schedule_id' });

      // archive_documents에 자동 저장
      await supabase.from('archive_documents').insert({
        club_id:   clubId,
        folder_id: null,
        title:     `[${session.title}] ${(profile as Record<string,string>).full_name || profile.email || '부원'}`,
        file_url:  publicUrl,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
      });

      setFileUrl(publicUrl);
      setFileName(file.name);
      onNoteChange(session.scheduleId, '', publicUrl, file.name);
    } catch (e) {
      console.error('upload error', e);
    } finally {
      setFileUploading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div key="ov2" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110]" onClick={onClose} />
      <motion.div key="md2"
        initial={{ opacity:0, y:40, scale:0.97 }}
        animate={{ opacity:1, y:0,  scale:1   }}
        exit={{   opacity:0, y:20, scale:0.97 }}
        transition={{ type:'spring', stiffness:380, damping:32 }}
        className="fixed inset-x-4 bottom-0 sm:inset-auto sm:left-1/2 sm:-translate-x-1/2
                   sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-lg
                   bg-[#111] border border-white/10 rounded-t-3xl sm:rounded-3xl
                   z-[110] overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-white/8">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${TYPE_BADGE[session.type] ?? TYPE_BADGE.GENERAL}`}>
                {TYPE_LABEL[session.type] ?? '활동'}
              </span>
              {!session.isUpcoming && <AttendBadge status={session.attendStatus} />}
            </div>
            <h3 className="font-black text-white text-base leading-tight">{session.title}</h3>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-white/40 font-medium flex-wrap">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(session.date)}{session.time ? ` ${String(session.time).slice(0,5)}` : ''}</span>
              {session.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{session.location}</span>}
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors shrink-0">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">

          {/* 운영진 활동 내용 */}
          <div>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3" />운영진 활동 내용
            </p>
            {session.adminDescription
              ? <div className="bg-white/5 border border-white/8 rounded-2xl px-4 py-3 text-sm text-white/80 leading-relaxed whitespace-pre-wrap font-medium">{session.adminDescription}</div>
              : <div className="bg-white/3 border border-white/6 rounded-2xl px-4 py-3 text-xs text-white/30 font-medium">운영진이 입력한 활동 내용이 없습니다</div>
            }
          </div>

          {/* 제출 내용 */}
          {(session.type === 'ASSIGNMENT' || session.type === 'BOTH') && (
            <div>
              <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <ClipboardList className="w-3 h-3" />나의 제출 내용
              </p>
              {session.submittedAt ? (
                <div className="space-y-2">
                  <p className="text-[10px] text-white/30 font-medium">제출: {new Date(session.submittedAt).toLocaleString('ko-KR', { hour12:false })}</p>
                  {session.submFileName && (
                    <a href={session.submFileUrl ?? '#'} target="_blank" rel="noopener noreferrer"
                       className="flex items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 hover:bg-white/10 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-white/60" />
                        </div>
                        <p className="text-sm font-black text-white truncate">{session.submFileName}</p>
                      </div>
                      <Download className="w-4 h-4 text-white/30 group-hover:text-white/70 shrink-0 transition-colors" />
                    </a>
                  )}
                  {session.submContent && (
                    <div className="bg-white/5 border border-white/8 rounded-2xl px-4 py-3 text-sm text-white/70 leading-relaxed whitespace-pre-wrap font-medium">{session.submContent}</div>
                  )}
                </div>
              ) : (
                <div className="bg-white/3 border border-white/6 rounded-2xl px-4 py-3 text-xs text-white/30 font-medium">제출 기록이 없습니다</div>
              )}
            </div>
          )}

          {/* 협업 기능: 공유 회의록 / 내 메모 / 액션 아이템 / 작업 링크 */}
          <SessionCollab
            scheduleId={session.scheduleId}
            clubId={clubId}
            isAdmin={isAdmin}
          />

          {/* 파일 첨부 → 아카이브 자동 저장 */}
          <div>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Paperclip className="w-3 h-3" />파일 첨부 · 아카이브 저장
            </p>
            {fileUrl && fileName ? (
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-white/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white truncate">{fileName}</p>
                  <p className="text-[10px] text-white/30 font-medium">아카이브에 저장됨</p>
                </div>
                <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                   className="shrink-0 text-white/30 hover:text-white/70 transition-colors">
                  <Download className="w-4 h-4" />
                </a>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={fileUploading}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl
                           bg-white/5 border border-dashed border-white/15
                           hover:bg-white/[0.08] hover:border-white/25 transition-all disabled:opacity-50">
                {fileUploading
                  ? <Loader2 className="w-4 h-4 text-white/40 shrink-0 animate-spin" />
                  : <Paperclip className="w-4 h-4 text-white/40 shrink-0" />}
                <span className="text-sm text-white/50">
                  {fileUploading ? '업로드 중...' : 'PDF, 이미지, 문서 → 아카이브 자동 저장'}
                </span>
              </button>
            )}
            <input ref={fileRef} type="file" className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-white/8">
          <button onClick={onClose}
            className="w-full py-3 rounded-2xl bg-white text-black font-black text-sm hover:bg-white/90 transition-all active:scale-[0.98]">
            닫기
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ════════════════════════ 메인: ActivityDetailSheet ════════════════════════ */
interface Props { activity: ClubActivity; onClose: () => void; }

export function ActivityDetailSheet({ activity, onClose }: Props) {
  const { profile } = useAuth();
  const [tab, setTab] = useState<DetailTab>('기본정보');

  const [sessions,        setSessions]        = useState<FullSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<FullSession | null>(null);

  const [members,       setMembers]       = useState<MemberRow[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [membersLoading,setMembersLoading]= useState(false);

  const [feeCats,    setFeeCats]    = useState<FeeCat[]>([]);
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>([]);
  const [feesLoaded, setFeesLoaded] = useState(false);
  const [feesLoading,setFeesLoading]= useState(false);

  /* ── 세션 로드 ── */
  const loadSessions = useCallback(async () => {
    if (!profile?.id) return;
    setSessionsLoading(true);
    try {
      const { data: schData } = await supabase
        .from('schedules')
        .select('id, title, type, date, time, location, description')
        .eq('club_id', activity.clubId)
        .gte('date', `${activity.year}-01-01`)
        .lte('date', `${activity.year}-12-31`)
        .order('date', { ascending: false });

      const schList = (schData ?? []) as {
        id:string; title:string; type:string; date:string;
        time:string|null; location:string|null; description:string|null;
      }[];
      const ids = schList.map(s => s.id);

      /* 출결 */
      const attendMap: Record<string,{status:string; marked_at:string|null}> = {};
      if (ids.length) {
        const { data } = await supabase.from('attendance')
          .select('schedule_id, status, marked_at')
          .eq('user_id', profile.id).in('schedule_id', ids);
        ((data ?? []) as {schedule_id:string;status:string;marked_at:string|null}[])
          .forEach(a => { attendMap[a.schedule_id] = a; });
      }

      /* 제출 */
      const assignIds = schList.filter(s => s.type === 'ASSIGNMENT' || s.type === 'BOTH').map(s => s.id);
      const submMap: Record<string,{content:string|null;file_name:string|null;file_url:string|null;submitted_at:string|null}> = {};
      if (assignIds.length) {
        const { data } = await supabase.from('submissions')
          .select('schedule_id, content, file_name, file_url, submitted_at')
          .eq('user_id', profile.id).in('schedule_id', assignIds);
        ((data ?? []) as {schedule_id:string;content:string|null;file_name:string|null;file_url:string|null;submitted_at:string|null}[])
          .forEach(s => { submMap[s.schedule_id] = s; });
      }

      /* 메모 */
      const noteMap: Record<string,{id:string;note:string;file_url:string|null;file_name:string|null}> = {};
      if (ids.length) {
        const { data } = await supabase.from('session_notes')
          .select('id, schedule_id, note, file_url, file_name')
          .eq('user_id', profile.id).in('schedule_id', ids);
        ((data ?? []) as {id:string;schedule_id:string;note:string;file_url:string|null;file_name:string|null}[])
          .forEach(n => { noteMap[n.schedule_id] = n; });
      }

      setSessions(schList.map(s => {
        const att  = attendMap[s.id];
        const subm = submMap[s.id];
        const n    = noteMap[s.id];
        return {
          scheduleId:       s.id,
          title:            s.title,
          date:             s.date,
          time:             s.time,
          type:             s.type ?? 'GENERAL',
          location:         s.location,
          adminDescription: s.description,
          attendStatus:     att ? (att.status as SessionItem['attendStatus']) : 'UNRECORDED',
          markedAt:         att?.marked_at ?? null,
          submContent:      subm?.content    ?? null,
          submFileName:     subm?.file_name  ?? null,
          submFileUrl:      subm?.file_url   ?? null,
          submittedAt:      subm?.submitted_at ?? null,
          isUpcoming:       s.date > TODAY,
          noteId:           n?.id    ?? null,
          note:             n?.note  ?? '',
          noteFileUrl:      n?.file_url  ?? null,
          noteFileName:     n?.file_name ?? null,
        };
      }));
    } finally {
      setSessionsLoading(false);
    }
  }, [profile?.id, activity.clubId, activity.year]);

  useEffect(() => { void loadSessions(); }, [loadSessions]);

  /* ── 멤버 로드 ── */
  const loadMembers = useCallback(async () => {
    if (membersLoaded || membersLoading) return;
    setMembersLoading(true);
    try {
      const { data } = await supabase
        .from('club_members')
        .select('user_id, role, profiles(full_name, email)')
        .eq('club_id', activity.clubId);
      type RawMember = { user_id: string; role: string; profiles: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null };
      setMembers(
        ((data ?? []) as unknown as RawMember[])
          .map(m => {
            const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
            return { user_id: m.user_id, role: m.role, full_name: p?.full_name ?? null, email: p?.email ?? null };
          })
      );
      setMembersLoaded(true);
    } finally { setMembersLoading(false); }
  }, [membersLoaded, membersLoading, activity.clubId]);

  /* ── 회비 로드 ── */
  const loadFees = useCallback(async () => {
    if (feesLoaded || feesLoading) return;
    setFeesLoading(true);
    try {
      const { data: cats } = await supabase.from('club_fee_categories')
        .select('id, name, type').eq('club_id', activity.clubId);
      const catList = (cats ?? []) as FeeCat[];
      setFeeCats(catList);
      if (catList.length) {
        const { data: recs } = await supabase.from('club_fee_records')
          .select('id, category_id, date, label, amount, note')
          .in('category_id', catList.map(c => c.id))
          .order('date', { ascending: false });
        setFeeRecords((recs ?? []) as FeeRecord[]);
      }
      setFeesLoaded(true);
    } finally { setFeesLoading(false); }
  }, [feesLoaded, feesLoading, activity.clubId]);

  useEffect(() => {
    if (tab === '멤버') loadMembers();
    if (tab === '회비') loadFees();
  }, [tab, loadMembers, loadFees]);

  /* ── 통계 ── */
  const stats = React.useMemo(() => {
    const past    = sessions.filter(s => !s.isUpcoming);
    const present = past.filter(s => s.attendStatus === 'PRESENT').length;
    const late    = past.filter(s => s.attendStatus === 'LATE').length;
    const absent  = past.filter(s => s.attendStatus === 'ABSENT').length;
    const total   = past.length;
    const rate    = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    return { total, present, late, absent, rate };
  }, [sessions]);

  /* ── 회비 집계 ── */
  const feeStats = React.useMemo(() =>
    feeCats.map(cat => {
      const records = feeRecords.filter(r => r.category_id === cat.id);
      return { ...cat, records, total: records.reduce((s,r) => s + (r.amount ?? 0), 0) };
    }), [feeCats, feeRecords]);

  const handleNoteChange = (scheduleId: string, note: string, fileUrl: string | null, fileName: string | null) => {
    setSessions(prev => prev.map(s => s.scheduleId === scheduleId ? { ...s, note, noteFileUrl: fileUrl, noteFileName: fileName } : s));
    if (selectedSession?.scheduleId === scheduleId) {
      setSelectedSession(prev => prev ? { ...prev, note, noteFileUrl: fileUrl, noteFileName: fileName } : prev);
    }
  };

  const TABS: DetailTab[] = ['기본정보', '일정', '멤버', '회비'];
  const upcoming = sessions.filter(s => s.isUpcoming);
  const past     = sessions.filter(s => !s.isUpcoming);

  return (
    <>
      <AnimatePresence>
        <motion.div key="ds-ov"
          initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80]"
          onClick={onClose}
        />
        <motion.div key="ds-sheet"
          initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
          transition={{ type:'spring', stiffness:320, damping:34 }}
          className="fixed inset-x-0 bottom-0 top-[5%] z-[80] bg-[#0a0a0a]
                     rounded-t-3xl border-t border-x border-white/10 flex flex-col overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* 핸들 + 헤더 */}
          <div className="shrink-0">
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3" />
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <div className="min-w-0 flex-1 pr-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {activity.isCompleted ? (
                    <span className="bg-white text-black text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />수료
                    </span>
                  ) : (
                    <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />진행중
                    </span>
                  )}
                  <span className="text-white/30 text-[10px] font-bold">{activity.year}년</span>
                </div>
                <h2 className="text-lg font-black text-white mt-0.5">{activity.clubName}</h2>
              </div>
              <button onClick={onClose}
                className="w-9 h-9 rounded-2xl bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors shrink-0">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* 탭 바 */}
            <div className="flex border-b border-white/8 px-2">
              {TABS.map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-3 text-xs font-black transition-colors relative
                    ${tab === t ? 'text-white' : 'text-white/35 hover:text-white/60'}`}>
                  {t}
                  {(t === '멤버' || t === '회비') && activity.isCompleted && (
                    <Lock className="inline w-2.5 h-2.5 ml-0.5 opacity-40" />
                  )}
                  {tab === t && <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-white rounded-full" />}
                </button>
              ))}
            </div>
          </div>

          {/* 탭 내용 */}
          <div className="flex-1 overflow-y-auto">

            {/* ══ 기본정보 ══ */}
            {tab === '기본정보' && (
              <div className="p-5 space-y-4">
                <div className="bg-white/5 rounded-2xl border border-white/8 p-4 space-y-3">
                  {[
                    ['동아리명', activity.clubName],
                    activity.clubCategory ? ['카테고리', activity.clubCategory] : null,
                    ['역할', ['ADMIN','LEADER','CAPTAIN'].includes(activity.clubRole) ? 'Leader' : '부원'],
                    ['활동 연도', `${activity.year}년`],
                  ].filter(Boolean).map(([label, value]) => (
                    <div key={label as string} className="flex justify-between text-sm">
                      <span className="text-white/40 font-medium">{label}</span>
                      <span className="text-white font-black">{value}</span>
                    </div>
                  ))}
                </div>

                {sessionsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>
                ) : (
                  <div className="bg-white/5 rounded-2xl border border-white/8 p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-white/40" />
                      <span className="text-xs font-black text-white/50 uppercase tracking-wide">출석 현황</span>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-white/40 font-medium">출석률</span>
                        <span className="text-white font-black">{stats.rate}%</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-white rounded-full transition-all" style={{ width:`${stats.rate}%` }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label:'전체', value:stats.total,   color:'text-white'       },
                        { label:'출석', value:stats.present, color:'text-emerald-400' },
                        { label:'지각', value:stats.late,    color:'text-amber-400'   },
                        { label:'결석', value:stats.absent,  color:'text-red-400'     },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="bg-white/5 rounded-xl p-2.5 text-center">
                          <p className={`text-lg font-black ${color}`}>{value}</p>
                          <p className="text-[10px] text-white/30 font-medium mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ══ 일정 ══ */}
            {tab === '일정' && (
              <div className="p-4">
                {sessionsLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>
                ) : sessions.length === 0 ? (
                  <p className="text-center py-12 text-white/30 text-sm font-medium">등록된 일정이 없습니다</p>
                ) : (
                  <div className="space-y-2">
                    {upcoming.length > 0 && (
                      <>
                        <p className="text-[10px] font-black text-white/30 uppercase tracking-widest px-1 pt-2 pb-1">다가오는 일정</p>
                        {upcoming.map(s => <SessionRow key={s.scheduleId} session={s} onClick={() => setSelectedSession(s)} />)}
                        {past.length > 0 && <div className="border-t border-white/8 my-3" />}
                      </>
                    )}
                    {past.length > 0 && (
                      <>
                        {upcoming.length > 0 && <p className="text-[10px] font-black text-white/30 uppercase tracking-widest px-1 pb-1">지난 활동</p>}
                        {past.map(s => <SessionRow key={s.scheduleId} session={s} onClick={() => setSelectedSession(s)} />)}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ══ 멤버 ══ */}
            {tab === '멤버' && (
              <div className="p-4">
                {activity.isCompleted ? (
                  <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
                    <Lock className="w-8 h-8 text-white/15" />
                    <p className="text-sm font-black text-white/30">수료된 활동입니다</p>
                    <p className="text-xs text-white/20 font-medium">활동 중인 경우에만 멤버 정보를 확인할 수 있습니다</p>
                  </div>
                ) : membersLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>
                ) : (
                  <div className="space-y-4">
                    {members.filter(m => ['ADMIN','LEADER','CAPTAIN'].includes(m.role)).length > 0 && (
                      <div>
                        <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2 px-1">운영진</p>
                        <div className="space-y-1">{members.filter(m => ['ADMIN','LEADER','CAPTAIN'].includes(m.role)).map(m => <MemberCard key={m.user_id} member={m} />)}</div>
                      </div>
                    )}
                    {members.filter(m => !['ADMIN','LEADER','CAPTAIN'].includes(m.role)).length > 0 && (
                      <div>
                        <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2 px-1">
                          부원 ({members.filter(m => !['ADMIN','LEADER','CAPTAIN'].includes(m.role)).length}명)
                        </p>
                        <div className="space-y-1">{members.filter(m => !['ADMIN','LEADER','CAPTAIN'].includes(m.role)).map(m => <MemberCard key={m.user_id} member={m} />)}</div>
                      </div>
                    )}
                    {members.length === 0 && <p className="text-center text-sm text-white/30 py-8 font-medium">멤버 정보가 없습니다</p>}
                  </div>
                )}
              </div>
            )}

            {/* ══ 회비 ══ */}
            {tab === '회비' && (
              <div className="p-4">
                {activity.isCompleted ? (
                  <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
                    <Lock className="w-8 h-8 text-white/15" />
                    <p className="text-sm font-black text-white/30">수료된 활동입니다</p>
                    <p className="text-xs text-white/20 font-medium">활동 중인 경우에만 회비 내역을 확인할 수 있습니다</p>
                  </div>
                ) : feesLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>
                ) : feeStats.length === 0 ? (
                  <p className="text-center py-12 text-white/30 text-sm font-medium">등록된 회비 내역이 없습니다</p>
                ) : (
                  <div className="space-y-4">
                    {feeStats.map(cat => (
                      <div key={cat.id} className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                          <div>
                            <span className="text-[10px] font-black text-white/40 uppercase mr-2">{cat.type === 'grant' ? '지원금' : '자체회비'}</span>
                            <span className="text-sm font-black text-white">{cat.name}</span>
                          </div>
                          <span className="text-sm font-black text-white">₩ {cat.total.toLocaleString()}</span>
                        </div>
                        {cat.records.length === 0 ? (
                          <p className="text-xs text-white/25 font-medium text-center py-4">내역 없음</p>
                        ) : (
                          <div className="divide-y divide-white/5">
                            {cat.records.map(r => (
                              <div key={r.id} className="flex items-center justify-between px-4 py-2.5">
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-black text-white/70 truncate">{r.label || '내역'}</p>
                                  {r.date && <p className="text-[10px] text-white/30 font-medium">{r.date}</p>}
                                  {r.note && <p className="text-[10px] text-white/25 font-medium truncate">{r.note}</p>}
                                </div>
                                <span className="text-sm font-black text-white/80 ml-3 shrink-0">₩ {r.amount.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* 세션 상세 모달 */}
      <AnimatePresence>
        {selectedSession && (
          <SessionDetailWithNote
            session={selectedSession}
            clubId={activity.clubId}
            clubRole={activity.clubRole}
            onClose={() => setSelectedSession(null)}
            onNoteChange={handleNoteChange}
          />
        )}
      </AnimatePresence>
    </>
  );
}
