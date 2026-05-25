import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Upload, Trash2, ExternalLink, Loader2,
  CheckCircle2, AlertCircle, ChevronLeft, Plus, FileSpreadsheet,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

/* ── 타입 ── */
type Category = '공모전' | '대외활동' | '동아리' | '스터디·프로젝트';

interface Activity {
  id: string;
  title: string;
  category: Category;
  tags: string[];
  org: string;
  start_date: string;
  end_date: string;
  link: string | null;
  description: string | null;
  prize: string | null;
  registered_at: string;
  created_at: string;
}

/* ── CSV 파싱 ── */
function parseCSV(text: string): Omit<Activity, 'id' | 'created_at'>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  // 헤더 파싱 (BOM 제거)
  const headers = lines[0].replace(/^﻿/, '').split(',').map(h => h.trim().toLowerCase());

  return lines.slice(1).map(line => {
    // 쉼표가 따옴표 안에 있을 경우 처리
    const cols: string[] = [];
    let cur = '';
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    cols.push(cur.trim());

    const get = (key: string) => cols[headers.indexOf(key)] ?? '';
    const tagsRaw = get('tags');
    const tags = tagsRaw ? tagsRaw.split(/[|;]/).map(t => t.trim()).filter(Boolean) : [];

    return {
      title:         get('title'),
      category:      (get('category') || '공모전') as Category,
      tags,
      org:           get('org'),
      start_date:    get('start_date'),
      end_date:      get('end_date'),
      link:          get('link') || null,
      description:   get('description') || null,
      prize:         get('prize') || null,
      registered_at: get('registered_at') || new Date().toISOString().slice(0, 10),
    };
  }).filter(a => a.title);
}

/* ── 상태 배지 ── */
const CAT_COLOR: Record<Category, string> = {
  '공모전':       'bg-purple-100 text-purple-700',
  '대외활동':     'bg-blue-100 text-blue-700',
  '동아리':       'bg-green-100 text-green-700',
  '스터디·프로젝트': 'bg-orange-100 text-orange-700',
};

/* ══════════════════════════════════════════
   메인
══════════════════════════════════════════ */
export function SuperAdmin() {
  const navigate  = useNavigate();
  const { isSuperAdmin, loading } = useAuth();

  const [activities,  setActivities]  = useState<Activity[]>([]);
  const [fetching,    setFetching]    = useState(true);
  const [uploading,   setUploading]   = useState(false);
  const [deleting,    setDeleting]    = useState<string | null>(null);
  const [toast,       setToast]       = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [preview,     setPreview]     = useState<Omit<Activity, 'id' | 'created_at'>[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [filterCat,   setFilterCat]  = useState<Category | '전체'>('전체');

  const fileRef = useRef<HTMLInputElement>(null);

  /* 토스트 자동 사라짐 */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  /* 비권한자 리다이렉트 */
  useEffect(() => {
    if (!loading && !isSuperAdmin) navigate('/dashboard', { replace: true });
  }, [loading, isSuperAdmin, navigate]);

  /* 활동 목록 로드 */
  const fetchActivities = async () => {
    setFetching(true);
    const { data } = await supabase
      .from('activities')
      .select('*')
      .order('registered_at', { ascending: false });
    setActivities((data as Activity[]) ?? []);
    setFetching(false);
  };
  useEffect(() => { fetchActivities(); }, []);

  /* CSV 파일 선택 */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (!parsed.length) {
        setToast({ type: 'err', msg: '파싱된 데이터가 없습니다. CSV 형식을 확인해주세요.' });
        return;
      }
      setPreview(parsed);
      setShowPreview(true);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  /* CSV 업로드 확정 */
  const handleUpload = async () => {
    if (!preview.length) return;
    setUploading(true);
    try {
      const { error } = await supabase.from('activities').insert(preview);
      if (error) throw error;
      setToast({ type: 'ok', msg: `${preview.length}건 업로드 완료!` });
      setPreview([]);
      setShowPreview(false);
      fetchActivities();
    } catch (e: any) {
      setToast({ type: 'err', msg: e.message ?? '업로드 실패' });
    } finally {
      setUploading(false);
    }
  };

  /* 삭제 */
  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제할까요?')) return;
    setDeleting(id);
    await supabase.from('activities').delete().eq('id', id);
    setActivities(prev => prev.filter(a => a.id !== id));
    setDeleting(null);
    setToast({ type: 'ok', msg: '삭제되었습니다.' });
  };

  const displayed = filterCat === '전체'
    ? activities
    : activities.filter(a => a.category === filterCat);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-black/30" />
      </div>
    );
  }

  if (!isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">

      {/* 헤더 */}
      <div className="bg-white border-b border-black/8 px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="text-black/40 hover:text-black transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <ShieldCheck className="w-5 h-5 text-black" />
        <div className="flex-1">
          <h1 className="font-black text-black text-sm">슈퍼어드민</h1>
          <p className="text-[10px] text-black/40">플랫폼 전체 관리</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(['전체', '공모전', '대외활동', '동아리'] as const).map(cat => {
            const count = cat === '전체'
              ? activities.length
              : activities.filter(a => a.category === cat).length;
            return (
              <div key={cat} className="bg-white rounded-2xl border border-black/8 p-4 text-center">
                <p className="text-2xl font-black text-black">{count}</p>
                <p className="text-xs text-black/40 font-bold mt-0.5">{cat}</p>
              </div>
            );
          })}
        </div>

        {/* CSV 업로드 섹션 */}
        <div className="bg-white rounded-2xl border border-black/8 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-black text-black">비교과 활동 CSV 업로드</h2>
              <p className="text-xs text-black/40 mt-0.5">공모전·대외활동·동아리 데이터를 일괄 등록합니다</p>
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 bg-black text-white text-sm font-bold rounded-xl hover:bg-black/80 transition-colors"
            >
              <Upload className="w-4 h-4" />
              CSV 선택
            </button>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
          </div>

          {/* CSV 형식 안내 */}
          <div className="bg-black/3 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileSpreadsheet className="w-4 h-4 text-black/40" />
              <p className="text-xs font-bold text-black/50">CSV 헤더 형식 (첫 번째 행)</p>
            </div>
            <code className="text-[11px] text-black/60 break-all leading-relaxed">
              title, category, tags, org, start_date, end_date, link, description, prize, registered_at
            </code>
            <div className="mt-3 space-y-1 text-[11px] text-black/40">
              <p>• <b>category:</b> 공모전 / 대외활동 / 동아리 / 스터디·프로젝트</p>
              <p>• <b>tags:</b> 세미콜론(;) 또는 파이프(|)로 구분 — 예: 개발|AI|취업</p>
              <p>• <b>start_date / end_date:</b> YYYY-MM-DD 형식</p>
              <p>• <b>prize:</b> 공모전 시상금 (선택) — 예: 최우수 300만원</p>
              <p>• <b>registered_at:</b> 등록일 (비워두면 오늘 날짜)</p>
            </div>
          </div>
        </div>

        {/* 미리보기 모달 */}
        {showPreview && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
              <div className="px-6 py-4 border-b border-black/8 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-black">업로드 미리보기</h3>
                  <p className="text-xs text-black/40">{preview.length}건을 등록합니다</p>
                </div>
                <button onClick={() => setShowPreview(false)} className="text-black/30 hover:text-black text-xl">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-black/5 px-2">
                {preview.map((item, i) => (
                  <div key={i} className="px-4 py-3">
                    <div className="flex items-start gap-2 mb-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${CAT_COLOR[item.category]}`}>
                        {item.category}
                      </span>
                      <p className="text-sm font-semibold text-black leading-snug">{item.title}</p>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-black/40 flex-wrap">
                      {item.org && <span>{item.org}</span>}
                      {item.start_date && <span>{item.start_date} ~ {item.end_date}</span>}
                      {item.prize && <span className="text-yellow-600 font-medium">🏆 {item.prize}</span>}
                      {item.tags.map(t => (
                        <span key={t} className="bg-black/5 px-1.5 py-0.5 rounded">{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-6 py-4 border-t border-black/8 flex gap-3">
                <button
                  onClick={() => setShowPreview(false)}
                  className="flex-1 py-3 rounded-xl border border-black/15 text-sm font-bold text-black/60 hover:bg-black/5 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex-[2] py-3 rounded-xl bg-black text-white text-sm font-bold hover:bg-black/80 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {uploading ? '업로드 중...' : `${preview.length}건 등록하기`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 활동 목록 */}
        <div className="bg-white rounded-2xl border border-black/8 overflow-hidden">
          {/* 카테고리 필터 */}
          <div className="px-5 py-4 border-b border-black/8 flex items-center gap-2 flex-wrap">
            <h2 className="font-black text-black text-sm flex-1">등록된 활동 목록</h2>
            <div className="flex gap-1.5">
              {(['전체', '공모전', '대외활동', '동아리', '스터디·프로젝트'] as const).map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilterCat(cat)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
                    filterCat === cat ? 'bg-black text-white' : 'bg-black/5 text-black/50 hover:bg-black/10'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {fetching ? (
            <div className="flex items-center justify-center py-16 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-black/30" />
              <span className="text-sm text-black/30">불러오는 중...</span>
            </div>
          ) : displayed.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-black/30 font-medium">등록된 활동이 없습니다</p>
              <p className="text-xs text-black/20 mt-1">CSV를 업로드해서 추가해보세요</p>
            </div>
          ) : (
            <div className="divide-y divide-black/5">
              {displayed.map(item => (
                <div key={item.id} className="px-5 py-4 flex items-start gap-3 hover:bg-black/[0.02] transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${CAT_COLOR[item.category]}`}>
                        {item.category}
                      </span>
                      <p className="text-sm font-semibold text-black truncate">{item.title}</p>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-black/40 flex-wrap">
                      {item.org && <span className="truncate max-w-[120px]">{item.org}</span>}
                      {item.start_date && (
                        <span>{item.start_date} ~ {item.end_date}</span>
                      )}
                      {item.prize && (
                        <span className="text-yellow-600 font-medium">🏆 {item.prize}</span>
                      )}
                      {(item.tags ?? []).slice(0, 3).map(t => (
                        <span key={t} className="bg-black/5 px-1.5 py-0.5 rounded">{t}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {item.link && (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg text-black/30 hover:text-black hover:bg-black/5 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deleting === item.id}
                      className="p-2 rounded-lg text-black/20 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                    >
                      {deleting === item.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />
                      }
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 토스트 */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl text-sm font-bold transition-all ${
          toast.type === 'ok' ? 'bg-black text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'ok'
            ? <CheckCircle2 className="w-4 h-4" />
            : <AlertCircle className="w-4 h-4" />
          }
          {toast.msg}
        </div>
      )}
    </div>
  );
}
