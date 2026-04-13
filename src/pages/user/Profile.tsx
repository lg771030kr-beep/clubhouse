import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Edit3, Mail, GraduationCap, User as UserIcon,
  X, Loader2, Users, Building2, ChevronRight, ShieldCheck,
} from 'lucide-react';
import { BackButton } from '../../components/common/BackButton';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

/* ── 타입 ── */
interface ClubMembership {
  role: string;
  clubs: {
    id: string;
    name: string;
    logo_url?: string | null;
    category?: string | null;
  } | null;
}

/* ── 역할 Badge 컬러 맵 ── */
const roleStyle: Record<string, { label: string; cls: string }> = {
  LEADER: { label: 'LEADER', cls: 'bg-white text-black' },
  ADMIN:  { label: 'ADMIN',  cls: 'bg-white/20 text-white border border-white/30' },
  MEMBER: { label: 'MEMBER', cls: 'bg-white/10 text-white/60 border border-white/15' },
};

const getRoleStyle = (role: string) =>
  roleStyle[role?.toUpperCase()] ?? roleStyle['MEMBER'];

/* ══════════════════════════════════════════
   Profile Page
══════════════════════════════════════════ */
export function Profile() {
  const { profile } = useAuth();
  const navigate    = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving,  setIsSaving]  = useState(false);
  const [userInfo,  setUserInfo]  = useState({
    name:      profile?.full_name || '김부원',
    email:     profile?.email     || 'user@example.com',
    university:profile?.univ_name || '미등록 학교',
    studentId: '—',
  });
  const [editForm, setEditForm] = useState(userInfo);

  const [memberships,   setMemberships]   = useState<ClubMembership[]>([]);
  const [isClubLoading, setIsClubLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) { setIsClubLoading(false); return; }

    const fetchMemberships = async () => {
      setIsClubLoading(true);
      try {
        const { data, error } = await supabase
          .from('members')
          .select('role, clubs(id, name, logo_url, category)')
          .eq('user_id', profile.id);
        if (error) throw error;
        setMemberships((data as ClubMembership[]) || []);
      } catch (err) {
        console.warn('[Profile] members fetch 실패 — 폴백 사용:', err);
        if (profile.univ_name) {
          try {
            const { data: clubData } = await supabase
              .from('clubs')
              .select('id, name, logo_url, category')
              .eq('name', profile.univ_name)
              .limit(1);
            if (clubData && clubData.length > 0) {
              setMemberships([{ role: profile.role ?? 'MEMBER', clubs: clubData[0] }]);
            }
          } catch { /* 최종 실패 */ }
        }
      } finally {
        setIsClubLoading(false);
      }
    };

    fetchMemberships();
  }, [profile?.id, profile?.univ_name, profile?.role]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      setUserInfo(editForm);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-black font-sans w-full mx-auto max-w-lg relative pb-12">

      {/* ── 헤더 ── */}
      <header className="bg-black px-6 py-4 flex flex-col gap-1
                         border-b border-white/10 sticky top-0 z-20">
        <BackButton />
        <h1 className="text-lg font-black text-white">계정 정보</h1>
      </header>

      <div className="p-6 space-y-6">

        {/* 섹션 1: 내 정보 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-white/60" />
              내 정보
            </h2>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 bg-white text-black font-black text-xs
                         rounded-full flex items-center gap-1.5 hover:bg-white/90 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" /> 정보 수정
            </motion.button>
          </div>

          <div className="bg-black rounded-3xl border border-white/10 p-6 relative overflow-hidden">
            {/* 아바타 + 이름 */}
            <div className="flex items-center gap-5 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/10
                              flex items-center justify-center text-2xl shrink-0">
                😊
              </div>
              <div>
                <h3 className="text-xl font-black text-white">{userInfo.name}</h3>
                <span className="inline-block mt-1 px-2.5 py-0.5 bg-white/10 text-white/60
                                 font-black text-[10px] rounded-full uppercase tracking-wide">
                  {profile?.role ?? 'MEMBER'}
                </span>
              </div>
            </div>

            {/* 정보 목록 */}
            <div className="space-y-4">
              {[
                { icon: Mail,          label: '이메일',    value: userInfo.email      },
                { icon: GraduationCap, label: '소속 학교', value: userInfo.university },
                { icon: UserIcon,      label: '학번',      value: userInfo.studentId  },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center text-white/40 shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs text-white/40 font-medium mb-0.5">{label}</p>
                    <p className="font-bold text-white">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* 섹션 2: 소속 동아리 */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-white/60" />
            <h2 className="text-base font-black text-white">소속 동아리</h2>
            {!isClubLoading && memberships.length > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-white text-black
                               text-[10px] font-black">
                {memberships.length}
              </span>
            )}
          </div>

          {isClubLoading && (
            <div className="flex items-center justify-center py-12 gap-2 text-white/40">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-medium">불러오는 중...</span>
            </div>
          )}

          {!isClubLoading && memberships.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-black rounded-3xl border border-white/10 p-10 flex flex-col items-center gap-3 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-white/8 flex items-center justify-center">
                <Building2 className="w-7 h-7 text-white/30" />
              </div>
              <p className="text-sm font-bold text-white/50">소속된 동아리가 없습니다</p>
              <p className="text-xs text-white/30">동아리에 가입하면 여기에 표시됩니다.</p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/user/recruitments')}
                className="mt-2 px-4 py-2 rounded-full bg-white text-black
                           font-black text-sm hover:bg-white/90 transition-colors"
              >
                모집 공고 탐색하기 →
              </motion.button>
            </motion.div>
          )}

          {!isClubLoading && memberships.length > 0 && (
            <div className="space-y-3">
              {memberships.map((m, i) => {
                const club      = m.clubs;
                const roleInfo  = getRoleStyle(m.role);
                const initial   = club?.name?.slice(0, 2) ?? 'CL';

                return (
                  <motion.div
                    key={club?.id ?? i}
                    custom={i}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 + i * 0.07, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.985 }}
                    onClick={() => navigate('/user/recruitments')}
                    className="bg-black rounded-2xl border border-white/10 px-5 py-4 flex items-center gap-4 cursor-pointer group"
                  >
                    <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0 bg-white/8
                                    flex items-center justify-center border border-white/10">
                      {club?.logo_url ? (
                        <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-white/10 flex items-center justify-center text-white font-black text-sm">
                          {initial}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-black text-white text-sm truncate">
                        {club?.name ?? '이름 없음'}
                      </p>
                      {club?.category && (
                        <p className="text-xs text-white/40 font-medium mt-0.5 truncate">
                          {club.category}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full
                                        text-[10px] font-black tracking-wide ${roleInfo.cls}`}>
                        {m.role?.toUpperCase() === 'LEADER' && <ShieldCheck className="w-3 h-3" />}
                        {roleInfo.label}
                      </span>
                      <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white transition-colors" />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.section>

      </div>

      {/* 정보 수정 모달 */}
      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsEditing(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="relative bg-black w-full sm:max-w-sm rounded-t-[2.5rem]
                         sm:rounded-[2.5rem] border border-white/15 shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto my-4 sm:hidden" />

              <div className="shrink-0 px-6 sm:px-8 pb-4 sm:pt-8 border-b border-white/10
                              flex items-center justify-between">
                <h3 className="text-xl font-black text-white">내 정보 변경</h3>
                <button onClick={() => setIsEditing(false)}
                  className="p-2 hover:bg-white/8 rounded-xl transition-colors hidden sm:block">
                  <X size={22} className="text-white/50" />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="p-6 sm:p-8 space-y-5">
                {[
                  { label: '이름',      key: 'name',       type: 'text',  ro: false },
                  { label: '이메일',    key: 'email',      type: 'email', ro: true  },
                  { label: '소속 학교', key: 'university', type: 'text',  ro: false },
                  { label: '학번',      key: 'studentId',  type: 'text',  ro: false },
                ].map(f => (
                  <div key={f.key} className="space-y-1.5">
                    <label className="text-xs font-black text-white/60 block">{f.label}</label>
                    <input
                      type={f.type}
                      readOnly={f.ro}
                      title={f.ro ? `${f.label}은 변경할 수 없습니다.` : undefined}
                      value={editForm[f.key as keyof typeof editForm]}
                      onChange={e => !f.ro && setEditForm({ ...editForm, [f.key]: e.target.value })}
                      className={`w-full p-4 rounded-2xl border outline-none font-medium transition-all text-sm
                        ${f.ro
                          ? 'bg-white/5 border-white/8 text-white/30 cursor-not-allowed'
                          : 'bg-white/5 border-white/15 text-white focus:border-white/40 focus:ring-2 focus:ring-white/10'
                        }`}
                    />
                  </div>
                ))}

                <motion.button
                  type="submit" disabled={isSaving}
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }}
                  className="w-full py-4 mt-2 bg-white text-black rounded-2xl font-black
                             disabled:opacity-60 transition-all"
                >
                  {isSaving ? (
                    <span className="inline-flex items-center gap-2 justify-center">
                      <Loader2 className="h-5 w-5 animate-spin" /> 저장 중...
                    </span>
                  ) : '저장하기'}
                </motion.button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
