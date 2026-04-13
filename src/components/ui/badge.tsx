import * as React from 'react';

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'secondary' | 'outline';
};

export function Badge({ className = '', variant = 'default', ...props }: BadgeProps) {
  const variantClass =
    variant === 'secondary'
      ? 'bg-slate-100 text-slate-700'
      : variant === 'outline'
        ? 'border border-slate-200 text-slate-700'
        : 'bg-blue-100 text-blue-700';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${variantClass} ${className}`.trim()}
      {...props}
    />
  );
}
