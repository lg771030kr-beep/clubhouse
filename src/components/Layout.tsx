import React from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { Navbar } from './Navbar';
import { UserBottomNav } from './UserBottomNav';
import { AdminBottomNav } from './AdminBottomNav';
import { OrgBottomNav } from './OrgBottomNav';
import { useAuth } from '../context/AuthContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const AUTH_PATHS    = ['/login', '/signup', '/find-account', '/reset-password'];
const FULLPAGE_PATHS = ['/welcome', '/clubs/create'];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading, isAdminMode, user, profile } = useAuth();
  const location = useLocation();
  const isAuthPage     = AUTH_PATHS.includes(location.pathname);
  const isFullPage     = FULLPAGE_PATHS.some(p => location.pathname.startsWith(p));
  const isScheduleArea = location.pathname.startsWith('/schedule');
  const isOrgMode      = location.pathname.startsWith('/org');

  /* 로딩 중 — 스피너 */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
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

  /* 인증 페이지 (/login, /signup) — 프로필까지 완성된 경우만 대시보드로 */
  if (isAuthPage) {
    if (user && profile) return <Navigate to="/dashboard" replace />;
    return <>{children}</>;
  }

  /* 비로그인 — 로그인 페이지로 */
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  /* 웰컴/동아리 생성 등 전체화면 페이지 — Navbar 없이 렌더 */
  if (isFullPage) {
    return <>{children}</>;
  }

  /* ── Org 모드: 회색 테마, 자체 레이아웃 ── */
  if (isOrgMode) {
    return (
      <div className="min-h-screen bg-[#f5f5f5]">
        <main className="w-full overflow-x-hidden pb-24">
          {children}
        </main>
        <OrgBottomNav />
      </div>
    );
  }

  return (
    <div className={cn('min-h-screen transition-colors duration-300', !isAdminMode && 'bg-black')}>
      <Navbar />
      <main className={cn(
        'w-full overflow-x-hidden',
        isAdminMode
          ? 'p-0 pb-16'
          : cn(
              'min-w-0 p-4 md:p-6',
              'pb-28 md:pb-6',
            ),
      )}>
        {children}
      </main>
      {isAdminMode  && <AdminBottomNav />}
      {!isAdminMode && <UserBottomNav />}
    </div>
  );
};
