import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Mail, Lock, User, Building2, Phone,
  AlertCircle, Loader2, CheckCircle2, Send, X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { KOREAN_UNIVERSITIES } from '../../data/universities';
import { SocialLoginButtons } from '../../components/auth/SocialLoginButtons';

type MemberType = 'personal' | 'corp';
type OtpState   = 'idle' | 'sending' | 'sent' | 'verifying' | 'verified';

/* ══════════════════════════════════════════════════════════
   메인 컨테이너
══════════════════════════════════════════════════════════ */
export const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const memberType = (searchParams.get('type') === 'corp' ? 'corp' : 'personal') as MemberType;

  const [success, setSuccess] = useState(false);

  const handleTypeSwitch = (type: MemberType) => {
    setSearchParams({ type });
    setSuccess(false);
  };

  /* 가입 완료 화면 */
  if (success) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 border border-white/20">
            <CheckCircle2 size={32} className="text-white" />
          </div>
          <div>
            <h2 className="text-white font-black text-2xl">가입 완료!</h2>
            <p className="text-white/50 text-sm mt-2 leading-relaxed">
              {memberType === 'corp'
                ? 'Club DX 기업·기관 회원으로 등록되었습니다.'
                : 'Club DX에 오신 것을 환영합니다.'}
            </p>
          </div>
          <button
            onClick={() => navigate('/welcome', { replace: true })}
            className="w-full bg-white text-black font-bold py-3 rounded-xl text-sm
                       hover:bg-white/90 active:scale-[0.98] transition-all"
          >
            시작하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm py-8">

        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white rounded-2xl mb-4 shadow-lg">
            <span className="text-black font-black text-xl">DX</span>
          </div>
          <h1 className="text-white font-black text-2xl tracking-tight">회원가입</h1>
          <p className="text-white/50 text-sm mt-1">Club DX에 합류하세요</p>
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

        {memberType === 'personal'
          ? <PersonalForm onSuccess={() => setSuccess(true)} />
          : <CorpForm    onSuccess={() => setSuccess(true)} />
        }

        {/* 소셜 로그인 */}
        <div className="mt-5">
          <SocialLoginButtons />
        </div>

        <p className="text-center text-white/40 text-sm mt-6">
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className="text-white font-semibold hover:underline underline-offset-2">
            로그인
          </Link>
        </p>

      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   일반회원 가입 폼
══════════════════════════════════════════════════════════ */
interface PersonalFormState {
  email: string; password: string; confirmPassword: string;
  fullName: string; univName: string; phone: string;
}

const PersonalForm: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [form, setForm] = useState<PersonalFormState>({
    email: '', password: '', confirmPassword: '',
    fullName: '', univName: '', phone: '',
  });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const [otpState,   setOtpState]   = useState<OtpState>('idle');
  const [otp,        setOtp]        = useState('');
  const [otpError,   setOtpError]   = useState('');
  const [countdown,  setCountdown]  = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const startCountdown = () => {
    setCountdown(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      setForm(prev => ({ ...prev, phone: formatPhone(value) }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSendOtp = async () => {
    setError('');
    if (!form.email) { setError('이메일을 먼저 입력해 주세요.'); return; }
    if (!form.email.endsWith('.ac.kr')) { setError('학교 이메일(.ac.kr)만 가입할 수 있습니다.'); return; }

    setOtpState('sending');
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: form.email,
        options: { shouldCreateUser: true },
      });
      if (otpErr) throw otpErr;
      setOtpState('sent');
      setOtp('');
      setOtpError('');
      startCountdown();
    } catch (err: unknown) {
      setOtpState('idle');
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'Failed to fetch' || msg.includes('fetch')) {
        setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
      } else {
        setError(msg || '코드 전송에 실패했습니다.');
      }
    }
  };

  const handleVerifyOtp = async () => {
    setOtpError('');
    if (otp.length !== 6) { setOtpError('6자리 코드를 입력해 주세요.'); return; }
    setOtpState('verifying');
    try {
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email: form.email, token: otp, type: 'email',
      });
      if (verifyErr) throw verifyErr;
      setOtpState('verified');
      if (timerRef.current) clearInterval(timerRef.current);
    } catch {
      setOtpState('sent');
      setOtpError('인증 코드가 올바르지 않습니다. 다시 확인해 주세요.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otpState !== 'verified') { setError('이메일 인증을 먼저 완료해 주세요.'); return; }
    if (!form.fullName.trim())   { setError('이름을 입력해 주세요.'); return; }
    if (!form.univName)          { setError('학교를 선택해 주세요.'); return; }
    if (!KOREAN_UNIVERSITIES.includes(form.univName)) { setError('목록에 있는 학교를 선택해 주세요.'); return; }
    if (!form.phone)             { setError('휴대폰 번호를 입력해 주세요.'); return; }
    if (!/^010-\d{4}-\d{4}$/.test(form.phone)) { setError('올바른 휴대폰 번호 형식이 아닙니다. (010-XXXX-XXXX)'); return; }
    if (form.password.length < 8) { setError('비밀번호는 8자 이상이어야 합니다.'); return; }
    if (!/[a-zA-Z]/.test(form.password)) { setError('비밀번호에 영문자를 포함해야 합니다.'); return; }
    if (!/[0-9]/.test(form.password))    { setError('비밀번호에 숫자를 포함해야 합니다.'); return; }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(form.password)) {
      setError('비밀번호에 특수문자를 포함해야 합니다.'); return;
    }
    if (form.password !== form.confirmPassword) { setError('비밀번호가 일치하지 않습니다.'); return; }

    setLoading(true);
    try {
      const { error: pwErr } = await supabase.auth.updateUser({ password: form.password });
      if (pwErr) throw new Error('password_error');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('user_not_found');

      const { error: profileErr } = await supabase.from('profiles').upsert({
        id: user.id,
        email: form.email,
        full_name: form.fullName.trim() || null,
        univ_name: form.univName || null,
        phone: form.phone || null,
        role: 'USER',
      }, { onConflict: 'id' });
      if (profileErr) throw new Error('profile_error');

      onSuccess();
    } catch (err: unknown) {
      console.error('[PersonalSignUp]', err);
      const code = err instanceof Error ? err.message : '';
      if (code === 'password_error') {
        setError('비밀번호 설정에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      } else {
        setError('회원가입에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  const otpVerified = otpState === 'verified';

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <ErrorBanner message={error} />}

      {/* 학교 이메일 + OTP */}
      <div className="space-y-1.5">
        <label className="text-white/60 text-xs font-semibold tracking-widest uppercase">학교 이메일 *</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            <input
              type="email" name="email" value={form.email} onChange={handleChange}
              placeholder="학교 이메일 (.ac.kr)" required disabled={otpVerified}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3
                         text-white placeholder-white/25 text-sm outline-none
                         focus:border-white/30 focus:bg-white/[0.08] transition-all disabled:opacity-50"
            />
          </div>
          <OtpSendButton state={otpState} countdown={countdown} verified={otpVerified} onSend={handleSendOtp} />
        </div>
        <p className="text-white/30 text-xs pl-1">재학생 확인을 위해 .ac.kr 이메일만 사용 가능합니다</p>
      </div>

      {(otpState === 'sent' || otpState === 'verifying') && (
        <OtpInput otp={otp} error={otpError} onOtpChange={setOtp} onVerify={handleVerifyOtp} verifying={otpState === 'verifying'} />
      )}

      <Field icon={<User size={15} />} label="이름 *" type="text" name="fullName"
        placeholder="실명" value={form.fullName} onChange={handleChange} required />

      <UnivAutocomplete value={form.univName} onChange={val => setForm(prev => ({ ...prev, univName: val }))} required />

      <Field icon={<Phone size={15} />} label="핸드폰 번호 *" type="tel" name="phone"
        placeholder="010-0000-0000" value={form.phone} onChange={handleChange} required />

      <div className="pt-1"><div className="border-t border-white/10" /></div>

      <Field icon={<Lock size={15} />} label="비밀번호 *" type="password" name="password"
        placeholder="8자 이상" value={form.password} onChange={handleChange} required
        hint="영문 + 숫자 + 특수문자(!@#$ 등) 조합, 8자 이상" />

      <Field icon={<Lock size={15} />} label="비밀번호 확인 *" type="password" name="confirmPassword"
        placeholder="비밀번호 재입력" value={form.confirmPassword} onChange={handleChange} required />

      <button
        type="submit"
        disabled={loading || !otpVerified}
        className="w-full bg-white text-black font-bold py-3 rounded-xl mt-2
                   hover:bg-white/90 active:scale-[0.98] transition-all
                   disabled:opacity-40 disabled:cursor-not-allowed
                   flex items-center justify-center gap-2 text-sm"
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        {!otpVerified ? '이메일 인증 후 가입 가능' : loading ? '가입 중...' : '가입하기'}
      </button>
    </form>
  );
};

/* ══════════════════════════════════════════════════════════
   기업·기관 가입 폼
══════════════════════════════════════════════════════════ */
interface CorpFormState {
  email: string; password: string; confirmPassword: string;
  orgName: string; contactName: string; phone: string;
}

const CorpForm: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [form, setForm] = useState<CorpFormState>({
    email: '', password: '', confirmPassword: '',
    orgName: '', contactName: '', phone: '',
  });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const [otpState,  setOtpState]  = useState<OtpState>('idle');
  const [otp,       setOtp]       = useState('');
  const [otpError,  setOtpError]  = useState('');
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const startCountdown = () => {
    setCountdown(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      setForm(prev => ({ ...prev, phone: formatPhone(value) }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSendOtp = async () => {
    setError('');
    if (!form.email) { setError('이메일을 먼저 입력해 주세요.'); return; }

    setOtpState('sending');
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: form.email,
        options: { shouldCreateUser: true },
      });
      if (otpErr) throw otpErr;
      setOtpState('sent');
      setOtp('');
      setOtpError('');
      startCountdown();
    } catch (err: unknown) {
      setOtpState('idle');
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'Failed to fetch' || msg.includes('fetch')) {
        setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
      } else {
        setError(msg || '코드 전송에 실패했습니다.');
      }
    }
  };

  const handleVerifyOtp = async () => {
    setOtpError('');
    if (otp.length !== 6) { setOtpError('6자리 코드를 입력해 주세요.'); return; }
    setOtpState('verifying');
    try {
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email: form.email, token: otp, type: 'email',
      });
      if (verifyErr) throw verifyErr;
      setOtpState('verified');
      if (timerRef.current) clearInterval(timerRef.current);
    } catch {
      setOtpState('sent');
      setOtpError('인증 코드가 올바르지 않습니다. 다시 확인해 주세요.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otpState !== 'verified')      { setError('이메일 인증을 먼저 완료해 주세요.'); return; }
    if (!form.orgName.trim())         { setError('기업/기관명을 입력해 주세요.'); return; }
    if (!form.contactName.trim())     { setError('담당자 이름을 입력해 주세요.'); return; }
    if (!form.phone)                  { setError('연락처 전화번호를 입력해 주세요.'); return; }
    if (!/^0\d{1,2}-\d{3,4}-\d{4}$/.test(form.phone)) {
      setError('올바른 전화번호 형식이 아닙니다.'); return;
    }
    if (form.password.length < 8)    { setError('비밀번호는 8자 이상이어야 합니다.'); return; }
    if (!/[a-zA-Z]/.test(form.password)) { setError('비밀번호에 영문자를 포함해야 합니다.'); return; }
    if (!/[0-9]/.test(form.password))    { setError('비밀번호에 숫자를 포함해야 합니다.'); return; }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(form.password)) {
      setError('비밀번호에 특수문자를 포함해야 합니다.'); return;
    }
    if (form.password !== form.confirmPassword) { setError('비밀번호가 일치하지 않습니다.'); return; }

    setLoading(true);
    try {
      const { error: pwErr } = await supabase.auth.updateUser({ password: form.password });
      if (pwErr) throw new Error('password_error');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('user_not_found');

      const { error: profileErr } = await supabase.from('profiles').upsert({
        id: user.id,
        email: form.email,
        full_name: form.contactName.trim() || null,
        team_name: form.orgName.trim() || null,   // 기관명 → team_name 재활용
        phone: form.phone || null,
        role: 'USER',
      }, { onConflict: 'id' });
      if (profileErr) throw new Error('profile_error');

      onSuccess();
    } catch (err: unknown) {
      console.error('[CorpSignUp]', err);
      const code = err instanceof Error ? err.message : '';
      if (code === 'password_error') {
        setError('비밀번호 설정에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      } else {
        setError('회원가입에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  const otpVerified = otpState === 'verified';

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <ErrorBanner message={error} />}

      {/* 업무 이메일 + OTP */}
      <div className="space-y-1.5">
        <label className="text-white/60 text-xs font-semibold tracking-widest uppercase">업무 이메일 *</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            <input
              type="email" name="email" value={form.email} onChange={handleChange}
              placeholder="업무용 이메일 주소" required disabled={otpVerified}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3
                         text-white placeholder-white/25 text-sm outline-none
                         focus:border-white/30 focus:bg-white/[0.08] transition-all disabled:opacity-50"
            />
          </div>
          <OtpSendButton state={otpState} countdown={countdown} verified={otpVerified} onSend={handleSendOtp} />
        </div>
      </div>

      {(otpState === 'sent' || otpState === 'verifying') && (
        <OtpInput otp={otp} error={otpError} onOtpChange={setOtp} onVerify={handleVerifyOtp} verifying={otpState === 'verifying'} />
      )}

      {/* 기업/기관 정보 */}
      <Field icon={<Building2 size={15} />} label="기업/기관명 *" type="text" name="orgName"
        placeholder="기업 또는 기관 이름" value={form.orgName} onChange={handleChange} required />

      <Field icon={<User size={15} />} label="담당자 이름 *" type="text" name="contactName"
        placeholder="담당자 실명" value={form.contactName} onChange={handleChange} required />

      <Field icon={<Phone size={15} />} label="연락처 *" type="tel" name="phone"
        placeholder="010-0000-0000" value={form.phone} onChange={handleChange} required />

      <div className="pt-1"><div className="border-t border-white/10" /></div>

      <Field icon={<Lock size={15} />} label="비밀번호 *" type="password" name="password"
        placeholder="8자 이상" value={form.password} onChange={handleChange} required
        hint="영문 + 숫자 + 특수문자(!@#$ 등) 조합, 8자 이상" />

      <Field icon={<Lock size={15} />} label="비밀번호 확인 *" type="password" name="confirmPassword"
        placeholder="비밀번호 재입력" value={form.confirmPassword} onChange={handleChange} required />

      <button
        type="submit"
        disabled={loading || !otpVerified}
        className="w-full bg-white text-black font-bold py-3 rounded-xl mt-2
                   hover:bg-white/90 active:scale-[0.98] transition-all
                   disabled:opacity-40 disabled:cursor-not-allowed
                   flex items-center justify-center gap-2 text-sm"
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        {!otpVerified ? '이메일 인증 후 가입 가능' : loading ? '가입 중...' : '가입하기'}
      </button>
    </form>
  );
};

/* ══════════════════════════════════════════════════════════
   공통 UI 컴포넌트
══════════════════════════════════════════════════════════ */

/* 에러 배너 */
const ErrorBanner: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
    <AlertCircle size={16} className="shrink-0" />
    {message}
  </div>
);

/* OTP 전송 버튼 */
interface OtpSendButtonProps {
  state: OtpState; countdown: number; verified: boolean; onSend: () => void;
}
const OtpSendButton: React.FC<OtpSendButtonProps> = ({ state, countdown, verified, onSend }) => {
  if (verified) {
    return (
      <div className="shrink-0 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10
                      flex items-center gap-1.5 text-white/60 text-xs font-semibold">
        <CheckCircle2 size={13} className="text-green-400" />
        인증 완료
      </div>
    );
  }
  return (
    <button
      type="button" onClick={onSend}
      disabled={state === 'sending' || (state === 'sent' && countdown > 0)}
      className="shrink-0 px-3 py-2.5 bg-white/10 border border-white/15 rounded-xl
                 text-white/70 text-xs font-semibold hover:bg-white/20 transition-all
                 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
    >
      {state === 'sending' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
      {state === 'sent' && countdown > 0
        ? `${countdown}s`
        : state === 'sent' || state === 'verifying' ? '재전송' : '코드 전송'}
    </button>
  );
};

/* OTP 입력 */
interface OtpInputProps {
  otp: string; error: string; verifying: boolean;
  onOtpChange: (v: string) => void; onVerify: () => void;
}
const OtpInput: React.FC<OtpInputProps> = ({ otp, error, verifying, onOtpChange, onVerify }) => (
  <div className="space-y-1.5">
    <label className="text-white/60 text-xs font-semibold tracking-widest uppercase">인증 코드</label>
    {error && (
      <p className="text-red-400 text-xs pl-1 flex items-center gap-1">
        <AlertCircle size={11} /> {error}
      </p>
    )}
    <div className="flex gap-2">
      <input
        type="text" inputMode="numeric" maxLength={6} value={otp}
        onChange={e => onOtpChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="이메일로 발송된 인증 코드"
        className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-3
                   text-white placeholder-white/25 text-sm outline-none tracking-[0.3em]
                   focus:border-white/30 focus:bg-white/[0.08] transition-all"
        autoFocus
      />
      <button
        type="button" onClick={onVerify}
        disabled={otp.length !== 6 || verifying}
        className="shrink-0 px-4 py-2.5 bg-white text-black font-bold text-xs rounded-xl
                   hover:bg-white/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed
                   flex items-center gap-1.5"
      >
        {verifying ? <Loader2 size={13} className="animate-spin" /> : '확인'}
      </button>
    </div>
  </div>
);

/* 공통 입력 필드 */
interface FieldProps {
  icon: React.ReactNode; label: string; type: string; name: string;
  placeholder: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean; hint?: string;
}
const Field: React.FC<FieldProps> = ({ icon, label, type, name, placeholder, value, onChange, required, hint }) => (
  <div className="space-y-1.5">
    <label className="text-white/60 text-xs font-semibold tracking-widest uppercase">{label}</label>
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30">{icon}</span>
      <input type={type} name={name} value={value} onChange={onChange}
        placeholder={placeholder} required={required}
        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3
                   text-white placeholder-white/25 text-sm outline-none
                   focus:border-white/30 focus:bg-white/[0.08] transition-all" />
    </div>
    {hint && <p className="text-white/30 text-xs pl-1">{hint}</p>}
  </div>
);

/* 학교 자동완성 */
const UnivAutocomplete: React.FC<{ value: string; onChange: (v: string) => void; required?: boolean }> = ({ value, onChange, required }) => {
  const [query, setQuery] = useState(value);
  const [open,  setOpen]  = useState(false);
  const wrapRef           = useRef<HTMLDivElement>(null);

  const filtered = query.trim().length > 0
    ? KOREAN_UNIVERSITIES.filter(u => u.includes(query.trim())).slice(0, 8)
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (!KOREAN_UNIVERSITIES.includes(query)) { setQuery(''); onChange(''); }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [query, onChange]);

  return (
    <div className="space-y-1.5" ref={wrapRef}>
      <label className="text-white/60 text-xs font-semibold tracking-widest uppercase">학교 {required && '*'}</label>
      <div className="relative">
        <Building2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
        <input
          type="text" value={query}
          onChange={e => { setQuery(e.target.value); onChange(''); setOpen(true); }}
          onFocus={() => query.trim().length > 0 && setOpen(true)}
          placeholder="학교 이름 검색" autoComplete="off"
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-9 py-3
                     text-white placeholder-white/25 text-sm outline-none
                     focus:border-white/30 focus:bg-white/[0.08] transition-all"
        />
        {query && (
          <button type="button" onClick={() => { setQuery(''); onChange(''); setOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
            <X size={14} />
          </button>
        )}
        {open && filtered.length > 0 && (
          <ul className="absolute z-50 mt-1 w-full bg-[#1a1a1a] border border-white/15 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
            {filtered.map(u => (
              <li key={u}>
                <button type="button" onMouseDown={() => { setQuery(u); onChange(u); setOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                  {u}
                </button>
              </li>
            ))}
          </ul>
        )}
        {open && query.trim().length > 0 && filtered.length === 0 && (
          <div className="absolute z-50 mt-1 w-full bg-[#1a1a1a] border border-white/15 rounded-xl shadow-2xl px-4 py-3 text-sm text-white/40">
            검색 결과가 없습니다
          </div>
        )}
      </div>
      {KOREAN_UNIVERSITIES.includes(value) && (
        <p className="text-xs text-white/50 pl-1">✓ {value}</p>
      )}
    </div>
  );
};

/* 전화번호 포맷 */
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}
