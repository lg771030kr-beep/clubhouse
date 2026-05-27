import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Link2, CalendarPlus, Megaphone, Check, ChevronRight } from 'lucide-react';

interface Props {
  clubName: string;
  clubId: string;
}

export function AdminClubWelcome({ clubName, clubId }: Props) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const inviteLink = `${window.location.origin}/join?club=${clubId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
      const el = document.createElement('textarea');
      el.value = inviteLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const actions = [
    {
      key: 'invite',
      icon: <Link2 className="w-6 h-6" />,
      title: '동아리 가입 링크 보내기',
      desc: '링크를 공유하면 누구든 Club DX에서 우리 동아리에 신청할 수 있어요.',
      cta: copied ? '링크 복사 완료!' : '링크 복사하기',
      onClick: handleCopyLink,
      done: copied,
    },
    {
      key: 'schedule',
      icon: <CalendarPlus className="w-6 h-6" />,
      title: '일정 / 과제 등록하기',
      desc: '첫 모임 일정이나 과제를 등록해 부원들과 공유하세요.',
      cta: '일정 등록하기',
      onClick: () => navigate('/admin/schedules'),
      done: false,
    },
    {
      key: 'recruit',
      icon: <Megaphone className="w-6 h-6" />,
      title: '모집공고 작성하기',
      desc: '새 부원을 모집하는 공고를 올려 동아리를 알려보세요.',
      cta: '공고 작성하기',
      onClick: () => navigate('/admin/recruitment'),
      done: false,
    },
  ];

  return (
    <>
      <div className="min-h-screen bg-white font-sans">

        {/* ── 헤더 ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="pt-16 pb-12 px-6 text-center border-b border-black/8"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="w-16 h-16 rounded-2xl bg-black flex items-center justify-center mx-auto mb-5 text-3xl"
          >
            🎉
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.45 }}
          >
            <span className="inline-flex items-center gap-1.5 mb-3 px-3 py-1 rounded-full text-[10px]
                             font-black tracking-widest uppercase bg-black/10 border border-black/15 text-black/70">
              동아리 개설 완료
            </span>
            <h1 className="text-2xl font-black text-black tracking-tight">
              {clubName || '새 동아리'}에<br />오신 걸 환영합니다!
            </h1>
            <p className="mt-3 text-sm text-black/50 font-medium leading-relaxed">
              아래 단계를 따라 동아리를 시작해보세요.<br />
              언제든 건너뛰고 나중에 설정할 수 있어요.
            </p>
          </motion.div>
        </motion.div>

        {/* ── 액션 카드들 ── */}
        <div className="max-w-lg mx-auto px-5 py-10 space-y-4">
          {actions.map((action, i) => (
            <motion.button
              key={action.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.1, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.98 }}
              onClick={action.onClick}
              className="w-full text-left flex items-center gap-4 p-5 rounded-3xl border border-black/20
                         bg-white hover:bg-black/[0.02] hover:border-black/30 transition-all group"
            >
              {/* 아이콘 */}
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors
                ${action.done
                  ? 'bg-black text-white'
                  : 'bg-black/8 border border-black/15 text-black group-hover:bg-black group-hover:text-white'
                }`}>
                {action.done ? <Check className="w-6 h-6" /> : action.icon}
              </div>

              {/* 텍스트 */}
              <div className="flex-1 min-w-0">
                <p className="font-black text-black text-sm">{action.title}</p>
                <p className="mt-0.5 text-xs text-black/50 font-medium leading-relaxed">{action.desc}</p>
                <span className={`inline-block mt-2 text-xs font-black transition-colors
                  ${action.done ? 'text-black' : 'text-black/40 group-hover:text-black'}`}>
                  {action.cta}
                </span>
              </div>

              {/* 화살표 */}
              <ChevronRight className="w-4 h-4 text-black/25 group-hover:text-black/50 shrink-0 transition-colors" />
            </motion.button>
          ))}

          {/* 대시보드로 그냥 이동 */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.65 }}
            className="text-center pt-4 text-xs text-black/30 font-medium"
          >
            모두 설정하면 대시보드가 자동으로 활성화됩니다.
          </motion.p>
        </div>
      </div>

    </>
  );
}
