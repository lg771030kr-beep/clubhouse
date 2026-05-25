import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Archive, Building2 } from 'lucide-react';

export const AdminBottomNav: React.FC = () => {
  const navigate  = useNavigate();
  const { pathname } = useLocation();

  const isArchive  = pathname.startsWith('/admin/archive');
  const isActivity = pathname.startsWith('/admin/activity');
  const isHome     = !isArchive && !isActivity;

  const cls = (active: boolean) =>
    `flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors
     ${active ? 'text-white' : 'text-white/35 hover:text-white/60'}`;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-black border-t border-white/10">
      <div className="flex">

        {/* 아카이브 */}
        <button onClick={() => navigate('/admin/archive')} className={cls(isArchive)}>
          <Archive className="w-5 h-5" />
          <span className="text-[10px] font-black tracking-wide">아카이브</span>
        </button>

        {/* 홈 */}
        <button onClick={() => navigate('/admin')} className={cls(isHome)}>
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-black tracking-wide">홈</span>
        </button>

        {/* 기관·활동 */}
        <button onClick={() => navigate('/admin/activity')} className={cls(isActivity)}>
          <Building2 className="w-5 h-5" />
          <span className="text-[10px] font-black tracking-wide">기관·활동</span>
        </button>

      </div>
    </div>
  );
};
