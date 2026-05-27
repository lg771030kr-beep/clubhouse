import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SocialLoginButtons } from '../../components/auth/SocialLoginButtons';

type MemberType = 'personal' | 'corp';

export const Login: React.FC = () => {
  const { signIn, user, loading: authLoading, hasClub } = useAuth();
  const navigate = useNavigate();

  const [memberType, setMemberType] = useState<MemberType>('personal');
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [error,      setError]      = useState('');
  const [submitting, setSubmitting] = useState(false);

  /**
   * signIn() 직후 navigate 금지 — onAuthStateChange 완료 후 여기서만 처리
   */
  useEffect(() => {
    if (!authLoading && user) {
      navigate(hasClub ? '/dashboard' : '/welcome', { replace: true });
    }
  }, [authLoading, user, hasClub, navigate]);

  const handleTypeSwitch = (type: MemberType) => {
    setMemberType(type);
    setError('');
    setEmail('');
    setPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn(email, password);
      // navigate는 useEffect가 처리 — 여기서 호출 금지
    } catch {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white rounded-2xl mb-4 shadow-lg">
            <span className="text-black font-black text-xl">DX</span>
          </div>
          <h1 className="text-white font-black text-2xl tracking-tight">Club DX</h1>
          <p className="text-white/50 text-sm mt-1">동아리 관리 플랫폼</p>
        </div>

        {/* 회원 유형 토글 */}
        <div className="flex bg-white/[0.07] rounded-xl p-1 mb-6">
          {(['personal', 'corp'] as MemberType[]).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => handleTypeSwitch(type)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                memberType === type
                  ? 'bg-white text-black shadow-sm'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {type === 'personal' ? '일반회원' : '기업·기관'}
            </button>
          ))}
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
            <label className="text-white/60 text-xs font-semibold tracking-widest uppercase">
              {memberType === 'personal' ? '학교 이메일' : '업무 이메일'}
            </label>
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={memberType === 'personal' ? '학교 이메일 주소' : '업무용 이메일 주소'}
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

        {/* 소셜 로그인 */}
        <div className="mt-5">
          <SocialLoginButtons />
        </div>

        {/* 하단 링크 */}
        <div className="mt-6 flex items-center justify-center gap-3 text-sm">
          <Link
            to={`/signup?type=${memberType}`}
            className="text-white/50 hover:text-white transition-colors"
          >
            회원가입
          </Link>
          <span className="text-white/20">|</span>
          <Link
            to={`/find-account?tab=id&type=${memberType}`}
            className="text-white/50 hover:text-white transition-colors"
          >
            아이디 찾기
          </Link>
          <span className="text-white/20">|</span>
          <Link
            to={`/find-account?tab=pw&type=${memberType}`}
            className="text-white/50 hover:text-white transition-colors"
          >
            비밀번호 찾기
          </Link>
        </div>

      </div>
    </div>
  );
};
