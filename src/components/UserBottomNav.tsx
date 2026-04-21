import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Activity, Megaphone, Rocket, User } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const items = [
  { to: '/dashboard', label: '홈', icon: LayoutDashboard },
  { to: '/portfolio', label: '활동 이력', icon: Activity },
  { to: '/user/recruitments', label: '동아리 찾기', icon: Megaphone },
  { to: '/explore/projects', label: '프로젝트', icon: Rocket },
  { to: '/profile', label: '프로필', icon: User },
] as const;

export const UserBottomNav: React.FC = () => {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-black/10 bg-white/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden"
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
                    ? 'text-black bg-black/8'
                    : 'text-black/40 hover:text-black/70'
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
