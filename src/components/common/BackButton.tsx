import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface BackButtonProps {
  /** 이동할 경로. 기본값: '/dashboard' */
  to?: string;
  /** 버튼 레이블. 기본값: '뒤로가기' */
  label?: string;
  /** 추가 Tailwind 클래스 (색상 오버라이드 등) */
  className?: string;
  /** to 대신 직접 핸들러를 넘길 때 사용 */
  onClick?: () => void;
}

export const BackButton: React.FC<BackButtonProps> = ({
  to = '/dashboard',
  label = '뒤로가기',
  className = '',
  onClick,
}) => {
  const navigate = useNavigate();
  const { isAdminMode } = useAuth();

  const colorCls = isAdminMode
    ? 'text-black/60 hover:text-black'
    : 'text-white/70 hover:text-white';

  return (
    <button
      onClick={onClick ?? (() => navigate(to))}
      className={`inline-flex items-center gap-1.5 mb-5 text-sm font-bold transition-colors group ${colorCls} ${className}`}
    >
      <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
      {label}
    </button>
  );
};
