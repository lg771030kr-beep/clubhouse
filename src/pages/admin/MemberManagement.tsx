import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { UserProfile, Role } from '../../types';
import {
  Users, Search, Award, Shield, User,
  Plus, X, Loader2, CheckCircle2, ChevronRight,
  ChevronLeft, ChevronRight as ChevronRightIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EmptyState } from '../../components/common/EmptyState';
import { BackButton } from '../../components/common/BackButton';
import { MemberDetailModal } from '../../components/admin/MemberDetailModal';

const PAGE_SIZE = 10;

export function MemberManagement() {
  const { profile, activeClubId } = useAuth();
  const { verified, checking } = useAdminGuard();
  const [members,     setMembers]     = useState<UserProfile[]>([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [searchTerm,  setSearchTerm]  = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [modalUserId, setModalUserId] = useState<string | null>(null);
  const [clubId,      setClubId]      = useState<string | null>(null);

  const [isAdding,    setIsAdding]    = useState(false);
  const [isSubmitting,setIsSubmitting]= useState(false);
  const [newMember,   setNewMember]   = useState({
    full_name: '', email: '', univ_name: '', role: 'USER' as Role,
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => { if (profile?.id && activeClubId) fetchMembers(); }, [profile?.id, activeClubId]);

  const fetchMembers = async () => {
    const cId = activeClubId;
    const adminId = profile?.id;
    if (!cId || !adminId) return;

    setIsLoading(true);
    setClubId(cId);

    // ① admin이 club_members에 없으면 자동 삽입 시도 (실패해도 계속 진행)
    try {
      const { data: existing } = await supabase
        .from('club_members')
        .select('user_id')
        .eq('club_id', cId)
        .eq('user_id', adminId)
        .maybeSingle();

      if (!existing) {
        const { error: insErr } = await supabase
          .from('club_members')
          .insert({ club_id: cId, user_id: adminId, role: 'ADMIN' });
        if (insErr) console.warn('[MemberManagement] admin 자동 삽입 실패:', insErr.message);
      }
    } catch (e) {
      console.warn('[MemberManagement] admin 체크/삽입 중 오류:', e);
    }

    // ② 동아리 전체 멤버 조회 (오류 시 빈 배열로 폴백)
    let memberProfiles: UserProfile[] = [];
    try {
      const { data: clubMembers, error } = await supabase
        .from('club_members')
        .select('user_id, role, profiles(*)')
        .eq('club_id', cId);

      if (error) {
        console.warn('[MemberManagement] club_members 조회 실패:', error.message);
      } else {
        interface MembershipRow { user_id: string; role: string; profiles: UserProfile | UserProfile[] | null; }
        memberProfiles = ((clubMembers ?? []) as MembershipRow[])
          .map((row) => {
            const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
            if (!p) return null;
            // club_members.role이 실제 권한 기준 — profiles.role보다 우선
            const cmRole = (row.role || '').toUpperCase();
            const effectiveRole: Role =
              (cmRole === 'ADMIN' || cmRole === 'LEADER' || cmRole === 'CAPTAIN')
                ? 'ADMIN' : 'USER';
            return { ...p, role: effectiveRole } as UserProfile;
          })
          .filter((p): p is UserProfile => p != null);
      }
    } catch (e) {
      console.warn('[MemberManagement] 멤버 조회 중 오류:', e);
    }

    // ③ admin이 여전히 목록에 없으면 → profiles 테이블에서 직접 조회해 맨 앞에 추가 (항상 실행)
    if (!memberProfiles.find(p => p.id === adminId)) {
      try {
        const { data: adminProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', adminId)
          .single();
        if (adminProfile) memberProfiles = [adminProfile as UserProfile, ...memberProfiles];
      } catch (e) {
        console.warn('[MemberManagement] admin 프로필 직접 조회 실패:', e);
      }
    }

    setMembers(memberProfiles);
    setIsLoading(false);
  };

  const handleRoleChange = async (userId: string, newRole: Role) => {
    // 멤버가 1명뿐일 때는 부원으로 변경 불가
    if (members.length === 1 && newRole !== 'ADMIN') {
      showToast('⚠️ 멤버가 1명일 때는 부원으로 변경할 수 없습니다.');
      return;
    }

    // 운영진 최소 1명 보호: 현재 ADMIN인 멤버가 1명뿐인데 그 사람의 역할을 바꾸려 할 때 차단
    const adminCount = members.filter(m => (m.role || '').toUpperCase() === 'ADMIN').length;
    const targetMember = members.find(m => m.id === userId);
    const isLastAdmin  = adminCount === 1 && (targetMember?.role || '').toUpperCase() === 'ADMIN';

    if (isLastAdmin && newRole !== 'ADMIN') {
      showToast('⚠️ 운영진이 최소 1명은 있어야 합니다.');
      return;
    }

    try {
      // ── 권한 재검증: club_members 기준으로 현재 사용자가 ADMIN/LEADER인지 확인 ──
      const { data: myMembership, error: myErr } = await supabase
        .from('club_members')
        .select('role')
        .eq('club_id', activeClubId!)
        .eq('user_id', profile!.id)
        .maybeSingle();
      const myRole = (myMembership?.role || '').toUpperCase();
      if (myErr || !['ADMIN', 'LEADER', 'CAPTAIN'].includes(myRole)) {
        showToast('권한이 없습니다.');
        return;
      }

      // club_members.role 업데이트 (이 동아리 내 역할 — 핵심)
      const clubRole = newRole === 'ADMIN' ? 'ADMIN' : 'MEMBER';
      if (clubId) {
        const { error: cmErr } = await supabase
          .from('club_members')
          .update({ role: clubRole })
          .eq('club_id', clubId)
          .eq('user_id', userId);
        if (cmErr) throw cmErr;
      }

      // profiles.role도 동기화 (실패해도 표시엔 영향 없음 — silent)
      await supabase
        .from('profiles').update({ role: newRole }).eq('id', userId)
        .then(() => {});

      setMembers(members.map(m => m.id === userId ? { ...m, role: newRole } : m));
      showToast('역할이 성공적으로 변경되었습니다!');
    } catch (err: unknown) {
      alert('역할 변경에 실패했습니다. ' + (err instanceof Error ? err.message : ''));
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const generatedId = crypto.randomUUID();
      const newProfile = {
        id: generatedId,
        full_name: newMember.full_name,
        email: newMember.email,
        univ_name: newMember.univ_name,
        role: newMember.role,
        created_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('profiles').insert([newProfile]);
      if (error) {
        if (error.code === '23503') throw new Error('Supabase auth 제약조건으로 직접 추가 불가합니다. MVP 테스트를 위해 제약조건을 해제해주세요.');
        throw error;
      }
      setMembers([newProfile as UserProfile, ...members]);
      setIsAdding(false);
      setCurrentPage(1);
      setNewMember({ full_name: '', email: '', univ_name: '', role: 'USER' });
      showToast('부원이 등록되었습니다!');
    } catch (err: unknown) {
      alert(`부원 등록에 실패했습니다.\n${err instanceof Error ? err.message : ''}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── 검색 + 페이지네이션 ── */
  const filtered = members.filter(m =>
    (m.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || '') ||
    m.email.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(currentPage, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSearch = (v: string) => { setSearchTerm(v); setCurrentPage(1); };

  /* ── 역할 뱃지 ── */
  const RoleBadge = ({ role }: { role: string }) => {
    const r = (role || '').toUpperCase();
    if (r === 'ADMIN' || r === 'LEADER')
      return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-black text-white"><Shield size={11} />운영진</span>;
    return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-black/6 border border-black/15 text-black/60"><User size={11} />부원</span>;
  };

  /* ═══════════════════════════════════════════
     Render
  ═══════════════════════════════════════════ */
  if (checking || !verified) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-black/30 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">

      {/* ── 상단 헤더 배너 (White) ── */}
      <div className="bg-white text-black pt-16 pb-16 px-6 shadow-sm" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <div className="relative z-10 max-w-5xl mx-auto">
          <BackButton to="/admin" className="mb-4" />
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                <Users className="w-8 h-8 opacity-90" />
                부원 관리
              </h1>
              <p className="mt-1.5 text-black/70 text-sm font-medium">부원 목록을 확인하고 역할을 관리하세요.</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 px-6 py-3 bg-black hover:bg-black/90
                         border border-black/20 text-white font-black rounded-full
                         transition-colors shrink-0"
            >
              <Plus size={18} /> 신규 부원 등록
            </motion.button>
          </div>
        </div>
      </div>

      {/* ── 콘텐츠 ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-8 relative z-20 space-y-5">

        {/* 검색 바 카드 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="bg-white rounded-3xl px-5 py-4 flex flex-col sm:flex-row gap-3 items-center border border-black/20"
        >
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-black/50" size={18} />
            <input
              type="text"
              placeholder="이름 또는 이메일로 검색..."
              value={searchTerm}
              onChange={e => handleSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white border border-black/20 text-black placeholder:text-black/50
                         focus:border-black focus:ring-2 focus:ring-black/20 transition-all outline-none text-sm"
            />
          </div>
          <span className="text-sm text-black/70 font-medium shrink-0">
            총 <strong className="text-black">{filtered.length}</strong>명
          </span>
        </motion.div>

        {/* 테이블 카드 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.07, ease: [0.22, 1, 0.36, 1] }}
          className="bg-white rounded-3xl overflow-hidden border border-black/20"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/20 bg-black/2">
                  <th className="py-4 px-6 font-black text-black/70 text-xs uppercase tracking-wider whitespace-nowrap min-w-[140px]">이름</th>
                  <th className="py-4 px-6 font-black text-black/70 text-xs uppercase tracking-wider">이메일</th>
                  <th className="py-4 px-6 font-black text-black/70 text-xs uppercase tracking-wider hidden sm:table-cell">소속 / 팀</th>
                  <th className="py-4 px-6 font-black text-black/70 text-xs uppercase tracking-wider text-right whitespace-nowrap">역할</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/20">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="py-16 text-center">
                      <Loader2 className="animate-spin w-8 h-8 text-black mx-auto" />
                      <p className="text-black/50 text-sm mt-3">부원 목록을 불러오는 중...</p>
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center">
                      <EmptyState
                        icon={<Users size={32} className="opacity-40" />}
                        message={searchTerm ? '검색 결과가 없습니다.' : '등록된 부원이 없습니다.'}
                      />
                    </td>
                  </tr>
                ) : (
                  paginated.map((member, i) => (
                    <motion.tr
                      key={member.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.035 }}
                      className="hover:bg-black/5 transition-colors group"
                    >
                      {/* 이름 */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-black
                                          flex items-center justify-center text-white text-sm font-black shrink-0">
                            {(member.full_name || '?')[0]}
                          </div>
                          <button
                            onClick={() => setModalUserId(member.id)}
                            className="group/btn flex items-center gap-0.5 font-black text-black
                                       hover:text-black hover:bg-black/5 active:scale-95
                                       px-2 py-1 rounded-lg transition-all -mx-2 text-sm truncate"
                          >
                            {member.full_name || '이름 미상'}
                            <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover/btn:opacity-100
                                                      -translate-x-1 group-hover/btn:translate-x-0 transition-all shrink-0" />
                          </button>
                        </div>
                      </td>
                      {/* 이메일 */}
                      <td className="py-4 px-6">
                        <span className="text-sm text-black/70">{member.email}</span>
                      </td>
                      {/* 소속 */}
                      <td className="py-4 px-6 hidden sm:table-cell">
                        <span className="text-sm text-black/70">{member.univ_name || '—'}</span>
                      </td>
                      {/* 역할 변경 */}
                      <td className="py-4 px-6 text-right">
                        <select
                          value={['ADMIN','LEADER'].includes((member.role || '').toUpperCase()) ? 'ADMIN' : 'USER'}
                          onChange={e => handleRoleChange(member.id, e.target.value as Role)}
                          disabled={members.length === 1}
                          title={members.length === 1 ? '멤버가 1명일 때는 역할을 변경할 수 없습니다' : undefined}
                          className="px-3 py-2 bg-black border border-black/40 rounded-2xl text-sm font-bold
                                     text-white focus:outline-none focus:border-white focus:ring-2
                                     focus:ring-white/20 transition-all appearance-none
                                     disabled:opacity-40 disabled:cursor-not-allowed
                                     enabled:cursor-pointer enabled:hover:bg-black/90"
                          style={{
                            paddingRight: '2rem',
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23ffffff'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                            backgroundPosition: 'right 0.5rem center',
                            backgroundRepeat: 'no-repeat',
                            backgroundSize: '1.2em 1.2em',
                          }}
                        >
                          <option value="USER">부원</option>
                          <option value="ADMIN">운영진</option>
                        </select>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── 페이지네이션 ── */}
          {!isLoading && totalPages > 1 && (
            <div className="px-6 py-4 border-t border-black/20 flex items-center justify-between gap-3">
              <span className="text-xs text-black/60 font-medium">
                {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} / {filtered.length}명
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="p-2 rounded-2xl hover:bg-black/5 text-black/60 disabled:opacity-30
                             disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                  .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p === 'ellipsis' ? (
                      <span key={`e${idx}`} className="px-1.5 text-black/60 text-sm">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p as number)}
                        className={`w-8 h-8 rounded-2xl text-sm font-black transition-all
                          ${safePage === p
                            ? 'bg-black text-white shadow-sm'
                            : 'hover:bg-black/5 text-black/60'}`}
                      >
                        {p}
                      </button>
                    )
                  )}

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="p-2 rounded-2xl hover:bg-black/5 text-black/60 disabled:opacity-30
                             disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRightIcon size={16} />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── 신규 등록 모달 ── */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-black/20"
            >
              <div className="shrink-0 p-8 border-b border-black/20 flex items-center justify-between">
                <h3 className="text-2xl font-black text-black">신규 부원 등록</h3>
                <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-black/5 rounded-2xl transition-colors">
                  <X size={24} className="text-black/60" />
                </button>
              </div>
              <form onSubmit={handleAddMember} className="p-8 space-y-6 overflow-y-auto">
                {[
                  { label: '이름', key: 'full_name', type: 'text', placeholder: '예: 홍길동', required: true },
                  { label: '이메일', key: 'email', type: 'email', placeholder: '예: user@example.com', required: true },
                  { label: '소속 팀 (선택)', key: 'univ_name', type: 'text', placeholder: '예: 기획 1팀', required: false },
                ].map(f => (
                  <div key={f.key} className="space-y-2">
                    <label className="text-sm font-black text-black/70">{f.label}</label>
                    <input
                      required={f.required}
                      type={f.type}
                      value={newMember[f.key as keyof typeof newMember]}
                      onChange={e => setNewMember({ ...newMember, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                      className="w-full p-4 rounded-2xl bg-white border border-black/20 text-black placeholder:text-black/50
                                 focus:border-black focus:ring-2 focus:ring-black/20 transition-all outline-none"
                    />
                  </div>
                ))}
                <div className="space-y-2">
                  <label className="text-sm font-black text-black/70">역할</label>
                  <select
                    value={newMember.role}
                    onChange={e => setNewMember({ ...newMember, role: e.target.value as Role })}
                    className="w-full p-4 rounded-2xl bg-white border border-black/20 text-black
                               focus:border-black focus:ring-2 focus:ring-black/20 transition-all
                               outline-none appearance-none font-bold"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23000000'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundPosition: 'right 1rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
                  >
                    <option value="USER">부원</option>
                    <option value="ADMIN">운영진</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 rounded-full font-black bg-black text-white hover:bg-black/90
                             active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <><Loader2 className="animate-spin" size={20} />등록 중...</> : '등록하기'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 부원 상세 모달 ── */}
      <MemberDetailModal userId={modalUserId} onClose={() => setModalUserId(null)} />

      {/* ── Toast ── */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-8 right-8 z-[300] flex items-center gap-3 px-6 py-4
                       bg-white border border-black/20 text-black rounded-3xl shadow-lg font-black backdrop-blur"
          >
            <CheckCircle2 className="text-black" size={24} />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
