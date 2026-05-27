import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, Calendar, MapPin, Megaphone,
  CheckCircle2, Clock, Send, X, ExternalLink,
  Zap, Loader2,
} from 'lucide-react';
import { BackButton } from '../../components/common/BackButton';

/* ══════════════════════════════════════════
   Types
══════════════════════════════════════════ */
interface ClubData {
  id: number | string;
  name: string;
  logo_url?: string | null;
  field: string;
  members: number;
  founded?: string | null;
  location: string;
  description: string;
  tech_stack?: string[] | null;
  isRecruiting: boolean;
  recruit_link?: string | null;
}

interface ClubDBRow {
  id: number | string;
  name: string | null;
  logo_url?: string | null;
  category?: string | null;
  member_count?: number | null;
  founded_at?: string | null;
  location?: string | null;
  description?: string | null;
  tech_stack?: string[] | null;
  is_recruiting?: boolean | null;
  recruit_link?: string | null;
}

function mapClubFromDB(row: ClubDBRow): ClubData {
  return {
    id:          row.id,
    name:        row.name        ?? '알 수 없음',
    logo_url:    row.logo_url    ?? null,
    field:       row.category    ?? '기타',
    members:     row.member_count ?? 0,
    founded:     row.founded_at  ?? null,
    location:    row.location    ?? '-',
    description: row.description ?? '',
    tech_stack:  Array.isArray(row.tech_stack) ? row.tech_stack : null,
    isRecruiting: row.is_recruiting ?? false,
    recruit_link: row.recruit_link ?? null,
  };
}

export function ClubDetail() {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const { isAdminMode } = useAuth();

  const [club,           setClub]           = useState<ClubData | null>(null);
  const [pageLoading,    setPageLoading]    = useState(true);
  const [notFound,       setNotFound]       = useState(false);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [applyMsg,       setApplyMsg]       = useState('');
  const [sent,           setSent]           = useState(false);

  useEffect(() => {
    if (!clubId) { setNotFound(true); setPageLoading(false); return; }
    async function loadClub() {
      setPageLoading(true);
      const { data, error } = await supabase
        .from('clubs')
        .select('id, name, category, logo_url, is_recruiting, recruit_link, description, member_count, location, tech_stack, founded_at')
        .eq('id', clubId)
        .maybeSingle();
      if (!error && data) {
        setClub(mapClubFromDB(data as ClubDBRow));
      } else {
        setNotFound(true);
      }
      setPageLoading(false);
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
  const textFaint   = isAdminMode ? 'text-black/50'         : 'text-white/50';
  const iconColor   = isAdminMode ? 'text-black'            : 'text-white';
  const subItemBg   = isAdminMode ? 'bg-black/5 border-black/8'   : 'bg-white/5 border-white/8';
  const fieldBadge  = isAdminMode ? 'bg-black/8 border-black/20 text-black'   : 'bg-white/8 border-white/20 text-white';
  const recruitBadge= isAdminMode ? 'bg-black text-white'   : 'bg-white text-black';
  const primaryBtn  = isAdminMode ? 'bg-black text-white hover:bg-black/90'   : 'bg-white text-black hover:bg-white/90';
  const banner      = isAdminMode ? 'bg-black text-white'   : 'bg-white text-black';
  const bannerIcon  = isAdminMode ? 'text-white'            : 'text-black';
  const techBadge   = isAdminMode ? 'bg-black/5 border-black/15 text-black'   : 'bg-white/5 border-white/15 text-white';
  const noRecruitEmoji = isAdminMode ? 'bg-black/5' : 'bg-white/5';

  const modalBg     = isAdminMode ? 'bg-white border-black/15'    : 'bg-black border-white/15';
  const modalBorder = isAdminMode ? 'border-black/10'             : 'border-white/10';
  const inputCls    = isAdminMode
    ? 'bg-black/5 border-black/15 text-black placeholder:text-black/30 focus:border-black/40 focus:ring-black/10'
    : 'bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-white/40 focus:ring-white/10';
  const closeBtn    = isAdminMode ? 'bg-black/8 hover:bg-black/15' : 'bg-white/8 hover:bg-white/15';
  const closeBtnIcon= isAdminMode ? 'text-black'                   : 'text-white';
  const labelCls    = isAdminMode ? 'text-black/60'                : 'text-white/60';
  const applyLinkCls= isAdminMode ? 'text-black'                   : 'text-white';

  /* ── 로딩 ── */
  if (pageLoading) {
    return (
      <div className={`min-h-screen ${bg} flex items-center justify-center`}>
        <div className="text-center space-y-3">
          <Loader2 className={`w-8 h-8 ${textFaint} animate-spin mx-auto`} />
          <p className={`${textFaint} font-medium text-sm`}>불러오는 중...</p>
        </div>
      </div>
    );
  }

  /* ── 404 ── */
  if (notFound || !club) {
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

  const handleSend = () => {
    setSent(true);
    setTimeout(() => { setApplyModalOpen(false); setSent(false); setApplyMsg(''); }, 1500);
  };

  return (
    <div className={`min-h-screen ${bg} pb-24`}>

      {/* ── 헤더 ── */}
      <div className={`${bg} border-b ${border} px-6 pt-12 pb-20`}>
        <div className="max-w-5xl mx-auto">
          <BackButton onClick={() => navigate(-1)} className="mb-8" />

          <div className="flex items-start gap-5">
            {/* 로고 or 이니셜 */}
            <div className={`w-20 h-20 rounded-3xl overflow-hidden shrink-0
                            ${isAdminMode ? 'bg-black/5 border-black/15' : 'bg-white/5 border-white/15'}
                            border flex items-center justify-center`}>
              {club.logo_url
                ? <img src={club.logo_url} alt="로고" className="w-full h-full object-cover" />
                : <span className={`text-3xl font-black ${textPri}`}>{club.name.slice(0, 1)}</span>
              }
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
                {club.founded && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> {club.founded}
                  </span>
                )}
                {club.location && club.location !== '-' && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> {club.location}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 콘텐츠 ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-8 relative z-10 space-y-5">

        {/* 모집 공고 카드 */}
        {club.isRecruiting ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className={`${cardBg} rounded-3xl border ${cardBorder} overflow-hidden`}
          >
            {/* 공고 배너 */}
            <div className={`${banner} px-6 py-4 flex items-center gap-2.5`}>
              <Megaphone className={`w-5 h-5 ${bannerIcon}`} />
              <span className={`font-black ${bannerIcon} text-sm`}>신입 부원 모집 중</span>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <h2 className={`text-xl font-black ${textPri}`}>{club.name} 신입 부원 모집</h2>
                <div className={`flex flex-wrap gap-4 mt-2 text-sm ${textMuted} font-medium`}>
                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />모집 중</span>
                </div>
              </div>

              {/* 지원 링크 */}
              {club.recruit_link && (
                <a
                  href={club.recruit_link}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex items-center gap-2 text-sm ${applyLinkCls} font-bold hover:underline`}
                >
                  <ExternalLink size={14} /> 공식 지원 폼 열기
                </a>
              )}

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
          <h3 className={`font-black ${textPri}`}>동아리 소개</h3>

          {club.description ? (
            <p className={`text-sm ${isAdminMode ? 'text-black/70' : 'text-white/70'} leading-relaxed`}>
              {club.description}
            </p>
          ) : (
            <p className={`text-sm ${textFaint}`}>소개글이 없습니다.</p>
          )}

          {/* 기술 스택 */}
          {club.tech_stack && club.tech_stack.length > 0 && (
            <div>
              <p className={`text-xs font-black ${textFaint} uppercase tracking-wider mb-2.5`}>기술 스택</p>
              <div className="flex flex-wrap gap-2">
                {club.tech_stack.map(t => (
                  <span key={t} className={`text-xs ${techBadge} font-bold px-3 py-1.5 rounded-full border`}>
                    <Zap className="w-2.5 h-2.5 inline mr-1" />{t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 위치 */}
          {club.location && club.location !== '-' && (
            <div className={`flex items-center gap-2.5 ${subItemBg} rounded-2xl px-3.5 py-2.5 border`}>
              <MapPin className={`w-3.5 h-3.5 ${iconColor} shrink-0`} />
              <span className={`text-xs font-semibold ${textPri}`}>{club.location}</span>
            </div>
          )}
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
                      <p className={`text-xs ${textFaint} mt-0.5`}>신입 부원 모집</p>
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
                    {club.recruit_link && (
                      <a href={club.recruit_link} target="_blank" rel="noreferrer"
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
