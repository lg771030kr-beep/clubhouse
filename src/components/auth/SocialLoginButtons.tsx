import React, { useState } from 'react';

/* ── 나중에 연결 시 이 함수만 채우면 됨 ── */
// import { supabase } from '../../lib/supabase';
// const signInWith = (provider: 'google' | 'kakao' | 'apple') =>
//   supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });

/* ══════════════════════════════════════════════
   소셜 로그인 버튼 묶음
══════════════════════════════════════════════ */
export const SocialLoginButtons: React.FC = () => {
  const [hint, setHint] = useState('');

  const handleClick = (label: string) => {
    setHint(`${label} 연동 준비 중이에요`);
    setTimeout(() => setHint(''), 2200);
  };

  return (
    <div className="space-y-2.5">
      {/* 구분선 */}
      <div className="flex items-center gap-3 py-1">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-white/30 text-xs font-medium tracking-wide">소셜 로그인</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* Google */}
      <button
        type="button"
        onClick={() => handleClick('Google')}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl
                   bg-white/[0.05] border border-white/10
                   hover:bg-white/[0.09] hover:border-white/20
                   active:scale-[0.98] transition-all"
      >
        <GoogleIcon />
        <span className="text-white/75 text-sm font-medium">Google로 계속하기</span>
      </button>

      {/* Kakao */}
      <button
        type="button"
        onClick={() => handleClick('카카오')}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl
                   bg-[#FEE500]/10 border border-[#FEE500]/20
                   hover:bg-[#FEE500]/[0.16] hover:border-[#FEE500]/40
                   active:scale-[0.98] transition-all"
      >
        <KakaoIcon />
        <span className="text-[#FEE500]/80 text-sm font-medium">카카오로 계속하기</span>
      </button>

      {/* Apple */}
      <button
        type="button"
        onClick={() => handleClick('Apple')}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl
                   bg-white/[0.05] border border-white/10
                   hover:bg-white/[0.09] hover:border-white/20
                   active:scale-[0.98] transition-all"
      >
        <AppleIcon />
        <span className="text-white/75 text-sm font-medium">Apple로 계속하기</span>
      </button>

      {/* 준비 중 힌트 */}
      {hint && (
        <p className="text-center text-white/35 text-xs pt-0.5">
          {hint} 👀
        </p>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════
   아이콘 SVG
══════════════════════════════════════════════ */
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const KakaoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0" fill="#FEE500">
    <path d="M12 3C6.477 3 2 6.6 2 11.05c0 2.82 1.8 5.3 4.52 6.82-.18.68-.67 2.48-.77 2.87-.12.5.18.49.38.36.16-.1 2.5-1.7 3.52-2.4.77.11 1.57.18 2.35.18 5.52 0 10-3.6 10-8.05C22 6.6 17.52 3 12 3z"/>
  </svg>
);

const AppleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0" fill="white">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
);
