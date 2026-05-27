import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Mail, User, Phone, AlertCircle, Loader2, CheckCircle2, ChevronLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Tab        = 'id' | 'pw';
type MemberType = 'personal' | 'corp';

/* 이메일 마스킹: test@school.ac.kr → tes***@school.ac.kr */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, Math.min(3, local.length));
  const masked  = '*'.repeat(Math.max(local.length - visible.length, 3));
  return `${visible}${masked}@${domain}`;
}

/* 전화번호 포맷 */
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

/* ══════════════════════════════════════════════════════════
   메인 컨테이너
══════════════════════════════════════════════════════════ */
export const FindAccount: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab        = (searchParams.get('tab')  === 'pw' ? 'pw' : 'id')         as Tab;
  const memberType = (searchParams.get('type') === 'corp' ? 'corp' : 'personal') as MemberType;

  const setTab        = (t: Tab)        => setSearchParams({ tab: t,    type: memberType });
  const setMemberType = (t: MemberType) => setSearchParams({ tab,       type: t });

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white rounded-2xl mb-4 shadow-lg">
            <span className="text-black font-black text-xl">DX</span>
          </div>
          <h1 className="text-white font-black text-2xl tracking-tight">계정 찾기</h1>
          <p className="text-white/50 text-sm mt-1">등록된 정보로 계정을 확인하세요</p>
        </div>

        {/* 회원 유형 토글 */}
        <div className="flex bg-white/[0.07] rounded-xl p-1 mb-5">
          {(['personal', 'corp'] as MemberType[]).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => setMemberType(type)}
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

        {/* 탭: 아이디 찾기 / 비밀번호 찾기 */}
        <div className="flex border-b border-white/10 mb-6">
          {([['id', '아이디 찾기'], ['pw', '비밀번호 찾기']] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 pb-3 text-sm font-semibold transition-all ${
                tab === t
                  ? 'text-white border-b-2 border-white -mb-px'
                  : 'text-white/35 hover:text-white/60'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        {tab === 'id'
          ? <IdFinder  memberType={memberType} />
          : <PwResetter memberType={memberType} />
        }

        {/* 로그인으로 */}
        <Link
          to="/login"
          className="mt-8 flex items-center justify-center gap-1.5 text-white/40 hover:text-white/70 text-sm transition-colors"
        >
          <ChevronLeft size={15} />
          로그인으로 돌아가기
        </Link>

      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   아이디 찾기
══════════════════════════════════════════════════════════ */
const IdFinder: React.FC<{ memberType: MemberType }> = ({ memberType }) => {
  const [name,     setName]     = useState('');
  const [phone,    setPhone]    = useState('');
  const [result,   setResult]   = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleFind = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setNotFound(false);
    setLoading(true);

    try {
      const { data, error: dbErr } = await supabase
        .from('profiles')
        .select('email')
        .eq('full_name', name.trim())
        .eq('phone', phone)
        .maybeSingle();

      if (dbErr) throw dbErr;

      if (data?.email) {
        setResult(maskEmail(data.email));
      } else {
        setNotFound(true);
      }
    } catch {
      setError('조회 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setName(''); setPhone('');
    setResult(null); setNotFound(false); setError('');
  };

  /* 결과 화면 */
  if (result) {
    return (
      <div className="space-y-4 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/10 border border-white/20">
          <CheckCircle2 size={26} className="text-white" />
        </div>
        <div>
          <p className="text-white/50 text-sm">가입된 이메일(아이디)</p>
          <p className="text-white font-bold text-lg mt-1 tracking-wide">{result}</p>
        </div>
        <Link
          to="/login"
          className="block w-full bg-white text-black font-bold py-3 rounded-xl text-sm
                     hover:bg-white/90 active:scale-[0.98] transition-all"
        >
          로그인하기
        </Link>
        <button
          type="button" onClick={reset}
          className="text-white/40 hover:text-white/70 text-sm transition-colors"
        >
          다시 찾기
        </button>
      </div>
    );
  }

  /* 미조회 결과 */
  if (notFound) {
    return (
      <div className="space-y-4 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/[0.06] border border-white/15">
          <AlertCircle size={26} className="text-white/50" />
        </div>
        <div>
          <p className="text-white font-semibold">일치하는 계정이 없습니다</p>
          <p className="text-white/40 text-sm mt-1">입력하신 정보를 다시 확인해 주세요.</p>
        </div>
        <button
          type="button" onClick={reset}
          className="w-full border border-white/15 text-white/70 font-semibold py-3 rounded-xl text-sm
                     hover:bg-white/5 transition-all"
        >
          다시 입력하기
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleFind} className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-white/60 text-xs font-semibold tracking-widest uppercase">
          {memberType === 'corp' ? '담당자 이름' : '이름'}
        </label>
        <div className="relative">
          <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="가입 시 입력한 이름" required
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3
                       text-white placeholder-white/25 text-sm outline-none
                       focus:border-white/30 focus:bg-white/[0.08] transition-all"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-white/60 text-xs font-semibold tracking-widest uppercase">전화번호</label>
        <div className="relative">
          <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="tel" value={phone}
            onChange={e => setPhone(formatPhone(e.target.value))}
            placeholder="010-0000-0000" required
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3
                       text-white placeholder-white/25 text-sm outline-none
                       focus:border-white/30 focus:bg-white/[0.08] transition-all"
          />
        </div>
      </div>

      <button
        type="submit" disabled={loading}
        className="w-full bg-white text-black font-bold py-3 rounded-xl mt-2
                   hover:bg-white/90 active:scale-[0.98] transition-all
                   disabled:opacity-50 disabled:cursor-not-allowed
                   flex items-center justify-center gap-2 text-sm"
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        {loading ? '조회 중...' : '아이디 찾기'}
      </button>
    </form>
  );
};

/* ══════════════════════════════════════════════════════════
   비밀번호 찾기 (재설정 이메일 발송)
══════════════════════════════════════════════════════════ */
const PwResetter: React.FC<{ memberType: MemberType }> = ({ memberType }) => {
  const [email,   setEmail]   = useState('');
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetErr) throw resetErr;
      setSent(true);
    } catch {
      setError('이메일 발송에 실패했습니다. 이메일 주소를 다시 확인해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  /* 발송 완료 */
  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/10 border border-white/20">
          <Mail size={26} className="text-white" />
        </div>
        <div>
          <p className="text-white font-semibold">재설정 이메일을 발송했습니다</p>
          <p className="text-white/40 text-sm mt-2 leading-relaxed">
            <span className="text-white/70 font-medium">{email}</span>로 발송된<br />
            링크를 클릭해 비밀번호를 재설정하세요.<br />
            <span className="text-white/30 text-xs mt-1 block">메일이 오지 않으면 스팸함을 확인해 주세요.</span>
          </p>
        </div>
        <button
          type="button" onClick={() => { setSent(false); setEmail(''); }}
          className="text-white/40 hover:text-white/70 text-sm transition-colors"
        >
          다른 이메일로 다시 보내기
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleReset} className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      <p className="text-white/40 text-sm leading-relaxed">
        가입 시 사용한{' '}
        {memberType === 'corp' ? '업무 이메일' : '학교 이메일'}을 입력하면
        비밀번호 재설정 링크를 보내드립니다.
      </p>

      <div className="space-y-1.5">
        <label className="text-white/60 text-xs font-semibold tracking-widest uppercase">
          {memberType === 'corp' ? '업무 이메일' : '학교 이메일'}
        </label>
        <div className="relative">
          <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="가입 시 사용한 이메일" required
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3
                       text-white placeholder-white/25 text-sm outline-none
                       focus:border-white/30 focus:bg-white/[0.08] transition-all"
          />
        </div>
      </div>

      <button
        type="submit" disabled={loading}
        className="w-full bg-white text-black font-bold py-3 rounded-xl mt-2
                   hover:bg-white/90 active:scale-[0.98] transition-all
                   disabled:opacity-50 disabled:cursor-not-allowed
                   flex items-center justify-center gap-2 text-sm"
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        {loading ? '발송 중...' : '재설정 이메일 발송'}
      </button>
    </form>
  );
};
