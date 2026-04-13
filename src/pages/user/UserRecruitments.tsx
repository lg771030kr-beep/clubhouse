/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ChevronRight, Search, Megaphone,
  Clock, Users, CheckCircle2, CalendarDays,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { BackButton } from '../../components/common/BackButton';

interface Recruitment {
  id: number;
  clubId: number;
  clubName: string;
  clubEmoji: string;
  clubField: string;
  posterEmoji: string;
  accentColor: string;
  title: string;
  target: string;
  quota: number;
  deadline: string;
  period: string;
  requirements: string[];
  process: string[];
}

const TODAY = new Date('2026-03-20');
function calcDday(deadline: string): number {
  return Math.ceil((new Date(deadline).getTime() - TODAY.getTime()) / 86_400_000);
}

const ALL_RECRUITMENTS: Recruitment[] = [
  {
    id: 1, clubId: 1, clubName: 'Club DX 개발팀', clubEmoji: '💻', clubField: '개발',
    posterEmoji: '🖥️', accentColor: '#22d3ee',
    title: '2026 Spring 신입 부원 모집', target: '개발에 열정 있는 누구나 (전공 무관)',
    quota: 10, deadline: '2026-03-31', period: '2026.03.01 ~ 2026.03.31',
    requirements: ['기초 프로그래밍 경험', '매주 정기 세션 참여 가능', '협업을 좋아하는 분'],
    process: ['서류 접수', '코딩 테스트', '면담', '최종 합격'],
  },
  {
    id: 2, clubId: 2, clubName: '크리에이티브 디자인', clubEmoji: '🎨', clubField: '디자인',
    posterEmoji: '✏️', accentColor: '#ec4899',
    title: '2026 상반기 디자이너 모집', target: '디자인에 관심 있는 누구나',
    quota: 6, deadline: '2026-04-05', period: '2026.03.10 ~ 2026.04.05',
    requirements: ['기초 Figma 사용 가능자', '포트폴리오 1개 이상', '정기 모임 참여 가능'],
    process: ['포트폴리오 제출', '과제 전형', '면담', '합격'],
  },
  {
    id: 3, clubId: 4, clubName: '알고리즘 스터디', clubEmoji: '🧠', clubField: '개발',
    posterEmoji: '🔢', accentColor: '#6366f1',
    title: '2026 봄학기 스터디원 모집', target: 'BOJ 실버 이상 또는 동급 실력 보유자',
    quota: 8, deadline: '2026-03-25', period: '2026.03.15 ~ 2026.03.25',
    requirements: ['알고리즘 기초 학습 경험', '주 1회 오프라인 세션 참여', '코드 리뷰에 적극 참여'],
    process: ['지원서 접수', '간단 코딩 과제', '합격'],
  },
  {
    id: 4, clubId: 6, clubName: '게임 크리에이터', clubEmoji: '🎮', clubField: '개발',
    posterEmoji: '🌌', accentColor: '#8b5cf6',
    title: '2026 신학기 게임 개발 팀원 모집', target: 'Unity 또는 언리얼 경험자 우대',
    quota: 5, deadline: '2026-04-10', period: '2026.03.20 ~ 2026.04.10',
    requirements: ['게임 개발 기초 이해', '팀 프로젝트 경험 우대', '주 2회 작업 세션 참여'],
    process: ['지원서 접수', '포트폴리오 심사', '팀 미팅', '합격'],
  },
  {
    id: 5, clubId: 5, clubName: '창업 스타터', clubEmoji: '🚀', clubField: '창업',
    posterEmoji: '💡', accentColor: '#10b981',
    title: '2026 시즌 2 팀원 충원', target: '창업에 진심인 1~3학년',
    quota: 4, deadline: '2026-04-20', period: '2026.04.01 ~ 2026.04.20',
    requirements: ['사업계획서 작성 경험 우대', '주 1회 미팅 필수 참여', '스타트업에 관심 있는 분'],
    process: ['지원서 + 아이디어 제출', '발표 면접', '최종 선발'],
  },
];

const FIELD_BADGE: Record<string, string> = {
  개발:   'stat-badge-cyan',
  디자인: 'stat-badge-violet',
  마케팅: 'stat-badge-amber',
  창업:   'stat-badge-emerald',
};

const FIELD_TABS = ['전체', '개발', '디자인', '마케팅', '창업'];

const CAT_ACCENT_R: Record<string, string>  = { 개발: '#22d3ee', 디자인: '#ec4899', 마케팅: '#f59e0b', 창업: '#10b981' };
const CAT_EMOJI_R: Record<string, string>   = { 개발: '💻', 디자인: '🎨', 마케팅: '📣', 창업: '🚀' };
const CAT_POSTER_R: Record<string, string>  = { 개발: '🖥️', 디자인: '✏️', 마케팅: '📢', 창업: '💡' };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRecruitment(c: any, idx: number): Recruitment {
  const cat = c.category ?? '개발';
  return {
    id:           c.id ?? idx,
    clubId:       c.id ?? idx,
    clubName:     c.name ?? '알 수 없음',
    clubEmoji:    CAT_EMOJI_R[cat]  ?? '🏢',
    clubField:    cat,
    posterEmoji:  CAT_POSTER_R[cat] ?? '📋',
    accentColor:  CAT_ACCENT_R[cat] ?? '#6366f1',
    title:        c.recruit_title   ?? `${c.name} 신입 모집`,
    target:       c.recruit_target  ?? '관심 있는 누구나',
    quota:        c.recruit_quota   ?? 0,
    deadline:     c.recruit_deadline ?? '2026-12-31',
    period:       c.recruit_period  ?? '-',
    requirements: Array.isArray(c.requirements) ? c.requirements : [],
    process:      Array.isArray(c.process) ? c.process : ['지원서 접수', '면담', '합격'],
  };
}

/* D-Day Badge */
function DDayBadge({ deadline }: { deadline: string }) {
  const d = calcDday(deadline);
  if (d < 0) return (
    <span className="text-[11px] font-black px-3 py-1 rounded-full stat-badge-indigo opacity-60">마감</span>
  );
  if (d === 0) return (
    <span className="text-[11px] font-black px-3 py-1 rounded-full stat-badge-rose animate-pulse">D-Day</span>
  );
  if (d <= 7) return (
    <span className="text-[11px] font-black px-3 py-1 rounded-full stat-badge-rose">D-{d}</span>
  );
  return (
    <span className="text-[11px] font-black px-3 py-1 rounded-full stat-badge-cyan">D-{d}</span>
  );
}

export function UserRecruitments() {
  const navigate = useNavigate();
  const [query,        setQuery]        = useState('');
  const [field,        setField]        = useState('전체');
  const [recruitments, setRecruitments] = useState<Recruitment[]>(ALL_RECRUITMENTS);

  useEffect(() => {
    async function loadRecruitments() {
      const { data, error } = await supabase
        .from('clubs')
        .select('id, name, category, logo_url, is_recruiting, recruit_link, recruit_title, recruit_target, recruit_quota, recruit_deadline, recruit_period, requirements, process')
        .eq('is_recruiting', true)
        .order('created_at', { ascending: false });
      if (!error && data && data.length > 0)
        setRecruitments(data.map((c, i) => mapRecruitment(c, i)));
    }
    loadRecruitments();
  }, []);

  const filtered = recruitments.filter(r => {
    const matchField = field === '전체' || r.clubField === field;
    const matchQ = !query || r.clubName.includes(query) || r.title.includes(query) || r.target.includes(query);
    return matchField && matchQ;
  });

  return (
    <div className="min-h-screen bg-black pb-24">

      {/* ── 헤더 ── */}
      <div className="bg-black border-b border-white/10 px-6 pt-12 pb-16">
        <div className="max-w-3xl mx-auto">
          <BackButton onClick={() => navigate(-1)} className="mb-8" />
          <div className="flex items-center gap-3 mb-2">
            <Megaphone className="w-6 h-6 text-white" />
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">모집공고 탐색</h1>
          </div>
          <p className="text-white/50 text-sm font-medium pl-1">
            {recruitments.length}개 공고 · 나에게 딱 맞는 동아리를 찾아보세요
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
            placeholder="동아리명·공고 제목으로 검색..."
            className="flex-1 text-sm text-white placeholder:text-white/30 outline-none bg-transparent font-medium"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-white/40 hover:text-white text-lg leading-none transition-colors">×</button>
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

        <p className="text-xs font-bold text-white/40 px-1">{filtered.length}개의 모집공고</p>

        {/* ── 공고 카드 리스트 ── */}
        {filtered.length === 0 ? (
          <div className="bg-black rounded-3xl border border-white/10 py-16 text-center">
            <p className="text-3xl mb-3">🔍</p>
            <p className="text-white font-bold text-sm">해당하는 공고가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((rec, i) => {
              const dday = calcDday(rec.deadline);
              const isExpired = dday < 0;
              return (
                <motion.div
                  key={rec.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => navigate(`/club/${rec.clubId}`)}
                  className={`bg-black border border-white/10 rounded-3xl overflow-hidden cursor-pointer hover:border-white/25 transition-all
                    ${isExpired ? 'opacity-50' : ''}`}
                >
                  {/* 포스터 배너 */}
                  <div
                    className="relative h-28 flex items-center px-6 gap-4"
                    style={{
                      background: isExpired
                        ? 'rgba(255,255,255,0.03)'
                        : `linear-gradient(135deg, ${rec.accentColor}25 0%, ${rec.accentColor}10 100%)`,
                      borderBottom: `1px solid ${rec.accentColor}25`,
                    }}
                  >
                    <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-7xl opacity-8 select-none">
                      {rec.posterEmoji}
                    </div>

                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 border"
                      style={{ background: `${rec.accentColor}18`, borderColor: `${rec.accentColor}35` }}
                    >
                      {rec.clubEmoji}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-white/40 uppercase tracking-widest mb-1">
                        {rec.clubName}
                      </p>
                      <h3 className="text-base sm:text-lg font-black text-white tracking-tight leading-tight line-clamp-2">
                        {rec.title}
                      </h3>
                    </div>

                    <div className="absolute top-3 right-4">
                      <DDayBadge deadline={rec.deadline} />
                    </div>
                  </div>

                  {/* 카드 본문 */}
                  <div className="p-5 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-white/10 text-white/70 border border-white/15">
                        {rec.clubField}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-semibold text-white/40">
                        <Users className="w-3 h-3" /> 모집 {rec.quota}명
                      </span>
                      <span className="flex items-center gap-1 text-xs font-semibold text-white/40">
                        <CalendarDays className="w-3 h-3" /> {rec.period}
                      </span>
                    </div>

                    <div>
                      <p className="text-[10px] font-black text-white/40 uppercase tracking-wider mb-1.5">지원 자격</p>
                      <ul className="space-y-1">
                        {rec.requirements.slice(0, 2).map((req, j) => (
                          <li key={j} className="flex items-start gap-1.5 text-xs text-white/60 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-white/40 shrink-0 mt-0.5" />
                            {req}
                          </li>
                        ))}
                        {rec.requirements.length > 2 && (
                          <li className="text-xs text-white/30 font-medium pl-5">+{rec.requirements.length - 2}개 더</li>
                        )}
                      </ul>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {rec.process.map((step, j) => (
                        <span key={j} className="flex items-center gap-1">
                          <span className="text-[10px] bg-white/5 text-white/50 font-bold px-2.5 py-1 rounded-full border border-white/10">
                            {j + 1}. {step}
                          </span>
                          {j < rec.process.length - 1 && (
                            <ChevronRight className="w-2.5 h-2.5 text-white/20 shrink-0" />
                          )}
                        </span>
                      ))}
                    </div>

                    <div className="pt-1">
                      {isExpired ? (
                        <div className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-white/5 border border-white/10">
                          <Clock className="w-4 h-4 text-white/30" />
                          <span className="text-sm font-bold text-white/30">모집이 마감되었습니다</span>
                        </div>
                      ) : (
                        <motion.div
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-white text-black font-black text-sm cursor-pointer select-none hover:bg-white/90 transition-colors"
                        >
                          <Megaphone className="w-4 h-4" />
                          동아리 상세보기 &amp; 지원하기
                        </motion.div>
                      )}
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
