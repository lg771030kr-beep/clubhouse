import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Settings2, FolderOpen, ChevronDown, ChevronRight,
  Settings, Megaphone as MegaphoneIcon, Rocket as RocketIcon,
  RefreshCw, Check, Building2, Loader2,
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
}

export const Navbar: React.FC = () => {
  const { profile, isAdminMode, toggleAdminMode } = useAuth();
  const navigate = useNavigate();

  const avatarUrl   = (profile as any)?.avatar_url as string | undefined;
  const displayName = profile?.full_name || '김부원';
  const clubName    = profile?.univ_name || 'Club DX';

  const [myClubs,         setMyClubs]         = useState<Club[]>([]);
  const [activeClubId,    setActiveClubId]    = useState<string | null>(null);
  const [isClubsLoading,  setIsClubsLoading]  = useState(false);

  useEffect(() => {
    if (!profile?.id || !isAdminMode) return;
    const fetchMyClubs = async () => {
      setIsClubsLoading(true);
      try {
        const { data, error } = await supabase
          .from('clubs')
          .select('id, name, description')
          .eq('admin_id', profile.id)
          .order('name');
        if (!error && data) {
          setMyClubs(data as Club[]);
          const current = (data as Club[]).find(c => c.name === profile.univ_name);
          if (current) setActiveClubId(current.id);
        }
      } catch (err) {
        console.error('clubs fetch error:', err);
      } finally {
        setIsClubsLoading(false);
      }
    };
    fetchMyClubs();
  }, [profile?.id, profile?.univ_name, isAdminMode]);

  const handleSwitchClub = (club: Club) => {
    setActiveClubId(club.id);
    navigate('/admin', { state: { clubId: club.id, clubName: club.name } });
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
                📂 포트폴리오
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
                                 font-black text-white shadow-sm text-xs shrink-0
                                 bg-white">
                  {clubName.slice(0, 2)}
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
                onSelect={() => navigate('/admin/projects')}
                className="text-white hover:text-white hover:bg-white/10 focus:bg-white/10 cursor-pointer"
              >
                <RocketIcon className="h-4 w-4 text-white/60 shrink-0" />
                <span>🚀 프로젝트 관리</span>
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
                  ) : myClubs.length === 0 ? (
                    <div className="px-3 py-3 text-center space-y-1">
                      <Building2 className="h-6 w-6 text-white/40 mx-auto" />
                      <p className="text-xs text-white/50 font-medium">운영 중인 동아리가 없습니다</p>
                    </div>
                  ) : (
                    <>
                      <DropdownMenuLabel className="text-[11px] text-white/70">
                        운영 중인 동아리 ({myClubs.length})
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-white/15" />
                      {myClubs.map(club => (
                        <DropdownMenuItem
                          key={club.id}
                          onSelect={() => handleSwitchClub(club)}
                          className={cn(
                            'text-white hover:text-white hover:bg-white/10 focus:bg-white/10 cursor-pointer',
                            activeClubId === club.id && 'bg-white/20 text-white',
                          )}
                        >
                          <span className="w-4 shrink-0 flex items-center justify-center">
                            {activeClubId === club.id
                              ? <Check className="h-3.5 w-3.5 text-white" />
                              : <Building2 className="h-3.5 w-3.5 text-white/40" />
                            }
                          </span>
                          <span className="flex-1 truncate">{club.name}</span>
                        </DropdownMenuItem>
                      ))}
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
            onClick={toggleAdminMode}
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
