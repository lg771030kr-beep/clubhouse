import * as React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
};

export function Button({
  className = '',
  variant = 'default',
  size = 'default',
  type = 'button',
  ...props
}: ButtonProps) {
  const variantClass =
    variant === 'secondary'
      ? 'bg-slate-100 text-slate-900 hover:bg-slate-200'
      : variant === 'outline'
        ? 'border border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
        : variant === 'ghost'
          ? 'text-slate-700 hover:bg-slate-100'
          : 'bg-blue-600 text-white hover:bg-blue-700';

  const sizeClass =
    size === 'sm'
      ? 'h-8 px-3 text-sm'
      : size === 'lg'
        ? 'h-11 px-6 text-base'
        : 'h-10 px-4 text-sm';

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${variantClass} ${sizeClass} ${className}`.trim()}
      {...props}
    />
  );
}
