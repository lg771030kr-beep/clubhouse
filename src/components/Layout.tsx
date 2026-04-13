import React from 'react';
import { useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { useAuth } from '../context/AuthContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading, isAdminMode } = useAuth();
  const location = useLocation();
  const isScheduleArea = location.pathname.startsWith('/schedule');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-full border-2 border-cyan-500/30 animate-ping absolute inset-0" />
            <div className="w-14 h-14 border-2 border-t-cyan-400 border-r-transparent border-b-transparent
                            border-l-transparent rounded-full animate-spin" />
          </div>
          <p className="text-cyan-300 font-bold animate-pulse tracking-wide">Club DX 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('min-h-screen transition-colors duration-300', !isAdminMode && 'bg-black')}>
      <Navbar />
      <main className={cn(
        'w-full overflow-x-hidden',
        isAdminMode
          ? 'p-0'
          : cn(
              'min-w-0 p-4 md:p-6',
              isScheduleArea ? 'pb-20 md:pb-14' : 'pb-12 md:pb-6',
            ),
      )}>
        {children}
      </main>
    </div>
  );
};
