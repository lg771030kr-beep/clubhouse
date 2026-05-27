import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Compass, Activity } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const items = [
  { to: '/portfolio',          label: '내 활동',      icon: Activity },
  { to: '/dashboard',          label: '홈',           icon: LayoutDashboard },
  { to: '/explore/activities', label: '다른 활동 찾기', icon: Compass },
] as const;

export const UserBottomNav: React.FC = () => {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/8 bg-black/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden"
      aria-label="주요 메뉴"
    >
      <ul className="flex items-stretch justify-around gap-0 px-1 py-1.5">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to} className="min-w-0 flex-1">
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[10px] font-bold transition-colors',
                  isActive
                    ? 'text-white bg-white/10'
                    : 'text-white/40 hover:text-white/70'
                )
              }
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={2.2} />
              <span className="truncate px-0.5">{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};
