import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, Calendar, MapPin, Megaphone,
  CheckCircle2, Clock, Send, X, ExternalLink,
  Zap, BookOpen, Star, ChevronLeft,
} from 'lucide-react';
import { BackButton } from '../../components/common/BackButton';

/* ══════════════════════════════════════════
   Types
══════════════════════════════════════════ */
interface ClubData {
  id: number;
  name: string;
  emoji: string;
  field: string;
  members: number;
  founded: string;
  location: string;
  description: string;
  activities: string[];
  techStack?: string[];
  isRecruiting: boolean;
  recruitment: {
    title: string;
    period: string;
    deadline: string;
    target: string;
    quota: number;
    requirements: string[];
    process: string[];
    applyUrl?: string;
  } | null;
  recentNews: { date: string; title: string }[];
}

const CLUBS: Record<number, ClubData> = {
  1: {
    id: 1, name: 'Club DX 개발팀', emoji: '💻', field: '개발',
    members: 42, founded: '2021년 3월', location: '공학관 302호',
    description: 'Club DX 개발팀은 실전 프로젝트 경험을 쌓고 싶은 개발자들이 모여 웹·앱 서비스를 함께 기획하고 구현하는 팀입니다. 매주 정기 세션을 통해 스터디와 프로젝트를 병행하며, 실무 역량을 빠르게 키울 수 있는 환경을 제공합니다.',
    activities: ['매주 화요일 정기 세션 (19:00)', '월 1회 해커톤 진행', '사이드 프로젝트 팀 매칭', '선배 개발자 초청 강연'],
    techStack: ['React', 'TypeScript', 'Node.js', 'Supabase', 'Tailwind CSS'],
    isRecruiting: true,
    recruitment: {
      title: '2026 Spring 신입 부원 모집',
      period: '2026.03.01 ~ 2026.03.31',
      deadline: '2026-03-31',
      target: '개발에 열정 있는 누구나 (전공 무관)',
      quota: 10,
      requirements: ['기초 프로그래밍 경험 (언어 무관)', '매주 정기 세션 참여 가능자', '협업을 좋아하는 분'],
      process: ['서류 접수', '코딩 테스트 (선택)', '면담', '최종 합격'],
      applyUrl: 'https://forms.gle/example',
    },
    recentNews: [
      { date: '2026.03.15', title: '2026 봄 해커톤 최우수상 수상 🏆' },
      { date: '2026.03.05', title: 'Club DX 앱 v2.0 베타 출시' },
      { date: '2026.02.20', title: '선배 초청 강연 — 카카오 현직 개발자' },
    ],
  },
  2: {
    id: 2, name: '크리에이티브 디자인', emoji: '🎨', field: '디자인',
    members: 28, founded: '2020년 9월', location: '예술관 B104',
    description: '크리에이티브 디자인은 UI/UX, 브랜딩, 모션 그래픽 등 다양한 디자인 분야를 탐구하는 동아리입니다.',
    activities: ['주 1회 크리틱 세션', 'Figma 실전 워크숍', '포트폴리오 리뷰', '디자인 공모전 참가'],
    techStack: ['Figma', 'Adobe XD', 'Illustrator', 'After Effects'],
    isRecruiting: true,
    recruitment: {
      title: '2026 Spring 디자이너 모집',
      period: '2026.03.10 ~ 2026.04.05',
      deadline: '2026-04-05',
      target: '디자인에 관심 있는 누구나',
      quota: 6,
      requirements: ['기초 Figma 사용 가능자', '포트폴리오 1개 이상', '정기 모임 참여 가능자'],
      process: ['포트폴리오 제출', '과제 전형', '면담', '합격'],
      applyUrl: 'https://forms.gle/example2',
    },
    recentNews: [
      { date: '2026.03.10', title: '봄학기 신규 프로젝트 팀 구성 완료' },
      { date: '2026.02.28', title: '대학생 디자인 어워드 입선' },
    ],
  },
  3: {
    id: 3, name: '마케팅 보이즈', emoji: '📣', field: '마케팅',
    members: 19, founded: '2022년 3월', location: '경영관 201호',
    description: '마케팅 보이즈는 브랜드 전략, SNS 마케팅, 데이터 분석을 직접 실행하며 배우는 동아리입니다.',
    activities: ['격주 마케팅 케이스 스터디', 'SNS 채널 운영', '외부 클라이언트 프로젝트', '스타트업 네트워킹'],
    isRecruiting: false,
    recruitment: null,
    recentNews: [
      { date: '2026.03.18', title: '스타트업 협업 캠페인 런칭 🚀' },
      { date: '2026.03.01', title: '인스타그램 팔로워 10K 달성!' },
    ],
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mergeClubFromDB(base: ClubData, row: any): ClubData {
  const cat = row.category ?? base.field;
  return {
    ...base,
    name:        row.name        ?? base.name,
    field:       cat             ?? base.field,
    members:     row.member_count ?? base.members,
    description: row.description ?? base.description,
    isRecruiting: row.is_recruiting ?? base.isRecruiting,
    recruitment: row.is_recruiting
      ? (base.recruitment ?? {
          title: `${row.name} 신입 모집`,
          period: '-', deadline: '2026-12-31',
          target: '관심 있는 누구나', quota: 0,
          requirements: [], process: ['지원서 접수', '면담', '합격'],
          applyUrl: row.recruit_link ?? undefined,
        })
      : null,
  };
}

export function ClubDetail() {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const { isAdminMode } = useAuth();

  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [applyMsg, setApplyMsg] = useState('');
  const [sent, setSent] = useState(false);
  const [club, setClub] = useState<ClubData | undefined>(CLUBS[Number(clubId)]);

  useEffect(() => {
    if (!clubId) return;
    async function loadClub() {
      const { data, error } = await supabase
        .from('clubs')
        .select('id, name, category, logo_url, is_recruiting, recruit_link, description, member_count, location')
        .eq('id', clubId)
        .maybeSingle();
      if (!error && data) {
        const base = CLUBS[Number(clubId)] ?? CLUBS[1];
        setClub(mergeClubFromDB(base, data));
      }
    }
    loadClub();
  }, [clubId]);

  /* ── 테마 헬퍼 ── */
  const bg          = isAdminMode ? 'bg-white'              : 'bg-black';
  const border      = isAdminMode ? 'border-black/10'       : 'border-white/10';
  const cardBg      = isAdminMode ? 'bg-white'              : 'bg-black';
  const cardBorder  = isAdminMode ? 'border-black/15'       : 'border-white/15';
  const textPri     = isAdminMode ? 'text-black'            : 'text-white';
  const textMuted   = isAdminMode ? 'text-black/60'         : 'text-white/60';
  const textDim     = isAdminMode ? 'text-black/40'         : 'text-white/40';
  const textFaint   = isAdminMode ? 'text-black/50'         : 'text-white/50';
  const iconColor   = isAdminMode ? 'text-black'            : 'text-white';
  const divider     = isAdminMode ? 'divide-black/8'        : 'divide-white/8';
  const hoverBg     = isAdminMode ? 'hover:bg-black/3'      : 'hover:bg-white/3';
  const subItemBg   = isAdminMode ? 'bg-black/5 border-black/8'   : 'bg-white/5 border-white/8';
  const fieldBadge  = isAdminMode ? 'bg-black/8 border-black/20 text-black'   : 'bg-white/8 border-white/20 text-white';
  const recruitBadge= isAdminMode ? 'bg-black text-white'   : 'bg-white text-black';
  const primaryBtn  = isAdminMode ? 'bg-black text-white hover:bg-black/90'   : 'bg-white text-black hover:bg-white/90';
  const banner      = isAdminMode ? 'bg-black text-white'   : 'bg-white text-black';
  const bannerIcon  = isAdminMode ? 'text-white'            : 'text-black';
  const stepBadge   = isAdminMode ? 'bg-black/8 text-black border-black/15'   : 'bg-white/8 text-white border-white/15';
  const techBadge   = isAdminMode ? 'bg-black/5 border-black/15 text-black'   : 'bg-white/5 border-white/15 text-white';
  const ddayBadge   = (dday: number | null) => {
    if (dday === null) return '';
    if (isAdminMode) return dday <= 0 ? 'bg-white/20 text-black/60' : dday <= 7 ? 'bg-white text-black' : 'bg-white/10 text-black';
    return dday <= 0 ? 'bg-black/20 text-black/60' : dday <= 7 ? 'bg-black text-white' : 'bg-black/10 text-black';
  };

  /* 모달 */
  const modalBg     = isAdminMode ? 'bg-white border-black/15'    : 'bg-black border-white/15';
  const modalBorder = isAdminMode ? 'border-black/10'             : 'border-white/10';
  const inputCls    = isAdminMode
    ? 'bg-black/5 border-black/15 text-black placeholder:text-black/30 focus:border-black/40 focus:ring-black/10'
    : 'bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-white/40 focus:ring-white/10';
  const closeBtn    = isAdminMode ? 'bg-black/8 hover:bg-black/15' : 'bg-white/8 hover:bg-white/15';
  const closeBtnIcon= isAdminMode ? 'text-black'                   : 'text-white';
  const labelCls    = isAdminMode ? 'text-black/60'                : 'text-white/60';
  const applyLinkCls= isAdminMode ? 'text-black'                   : 'text-white';
  const noRecruitEmoji = isAdminMode ? 'bg-black/5'               : 'bg-white/5';

  if (!club) {
    return (
      <div className={`min-h-screen ${bg} flex items-center justify-center`}>
        <div className="text-center">
          <p className="text-4xl mb-3">😢</p>
          <p className={`${textFaint} font-bold`}>동아리를 찾을 수 없습니다</p>
          <button onClick={() => navigate(-1)} className={`mt-4 ${textPri} font-bold text-sm`}>← 돌아가기</button>
        </div>
      </div>
    );
  }

  const r = club.recruitment;
  const dday = r ? Math.ceil((new Date(r.deadline).getTime() - Date.now()) / 86400000) : null;
  const handleSend = () => { setSent(true); setTimeout(() => { setApplyModalOpen(false); setSent(false); setApplyMsg(''); }, 1500); };

  return (
    <div className={`min-h-screen ${bg} pb-24`}>

      {/* ── 헤더 ── */}
      <div className={`${bg} border-b ${border} px-6 pt-12 pb-20`}>
        <div className="max-w-5xl mx-auto">
          <BackButton onClick={() => navigate(-1)} className="mb-8" />

          <div className="flex items-start gap-5">
            <div className={`w-20 h-20 rounded-3xl ${isAdminMode ? 'bg-black/5 border-black/15' : 'bg-white/5 border-white/15'}
                            border flex items-center justify-center text-4xl shrink-0`}>
              {club.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className={`text-[11px] font-black uppercase tracking-widest
                                 ${fieldBadge} px-2.5 py-1 rounded-full border`}>
                  {club.field}
                </span>
                {club.isRecruiting && (
                  <span className={`text-[11px] font-black uppercase tracking-widest
                                   ${recruitBadge} px-2.5 py-1 rounded-full`}>
                    모집중
                  </span>
                )}
              </div>
              <h1 className={`text-3xl font-black tracking-tight ${textPri}`}>
                {club.name}
              </h1>
              <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5
                              ${textMuted} text-sm font-semibold`}>
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> {club.members}명
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> {club.founded}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> {club.location}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 콘텐츠 ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-8 relative z-10 space-y-5">

        {/* 모집 공고 카드 */}
        {club.isRecruiting && r ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className={`${cardBg} rounded-3xl border ${cardBorder} overflow-hidden`}
          >
            {/* 공고 배너 */}
            <div className={`${banner} px-6 py-4 flex items-center justify-between`}>
              <div className="flex items-center gap-2.5">
                <Megaphone className={`w-5 h-5 ${bannerIcon}`} />
                <span className={`font-black ${bannerIcon} text-sm`}>신입 부원 모집 공고</span>
              </div>
              {dday !== null && (
                <span className={`text-xs font-black px-3 py-1 rounded-full ${ddayBadge(dday)}`}>
                  {dday <= 0 ? '마감' : `D-${dday}`}
                </span>
              )}
            </div>

            <div className="p-6 space-y-5">
              <div>
                <h2 className={`text-xl font-black ${textPri}`}>{r.title}</h2>
                <div className={`flex flex-wrap gap-4 mt-2 text-sm ${textMuted} font-medium`}>
                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{r.period}</span>
                  <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />모집 인원 {r.quota}명</span>
                </div>
              </div>

              {/* 지원 자격 */}
              <div>
                <p className={`text-xs font-black ${textFaint} uppercase tracking-wider mb-2.5`}>지원 자격</p>
                <ul className="space-y-2">
                  {r.requirements.map((req, i) => (
                    <li key={i} className={`flex items-start gap-2.5 text-sm ${textPri}`}>
                      <CheckCircle2 className={`w-4 h-4 ${iconColor} shrink-0 mt-0.5`} />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>

              {/* 전형 과정 */}
              <div>
                <p className={`text-xs font-black ${textFaint} uppercase tracking-wider mb-2.5`}>전형 과정</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {r.process.map((step, i) => (
                    <React.Fragment key={i}>
                      <span className={`text-xs ${stepBadge} font-bold px-3 py-1.5 rounded-full border`}>
                        {i + 1}. {step}
                      </span>
                      {i < r.process.length - 1 && (
                        <ChevronLeft className={`w-3 h-3 ${textDim} rotate-180 shrink-0`} />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* 지원하기 버튼 */}
              <motion.button
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                onClick={() => setApplyModalOpen(true)}
                className={`w-full py-4 ${primaryBtn} rounded-full font-black text-base
                           flex items-center justify-center gap-2.5 transition-colors`}
              >
                <Send className="w-5 h-5" /> 지원하기
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className={`${cardBg} rounded-3xl border ${cardBorder} p-6 flex items-center gap-4`}
          >
            <div className={`w-12 h-12 ${noRecruitEmoji} rounded-2xl flex items-center justify-center text-2xl shrink-0`}>😴</div>
            <div>
              <p className={`font-bold ${textPri}`}>현재 모집 중이 아닙니다</p>
              <p className={`text-sm ${textFaint} mt-0.5`}>다음 모집 공고를 기다려주세요.</p>
            </div>
          </motion.div>
        )}

        {/* 동아리 소개 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.07 }}
          className={`${cardBg} rounded-3xl border ${cardBorder} p-6 space-y-4`}
        >
          <div className="flex items-center gap-2">
            <BookOpen className={`w-4 h-4 ${iconColor}`} />
            <h3 className={`font-black ${textPri}`}>동아리 소개</h3>
          </div>
          <p className={`text-sm ${isAdminMode ? 'text-black/70' : 'text-white/70'} leading-relaxed`}>{club.description}</p>

          <div>
            <p className={`text-xs font-black ${textFaint} uppercase tracking-wider mb-3`}>주요 활동</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {club.activities.map((act, i) => (
                <div key={i} className={`flex items-center gap-2.5 ${subItemBg} rounded-2xl px-3.5 py-2.5 border`}>
                  <Zap className={`w-3.5 h-3.5 ${iconColor} shrink-0`} />
                  <span className={`text-xs font-semibold ${textPri}`}>{act}</span>
                </div>
              ))}
            </div>
          </div>

          {club.techStack && (
            <div>
              <p className={`text-xs font-black ${textFaint} uppercase tracking-wider mb-2.5`}>기술 스택</p>
              <div className="flex flex-wrap gap-2">
                {club.techStack.map(t => (
                  <span key={t} className={`text-xs ${techBadge} font-bold px-3 py-1.5 rounded-full border`}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* 최근 소식 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className={`${cardBg} rounded-3xl border ${cardBorder} overflow-hidden`}
        >
          <div className={`px-6 py-4 border-b ${border} flex items-center gap-2`}>
            <Star className={`w-4 h-4 ${iconColor}`} />
            <h3 className={`font-black ${textPri}`}>최근 소식</h3>
          </div>
          <ul className={`divide-y ${divider}`}>
            {club.recentNews.map((n, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.05 }}
                className={`px-6 py-4 flex items-center gap-4 ${hoverBg} transition-colors`}
              >
                <span className={`text-xs ${textDim} font-medium shrink-0`}>{n.date}</span>
                <span className={`text-sm font-semibold ${textPri}`}>{n.title}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>

      </div>

      {/* ── 지원 모달 ── */}
      <AnimatePresence>
        {applyModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setApplyModalOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              className={`relative ${modalBg} w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border`}
            >
              {!sent ? (
                <>
                  <div className={`px-7 pt-7 pb-5 border-b ${modalBorder} flex items-center justify-between`}>
                    <div>
                      <h3 className={`text-lg font-black ${textPri}`}>{club.name} 지원하기</h3>
                      <p className={`text-xs ${textFaint} mt-0.5`}>{r?.title}</p>
                    </div>
                    <button onClick={() => setApplyModalOpen(false)}
                      className={`w-8 h-8 ${closeBtn} rounded-full flex items-center justify-center transition-colors`}>
                      <X size={15} className={closeBtnIcon} />
                    </button>
                  </div>
                  <div className="px-7 py-6 space-y-5">
                    <div>
                      <label className={`text-xs font-bold ${labelCls} uppercase tracking-wider block mb-2`}>지원 동기</label>
                      <textarea
                        value={applyMsg}
                        onChange={e => setApplyMsg(e.target.value)}
                        placeholder="이 동아리에 지원하는 이유를 간단히 적어주세요..."
                        rows={4}
                        className={`w-full px-4 py-3 rounded-2xl border text-sm
                                   outline-none focus:ring-2 resize-none transition-all ${inputCls}`}
                      />
                    </div>
                    {r?.applyUrl && (
                      <a href={r.applyUrl} target="_blank" rel="noreferrer"
                        className={`flex items-center gap-2 text-sm ${applyLinkCls} font-bold hover:underline`}>
                        <ExternalLink size={14} /> 공식 지원 폼 열기
                      </a>
                    )}
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleSend}
                      className={`w-full py-3.5 ${primaryBtn} rounded-full
                                 font-black text-sm transition-colors
                                 flex items-center justify-center gap-2`}
                    >
                      <Send size={16} /> 지원서 제출
                    </motion.button>
                  </div>
                </>
              ) : (
                <div className="px-7 py-14 text-center">
                  <CheckCircle2 className={`w-14 h-14 ${iconColor} mx-auto mb-4`} />
                  <p className={`text-xl font-black ${textPri}`}>지원 완료! 🎉</p>
                  <p className={`text-sm ${textFaint} mt-2`}>검토 후 연락드릴게요.</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
