import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, CalendarDays, ClipboardList, Users,
  CheckCheck, X, Info, Loader2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

/* ══════════════════════════ 타입 ══════════════════════════ */
interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: 'schedule' | 'attendance' | 'assignment' | 'member' | 'general';
  link: string | null;
  read_at: string | null;
  created_at: string;
}

/* ══════════════════════════ 헬퍼 ══════════════════════════ */
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return '방금';
  if (mins  < 60) return `${mins}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days  < 7)  return `${days}일 전`;
  const d = new Date(dateStr);
  return `${d.getMonth()+1}월 ${d.getDate()}일`;
}

function TypeIcon({ type }: { type: Notification['type'] }) {
  const base = 'w-4 h-4 shrink-0';
  switch (type) {
    case 'schedule':   return <CalendarDays  className={`${base} text-blue-500`}  />;
    case 'attendance': return <CheckCheck    className={`${base} text-emerald-500`}/>;
    case 'assignment': return <ClipboardList className={`${base} text-amber-500`} />;
    case 'member':     return <Users         className={`${base} text-purple-500`}/>;
    default:           return <Info          className={`${base} text-black/40`}  />;
  }
}

/* ══════════════════════════ 컴포넌트 ══════════════════════════ */
export const NotificationBell: React.FC<{ isAdmin?: boolean }> = ({ isAdmin = false }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open,    setOpen]    = useState(false);
  const [notifs,  setNotifs]  = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unread = notifs.filter(n => !n.read_at).length;

  /* ── fetch ── */
  const fetchNotifs = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      setNotifs((data ?? []) as Notification[]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  /* ── realtime 구독 ── */
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, payload => {
        setNotifs(prev => [payload.new as Notification, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  /* ── 바깥 클릭 닫기 ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  /* ── 읽음 처리 ── */
  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  };

  const markAllRead = async () => {
    if (!user?.id) return;
    const unreadIds = notifs.filter(n => !n.read_at).map(n => n.id);
    if (!unreadIds.length) return;
    await supabase.from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds);
    setNotifs(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  };

  const handleClick = async (n: Notification) => {
    if (!n.read_at) await markRead(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  /* 색상 팔레트 */
  const bellColor = isAdmin ? 'text-white/70 hover:text-white' : 'text-black/60 hover:text-black';
  const badgeBg   = 'bg-red-500';

  return (
    <div className="relative" ref={panelRef}>
      {/* ── 벨 버튼 ── */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`relative w-9 h-9 flex items-center justify-center rounded-xl transition-colors
                    ${isAdmin ? 'hover:bg-white/10' : 'hover:bg-black/6'}`}
        aria-label="알림"
      >
        <Bell className={`w-5 h-5 ${bellColor} transition-colors`} />
        {unread > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1
                            ${badgeBg} rounded-full text-white text-[9px] font-black
                            flex items-center justify-center leading-none`}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* ── 알림 패널 ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{   opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-full mt-2 w-80 max-h-[480px]
                       bg-white rounded-2xl shadow-2xl shadow-black/20
                       border border-black/10 overflow-hidden z-[200] flex flex-col"
          >
            {/* 패널 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/8">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-black/50" />
                <span className="text-sm font-black text-black">알림</span>
                {unread > 0 && (
                  <span className="px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-black rounded-full">
                    {unread}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[11px] font-black text-black/40 hover:text-black transition-colors px-2 py-1 rounded-lg hover:bg-black/5"
                  >
                    모두 읽음
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-black/6 transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-black/40" />
                </button>
              </div>
            </div>

            {/* 알림 목록 */}
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="flex items-center justify-center py-10 gap-2 text-black/30">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs font-black">불러오는 중...</span>
                </div>
              ) : notifs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <Bell className="w-8 h-8 text-black/10 mb-3" />
                  <p className="text-sm font-black text-black/30">알림이 없습니다</p>
                  <p className="text-xs text-black/20 mt-1 font-medium">새로운 알림이 오면 여기에 표시됩니다</p>
                </div>
              ) : (
                <div className="divide-y divide-black/5">
                  {notifs.map(n => (
                    <button
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors
                        ${!n.read_at
                          ? 'bg-blue-50/60 hover:bg-blue-50'
                          : 'hover:bg-black/[0.02]'}`}
                    >
                      {/* 타입 아이콘 */}
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5
                        ${!n.read_at ? 'bg-white shadow-sm border border-black/8' : 'bg-black/5'}`}>
                        <TypeIcon type={n.type} />
                      </div>

                      {/* 내용 */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-snug truncate
                          ${!n.read_at ? 'font-black text-black' : 'font-medium text-black/70'}`}>
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="text-xs text-black/45 mt-0.5 font-medium leading-relaxed line-clamp-2">
                            {n.body}
                          </p>
                        )}
                        <p className="text-[10px] text-black/30 font-medium mt-1">
                          {timeAgo(n.created_at)}
                        </p>
                      </div>

                      {/* 읽지 않음 점 */}
                      {!n.read_at && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 패널 푸터 */}
            {notifs.length > 0 && (
              <div className="border-t border-black/6 px-4 py-2.5 text-center">
                <p className="text-[11px] text-black/25 font-medium">최근 30개 알림 표시</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
