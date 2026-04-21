import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Mail, Lock, User, Building2, Phone,
  AlertCircle, Loader2, CheckCircle2, Send, X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { KOREAN_UNIVERSITIES } from '../../data/universities';

interface FormState {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  univName: string;
  phone: string;
}

type OtpState = 'idle' | 'sending' | 'sent' | 'verifying' | 'verified';

export const SignUp: React.FC = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>({
    email: '', password: '', confirmPassword: '',
    fullName: '', univName: '', phone: '',
  });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  /* ── OTP 상태 ── */
  const [otpState, setOtpState] = useState<OtpState>('idle');
  const [otp, setOtp]           = useState('');
  const [otpError, setOtpError] = useState('');
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

  /* ── 폼 핸들러 ── */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      setForm(prev => ({ ...prev, phone: formatPhone(value) }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  /* ── 인증 코드 전송 ── */
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
        setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도하거나 네트워크를 확인해 주세요.');
      } else {
        setError(msg || '코드 전송에 실패했습니다.');
      }
    }
  };

  /* ── OTP 확인 ── */
  const handleVerifyOtp = async () => {
    setOtpError('');
    if (otp.length !== 6) { setOtpError('6자리 코드를 입력해 주세요.'); return; }

    setOtpState('verifying');
    try {
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email: form.email,
        token: otp,
        type: 'email',
      });
      if (verifyErr) throw verifyErr;
      setOtpState('verified');
      if (timerRef.current) clearInterval(timerRef.current);
    } catch {
      setOtpState('sent');
      setOtpError('인증 코드가 올바르지 않습니다. 다시 확인해 주세요.');
    }
  };

  /* ── 가입 제출 ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (otpState !== 'verified') {
      setError('이메일 인증을 먼저 완료해 주세요.');
      return;
    }
    if (!form.fullName.trim()) {
      setError('이름을 입력해 주세요.');
      return;
    }
    if (!form.univName) {
      setError('학교를 선택해 주세요.');
      return;
    }
    if (!KOREAN_UNIVERSITIES.includes(form.univName)) {
      setError('목록에 있는 학교를 선택해 주세요.');
      return;
    }
    if (!form.phone) {
      setError('휴대폰 번호를 입력해 주세요.');
      return;
    }
    if (!/^010-\d{4}-\d{4}$/.test(form.phone)) {
      setError('올바른 휴대폰 번호 형식이 아닙니다. (010-XXXX-XXXX)');
      return;
    }
    if (form.password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    if (!/[a-zA-Z]/.test(form.password)) {
      setError('비밀번호에 영문자를 포함해야 합니다.');
      return;
    }
    if (!/[0-9]/.test(form.password)) {
      setError('비밀번호에 숫자를 포함해야 합니다.');
      return;
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(form.password)) {
      setError('비밀번호에 특수문자를 포함해야 합니다.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);
    try {
      /* 비밀번호 설정 (OTP로 생성된 계정에 비밀번호 추가) */
      const { error: pwErr } = await supabase.auth.updateUser({ password: form.password });
      if (pwErr) throw new Error('password_error');

      /* 현재 유저 확인 */
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('user_not_found');

      /* 프로필 생성 */
      const { error: profileErr } = await supabase.from('profiles').upsert({
        id: user.id,
        email: form.email,
        full_name: form.fullName.trim() || null,
        univ_name: form.univName || null,
        phone: form.phone || null,
        role: 'USER',
      }, { onConflict: 'id' });
      if (profileErr) throw new Error('profile_error');

      setSuccess(true);
    } catch (err: unknown) {
      // 내부 DB 에러 코드·스택 노출 방지 — 사용자 친화적 메시지로 통일
      console.error('[SignUp]', err);
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

  /* ── 가입 완료 ── */
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
              Club DX에 오신 것을 환영합니다.
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

  const otpVerified = otpState === 'verified';

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

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          {/* ── 학교 이메일 + 인증 ── */}
          <div className="space-y-1.5">
            <label className="text-white/60 text-xs font-semibold tracking-widest uppercase">
              학교 이메일 *
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="학교 이메일 (.ac.kr)"
                  required
                  disabled={otpVerified}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3
                             text-white placeholder-white/25 text-sm outline-none
                             focus:border-white/30 focus:bg-white/[0.08] transition-all
                             disabled:opacity-50"
                />
              </div>
              {/* 전송 버튼 */}
              {!otpVerified && (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpState === 'sending' || (otpState === 'sent' && countdown > 0)}
                  className="shrink-0 px-3 py-2.5 bg-white/10 border border-white/15 rounded-xl
                             text-white/70 text-xs font-semibold hover:bg-white/20 transition-all
                             disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {otpState === 'sending' ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Send size={13} />
                  )}
                  {otpState === 'sent' && countdown > 0
                    ? `${countdown}s`
                    : otpState === 'sent' || otpState === 'verifying'
                    ? '재전송'
                    : '코드 전송'}
                </button>
              )}
              {/* 인증 완료 배지 */}
              {otpVerified && (
                <div className="shrink-0 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10
                                flex items-center gap-1.5 text-white/60 text-xs font-semibold">
                  <CheckCircle2 size={13} className="text-green-400" />
                  인증 완료
                </div>
              )}
            </div>
            <p className="text-white/30 text-xs pl-1">재학생 확인을 위해 .ac.kr 이메일만 사용 가능합니다</p>
          </div>

          {/* ── OTP 입력 ── */}
          {(otpState === 'sent' || otpState === 'verifying') && (
            <div className="space-y-1.5">
              <label className="text-white/60 text-xs font-semibold tracking-widest uppercase">
                인증 코드
              </label>
              {otpError && (
                <p className="text-red-400 text-xs pl-1 flex items-center gap-1">
                  <AlertCircle size={11} /> {otpError}
                </p>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="이메일로 발송된 인증 코드"
                  className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-3
                             text-white placeholder-white/25 text-sm outline-none tracking-[0.3em]
                             focus:border-white/30 focus:bg-white/[0.08] transition-all"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={otp.length !== 6 || otpState === 'verifying'}
                  className="shrink-0 px-4 py-2.5 bg-white text-black font-bold text-xs rounded-xl
                             hover:bg-white/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed
                             flex items-center gap-1.5"
                >
                  {otpState === 'verifying'
                    ? <Loader2 size={13} className="animate-spin" />
                    : '확인'}
                </button>
              </div>
            </div>
          )}

          {/* ── 이름 ── */}
          <Field
            icon={<User size={15} />}
            label="이름 *"
            type="text"
            name="fullName"
            placeholder="실명"
            value={form.fullName}
            onChange={handleChange}
            required
          />

          {/* ── 학교 자동완성 ── */}
          <UnivAutocomplete
            value={form.univName}
            onChange={val => setForm(prev => ({ ...prev, univName: val }))}
            required
          />

          {/* ── 핸드폰 번호 ── */}
          <Field
            icon={<Phone size={15} />}
            label="핸드폰 번호 *"
            type="tel"
            name="phone"
            placeholder="010-0000-0000"
            value={form.phone}
            onChange={handleChange}
            required
          />

          {/* 구분선 */}
          <div className="pt-1"><div className="border-t border-white/10" /></div>

          {/* ── 비밀번호 ── */}
          <Field
            icon={<Lock size={15} />}
            label="비밀번호 *"
            type="password"
            name="password"
            placeholder="8자 이상"
            value={form.password}
            onChange={handleChange}
            required
            hint="영문 + 숫자 + 특수문자(!@#$ 등) 조합, 8자 이상"
          />

          <Field
            icon={<Lock size={15} />}
            label="비밀번호 확인 *"
            type="password"
            name="confirmPassword"
            placeholder="비밀번호 재입력"
            value={form.confirmPassword}
            onChange={handleChange}
            required
          />

          <button
            type="submit"
            disabled={loading || !otpVerified}
            className="w-full bg-white text-black font-bold py-3 rounded-xl mt-2
                       hover:bg-white/90 active:scale-[0.98] transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2 text-sm"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {!otpVerified
              ? '이메일 인증 후 가입 가능'
              : loading ? '가입 중...' : '가입하기'}
          </button>
        </form>

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

/* ── 학교 자동완성 ── */
const UnivAutocomplete: React.FC<{ value: string; onChange: (v: string) => void; required?: boolean }> = ({ value, onChange, required }) => {
  const [query, setQuery]   = useState(value);
  const [open, setOpen]     = useState(false);
  const wrapperRef          = useRef<HTMLDivElement>(null);

  const filtered = query.trim().length > 0
    ? KOREAN_UNIVERSITIES.filter(u => u.includes(query.trim())).slice(0, 8)
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (!KOREAN_UNIVERSITIES.includes(query)) { setQuery(''); onChange(''); }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [query, onChange]);

  return (
    <div className="space-y-1.5" ref={wrapperRef}>
      <label className="text-white/60 text-xs font-semibold tracking-widest uppercase">학교 {required && '*'}</label>
      <div className="relative">
        <Building2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); onChange(''); setOpen(true); }}
          onFocus={() => query.trim().length > 0 && setOpen(true)}
          placeholder="학교 이름 검색"
          autoComplete="off"
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

/* ── 공통 입력 필드 ── */
interface FieldProps {
  icon: React.ReactNode; label: string; type: string; name: string;
  placeholder: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean; hint?: string;
}
const Field: React.FC<FieldProps> = ({ icon, label, type, name, placeholder, value, onChange, required, hint }) => (
  <div className="space-y-1.5">
    <label className="text-white/60 text-xs font-semibold tracking-widest uppercase">{label}</label>
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30">{icon}</span>
      <input type={type} name={name} value={value} onChange={onChange} placeholder={placeholder} required={required}
        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3
                   text-white placeholder-white/25 text-sm outline-none
                   focus:border-white/30 focus:bg-white/[0.08] transition-all" />
    </div>
    {hint && <p className="text-white/30 text-xs pl-1">{hint}</p>}
  </div>
);

/* ── 핸드폰 번호 포맷 ── */
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}
