import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Role } from '../types';

interface ProtectedRouteProps {
  allowedRoles?: Role[];
  redirectPath?: string;
}

export function ProtectedRoute({ allowedRoles, redirectPath = '/' }: ProtectedRouteProps) {
  const { user, profile, loading, isAdminMode } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // MVP: 로그인 여부와 관계없이 토글된 상태(isAdminMode)만으로 관리자 페이지 접근을 제어합니다.
  if (!isAdminMode) {
    console.warn('[ProtectedRoute] Blocked: isAdminMode is false');
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
