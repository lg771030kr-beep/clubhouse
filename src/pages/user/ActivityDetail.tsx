import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ExternalLink, Calendar, MapPin, Users, Trophy, Globe, BookOpen, Tag } from 'lucide-react';

/* ── 타입 ── */
type Category = '공모전' | '대외활동' | '동아리' | '스터디·프로젝트';
type Status   = '접수중' | '접수예정' | '마감임박' | '마감';

interface ActivityDetail {
  id: string;
  category: Category;
  title: string;
  org: string;
  host?: string;           // 주관
  imageUrl?: string;
  dday: number;
  startDate: string;
  endDate: string;
  status: Status;
  link?: string;
  tags: string[];

  // 공모전
  field?: string;          // 응모분야
  applyMethod?: string;    // 접수방법
  eligibility?: string;    // 참가자격
  awardType?: string;      // 시상종류
  awardPrize?: string;     // 시상금(1등)
  summary?: string[];      // 공모요강 항목들

  // 대외활동
  benefit?: string;        // 혜택
  activityPeriod?: string; // 활동기간
  headcount?: string;      // 모집인원
  activityContent?: string[];

  // 동아리
  location?: string;       // 활동장소
  memberCount?: string;
  clubDescription?: string;

  // 스터디·프로젝트
  stack?: string[];        // 기술스택
  meetingStyle?: string;   // 활동방식
  applyLink?: string;
}

/* ── 더미 상세 데이터 ── */
export const ACTIVITY_DETAILS: ActivityDetail[] = [
  {
    id: '1', category: '공모전',
    title: '2026년 관악 사회적경제 주민 어울림 한마당 브랜드 네이밍/슬로건 공모',
    org: '관악구', host: '관악구',
    dday: 11, startDate: '2026-04-30', endDate: '2026-05-22', status: '접수중',
    link: 'https://gongu.copyright.or.kr',
    tags: ['네이밍/슬로건', '공공기관', '관악구'],
    field: '네이밍/슬로건',
    applyMethod: '온라인 접수',
    eligibility: '초등학생, 중학생, 고등학생, 동년배당 청소년, 대학생, 대학원생, 일반인, 가업, 관악구',
    awardType: '상금',
    awardPrize: '30만 원',
    summary: [
      '참가 자격: 2026년 관악 사회적경제 주민 어울림 한마당 브랜드 네이밍 공모전에서 관악구 거주·주민 또는 관악구 소재 (업단체) 소속 근무자',
      '공모 주제: 관악과 사회적경제의 의미를 하나로 담아 사회적경제의 가치를 알리고 가까이 날 수 있는 이름을 지어 주세요.',
      '주요 키워드 안내: 관악, 상생, 어울림, 나눔, 연대, 가치, 나누다, 즐겁다 등',
      '시상 내역: 대상 1팀 30만원, 우수상 2팀 각 10만원, 장려상 5팀 각 5만원',
      '제출 형식: 제안 명칭, 제안 사유(의미 설명)를 기재',
      '최대 5글자 이내의 간결한 이름을 지어 주세요. 신시가호상상성, 독창성, 대중성, 활용성이상계획',
      '접수 방법: 온라인 폼 접수 — https://form.naver.com/response/Goen7X8hX88quYhWCU YpeQ',
      '유의 사항: 관악구 사업단 연락처 010-8984-1967',
    ],
  },
  {
    id: '2', category: '공모전',
    title: '2026 제44회 서울특별시 건축상 공모',
    org: '서울특별시', host: '서울특별시',
    dday: 25, startDate: '2026-05-07', endDate: '2026-06-05', status: '접수중',
    link: 'https://example.com',
    tags: ['건축', '서울시', '공공'],
    field: '건축',
    applyMethod: '온라인 접수',
    eligibility: '건축사, 건축학과 재학생 및 졸업생',
    awardType: '상금 + 표창',
    awardPrize: '500만 원',
    summary: [
      '참가 자격: 국내 건축사 면허 소지자 또는 건축학과 재·졸업생',
      '공모 주제: 서울시민의 삶의 질을 향상시키는 혁신적 건축 설계',
      '시상 내역: 대상 1팀 500만원, 최우수상 2팀 각 300만원, 우수상 5팀 각 100만원',
      '제출 형식: A1 패널 3장 이내, 설계 도면 및 모형 사진',
      '접수 방법: 공식 홈페이지 온라인 시스템을 통한 파일 업로드',
    ],
  },
  {
    id: '7', category: '대외활동',
    title: '삼성 청년 SW 아카데미 12기 모집',
    org: '삼성전자', host: '삼성전자 주식회사',
    dday: 21, startDate: '2026-05-01', endDate: '2026-06-01', status: '접수중',
    link: 'https://example.com',
    tags: ['개발', 'SW', '취업연계'],
    benefit: '교육비 전액 지원 + 삼성전자 취업 연계',
    activityPeriod: '2026.08 ~ 2027.01 (6개월)',
    headcount: '1,000명',
    eligibility: '미취업 청년 (만 29세 이하)',
    activityContent: [
      'SW 기초 교육 (2개월): 알고리즘, 자료구조, Python 기초',
      'SW 심화 교육 (2개월): 웹 개발, 알고리즘 심화',
      '프로젝트 (2개월): 팀 프로젝트 + 해커톤',
      '수료 후 삼성전자 공채 서류 면제 혜택 제공',
      '월 최대 100만원 교육 지원금 지급',
    ],
  },
  {
    id: '8', category: '대외활동',
    title: '현대자동차 대학생 서포터즈 HIVE 9기',
    org: '현대자동차', host: '현대자동차 마케팅본부',
    dday: 14, startDate: '2026-05-11', endDate: '2026-05-25', status: '마감임박',
    link: 'https://example.com',
    tags: ['마케팅', '서포터즈', '자동차'],
    benefit: '활동비 지원, 수료증, 현대차 견학, 인턴 우대',
    activityPeriod: '2026.07 ~ 2026.12 (6개월)',
    headcount: '100명',
    eligibility: '대학교 재학생 (휴학생 포함)',
    activityContent: [
      'SNS 콘텐츠 제작 및 배포 (인스타그램, 유튜브)',
      '현대자동차 신차 시승 및 리뷰 작성',
      '오프라인 이벤트 및 캠페인 참여',
      '월 1회 정기 모임 참여',
      '팀별 미션 수행 및 결과 보고',
    ],
  },
  {
    id: '9', category: '동아리',
    title: '아주대 개발 동아리 START 2026 신입 부원 모집',
    org: '아주대학교', host: 'START 운영진',
    dday: 3, startDate: '2026-05-11', endDate: '2026-05-14', status: '마감임박',
    tags: ['개발', '프로젝트', '아주대'],
    location: '아주대학교 팔달관 B101',
    memberCount: '20명 내외 (신입 10명 모집)',
    eligibility: '아주대학교 재학생 (학과 무관)',
    clubDescription: '매 학기 팀 프로젝트를 진행하며 웹/앱 개발 역량을 키우는 동아리입니다. 초보자도 환영합니다!',
    activityContent: [
      '주 1회 정기 모임 (매주 화요일 저녁 7시)',
      '파트별 스터디: 프론트엔드 / 백엔드 / 기획·디자인',
      '학기별 팀 프로젝트 1개 이상 진행',
      '해커톤 및 공모전 참여 지원',
      '선배·멘토링 프로그램 운영',
    ],
    applyLink: 'https://forms.gle/example',
  },
  {
    id: '10', category: '스터디·프로젝트',
    title: 'React & TypeScript 프론트엔드 스터디 팀원 모집',
    org: '자율 모집', host: '이건호 외 2인',
    dday: 9, startDate: '2026-05-11', endDate: '2026-05-20', status: '접수중',
    tags: ['React', 'TypeScript', '프론트엔드'],
    stack: ['React', 'TypeScript', 'TailwindCSS', 'Supabase'],
    meetingStyle: '온/오프라인 병행 (매주 토요일 오전)',
    headcount: '4명',
    eligibility: 'HTML/CSS/JS 기초 지식 보유자',
    activityContent: [
      '주차별 주제 발표 및 코드 리뷰',
      '토이 프로젝트 1개 공동 제작',
      '매주 알고리즘 문제 1~2개 풀이',
      '스터디 종료 후 포트폴리오 정리',
    ],
    applyLink: 'https://open.kakao.com/example',
  },
  {
    id: '11', category: '스터디·프로젝트',
    title: '졸업 프로젝트 AI 서비스 개발 팀원 모집',
    org: '아주대학교 SW학과',
    dday: 11, startDate: '2026-05-11', endDate: '2026-05-22', status: '접수중',
    tags: ['AI', '백엔드', '졸업프로젝트'],
    stack: ['Python', 'FastAPI', 'PyTorch', 'React'],
    meetingStyle: '오프라인 (아주대 팔달관)',
    headcount: '2명 (백엔드 1, AI 1)',
    eligibility: 'SW학과 4학년 재학생',
    activityContent: [
      'AI 기반 추천 서비스 개발',
      '주 2회 대면 미팅',
      '깃허브 PR 리뷰 필수',
      '12월 졸업 작품 전시회 참가',
    ],
    applyLink: 'https://open.kakao.com/example2',
  },
];

/* ── 상태 색상 ── */
const STATUS_STYLE: Record<Status, string> = {
  '접수중':  'bg-orange-500/15 text-orange-400',
  '접수예정': 'bg-blue-500/15 text-blue-400',
  '마감임박': 'bg-red-500/15 text-red-400',
  '마감':    'bg-white/10 text-white/30',
};

const CATEGORY_ICON: Record<Category, React.ElementType> = {
  '공모전': Trophy,
  '대외활동': Globe,
  '동아리': Users,
  '스터디·프로젝트': BookOpen,
};

/* ── 공통 Info Row ── */
function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 py-2.5 border-b border-white/6 last:border-0">
      <span className="text-[11px] text-white/40 w-20 shrink-0 pt-0.5">{label}</span>
      <span className="text-[12px] text-white/85 leading-relaxed flex-1">{value}</span>
    </div>
  );
}

/* ── 메인 컴포넌트 ── */
export function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'요강' | '팀원모집'>('요강');

  const item = ACTIVITY_DETAILS.find(a => a.id === id);

  if (!item) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white/40 text-sm">
        활동 정보를 찾을 수 없습니다.
      </div>
    );
  }

  const Icon = CATEGORY_ICON[item.category];
  const tabLabel = item.category === '공모전' ? '공모요강'
    : item.category === '대외활동' ? '활동내용'
    : item.category === '동아리' ? '동아리 소개'
    : '스터디 소개';

  return (
    <div className="min-h-screen bg-black text-white pb-28">

      {/* 상단 네비 */}
      <div className="sticky top-0 z-30 bg-black/90 backdrop-blur border-b border-white/8 flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-white/60 hover:text-white transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold flex-1 truncate">{item.title}</span>
        {item.link && (
          <a href={item.link} target="_blank" rel="noopener noreferrer"
            className="text-white/40 hover:text-white transition-colors">
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>

      {/* 포스터 이미지 영역 */}
      <div className="w-full h-40 bg-gradient-to-br from-white/5 to-white/[0.02] flex items-center justify-center border-b border-white/6">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-white/20">
            <Icon className="h-12 w-12" />
            <span className="text-xs">{item.category}</span>
          </div>
        )}
      </div>

      {/* 제목 + 배지 */}
      <div className="px-4 pt-4 pb-3 border-b border-white/8">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[item.status]}`}>
            {item.status}
          </span>
          {item.dday <= 7 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">
              D-{item.dday}
            </span>
          )}
        </div>
        <h1 className="text-[15px] font-bold leading-snug mb-1">{item.title}</h1>
        <p className="text-white/40 text-xs">{item.org}</p>

        {/* 태그 */}
        <div className="flex flex-wrap gap-1 mt-2.5">
          {item.tags.map(t => (
            <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/6 text-white/40">#{t}</span>
          ))}
        </div>
      </div>

      {/* 핵심 정보 그리드 */}
      <div className="px-4 py-3 border-b border-white/8">
        {/* 공통 */}
        <div className="flex items-center gap-1.5 text-[11px] text-white/50 mb-1">
          <Calendar className="h-3.5 w-3.5" />
          <span>{item.startDate} ~ {item.endDate}</span>
          <span className={`ml-auto font-bold text-[11px] px-2 py-0.5 rounded-full ${
            item.dday > 7 ? 'bg-white/8 text-white/50' : 'bg-red-500/15 text-red-400'
          }`}>D-{item.dday}</span>
        </div>

        {item.location && (
          <div className="flex items-center gap-1.5 text-[11px] text-white/50 mt-1">
            <MapPin className="h-3.5 w-3.5" />
            <span>{item.location}</span>
          </div>
        )}

        {(item.headcount || item.memberCount) && (
          <div className="flex items-center gap-1.5 text-[11px] text-white/50 mt-1">
            <Users className="h-3.5 w-3.5" />
            <span>{item.headcount ?? item.memberCount}</span>
          </div>
        )}
      </div>

      {/* 상세 정보 테이블 */}
      <div className="px-4 py-1 border-b border-white/8">
        <InfoRow label="주최" value={item.org} />
        <InfoRow label="주관" value={item.host} />
        <InfoRow label="응모분야" value={item.field} />
        <InfoRow label="접수방법" value={item.applyMethod} />
        <InfoRow label="접수기간" value={`${item.startDate} ~ ${item.endDate}`} />
        <InfoRow label="참가자격" value={item.eligibility} />
        <InfoRow label="시상종류" value={item.awardType} />
        <InfoRow label="시상금(1등)" value={item.awardPrize} />
        <InfoRow label="활동기간" value={item.activityPeriod} />
        <InfoRow label="혜택" value={item.benefit} />
        <InfoRow label="활동방식" value={item.meetingStyle} />
        {item.stack && (
          <div className="flex gap-3 py-2.5 border-b border-white/6">
            <span className="text-[11px] text-white/40 w-20 shrink-0 pt-0.5">기술스택</span>
            <div className="flex flex-wrap gap-1">
              {item.stack.map(s => (
                <span key={s} className="text-[10px] px-2 py-0.5 rounded bg-white/8 text-white/60">{s}</span>
              ))}
            </div>
          </div>
        )}
        {item.link && (
          <div className="flex gap-3 py-2.5">
            <span className="text-[11px] text-white/40 w-20 shrink-0 pt-0.5">홈페이지</span>
            <a href={item.link} target="_blank" rel="noopener noreferrer"
              className="text-[12px] text-blue-400 underline underline-offset-2 flex-1 break-all">
              공고 바로가기
            </a>
          </div>
        )}
      </div>

      {/* 탭 */}
      <div className="flex border-b border-white/8 px-4">
        {([tabLabel, '팀원모집(0)'] as const).map((t, i) => {
          const key = i === 0 ? '요강' : '팀원모집';
          return (
            <button
              key={t}
              onClick={() => setTab(key as '요강' | '팀원모집')}
              className={`py-3 text-xs font-semibold mr-5 border-b-2 transition-all ${
                tab === key ? 'border-white text-white' : 'border-transparent text-white/30'
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* 탭 내용 */}
      <div className="px-4 py-4">
        {tab === '요강' ? (
          <div className="space-y-4">
            {/* 동아리 소개글 */}
            {item.clubDescription && (
              <p className="text-[13px] text-white/70 leading-relaxed bg-white/4 rounded-xl p-3">
                {item.clubDescription}
              </p>
            )}
            {/* 활동 내용 */}
            {item.activityContent && item.activityContent.length > 0 && (
              <div>
                <h3 className="text-[12px] font-bold text-white/50 mb-2 uppercase tracking-wider">
                  {item.category === '공모전' ? '공모 요강' : '활동 내용'}
                </h3>
                <ul className="space-y-2">
                  {item.activityContent.map((line, i) => (
                    <li key={i} className="flex gap-2 text-[13px] text-white/75 leading-relaxed">
                      <span className="text-white/25 shrink-0 mt-0.5">•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* 공모전 summary */}
            {item.summary && item.summary.length > 0 && (
              <div>
                <h3 className="text-[12px] font-bold text-white/50 mb-2 uppercase tracking-wider">공모 요강</h3>
                <ul className="space-y-2">
                  {item.summary.map((line, i) => (
                    <li key={i} className="flex gap-2 text-[13px] text-white/75 leading-relaxed">
                      <span className="text-white/25 shrink-0 mt-0.5">•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* 지원 링크 */}
            {item.applyLink && (
              <a
                href={item.applyLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white text-black text-sm font-bold mt-4"
              >
                지원하기 <ExternalLink className="h-4 w-4" />
              </a>
            )}
            {item.link && !item.applyLink && (
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white text-black text-sm font-bold mt-4"
              >
                공고 바로가기 <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        ) : (
          <div>
            {/* 항상 상단 고정 버튼 */}
            <button
              onClick={() => navigate('/projects/create')}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-black text-sm font-bold mb-6"
            >
              <Users className="h-4 w-4" />
              팀원 모집하기
            </button>
            <div className="text-center py-8 text-white/30">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">등록된 팀원 모집이 없습니다</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
