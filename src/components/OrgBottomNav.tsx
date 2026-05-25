import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Users, BarChart3, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/org',          icon: LayoutDashboard, label: '홈'       },
  { to: '/org/programs', icon: FolderKanban,    label: '프로그램' },
  { to: '/org/members',  icon: Users,           label: '멤버'     },
  { to: '/org/analytics',icon: BarChart3,       label: '통계'     },
  { to: '/org/settings', icon: Settings,        label: '설정'     },
];

export const OrgBottomNav: React.FC = () => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-pb">
      <div className="flex items-stretch max-w-2xl mx-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
          /* /org/programs/new なども /org/programs 扱い */
          const isActive = to === '/org'
            ? location.pathname === '/org'
            : location.pathname.startsWith(to);

          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/org'}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors"
            >
              <Icon
                className={`w-5 h-5 transition-all ${isActive ? 'text-gray-900' : 'text-gray-350'}`}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              <span className={`text-[9px] font-black tracking-wide ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                {label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 w-6 h-0.5 bg-gray-900 rounded-full" />
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
