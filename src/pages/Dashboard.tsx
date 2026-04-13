import React from 'react';
import { useAuth } from '../context/AuthContext';
import { UserDashboard } from './user/Dashboard';
import { AdminDashboard } from './admin/AdminDashboard';

export const Dashboard: React.FC = () => {
  const { isAdminMode } = useAuth();
  
  if (isAdminMode) {
    return <AdminDashboard />;
  }
  
  return <UserDashboard />;
};
