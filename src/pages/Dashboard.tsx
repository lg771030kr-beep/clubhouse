import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserDashboard } from './user/Dashboard';
import { AdminDashboard } from './admin/AdminDashboard';

export const Dashboard: React.FC = () => {
  const { isAdminMode, user, loading, hasClub } = useAuth();

  // 1. Auth 로딩 중 → 아무것도 표시 안 함
  if (loading) return null;

  // 2. 비로그인 or 동아리 소속 없음 → 웰컴
  if (!user || !hasClub) return <Navigate to="/welcome" replace />;

  // 3. 동아리 있음 → 모드에 따라 대시보드
  return isAdminMode ? <AdminDashboard /> : <UserDashboard />;
};
