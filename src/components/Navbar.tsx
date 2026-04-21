import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Settings2, FolderOpen, ChevronDown, ChevronRight,
  Settings, Megaphone as MegaphoneIcon, Archive as ArchiveIcon,
  RefreshCw, Check, Building2, Loader2, LogOut, Plus, Trash2,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { supabase } from '../lib/supabase';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Club {
  id: string;
  name: string;
  description?: string;
  logo_url?: string;
  deleted_at?: string | null;
}

export const Navbar: React.FC = () => {
  const { profile, isAdminMode, toggleAdminMode, signOut, activeClubId, switchClub } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch {
      /* silent */
    }
  };

  // 토글 시 해당 모드의 홈으로 이동
  const handleToggle = () => {
    toggleAdminMode();
    if (!isAdminMode) {
      // USER → ADMIN 전환
      navigate('/admin', { replace: true });
    } else {
      // ADMIN → USER 전환
      navigate('/', { replace: true });
    }
  };

  const avatarUrl   = (profile as { avatar_url?: string } | null)?.avatar_url;
  const displayName = profile?.full_name || '김부원';

  const [myClubs,         setMyClubs]         = useState<Club[]>([]);
  const [activeClubName,  setActiveClubName]  = useState<string>('');
  const [activeClubLogo,  setActiveClubLogo]  = useState<string | null>(null);
  const [isClubsLoading,  setIsClubsLoading]  = useState(false);

  // 클럽 정보 fetch (어드민 모드일 때)
  const fetchMyClubs = async () => {
    if (!profile?.id) return;
    setIsClubsLoading(true);
    try {
      const { data, error } = await supabase
        .from('clubs')
        .select('id, name, description, logo_url, deleted_at')
        .eq('admin_id', profile.id)
        .order('name');
      interface ClubRow { id: string; name: string; logo_url?: string | null; description?: string; deleted_at?: string | null; }
      if (!error && data && data.length > 0) {
        setMyClubs(data as ClubRow[]);
        // activeClubId에 맞는 클럽 정보 표시 (없으면 첫 번째)
        const rows = data as ClubRow[];
        const current = rows.find((c) => c.id === activeClubId) ?? rows[0];
        setActiveClubName(current.name);
        setActiveClubLogo(current.logo_url ?? null);
      }
    } catch (err) {
      console.error('clubs fetch error:', err);
    } finally {
      setIsClubsLoading(false);
    }
  };

  useEffect(() => {
    if (!profile?.id || !isAdminMode) return;
    fetchMyClubs();
  }, [profile?.id, isAdminMode, activeClubId]);

  // Settings 저장 후 갱신 이벤트 수신
  useEffect(() => {
    const handler = () => fetchMyClubs();
    window.addEventListener('club-settings-saved', handler);
    return () => window.removeEventListener('club-settings-saved', handler);
  }, [profile?.id]);

  const clubName = activeClubName || profile?.univ_name || 'Club DX';

  const handleSwitchClub = (club: Club & { logo_url?: string }) => {
    switchClub(club.id);          // context에 저장 → 전체 앱에서 참조
    setActiveClubName(club.name);
    setActiveClubLogo(club.logo_url ?? null);
    navigate('/admin');           // 대시보드로 이동 (state 불필요)
  };

  return (
    <nav className={cn(
      "sticky top-0 z-50 h-[58px] border-b shadow-sm transition-colors duration-300 w-full",
      isAdminMode
        ? "bg-black border-white/10 shadow-black/30 backdrop-blur-xl"
        : "bg-white border-black/10 shadow-black/5"
    )}>

      {/* Monochrome top line */}
      <div className={cn(
        "absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent to-transparent",
        isAdminMode
          ? "via-white/30"
          : "via-black/20"
      )} />

      <div className="max-w-5xl mx-auto h-full px-4 md:px-6 flex items-center justify-between">

        {/* ════ LEFT SIDE ════ */}
        {!isAdminMode ? (
          /* USER MODE */
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all
                           hover:bg-white/8 focus:outline-none
                           focus:ring-2 focus:ring-black/20 focus:ring-offset-2 focus:ring-offset-transparent"
                aria-label="프로필 퀵 메뉴"
              >
                <span className="h-8 w-8 rounded-full border border-black/15
                                 bg-black/5 shadow-sm overflow-hidden
                                 flex items-center justify-center shrink-0">
                  {avatarUrl
                    ? <img src={avatarUrl} alt="프로필" className="h-full w-full object-cover" />
                    : <span className="text-lg leading-none">🙂</span>
                  }
                </span>
                <span className="text-sm font-bold truncate max-w-[90px] text-black">
                  {displayName}
                </span>
                <ChevronDown size={13} className="text-black/40 shrink-0" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="start" sideOffset={8}
              className="border border-white/20 shadow-2xl shadow-black/40 text-white"
              style={{ background: '#111111' }}
            >
              <DropdownMenuLabel className="text-white text-xs font-black tracking-widest uppercase">
                퀵 메뉴
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                onSelect={() => navigate('/profile')}
                className="text-white hover:text-white hover:bg-white/10 focus:bg-white/10 cursor-pointer"
              >
                <Settings2 className="h-4 w-4 text-white/60 shrink-0" />
                ⚙️ 계정 정보
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => navigate('/portfolio')}
                className="text-white hover:text-white hover:bg-white/10 focus:bg-white/10 cursor-pointer"
              >
                <FolderOpen className="h-4 w-4 text-white/60 shrink-0" />
                📂 활동 이력
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                onSelect={handleSignOut}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 focus:bg-red-500/10 cursor-pointer"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                로그아웃
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

        ) : (
          /* ADMIN MODE */
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all
                           hover:bg-white/8 focus:outline-none
                           focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-transparent"
                aria-label="동아리 관리 메뉴"
              >
                <span className="w-8 h-8 rounded-xl flex items-center justify-center
                                 font-black shadow-sm text-xs shrink-0
                                 bg-white overflow-hidden border border-white/20">
                  {activeClubLogo
                    ? <img src={activeClubLogo} alt="로고" className="w-full h-full object-cover" />
                    : <span className="text-black">{clubName.slice(0, 2)}</span>
                  }
                </span>
                <span className="text-sm font-bold truncate max-w-[130px] text-white">
                  {clubName}
                </span>
                <ChevronDown size={13} className="text-white/60 shrink-0" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="start" sideOffset={8}
              className="w-56 border border-white/15 shadow-2xl shadow-black/40 text-white"
              style={{ background: '#000000' }}
            >
              <DropdownMenuLabel className="text-white/70 text-xs font-black tracking-widest uppercase">
                콘텐츠 관리
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/15" />

              <DropdownMenuItem
                onSelect={() => navigate('/admin/recruitment')}
                className="text-white bg-transparent hover:text-white hover:bg-white/20 focus:bg-white/20 cursor-pointer"
              >
                <MegaphoneIcon className="h-4 w-4 text-white/60 shrink-0" />
                <span>📢 모집 공고 관리</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onSelect={() => navigate('/admin/archive')}
                className="text-white hover:text-white hover:bg-white/10 focus:bg-white/10 cursor-pointer"
              >
                <ArchiveIcon className="h-4 w-4 text-white/60 shrink-0" />
                <span>🗂️ 동아리 아카이브</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-white/15" />
              <DropdownMenuLabel className="text-white/70 text-xs font-black tracking-widest uppercase">
                동아리
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/15" />

              <DropdownMenuItem
                onSelect={() => navigate('/admin/settings')}
                className="text-white hover:text-white hover:bg-white/10 focus:bg-white/10 cursor-pointer"
              >
                <Settings className="h-4 w-4 text-white/60 shrink-0" />
                <span>⚙️ 동아리 설정</span>
              </DropdownMenuItem>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="text-white hover:text-white hover:bg-white/10 focus:bg-white/10 cursor-pointer">
                  <RefreshCw className="h-4 w-4 text-white/60 shrink-0" />
                  <span className="flex-1">🔄 동아리 전환</span>
                  <ChevronRight className="h-3.5 w-3.5 text-white/60 ml-auto shrink-0" />
                </DropdownMenuSubTrigger>

                <DropdownMenuSubContent
                  className="w-52 border border-white/15 shadow-2xl shadow-black/40 text-white"
                  style={{ background: '#000000' }}
                >
                  {isClubsLoading ? (
                    <div className="flex items-center gap-2 px-3 py-3 text-sm text-white/50">
                      <Loader2 className="h-4 w-4 animate-spin text-white/60" />
                      불러오는 중...
                    </div>
                  ) : (
                    <>
                      {myClubs.length > 0 && (
                        <>
                          <DropdownMenuLabel className="text-[11px] text-white/70">
                            운영 중인 동아리 ({myClubs.length})
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator className="bg-white/15" />
                          {myClubs.map(club => {
                            const isDeleted = !!club.deleted_at;
                            const isActive  = activeClubId === club.id;
                            return (
                              <DropdownMenuItem
                                key={club.id}
                                onSelect={() => handleSwitchClub(club)}
                                className={cn(
                                  'cursor-pointer',
                                  isActive
                                    ? 'bg-white/20 text-white hover:bg-white/25 focus:bg-white/25'
                                    : 'text-white hover:bg-white/10 focus:bg-white/10',
                                  isDeleted && 'opacity-60',
                                )}
                              >
                                <span className="w-4 shrink-0 flex items-center justify-center">
                                  {isDeleted
                                    ? <Trash2 className="h-3.5 w-3.5 text-red-400/70" />
                                    : isActive
                                      ? <Check className="h-3.5 w-3.5 text-white" />
                                      : <Building2 className="h-3.5 w-3.5 text-white/40" />
                                  }
                                </span>
                                <span className={cn(
                                  'flex-1 truncate',
                                  isDeleted && 'line-through text-white/40',
                                )}>
                                  {club.name}
                                </span>
                                {isDeleted && (
                                  <span className="text-[10px] text-red-400/70 font-bold ml-1 shrink-0">
                                    삭제됨
                                  </span>
                                )}
                              </DropdownMenuItem>
                            );
                          })}
                          <DropdownMenuSeparator className="bg-white/15" />
                        </>
                      )}
                      {/* 신규 동아리 만들기 */}
                      <DropdownMenuItem
                        onSelect={() => navigate('/clubs/create')}
                        className="text-white/60 hover:text-white hover:bg-white/10 focus:bg-white/10 cursor-pointer"
                      >
                        <Plus className="h-4 w-4 text-white/40 shrink-0" />
                        <span>신규 동아리 만들기</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* ════ RIGHT SIDE: MODE TOGGLE ════ */}
        <div className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-sm shadow-sm transition-colors",
          isAdminMode
            ? "border border-white/20 bg-black/80"
            : "border border-black/15 bg-white"
        )}>
          <span className={cn(
            'text-[10px] font-black uppercase tracking-wider px-1',
            !isAdminMode ? 'text-black' : 'text-white/50',
          )}>
            USER
          </span>

          <button
            onClick={handleToggle}
            className={cn(
              'relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full',
              'border-2 border-transparent transition-colors duration-200 outline-none items-center shadow-inner',
              isAdminMode
                ? 'bg-white'
                : 'bg-white/20',
            )}
          >
            <span className="sr-only">운영진 모드 토글</span>
            <span className={cn(
              'pointer-events-none inline-block h-4 w-4 transform rounded-full',
              'shadow ring-0 transition duration-200 ease-in-out',
              isAdminMode
                ? 'bg-black translate-x-5'
                : 'bg-black/40 translate-x-0',
            )} />
          </button>

          <span className={cn(
            'text-[10px] font-black uppercase tracking-wider px-1',
            isAdminMode ? 'text-white' : 'text-white/50',
          )}>
            ADMIN
          </span>
        </div>

      </div>
    </nav>
  );
};
