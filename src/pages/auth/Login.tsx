import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Login: React.FC = () => {
  const { signIn, user, loading: authLoading, hasClub } = useAuth();
  const navigate = useNavigate();

  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [error,      setError]      = useState('');
  const [submitting, setSubmitting] = useState(false);

  /**
   * ★ 핵심 수정: navigate를 handleSubmit에서 제거하고 여기서만 처리
   *    signIn() 직후 navigate하면 onAuthStateChange가 아직 안 터진 상태(loading=false, hasClub=false)
   *    이므로 Dashboard가 /welcome으로 튕긴다.
   *    authLoading이 false가 된 뒤 user 확인 → 그때 navigate.
   */
  useEffect(() => {
    if (!authLoading && user) {
      navigate(hasClub ? '/dashboard' : '/welcome', { replace: true });
    }
  }, [authLoading, user, hasClub, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn(email, password);
      // navigate는 위 useEffect가 처리 — 여기서 navigate 호출 금지
    } catch {
      // 내부 에러 메시지(DB 구조, 스택 트레이스 등) 노출 방지
      setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      setSubmitting(false);
    }
    // finally에서 setSubmitting(false) 하지 않음 — navigate 전까지 스피너 유지
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* 로고 */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white rounded-2xl mb-4 shadow-lg">
            <span className="text-black font-black text-xl">DX</span>
          </div>
          <h1 className="text-white font-black text-2xl tracking-tight">Club DX</h1>
          <p className="text-white/50 text-sm mt-1">동아리 관리 플랫폼</p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-white/60 text-xs font-semibold tracking-widest uppercase">이메일</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="이메일 주소"
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3
                           text-white placeholder-white/25 text-sm outline-none
                           focus:border-white/30 focus:bg-white/[0.08] transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-white/60 text-xs font-semibold tracking-widest uppercase">비밀번호</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="비밀번호"
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3
                           text-white placeholder-white/25 text-sm outline-none
                           focus:border-white/30 focus:bg-white/[0.08] transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || authLoading}
            className="w-full bg-white text-black font-bold py-3 rounded-xl mt-2
                       hover:bg-white/90 active:scale-[0.98] transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2 text-sm"
          >
            {(submitting || authLoading) && <Loader2 size={16} className="animate-spin" />}
            {(submitting || authLoading) ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p className="text-center text-white/40 text-sm mt-6">
          아직 계정이 없으신가요?{' '}
          <Link to="/signup" className="text-white font-semibold hover:underline underline-offset-2">
            회원가입
          </Link>
        </p>

      </div>
    </div>
  );
};
