import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Plus, X, ChevronDown, ChevronUp,
  Loader2, CheckCircle2, Users, BookOpen, Link2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

/* ── 상수 ── */
const FIELDS = ['스터디', '프로젝트', '해커톤', '공모전', '사이드프로젝트', '기타'];
const STACK_SUGGESTIONS = [
  'React', 'TypeScript', 'JavaScript', 'Python', 'FastAPI', 'Node.js',
  'Next.js', 'Vue', 'Flutter', 'Swift', 'Kotlin', 'Spring', 'Django',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Supabase', 'Firebase',
  'TailwindCSS', 'Figma', 'AI/ML', 'PyTorch', 'Docker',
];

export function CreatePersonalProject() {
  const navigate = useNavigate();
  const { user } = useAuth();

  /* ── 폼 상태 ── */
  const [form, setForm] = useState({
    title: '',
    description: '',
    field: '',
    startDate: '',
    endDate: '',
    githubUrl: '',
    demoUrl: '',
  });
  const [tags,       setTags]       = useState<string[]>([]);
  const [tagInput,   setTagInput]   = useState('');
  const [isRecruit,  setIsRecruit]  = useState(false);
  const [recruitForm, setRecruitForm] = useState({
    recruitStart: '',
    recruitEnd: '',
    recruitUrl: '',
    headcount: '',
    eligibility: '',
  });
  /* ── 활동 연결 ── */
  type ActivityOption = { id: string; name: string; kind: 'club' | 'project' };
  const [linkActivity,       setLinkActivity]       = useState(false);
  const [activityOptions,    setActivityOptions]    = useState<ActivityOption[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [selectedKind,       setSelectedKind]       = useState<'club' | 'project'>('club');
  const addToPortfolio = true;

  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);
  const [error,      setError]      = useState('');

  /* ── 연결 가능한 활동 목록 fetch
       · 클럽: 내가 소속된 모든 동아리
       · 프로젝트: 내가 만든 프로젝트 중 이미 상위 활동에 연결되지 않은 것 (club_id IS NULL)
  ── */
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const [{ data: memberships }, { data: projects }] = await Promise.all([
        supabase.from('club_members')
          .select('clubs(id, name)')
          .eq('user_id', user.id),
        supabase.from('projects')
          .select('id, title')
          .eq('created_by', user.id)
          .is('club_id', null)          // 이미 하위활동인 것 제외
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      const clubs = ((memberships ?? []) as any[])
        .map((m: any) => Array.isArray(m.clubs) ? m.clubs[0] : m.clubs)
        .filter(Boolean)
        .map((c: any) => ({ id: c.id, name: c.name, kind: 'club' as const }));

      const projs = ((projects ?? []) as any[])
        .map((p: any) => ({ id: p.id, name: p.title, kind: 'project' as const }));

      const options: ActivityOption[] = [...clubs, ...projs];
      setActivityOptions(options);
      if (options.length > 0) {
        setSelectedActivityId(options[0].id);
        setSelectedKind(options[0].kind);
      }
    })();
  }, [user?.id]);

  /* ── 태그 추가 ── */
  const addTag = (t: string) => {
    const tag = t.trim();
    if (tag && !tags.includes(tag) && tags.length < 10) {
      setTags(prev => [...prev, tag]);
    }
    setTagInput('');
  };

  /* ── 제출 ── */
  const handleSubmit = async () => {
    if (!form.title.trim()) { setError('프로젝트명을 입력해주세요.'); return; }
    if (!form.field)        { setError('분야를 선택해주세요.'); return; }
    setSubmitting(true);
    setError('');

    try {
      const linked = linkActivity && selectedActivityId
        ? activityOptions.find(a => a.id === selectedActivityId) ?? null
        : null;

      const payload: Record<string, any> = {
        title:        form.title.trim(),
        description:  form.description.trim() || null,
        field:        form.field,
        start_date:   form.startDate || null,
        end_date:     form.endDate   || null,
        github_url:   form.githubUrl || null,
        demo_url:     form.demoUrl   || null,
        tags:         tags.length > 0 ? tags : null,
        is_personal:  true,
        created_by:   user!.id,
        // 동아리 연결
        club_id:       linked?.kind === 'club' ? linked.id : null,
        club_approved: linked?.kind === 'club' ? null : true, // 동아리 연결 시 승인 대기
        // 프로젝트(상위 활동) 연결
        parent_project_id: linked?.kind === 'project' ? linked.id : null,
        is_recruiting: isRecruit,
        recruit_start: isRecruit ? recruitForm.recruitStart || null : null,
        recruit_end:   isRecruit ? recruitForm.recruitEnd   || null : null,
        recruit_url:   isRecruit ? recruitForm.recruitUrl   || null : null,
        recruit_headcount:   isRecruit ? recruitForm.headcount   || null : null,
        recruit_eligibility: isRecruit ? recruitForm.eligibility || null : null,
      };

      const { data: project, error: pErr } = await supabase
        .from('projects')
        .insert(payload)
        .select('id')
        .single();

      if (pErr) throw pErr;

      // 포트폴리오(activity_logs) 동기화
      if (addToPortfolio && project) {
        await supabase.from('activity_logs').insert({
          user_id: user!.id,
          title:   `[${form.field}] ${form.title.trim()}`,
          content: form.description.trim() || null,
        });
      }

      setDone(true);
      setTimeout(() => navigate('/explore/activities'), 1500);
    } catch (e: any) {
      setError(e.message ?? '저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── 완료 화면 ── */
  if (done) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 text-white">
        <CheckCircle2 className="h-14 w-14 text-green-400" />
        <p className="text-lg font-bold">프로젝트가 등록되었습니다!</p>
        <p className="text-white/40 text-sm">비교과 탐색으로 이동합니다...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      {/* 헤더 */}
      <div className="sticky top-0 z-30 bg-black/90 backdrop-blur border-b border-white/8 flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-white/50 hover:text-white transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="font-bold text-sm flex-1">개인 프로젝트 등록</span>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-4 py-1.5 rounded-full bg-white text-black text-xs font-bold disabled:opacity-40 flex items-center gap-1"
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '등록'}
        </button>
      </div>

      <div className="px-4 py-5 space-y-6">

        {/* 기본 정보 */}
        <section>
          <Label>기본 정보</Label>
          <div className="space-y-3">
            <input
              placeholder="프로젝트명 *"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className={Input}
            />
            <textarea
              placeholder="프로젝트 설명 (선택)"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              className={`${Input} resize-none`}
            />

            {/* 분야 선택 */}
            <div className="flex flex-wrap gap-2">
              {FIELDS.map(f => (
                <button
                  key={f}
                  onClick={() => setForm(prev => ({ ...prev, field: f }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    form.field === f
                      ? 'bg-white text-black border-white'
                      : 'bg-white/5 text-white/50 border-white/10'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 기간 */}
        <section>
          <Label>진행 기간</Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[11px] text-white/40 mb-1">시작일</p>
              <input type="date" value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className={Input} />
            </div>
            <div>
              <p className="text-[11px] text-white/40 mb-1">종료일 (예정)</p>
              <input type="date" value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className={Input} />
            </div>
          </div>
        </section>

        {/* 기술스택 / 태그 */}
        <section>
          <Label>기술스택 / 태그</Label>
          <div className="flex gap-2 mb-2">
            <input
              placeholder="태그 입력 후 Enter"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } }}
              className={`${Input} flex-1`}
            />
            <button onClick={() => addTag(tagInput)}
              className="px-3 py-2 bg-white/10 rounded-xl text-white/60 hover:bg-white/20 transition-colors">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {/* 추천 태그 */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {STACK_SUGGESTIONS.filter(s => !tags.includes(s)).slice(0, 12).map(s => (
              <button key={s} onClick={() => addTag(s)}
                className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-white/40 border border-white/8 hover:bg-white/10 transition-colors">
                + {s}
              </button>
            ))}
          </div>
          {/* 선택된 태그 */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map(t => (
                <span key={t} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-white/10 text-white">
                  {t}
                  <button onClick={() => setTags(prev => prev.filter(x => x !== t))}>
                    <X className="h-3 w-3 text-white/40" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* 링크 */}
        <section>
          <Label>링크 (선택)</Label>
          <div className="space-y-2">
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
              <input placeholder="GitHub URL" value={form.githubUrl}
                onChange={e => setForm(f => ({ ...f, githubUrl: e.target.value }))}
                className={`${Input} pl-8`} />
            </div>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
              <input placeholder="데모/배포 URL" value={form.demoUrl}
                onChange={e => setForm(f => ({ ...f, demoUrl: e.target.value }))}
                className={`${Input} pl-8`} />
            </div>
          </div>
        </section>

        {/* 팀원 모집 */}
        <section>
          <Toggle
            label="팀원 모집"
            description="비교과 탐색에 공고로 노출됩니다"
            icon={<Users className="h-4 w-4" />}
            value={isRecruit}
            onChange={setIsRecruit}
          />
          {isRecruit && (
            <div className="mt-3 space-y-3 pl-2 border-l-2 border-white/10">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[11px] text-white/40 mb-1">접수 시작일</p>
                  <input type="date" value={recruitForm.recruitStart}
                    onChange={e => setRecruitForm(f => ({ ...f, recruitStart: e.target.value }))}
                    className={Input} />
                </div>
                <div>
                  <p className="text-[11px] text-white/40 mb-1">접수 마감일</p>
                  <input type="date" value={recruitForm.recruitEnd}
                    onChange={e => setRecruitForm(f => ({ ...f, recruitEnd: e.target.value }))}
                    className={Input} />
                </div>
              </div>
              <input placeholder="접수 URL (오픈카톡, 구글폼 등)"
                value={recruitForm.recruitUrl}
                onChange={e => setRecruitForm(f => ({ ...f, recruitUrl: e.target.value }))}
                className={Input} />
              <input placeholder="모집 인원 (예: 2명)"
                value={recruitForm.headcount}
                onChange={e => setRecruitForm(f => ({ ...f, headcount: e.target.value }))}
                className={Input} />
              <input placeholder="지원 자격 (예: React 기초 지식 보유자)"
                value={recruitForm.eligibility}
                onChange={e => setRecruitForm(f => ({ ...f, eligibility: e.target.value }))}
                className={Input} />
            </div>
          )}
        </section>

        {/* 활동 연결 */}
        {activityOptions.length > 0 && (
          <section>
            <Toggle
              label="활동 연결"
              description="상위 활동의 하위 활동으로 연결됩니다"
              icon={<BookOpen className="h-4 w-4" />}
              value={linkActivity}
              onChange={setLinkActivity}
            />
            {linkActivity && (
              <div className="mt-3 pl-2 border-l-2 border-white/10 space-y-2">
                <p className="text-[11px] text-white/40 font-medium px-1">
                  연결할 상위 활동 선택
                  <span className="ml-1.5 text-white/25">· 이미 하위 활동인 항목은 제외됩니다</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {activityOptions.map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => { setSelectedActivityId(opt.id); setSelectedKind(opt.kind); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        selectedActivityId === opt.id
                          ? 'bg-white text-black'
                          : 'bg-white/8 text-white/60 border border-white/10 hover:bg-white/15'
                      }`}
                    >
                      <span>{opt.kind === 'club' ? '🏫' : '📁'}</span>
                      <span className="max-w-[120px] truncate">{opt.name}</span>
                    </button>
                  ))}
                </div>
                {selectedActivityId && (
                  <p className="text-[11px] text-white/30 px-1">
                    {selectedKind === 'club'
                      ? '동아리 운영진 승인 후 연결이 완료됩니다'
                      : '선택한 프로젝트의 하위 활동으로 바로 연결됩니다'}
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {/* 에러 */}
        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}
      </div>
    </div>
  );
}

/* ── 공통 컴포넌트 ── */
const Input = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/25 transition-all';

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">{children}</p>;
}

function Toggle({ label, description, icon, value, onChange }: {
  label: string; description: string; icon: React.ReactNode;
  value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="w-full flex items-center gap-3 py-3 px-3 rounded-xl bg-white/4 border border-white/8 transition-all hover:bg-white/7"
    >
      <span className={`p-2 rounded-lg ${value ? 'bg-white text-black' : 'bg-white/10 text-white/40'} transition-all`}>
        {icon}
      </span>
      <div className="flex-1 text-left">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-[11px] text-white/40">{description}</p>
      </div>
      <div className={`w-10 h-6 rounded-full transition-all relative ${value ? 'bg-white' : 'bg-white/15'}`}>
        <div className={`absolute top-1 h-4 w-4 rounded-full transition-all ${value ? 'left-5 bg-black' : 'left-1 bg-white/50'}`} />
      </div>
    </button>
  );
}
