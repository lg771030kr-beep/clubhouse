import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Search, Users, Compass, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { BackButton } from '../../components/common/BackButton';

/* ── 타입 ── */
interface Club {
  id: string;
  name: string;
  category: string | null;
  logo_url: string | null;
  description: string | null;
  is_recruiting: boolean;
  recruit_link: string | null;
  recruit_description: string | null;
  member_count: number;
}

/* ── 카테고리별 이모지 ── */
const CAT_EMOJI: Record<string, string> = {
  개발: '💻', 디자인: '🎨', 마케팅: '📣', 창업: '🚀',
  기획: '📋', 사진: '📷', 음악: '🎵', 스포츠: '⚽',
};
const getCatEmoji = (cat: string | null) => CAT_EMOJI[cat ?? ''] ?? '🏢';

/* ── 카테고리별 accent 색 ── */
const CAT_COLOR: Record<string, string> = {
  개발: '#22d3ee', 디자인: '#ec4899', 마케팅: '#f59e0b',
  창업: '#10b981', 기획: '#6366f1', 사진: '#f97316',
  음악: '#a78bfa', 스포츠: '#34d399',
};
const getCatColor = (cat: string | null) => CAT_COLOR[cat ?? ''] ?? '#6366f1';

const FIELD_TABS = ['전체', '개발', '디자인', '마케팅', '창업', '기획', '사진', '음악', '스포츠'];

/* ════════════════════════════════════════
   Component
════════════════════════════════════════ */
export function UserRecruitments() {
  const navigate = useNavigate();
  const [query,   setQuery]   = useState('');
  const [field,   setField]   = useState('전체');
  const [clubs,   setClubs]   = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── DB에서 전체 동아리 로드 ── */
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // ① 기본 컬럼만 우선 조회 (없는 컬럼 포함 시 400 방지)
        const { data: baseData, error: baseErr } = await supabase
          .from('clubs')
          .select('id, name, category, logo_url, description, created_at')
          .order('created_at', { ascending: false });

        if (baseErr) {
          console.error('[동아리 찾기] clubs 로드 실패:', baseErr.message);
          return;
        }
        if (!baseData || baseData.length === 0) return;

        // ② is_recruiting 등 선택적 컬럼 별도 조회 (없으면 무시)
        let recruitMap: Record<string, { is_recruiting: boolean; recruit_link: string | null; recruit_description: string | null }> = {};
        try {
          const { data: rData } = await supabase
            .from('clubs')
            .select('id, is_recruiting, recruit_link, recruit_description')
            .in('id', baseData.map(c => c.id));
          interface RecruitRow { id: string; is_recruiting: boolean | null; recruit_link: string | null; recruit_description: string | null; }
          (rData as RecruitRow[] ?? []).forEach((r) => {
            recruitMap[r.id] = {
              is_recruiting:      r.is_recruiting      ?? false,
              recruit_link:       r.recruit_link       ?? null,
              recruit_description: r.recruit_description ?? null,
            };
          });
        } catch { /* 컬럼 미존재 시 무시 — 기본값 false 사용 */ }

        // ③ 멤버 수 일괄 조회
        const { data: memData } = await supabase
          .from('club_members')
          .select('club_id')
          .in('club_id', baseData.map(c => c.id));

        const countMap: Record<string, number> = {};
        interface MemberCountRow { club_id: string; }
        (memData as MemberCountRow[] ?? []).forEach((m) => {
          countMap[m.club_id] = (countMap[m.club_id] ?? 0) + 1;
        });

        const mapped = baseData.map(c => ({
          id:                 c.id,
          name:               c.name,
          category:           c.category ?? null,
          logo_url:           c.logo_url ?? null,
          description:        c.description ?? null,
          is_recruiting:      recruitMap[c.id]?.is_recruiting      ?? false,
          recruit_link:       recruitMap[c.id]?.recruit_link       ?? null,
          recruit_description: recruitMap[c.id]?.recruit_description ?? null,
          member_count:       countMap[c.id] ?? 0,
        }));

        // 모집중 우선 정렬
        mapped.sort((a, b) => Number(b.is_recruiting) - Number(a.is_recruiting));
        setClubs(mapped);
      } catch (e) {
        console.error('[동아리 찾기] 예외:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  /* ── 필터링 ── */
  const filtered = clubs.filter(c => {
    const matchField = field === '전체' || c.category === field;
    const matchQ     = !query ||
      c.name.includes(query) ||
      (c.description ?? '').includes(query) ||
      (c.category ?? '').includes(query);
    return matchField && matchQ;
  });

  const recruitingCount = filtered.filter(c => c.is_recruiting).length;

  return (
    <div className="min-h-screen bg-black pb-28">

      {/* ── 헤더 ── */}
      <div className="bg-black border-b border-white/10 px-6 pt-12 pb-16">
        <div className="max-w-3xl mx-auto">
          <BackButton onClick={() => navigate(-1)} className="mb-8" />
          <div className="flex items-center gap-3 mb-2">
            <Compass className="w-6 h-6 text-white" />
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">동아리 찾기</h1>
          </div>
          <p className="text-white/50 text-sm font-medium pl-1">
            {loading ? '불러오는 중...' : `${clubs.length}개 동아리 · 모집중 ${clubs.filter(c => c.is_recruiting).length}개`}
          </p>
        </div>
      </div>

      {/* ── 검색 + 필터 ── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 -mt-8 relative z-10 space-y-3">

        {/* 검색창 */}
        <div className="bg-black rounded-3xl border border-white/20 flex items-center gap-3 px-4 py-3.5">
          <Search className="w-4 h-4 text-white/50 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="동아리명·분야·설명으로 검색..."
            className="flex-1 text-sm text-white placeholder:text-white/30 outline-none bg-transparent font-medium"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-white/40 hover:text-white text-lg leading-none transition-colors"
            >×</button>
          )}
        </div>

        {/* 분야 필터 칩 */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {FIELD_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setField(tab)}
              className={`shrink-0 px-4 py-2 rounded-full text-xs font-black border transition-all
                ${field === tab
                  ? 'bg-white text-black border-white'
                  : 'bg-black text-white/50 border-white/15 hover:border-white/40 hover:text-white'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* 카운트 라벨 */}
        {!loading && (
          <div className="flex items-center gap-3 px-1">
            <p className="text-xs font-bold text-white/40">
              {filtered.length}개 동아리
            </p>
            {recruitingCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-black text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                모집중 {recruitingCount}개
              </span>
            )}
          </div>
        )}

        {/* ── 로딩 ── */}
        {loading && (
          <div className="flex items-center justify-center py-20 gap-2 text-white/40">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-black">동아리 목록 불러오는 중...</span>
          </div>
        )}

        {/* ── 빈 결과 ── */}
        {!loading && filtered.length === 0 && (
          <div className="bg-black rounded-3xl border border-white/10 py-16 text-center">
            <p className="text-3xl mb-3">🔍</p>
            <p className="text-white font-bold text-sm">해당하는 동아리가 없습니다</p>
            <p className="text-white/30 text-xs mt-1">검색어나 분야 필터를 바꿔보세요</p>
          </div>
        )}

        {/* ── 동아리 카드 리스트 ── */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-3 pt-1">
            {filtered.map((club, i) => {
              const accent = getCatColor(club.category);
              const emoji  = getCatEmoji(club.category);
              return (
                <motion.div
                  key={club.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => navigate(`/club/${club.id}`)}
                  className="bg-black border border-white/10 rounded-3xl overflow-hidden cursor-pointer hover:border-white/25 transition-all"
                >
                  {/* ★ 모집중 강조 배너 */}
                  {club.is_recruiting && (
                    <div
                      className="flex items-center gap-2 px-5 py-2"
                      style={{ background: `${accent}20`, borderBottom: `1px solid ${accent}30` }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accent }} />
                      <span className="text-[11px] font-black tracking-widest uppercase" style={{ color: accent }}>
                        모집중
                      </span>
                      {club.recruit_link && (
                        <span className="ml-auto text-[10px] font-bold text-white/30">지원 링크 있음 →</span>
                      )}
                    </div>
                  )}

                  {/* 카드 본문 */}
                  <div className="flex items-center gap-4 p-5">
                    {/* 로고 */}
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border text-2xl overflow-hidden"
                      style={{ background: `${accent}15`, borderColor: `${accent}30` }}
                    >
                      {club.logo_url
                        ? <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover" />
                        : emoji
                      }
                    </div>

                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-black text-white text-sm leading-tight line-clamp-1">
                          {club.name}
                        </h3>
                        {/* 비모집중 → 회색 배지 */}
                        {!club.is_recruiting && (
                          <span className="shrink-0 text-[9px] font-black px-2 py-0.5 rounded-full bg-white/8 text-white/30 border border-white/10">
                            모집 없음
                          </span>
                        )}
                      </div>

                      {club.description && (
                        <p className="text-xs text-white/40 font-medium line-clamp-2 leading-relaxed">
                          {club.description}
                        </p>
                      )}

                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {club.category && (
                          <span
                            className="text-[10px] font-black px-2.5 py-0.5 rounded-full border"
                            style={{
                              color: accent,
                              borderColor: `${accent}40`,
                              background: `${accent}12`,
                            }}
                          >
                            {club.category}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-[10px] text-white/30 font-bold">
                          <Users className="w-3 h-3" />
                          {club.member_count}명
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
