import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  message: string;
  sub?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, message, sub, action }) => {
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-slate-400">
      <span className="flex items-center justify-center">{icon}</span>
      <p className="text-sm font-medium text-slate-500">{message}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
      {action && <div>{action}</div>}
    </div>
  );
};
