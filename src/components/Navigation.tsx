import React, { useState } from 'react';
import { LogOut, User, Shield, LayoutDashboard, Settings, Users, Calendar, Menu, X, UserCheck, Plus, Loader2, Megaphone, Rocket } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { Link, useLocation, useNavigate } from 'react-router-dom';

export const Sidebar: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { isAdminMode, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch { /* ignore */ } finally {
      navigate('/login');
    }
  };

  // Club Creation Modal
  const [isCreatingClub, setIsCreatingClub] = useState(false);
  const [isSubmittingClub, setIsSubmittingClub] = useState(false);
  const [newClub, setNewClub] = useState({ name: '', description: '' });

  const handleCreateClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return alert("로그인이 필요합니다.");

    try {
      setIsSubmittingClub(true);
      const { error: clubError } = await supabase
        .from('clubs')
        .insert([{
          name: newClub.name,
          description: newClub.description,
          admin_id: profile.id
        }]);

      if (clubError) throw clubError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          role: 'LEADER',
          univ_name: newClub.name
        })
        .eq('id', profile.id);

      if (profileError) throw profileError;

      alert(`'${newClub.name}' 동아리 개설이 완료되었습니다! \n상단 토글을 통해 [운영진 모드]를 활성화하시면 관리자 패널 이용이 가능합니다.`);
      setIsCreatingClub(false);
      window.location.reload();

    } catch (err: any) {
      console.error(err);
      alert('동아리 개설 실패: ' + err.message);
    } finally {
      setIsSubmittingClub(false);
    }
  };

  const userLinks = [
    { icon: LayoutDashboard, label: '대시보드', path: '/dashboard' },
    { icon: UserCheck, label: '포트폴리오', path: '/portfolio' },
    { icon: User, label: '마이페이지', path: '/profile' },
  ];

  const discoveryLinks = [
    { icon: Megaphone, label: '동아리 모집', path: '/explore/recruitment' },
    { icon: Rocket, label: '프로젝트 둘러보기', path: '/explore/projects' },
  ];

  const adminLinks = [
    { icon: Shield, label: '관리자 패널', path: '/admin' },
    { icon: Users, label: '부원 관리', path: '/admin/members' },
    { icon: Calendar, label: '행사 및 일정', path: '/admin/schedules' },
    { icon: Settings, label: '동아리 설정', path: '/admin/settings' },
  ];

  const showAdminMenu = isAdminMode;
  const links = showAdminMenu ? adminLinks : userLinks;

  const renderLink = (link: any) => {
    const isExactMatch = location.pathname === link.path;
    const isSubPathMatch = link.path !== '/' && link.path !== '/admin' && location.pathname.startsWith(`${link.path}/`);
    const isActive = isExactMatch || isSubPathMatch;

    return (
      <Link
        key={link.label}
        to={link.path}
        onClick={onClose}
        className={cn(
          "flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-200",
          isActive
            ? "bg-black text-white shadow-sm"
            : "text-black/70 hover:bg-black/5 hover:text-black"
        )}
      >
        <link.icon size={18} />
        {link.label}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        "fixed md:sticky top-16 left-0 z-40 w-64 h-[calc(100vh-64px)] flex flex-col transition-all duration-300 ease-in-out border-r",
        "bg-white/95 border-black/10",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        {/* 상단 섹션: 로고 */}
        <div className="w-full px-6 py-5 border-b shrink-0 flex items-center justify-between border-black/10 bg-black/3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white shadow-sm text-sm bg-black">
              DX
            </div>
            <span className="font-bold tracking-tight text-black">
              {showAdminMenu ? "ADMIN MODE" : "CLUB DX"}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-black/5 rounded-lg md:hidden">
            <X size={20} className="text-black/40" />
          </button>
        </div>

        {/* 중간 섹션 (조건부 메뉴 리스트) */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          <div className="space-y-1">
            {links.map(renderLink)}
          </div>

          {!showAdminMenu && (
            <div className="rounded-2xl border border-black/10 bg-black/3 p-3">
              <p className="px-1 text-xs font-semibold text-black/40 tracking-wide mb-2">발견하기</p>
              <div className="space-y-1">
                {discoveryLinks.map(renderLink)}
              </div>
            </div>
          )}
        </nav>

        {/* 하단 섹션 (고정): 구분선 + [신규 동아리 만들기] 버튼 및 로그아웃 */}
        <div className="shrink-0 w-full">
          <div className="w-full h-px bg-black/15" />
          <div className="p-4 space-y-3 bg-white/50 backdrop-blur-md">
            <button
              onClick={() => setIsCreatingClub(true)}
              className="w-full py-3 outline-none rounded-xl font-black text-sm text-center transition-all flex items-center justify-center gap-2 border active:scale-95
                         bg-black/8 hover:bg-black/12 text-black border-black/15"
            >
              <Plus className="w-4 h-4" />
              신규 동아리 만들기
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold w-full transition-colors text-red-500 hover:bg-red-50"
            >
              <LogOut size={16} />
              로그아웃
            </button>
          </div>
        </div>
      </aside>

      {/* Club Creation Modal */}
      <AnimatePresence>
        {isCreatingClub && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreatingClub(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative bg-white w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="w-12 h-1.5 bg-black/15 rounded-full mx-auto my-4 sm:hidden"></div>

              <div className="shrink-0 px-6 sm:px-8 pb-4 sm:pt-8 border-b border-black/10 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-black">신규 동아리 개설</h3>
                  <p className="text-xs text-black/50 mt-1">개설 즉시 운영진 권한이 부여됩니다.</p>
                </div>
                <button onClick={() => setIsCreatingClub(false)} className="p-2 hover:bg-black/5 rounded-xl transition-colors hidden sm:block">
                  <X size={24} className="text-black/50" />
                </button>
              </div>

              <form onSubmit={handleCreateClub} className="p-6 sm:p-8 space-y-5 overflow-y-auto w-full text-left">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-black/80">동아리 이름 <span className="text-red-500">*</span></label>
                  <input
                    required
                    type="text"
                    value={newClub.name}
                    onChange={e => setNewClub({...newClub, name: e.target.value})}
                    placeholder="예: CLUB DX 개발팀"
                    className="w-full p-4 rounded-xl bg-black/3 border border-black/15 outline-none focus:border-black font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-black/80">동아리 설명</label>
                  <textarea
                    value={newClub.description}
                    onChange={e => setNewClub({...newClub, description: e.target.value})}
                    placeholder="동아리에 대한 간단한 설명을 적어주세요."
                    className="w-full p-4 rounded-xl bg-black/3 border border-black/15 outline-none focus:border-black font-medium h-24 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingClub}
                  className="w-full py-4 mt-2 bg-black text-white rounded-xl font-bold hover:bg-black/90 active:scale-95 transition-all shadow-md disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {isSubmittingClub ? <><Loader2 className="w-5 h-5 animate-spin" /> 개설 중...</> : '동아리 개설하기'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
