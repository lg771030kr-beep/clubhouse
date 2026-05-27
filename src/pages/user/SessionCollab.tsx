/**
 * SessionCollab
 * 일정(세션) 상세 내부의 협업 기능
 *   1. 공유 회의록   — 운영진이 작성, 전체 공개 (읽기)
 *   2. 개별 메모장   — 나만 보는 개인 메모 (전체 쓰기)
 *   3. 액션 아이템   — 담당자 지정 + 마감일 + 완료 체크
 *   4. 작업 링크     — Notion · GitHub · Figma 등 외부 링크 모음
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  BookOpen, NotebookPen, CheckSquare, ExternalLink,
  Plus, Trash2, Check, Loader2,
  User, Calendar,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

/* ════════════════════════ 타입 ════════════════════════ */
interface ActionItem {
  id:             string;
  content:        string;
  assignee_id:    string | null;
  assignee_name:  string | null;
  due_date:       string | null;
  completed:      boolean;
}
interface SessionLink {
  id:    string;
  title: string;
  url:   string;
}
interface MemberOption {
  id:   string;
  name: string;
}

/* ════════════════════════ 헬퍼 ════════════════════════ */
function linkEmoji(url: string): string {
  if (/notion\.(so|site)/.test(url))              return '📝';
  if (/github\.com/.test(url))                    return '💻';
  if (/figma\.com/.test(url))                     return '🎨';
  if (/docs\.google\.com\/spreadsheet/.test(url)) return '📊';
  if (/docs\.google\.com/.test(url))              return '📄';
  if (/drive\.google\.com/.test(url))             return '📁';
  if (/slack\.com/.test(url))                     return '💬';
  if (/trello\.com/.test(url))                    return '🗂';
  if (/linear\.app/.test(url))                    return '🔷';
  return '🔗';
}

function linkDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return url; }
}

/* ════════════════════════ 컴포넌트 ════════════════════════ */
interface Props {
  scheduleId: string;
  clubId:     string;
  isAdmin:    boolean;
}

export function SessionCollab({ scheduleId, clubId, isAdmin }: Props) {
  const { profile } = useAuth();

  /* ── 공유 회의록 ── */
  const [sharedNotes,      setSharedNotes]      = useState('');
  const [sharedNotesInit,  setSharedNotesInit]  = useState(false);
  const [sharedSaving,     setSharedSaving]     = useState(false);
  const [sharedSaved,      setSharedSaved]      = useState(false);
  const sharedTimer = useRef<ReturnType<typeof setTimeout>>();

  /* ── 개별 메모 ── */
  const [myNote,      setMyNote]      = useState('');
  const [myNoteInit,  setMyNoteInit]  = useState(false);
  const [myNoteSaving,setMyNoteSaving]= useState(false);
  const [myNoteSaved, setMyNoteSaved] = useState(false);
  const myNoteTimer = useRef<ReturnType<typeof setTimeout>>();

  /* ── 액션 아이템 ── */
  const [actions,    setActions]    = useState<ActionItem[]>([]);
  const [actLoading, setActLoading] = useState(true);
  const [showAddAct, setShowAddAct] = useState(false);
  const [actContent, setActContent] = useState('');
  const [actAssignee,setActAssignee]= useState('');
  const [actDue,     setActDue]     = useState('');
  const [actAdding,  setActAdding]  = useState(false);

  /* ── 링크 ── */
  const [links,      setLinks]      = useState<SessionLink[]>([]);
  const [lnkLoading, setLnkLoading] = useState(true);
  const [showAddLnk, setShowAddLnk] = useState(false);
  const [lnkUrl,     setLnkUrl]     = useState('');
  const [lnkTitle,   setLnkTitle]   = useState('');
  const [lnkAdding,  setLnkAdding]  = useState(false);

  /* ── 멤버 (admin: 담당자 선택용) ── */
  const [members, setMembers] = useState<MemberOption[]>([]);

  /* ════ 최초 로드 ════ */
  useEffect(() => { void loadAll(); }, [scheduleId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAll = async () => {
    /* 공유 회의록 */
    const { data: sch } = await supabase
      .from('schedules').select('meeting_notes').eq('id', scheduleId).single();
    setSharedNotes(sch?.meeting_notes ?? '');
    setSharedNotesInit(true);

    /* 개별 메모 */
    if (profile?.id) {
      const { data: noteRow } = await supabase
        .from('session_notes')
        .select('note')
        .eq('schedule_id', scheduleId)
        .eq('user_id', profile.id)
        .single();
      setMyNote(noteRow?.note ?? '');
    }
    setMyNoteInit(true);

    /* 액션 아이템 */
    setActLoading(true);
    const { data: actData } = await supabase
      .from('action_items')
      .select('id, content, assignee_id, due_date, completed, profiles!action_items_assignee_id_fkey(full_name)')
      .eq('schedule_id', scheduleId)
      .order('created_at');
    type RawAction = {
      id: string; content: string; assignee_id: string | null;
      due_date: string | null; completed: boolean;
      profiles: { full_name: string | null } | { full_name: string | null }[] | null;
    };
    setActions(
      ((actData ?? []) as unknown as RawAction[]).map(a => {
        const p = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
        return {
          id:            a.id,
          content:       a.content,
          assignee_id:   a.assignee_id,
          assignee_name: p?.full_name ?? null,
          due_date:      a.due_date,
          completed:     a.completed,
        };
      })
    );
    setActLoading(false);

    /* 링크 */
    setLnkLoading(true);
    const { data: lnkData } = await supabase
      .from('session_links')
      .select('id, title, url')
      .eq('schedule_id', scheduleId)
      .order('created_at');
    setLinks((lnkData ?? []) as SessionLink[]);
    setLnkLoading(false);

    /* 멤버 (admin일 때만) */
    if (isAdmin) {
      const { data: mData } = await supabase
        .from('club_members')
        .select('user_id, profiles(full_name)')
        .eq('club_id', clubId);
      setMembers(
        ((mData ?? []) as { user_id: string; profiles: { full_name: string | null } | { full_name: string | null }[] | null }[])
          .map(m => {
            const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
            return { id: m.user_id, name: p?.full_name ?? '이름 없음' };
          })
      );
    }
  };

  /* ════ 공유 회의록 저장 (admin only) ════ */
  const saveShared = useCallback(async (text: string) => {
    if (!isAdmin) return;
    setSharedSaving(true);
    try {
      await supabase.from('schedules').update({ meeting_notes: text }).eq('id', scheduleId);
      setSharedSaved(true);
      setTimeout(() => setSharedSaved(false), 2000);
    } finally { setSharedSaving(false); }
  }, [isAdmin, scheduleId]);

  const handleSharedChange = (text: string) => {
    setSharedNotes(text);
    setSharedSaved(false);
    clearTimeout(sharedTimer.current);
    sharedTimer.current = setTimeout(() => saveShared(text), 1000);
  };

  /* ════ 개별 메모 저장 ════ */
  const saveMyNote = useCallback(async (text: string) => {
    if (!profile?.id) return;
    setMyNoteSaving(true);
    try {
      await supabase.from('session_notes').upsert({
        user_id:     profile.id,
        schedule_id: scheduleId,
        club_id:     clubId,
        note:        text,
        updated_at:  new Date().toISOString(),
      }, { onConflict: 'user_id,schedule_id' });
      setMyNoteSaved(true);
      setTimeout(() => setMyNoteSaved(false), 2000);
    } finally { setMyNoteSaving(false); }
  }, [profile?.id, scheduleId, clubId]);

  const handleMyNoteChange = (text: string) => {
    setMyNote(text);
    setMyNoteSaved(false);
    clearTimeout(myNoteTimer.current);
    myNoteTimer.current = setTimeout(() => saveMyNote(text), 1000);
  };

  /* ════ 액션 아이템 CRUD ════ */
  const addAction = async () => {
    if (!actContent.trim() || !profile?.id) return;
    setActAdding(true);
    try {
      const assigneeMember = members.find(m => m.id === actAssignee);
      const { data } = await supabase
        .from('action_items')
        .insert({
          schedule_id: scheduleId,
          club_id:     clubId,
          content:     actContent.trim(),
          assignee_id: actAssignee || null,
          due_date:    actDue || null,
          completed:   false,
          created_by:  profile.id,
        })
        .select('id, content, assignee_id, due_date, completed')
        .single();
      if (data) {
        setActions(prev => [...prev, {
          ...(data as ActionItem),
          assignee_name: assigneeMember?.name ?? null,
        }]);
      }
      setActContent(''); setActAssignee(''); setActDue('');
      setShowAddAct(false);
    } finally { setActAdding(false); }
  };

  const toggleAction = async (item: ActionItem) => {
    const next = !item.completed;
    setActions(prev => prev.map(a => a.id === item.id ? { ...a, completed: next } : a));
    await supabase.from('action_items').update({
      completed:    next,
      completed_by: next ? profile?.id : null,
      completed_at: next ? new Date().toISOString() : null,
    }).eq('id', item.id);
  };

  const deleteAction = async (id: string) => {
    setActions(prev => prev.filter(a => a.id !== id));
    await supabase.from('action_items').delete().eq('id', id);
  };

  /* ════ 링크 CRUD ════ */
  const addLink = async () => {
    if (!lnkUrl.trim() || !profile?.id) return;
    setLnkAdding(true);
    try {
      const title = lnkTitle.trim() || linkDomain(lnkUrl.trim());
      const { data } = await supabase
        .from('session_links')
        .insert({ schedule_id: scheduleId, club_id: clubId, title, url: lnkUrl.trim(), created_by: profile.id })
        .select('id, title, url')
        .single();
      if (data) setLinks(prev => [...prev, data as SessionLink]);
      setLnkUrl(''); setLnkTitle('');
      setShowAddLnk(false);
    } finally { setLnkAdding(false); }
  };

  const deleteLink = async (id: string) => {
    setLinks(prev => prev.filter(l => l.id !== id));
    await supabase.from('session_links').delete().eq('id', id);
  };

  /* ════ 비어있으면 멤버에게 숨김 ════ */
  const everythingEmpty = sharedNotesInit && myNoteInit
    && !sharedNotes && !myNote
    && actions.length === 0 && links.length === 0;
  if (!isAdmin && everythingEmpty && !actLoading && !lnkLoading) return null;

  /* ════ 렌더 ════ */
  return (
    <div className="space-y-5">
      <div className="border-t border-white/10" />

      {/* ══════════ 1. 공유 회의록 ══════════ */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="flex items-center gap-1.5 text-[10px] font-black text-white/40 uppercase tracking-widest">
            <BookOpen className="w-3 h-3" />공유 회의록
            <span className="ml-1 px-1.5 py-0.5 rounded-md bg-white/8 text-white/25 text-[9px] font-black normal-case tracking-normal">
              운영진 작성
            </span>
          </p>
          {isAdmin && (
            <span className="flex items-center gap-1 text-[10px]">
              {sharedSaving && <><Loader2 className="w-3 h-3 animate-spin text-white/25" /><span className="text-white/30">저장 중</span></>}
              {sharedSaved  && <><Check   className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">저장됨</span></>}
            </span>
          )}
        </div>

        {isAdmin ? (
          <textarea
            value={sharedNotes}
            onChange={e => handleSharedChange(e.target.value)}
            placeholder="회의 결정사항, 논의 내용을 여기에 기록하세요. 모든 부원이 볼 수 있습니다."
            rows={4}
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3
                       text-white text-sm font-medium placeholder-white/20 outline-none resize-none
                       focus:border-white/25 focus:bg-white/[0.08] transition-all"
          />
        ) : sharedNotes ? (
          <div className="bg-white/5 border border-white/8 rounded-2xl px-4 py-3
                          text-sm text-white/80 leading-relaxed whitespace-pre-wrap font-medium">
            {sharedNotes}
          </div>
        ) : (
          <div className="bg-white/3 border border-white/6 rounded-2xl px-4 py-3 text-xs text-white/25 font-medium">
            작성된 회의록이 없습니다
          </div>
        )}
      </div>

      {/* ══════════ 2. 개별 메모 ══════════ */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="flex items-center gap-1.5 text-[10px] font-black text-white/40 uppercase tracking-widest">
            <NotebookPen className="w-3 h-3" />내 메모
            <span className="ml-1 px-1.5 py-0.5 rounded-md bg-white/8 text-white/25 text-[9px] font-black normal-case tracking-normal">
              나만 보임
            </span>
          </p>
          <span className="flex items-center gap-1 text-[10px]">
            {myNoteSaving && <><Loader2 className="w-3 h-3 animate-spin text-white/25" /><span className="text-white/30">저장 중</span></>}
            {myNoteSaved  && <><Check   className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">저장됨</span></>}
          </span>
        </div>
        <textarea
          value={myNote}
          onChange={e => handleMyNoteChange(e.target.value)}
          placeholder="이 활동에 대한 메모를 자유롭게 입력하세요..."
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3
                     text-white text-sm font-medium placeholder-white/20 outline-none resize-none
                     focus:border-white/25 focus:bg-white/[0.08] transition-all"
        />
      </div>

      {/* ══════════ 3. 액션 아이템 ══════════ */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="flex items-center gap-1.5 text-[10px] font-black text-white/40 uppercase tracking-widest">
            <CheckSquare className="w-3 h-3" />액션 아이템
          </p>
          {isAdmin && !showAddAct && (
            <button onClick={() => setShowAddAct(true)}
              className="flex items-center gap-0.5 text-[10px] font-black text-white/30
                         hover:text-white/60 transition-colors px-2 py-1 rounded-lg hover:bg-white/5">
              <Plus className="w-3 h-3" />추가
            </button>
          )}
        </div>

        {isAdmin && showAddAct && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 mb-2 space-y-2">
            <input value={actContent} onChange={e => setActContent(e.target.value)}
              placeholder="할 일을 입력하세요..." autoFocus
              onKeyDown={e => { if (e.key === 'Enter') addAction(); if (e.key === 'Escape') setShowAddAct(false); }}
              className="w-full bg-white/8 border border-white/10 rounded-xl px-3 py-2
                         text-white text-xs font-medium placeholder-white/25 outline-none
                         focus:border-white/25 transition-all" />
            <div className="flex gap-2">
              <select value={actAssignee} onChange={e => setActAssignee(e.target.value)}
                className="flex-1 bg-white/8 border border-white/10 rounded-xl px-3 py-2
                           text-white text-xs outline-none focus:border-white/25 transition-all [color-scheme:dark]">
                <option value="">담당자</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <input type="date" value={actDue} onChange={e => setActDue(e.target.value)}
                className="flex-1 bg-white/8 border border-white/10 rounded-xl px-3 py-2
                           text-white text-xs outline-none focus:border-white/25 transition-all [color-scheme:dark]" />
            </div>
            <div className="flex gap-2">
              <button onClick={addAction} disabled={actAdding || !actContent.trim()}
                className="flex-1 py-2 rounded-xl bg-white text-black font-black text-xs
                           hover:bg-white/90 transition-colors disabled:opacity-40
                           flex items-center justify-center gap-1">
                {actAdding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}추가
              </button>
              <button onClick={() => { setShowAddAct(false); setActContent(''); setActAssignee(''); setActDue(''); }}
                className="px-4 py-2 rounded-xl bg-white/8 text-white/50 font-black text-xs hover:bg-white/12 transition-colors">
                취소
              </button>
            </div>
          </div>
        )}

        {actLoading ? (
          <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-white/20" /></div>
        ) : actions.length === 0 ? (
          <div className="bg-white/3 border border-white/6 rounded-2xl px-4 py-3 text-xs text-white/25 font-medium">
            {isAdmin ? '+ 추가 버튼으로 할 일을 등록하세요' : '등록된 액션 아이템이 없습니다'}
          </div>
        ) : (
          <div className="space-y-1.5">
            {actions.map(item => (
              <div key={item.id}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-colors
                  ${item.completed ? 'bg-white/3 border-white/5' : 'bg-white/6 border-white/10'}`}>
                <button onClick={() => toggleAction(item)}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all
                    ${item.completed ? 'bg-emerald-500 border-emerald-500' : 'border-white/25 hover:border-white/50'}`}>
                  {item.completed && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium leading-snug ${item.completed ? 'line-through text-white/30' : 'text-white'}`}>
                    {item.content}
                  </p>
                  <div className="flex items-center gap-2.5 mt-1 flex-wrap">
                    {item.assignee_name && (
                      <span className="flex items-center gap-1 text-[10px] text-white/35 font-medium">
                        <User className="w-2.5 h-2.5" />{item.assignee_name}
                      </span>
                    )}
                    {item.due_date && (
                      <span className="flex items-center gap-1 text-[10px] text-white/35 font-medium">
                        <Calendar className="w-2.5 h-2.5" />{item.due_date}
                      </span>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <button onClick={() => deleteAction(item.id)}
                    className="text-white/15 hover:text-red-400 transition-colors shrink-0 p-0.5 mt-0.5">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════════ 4. 작업 링크 ══════════ */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="flex items-center gap-1.5 text-[10px] font-black text-white/40 uppercase tracking-widest">
            <ExternalLink className="w-3 h-3" />작업 링크
          </p>
          {isAdmin && !showAddLnk && (
            <button onClick={() => setShowAddLnk(true)}
              className="flex items-center gap-0.5 text-[10px] font-black text-white/30
                         hover:text-white/60 transition-colors px-2 py-1 rounded-lg hover:bg-white/5">
              <Plus className="w-3 h-3" />추가
            </button>
          )}
        </div>

        {isAdmin && showAddLnk && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 mb-2 space-y-2">
            <input value={lnkUrl} onChange={e => setLnkUrl(e.target.value)}
              placeholder="URL (https://...)" type="url" autoFocus
              className="w-full bg-white/8 border border-white/10 rounded-xl px-3 py-2
                         text-white text-xs font-medium placeholder-white/25 outline-none
                         focus:border-white/25 transition-all" />
            <input value={lnkTitle} onChange={e => setLnkTitle(e.target.value)}
              placeholder="이름 (선택 — 비우면 도메인 자동 표시)"
              className="w-full bg-white/8 border border-white/10 rounded-xl px-3 py-2
                         text-white text-xs font-medium placeholder-white/25 outline-none
                         focus:border-white/25 transition-all" />
            <div className="flex gap-2">
              <button onClick={addLink} disabled={lnkAdding || !lnkUrl.trim()}
                className="flex-1 py-2 rounded-xl bg-white text-black font-black text-xs
                           hover:bg-white/90 transition-colors disabled:opacity-40
                           flex items-center justify-center gap-1">
                {lnkAdding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}추가
              </button>
              <button onClick={() => { setShowAddLnk(false); setLnkUrl(''); setLnkTitle(''); }}
                className="px-4 py-2 rounded-xl bg-white/8 text-white/50 font-black text-xs hover:bg-white/12 transition-colors">
                취소
              </button>
            </div>
          </div>
        )}

        {lnkLoading ? (
          <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-white/20" /></div>
        ) : links.length === 0 ? (
          <div className="bg-white/3 border border-white/6 rounded-2xl px-4 py-3 text-xs text-white/25 font-medium">
            {isAdmin ? '+ 추가 버튼으로 작업 링크를 등록하세요' : '등록된 링크가 없습니다'}
          </div>
        ) : (
          <div className="space-y-1.5">
            {links.map(link => (
              <div key={link.id}
                className="flex items-center gap-3 bg-white/6 border border-white/10 rounded-xl px-3 py-2.5">
                <span className="text-lg shrink-0 leading-none">{linkEmoji(link.url)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white truncate">{link.title}</p>
                  <p className="text-[10px] text-white/30 font-medium truncate">{linkDomain(link.url)}</p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <a href={link.url} target="_blank" rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-white/25 hover:text-white/70 hover:bg-white/8 transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  {isAdmin && (
                    <button onClick={() => deleteLink(link.id)}
                      className="p-1.5 rounded-lg text-white/15 hover:text-red-400 hover:bg-white/5 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
