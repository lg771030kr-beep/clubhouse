import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Search, Plus, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Welcome() {
  const { profile, signOut } = useAuth();
  const navigate             = useNavigate();
  const name                 = profile?.full_name || '회원';

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 pb-12 relative">

      {/* 로그아웃 버튼 — 우상단 */}
      <button
        onClick={handleSignOut}
        className="absolute top-6 right-6 flex items-center gap-1.5 text-white/30 hover:text-white/70 text-xs font-semibold transition-colors"
      >
        <LogOut size={14} />
        로그아웃
      </button>

      {/* 로고 */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-10"
      >
        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto">
          <span className="text-black font-black text-lg">DX</span>
        </div>
      </motion.div>

      {/* 인사 */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.1 }}
        className="text-center mb-14"
      >
        <h1 className="text-white font-black text-4xl tracking-tight leading-tight mb-3">
          {name}님,<br />환영합니다! 🎉
        </h1>
        <p className="text-white/40 text-sm font-medium leading-relaxed">
          Club DX에서 동아리 활동을 시작하세요.<br />
          동아리를 찾거나 직접 만들 수 있어요.
        </p>
      </motion.div>

      {/* 버튼 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.2 }}
        className="w-full max-w-sm space-y-3"
      >
        {/* 동아리 만들기 — 흰색 (Primary) */}
        <button
          onClick={() => navigate('/clubs/create')}
          className="w-full bg-white text-black font-black py-4 rounded-2xl text-sm
                     hover:bg-white/90 active:scale-[0.98] transition-all
                     flex items-center justify-center gap-2"
        >
          <Plus size={18} />
          동아리 만들기
        </button>

        {/* 동아리 찾기 — 검은색 (Secondary) */}
        <button
          onClick={() => navigate('/user/clubs')}
          className="w-full bg-transparent text-white font-black py-4 rounded-2xl text-sm
                     border border-white/20 hover:border-white/50 hover:bg-white/5
                     active:scale-[0.98] transition-all
                     flex items-center justify-center gap-2"
        >
          <Search size={18} />
          동아리 찾기
        </button>

      </motion.div>

    </div>
  );
}
