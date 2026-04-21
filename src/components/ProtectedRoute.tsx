import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-10 h-10 border-2 border-t-white border-r-transparent border-b-transparent
                        border-l-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 서버에서 가져온 실제 role로 판단 — 클라이언트 토글 상태(isAdminMode)는 신뢰하지 않음
  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'LEADER';
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
