import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute() {
  const { profile, loading, isAdminMode } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-10 h-10 border-2 border-t-white border-r-transparent border-b-transparent
                        border-l-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // profile.role 기반 체크 + enterAdminMode()로 club_members 검증 후 진입한 경우도 허용
  const isAdmin =
    profile?.role === 'ADMIN' ||
    profile?.role === 'LEADER' ||
    isAdminMode;   // club_members CAPTAIN/LEADER 확인 후 앱 레벨에서 승인된 상태

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
