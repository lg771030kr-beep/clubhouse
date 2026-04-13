import React from 'react';

interface SectionHeaderProps {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, icon, action }) => {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2">
        {icon && <span className="flex items-center">{icon}</span>}
        <h2 className="text-base font-bold text-slate-800">{title}</h2>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};
