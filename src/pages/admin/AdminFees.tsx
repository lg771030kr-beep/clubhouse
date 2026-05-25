import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet, Plus, Trash2, ChevronLeft, Loader2,
  Upload, X, Paperclip, ImageIcon, Check,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

/* ══════════════════════════ 타입 ══════════════════════════ */
type FeeType = 'grant' | 'membership';

interface FeeCategory {
  id: string;
  name: string;
  type: FeeType;
  sort_order: number;
}

interface FeeRecord {
  id: string;
  category_id: string;
  title: string | null;
  amount: number | null;
  note: string | null;
  date: string | null;
  attachment_url: string | null;
}

/* ══════════════════════════ 헬퍼 ══════════════════════════ */
const fmt = (n: number | null | undefined) =>
  n == null ? '0' : Number(n).toLocaleString();

const fmtDate = (d: string | null) => {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getFullYear()}.${String(dt.getMonth()+1).padStart(2,'0')}.${String(dt.getDate()).padStart(2,'0')}`;
};

function nextName(categories: FeeCategory[], type: FeeType) {
  const cnt = categories.filter(c => c.type === type).length + 1;
  return type === 'grant' ? `지원금${cnt}` : `회비${cnt}`;
}

const MAX = 5;

/* ══════════════════════════ 컴포넌트 ══════════════════════════ */
export function AdminFees() {
  const navigate = useNavigate();
  const { activeClubId } = useAuth();

  const [cats,      setCats]      = useState<FeeCategory[]>([]);
  const [activeCat, setActiveCat] = useState<FeeCategory | null>(null);
  const [records,   setRecords]   = useState<FeeRecord[]>([]);
  const [catsLoading, setCatsLoading] = useState(true);
  const [recsLoading, setRecsLoading] = useState(false);

  /* 카테고리 추가 모달 */
  const [addCatType, setAddCatType] = useState<FeeType | null>(null);
  const [savingCat,  setSavingCat]  = useState(false);

  /* ── load categories ── */
  useEffect(() => {
    if (activeClubId) fetchCats();
  }, [activeClubId]);

  const fetchCats = async () => {
    if (!activeClubId) return;
    setCatsLoading(true);
    try {
      const { data } = await supabase
        .from('club_fee_categories')
        .select('*')
        .eq('club_id', activeClubId)
        .order('sort_order');
      const list = (data ?? []) as FeeCategory[];
      setCats(list);
      if (list.length > 0 && !activeCat) setActiveCat(list[0]);
    } finally {
      setCatsLoading(false);
    }
  };

  /* ── load records when category changes ── */
  useEffect(() => {
    if (activeCat) fetchRecords(activeCat.id);
    else setRecords([]);
  }, [activeCat?.id]);

  const fetchRecords = async (catId: string) => {
    setRecsLoading(true);
    try {
      const { data } = await supabase
        .from('club_fee_records')
        .select('*')
        .eq('category_id', catId)
        .order('date', { ascending: false });
      setRecords((data ?? []) as FeeRecord[]);
    } finally {
      setRecsLoading(false);
    }
  };

  /* ── 카테고리 추가 ── */
  const handleAddCat = async () => {
    if (!addCatType || !activeClubId || cats.length >= MAX) return;
    setSavingCat(true);
    try {
      const name = nextName(cats, addCatType);
      const { data } = await supabase
        .from('club_fee_categories')
        .insert({ club_id: activeClubId, name, type: addCatType, sort_order: cats.length })
        .select().single();
      if (data) {
        const newCat = data as FeeCategory;
        const updated = [...cats, newCat];
        setCats(updated);
        setActiveCat(newCat);
      }
      setAddCatType(null);
    } finally {
      setSavingCat(false);
    }
  };

  /* ── 카테고리 삭제 ── */
  const handleDeleteCat = async (cat: FeeCategory) => {
    if (!confirm(`"${cat.name}" 구분을 삭제합니까? 내부 기록도 모두 삭제됩니다.`)) return;
    await supabase.from('club_fee_categories').delete().eq('id', cat.id);
    const updated = cats.filter(c => c.id !== cat.id);
    setCats(updated);
    setActiveCat(updated[0] ?? null);
  };

  /* ── 합계 ── */
  const allGrant      = records.filter(r => activeCat?.type === 'grant')
    .reduce((s, r) => s + (r.amount ?? 0), 0);
  const allMembership = records.filter(r => activeCat?.type === 'membership')
    .reduce((s, r) => s + (r.amount ?? 0), 0);
  const catTotal = activeCat?.type === 'grant' ? allGrant : allMembership;

  /* ── 탭 라벨 색상 ── */
  const tabColor = (cat: FeeCategory) =>
    cat.type === 'grant'
      ? 'bg-blue-600 text-white'
      : 'bg-emerald-600 text-white';

  /* ──────────────── render ──────────────── */
  return (
    <div className="min-h-screen bg-[#f8f9fa]">

      {/* 헤더 */}
      <div className="bg-white border-b border-black/8 px-4 pt-14 pb-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto">
          <button onClick={() => navigate('/admin')}
            className="flex items-center gap-1 text-xs font-black text-black/40 hover:text-black transition-colors mb-2">
            <ChevronLeft className="w-3.5 h-3.5" /> 홈으로
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-black/60" />
              <h1 className="text-xl font-black text-black">회비 관리</h1>
            </div>
            {/* 구분 추가 버튼 */}
            {cats.length < MAX && (
              <button
                onClick={() => setAddCatType('grant')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-black/20
                           text-xs font-black text-black/60 hover:bg-black/5 transition-colors"
              >
                <Plus className="w-3 h-3" /> 회비 구분 추가
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 카테고리 추가 모달 ── */}
      <AnimatePresence>
        {addCatType !== null && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setAddCatType(null)}
          >
            <motion.div
              className="w-full max-w-md bg-white rounded-t-3xl p-6 pb-20"
              initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
              transition={{ type: 'spring', damping: 25 }}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-base font-black text-black mb-1">회비 구분 추가</h3>
              <p className="text-xs text-black/40 mb-4">
                현재 {cats.length}/{MAX}개 · 추가 후 이름이 자동 지정됩니다
              </p>

              <div className="grid grid-cols-2 gap-3 mb-5">
                {(['grant', 'membership'] as FeeType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setAddCatType(t)}
                    className={`py-4 rounded-2xl border-2 text-sm font-black transition-all
                      ${addCatType === t
                        ? t === 'grant'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-black/12 text-black/50'}`}
                  >
                    <div className="text-xl mb-1">{t === 'grant' ? '🏛️' : '💳'}</div>
                    <div>{t === 'grant' ? `지원금${cats.filter(c=>c.type==='grant').length+1}` : `회비${cats.filter(c=>c.type==='membership').length+1}`}</div>
                    <div className="text-[10px] mt-0.5 font-medium opacity-60">
                      {t === 'grant' ? '외부 지원금' : '자체 회비 지출'}
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={handleAddCat}
                disabled={savingCat}
                className="w-full py-3.5 bg-black text-white rounded-2xl text-sm font-black
                           hover:bg-black/85 transition-colors disabled:opacity-40"
              >
                {savingCat ? '추가 중...' : `"${nextName(cats, addCatType)}" 추가하기`}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-3xl mx-auto px-4 py-4">

        {catsLoading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-black/30">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : cats.length === 0 ? (
          /* 카테고리 없는 빈 상태 */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Wallet className="w-12 h-12 text-black/10 mb-4" />
            <p className="text-base font-black text-black/35 mb-1">회비 구분이 없습니다</p>
            <p className="text-sm text-black/25 mb-6">상단 "회비 구분 추가" 버튼으로 시작하세요</p>
            <button
              onClick={() => setAddCatType('grant')}
              className="px-6 py-3 bg-black text-white rounded-full text-sm font-black hover:bg-black/85"
            >
              <Plus className="w-4 h-4 inline mr-1.5" />첫 구분 추가하기
            </button>
          </div>
        ) : (
          <>
            {/* ── 카테고리 탭 ── */}
            <div className="flex gap-2 overflow-x-auto pb-1 mb-4 no-scrollbar">
              {cats.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCat(cat)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-black transition-all
                    ${activeCat?.id === cat.id
                      ? tabColor(cat)
                      : 'bg-black/6 text-black/50 hover:bg-black/10'}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* ── 선택된 카테고리 뷰 ── */}
            {activeCat && (
              activeCat.type === 'grant'
                ? <GrantView
                    category={activeCat}
                    records={records}
                    loading={recsLoading}
                    clubId={activeClubId!}
                    onRefresh={() => fetchRecords(activeCat.id)}
                    onDeleteCat={() => handleDeleteCat(activeCat)}
                    total={catTotal}
                  />
                : <MembershipView
                    category={activeCat}
                    records={records}
                    loading={recsLoading}
                    clubId={activeClubId!}
                    onRefresh={() => fetchRecords(activeCat.id)}
                    onDeleteCat={() => handleDeleteCat(activeCat)}
                    total={catTotal}
                  />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   지원금 뷰
══════════════════════════════════════════════ */
function GrantView({
  category, records, loading, clubId, onRefresh, onDeleteCat, total,
}: {
  category: FeeCategory; records: FeeRecord[]; loading: boolean;
  clubId: string; onRefresh: () => void; onDeleteCat: () => void; total: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview,    setPreview]    = useState<string | null>(null);
  const [file,       setFile]       = useState<File | null>(null);
  const [formDate,   setFormDate]   = useState('');
  const [formAmt,    setFormAmt]    = useState('');
  const [formNote,   setFormNote]   = useState('');
  const [uploading,  setUploading]  = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  };

  const clearForm = () => {
    setPreview(null); setFile(null);
    setFormDate(''); setFormAmt(''); setFormNote('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSave = async () => {
    const amt = parseInt(formAmt.replace(/,/g, ''), 10);
    if (isNaN(amt) || amt <= 0) { alert('금액을 입력해주세요.'); return; }
    setUploading(true);
    try {
      let attachment_url: string | null = null;
      if (file) {
        const path = `${clubId}/${category.id}/${Date.now()}_${file.name}`;
        const { data: up, error } = await supabase.storage.from('fees').upload(path, file, { upsert: false });
        if (!error && up) {
          const { data: { publicUrl } } = supabase.storage.from('fees').getPublicUrl(up.path);
          attachment_url = publicUrl;
        }
      }
      await supabase.from('club_fee_records').insert({
        category_id: category.id,
        club_id: clubId,
        amount: amt,
        date: formDate || null,
        note: formNote.trim() || null,
        attachment_url,
      });
      clearForm();
      onRefresh();
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 기록을 삭제합니까?')) return;
    await supabase.from('club_fee_records').delete().eq('id', id);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* 합계 카드 */}
      <div className="bg-white rounded-2xl border border-black/10 p-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-black text-black/40">{category.name} 합계</p>
          <p className="text-2xl font-black text-black mt-0.5">{fmt(total)}<span className="text-sm font-medium text-black/40 ml-1">원</span></p>
        </div>
        <button onClick={onDeleteCat} className="text-[10px] font-black text-red-400/70 hover:text-red-500 transition-colors">
          구분 삭제
        </button>
      </div>

      {/* 카드 캡처 업로드 */}
      <div className="bg-white rounded-2xl border border-black/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-black/6 flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-black/40" />
          <span className="text-sm font-black text-black">카드 내역 추가</span>
        </div>

        <div className="p-4 space-y-3">
          {preview ? (
            <div className="relative">
              <img src={preview} alt="카드 캡처" className="w-full max-h-52 object-contain rounded-xl border border-black/10" />
              <button onClick={clearForm}
                className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center">
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full h-28 border-2 border-dashed border-black/15 rounded-2xl
                         flex flex-col items-center justify-center gap-2 text-black/30
                         hover:border-black/30 hover:bg-black/[0.01] transition-all"
            >
              <Upload className="w-6 h-6" />
              <span className="text-xs font-black">카드 내역 캡처 업로드</span>
              <span className="text-[10px]">JPG, PNG</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

          {/* 날짜 + 금액 */}
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={formDate}
              onChange={e => setFormDate(e.target.value)}
              placeholder="날짜"
              className="w-full px-3 py-2.5 rounded-xl border border-black/15 text-sm font-medium
                         bg-white focus:outline-none focus:ring-2 focus:ring-black/20 text-black [color-scheme:light]"
            />
            <input
              type="number"
              value={formAmt}
              onChange={e => setFormAmt(e.target.value)}
              placeholder="금액 (원)"
              className="w-full px-3 py-2.5 rounded-xl border border-black/15 text-sm font-medium
                         bg-white focus:outline-none focus:ring-2 focus:ring-black/20 text-black"
            />
          </div>
          <input
            type="text"
            value={formNote}
            onChange={e => setFormNote(e.target.value)}
            placeholder="내용 (선택)"
            className="w-full px-3 py-2.5 rounded-xl border border-black/15 text-sm font-medium
                       bg-white focus:outline-none focus:ring-2 focus:ring-black/20 text-black"
          />
          <button
            onClick={handleSave}
            disabled={uploading || !formAmt}
            className="w-full py-3 bg-black text-white rounded-2xl text-sm font-black
                       hover:bg-black/85 transition-colors disabled:opacity-40"
          >
            {uploading ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </div>

      {/* 기록 목록 */}
      <div className="bg-white rounded-2xl border border-black/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-black/6">
          <span className="text-xs font-black text-black/40">내역 ({records.length}건)</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="w-4 h-4 animate-spin text-black/30" /></div>
        ) : records.length === 0 ? (
          <div className="py-10 text-center text-sm font-black text-black/25">내역이 없습니다</div>
        ) : (
          <div className="divide-y divide-black/5">
            {records.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02] group">
                {/* 썸네일 */}
                {r.attachment_url
                  ? <img src={r.attachment_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-black/10 shrink-0" />
                  : <div className="w-10 h-10 rounded-lg bg-black/5 flex items-center justify-center shrink-0">
                      <ImageIcon className="w-4 h-4 text-black/20" />
                    </div>
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-black">{fmt(r.amount)}<span className="text-xs font-medium text-black/40 ml-0.5">원</span></p>
                  <p className="text-[10px] text-black/35 font-medium">{fmtDate(r.date)}{r.note ? ` · ${r.note}` : ''}</p>
                </div>
                <button onClick={() => handleDelete(r.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50 text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   자체 회비 뷰 — Excel 형식 테이블
══════════════════════════════════════════════ */
interface DraftRow {
  _key: string;      // 신규: 'new-xxx', DB row: id
  id: string | null; // null이면 아직 미저장
  title: string;
  amount: string;
  note: string;
  date: string;
  attachment_url: string | null;
  _saved: boolean;
  _dirty: boolean;
}

function MembershipView({
  category, records, loading, clubId, onRefresh, onDeleteCat, total,
}: {
  category: FeeCategory; records: FeeRecord[]; loading: boolean;
  clubId: string; onRefresh: () => void; onDeleteCat: () => void; total: number;
}) {
  const [rows,    setRows]    = useState<DraftRow[]>([]);
  const [saving,  setSaving]  = useState<Set<string>>(new Set());
  const [saved,   setSaved]   = useState<Set<string>>(new Set());
  const attachRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  /* records → draft rows */
  useEffect(() => {
    setRows(records.map(r => ({
      _key: r.id, id: r.id,
      title: r.title ?? '', amount: r.amount != null ? String(r.amount) : '',
      note: r.note ?? '', date: r.date ?? '',
      attachment_url: r.attachment_url,
      _saved: true, _dirty: false,
    })));
  }, [records]);

  /* 행 추가 */
  const addRow = () => {
    const key = `new-${Date.now()}`;
    setRows(prev => [...prev, {
      _key: key, id: null,
      title: '', amount: '', note: '', date: '',
      attachment_url: null,
      _saved: false, _dirty: false,
    }]);
  };

  /* 필드 변경 → dirty + debounce save */
  const handleChange = (key: string, field: keyof DraftRow, value: string) => {
    setRows(prev => prev.map(r => r._key === key ? { ...r, [field]: value, _dirty: true } : r));
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(() => autoSaveRow(key), 800);
  };

  /* 자동 저장 */
  const autoSaveRow = useCallback(async (key: string) => {
    setRows(prev => {
      const row = prev.find(r => r._key === key);
      if (!row || !row._dirty) return prev;
      const amt = parseInt(row.amount.replace(/,/g, ''), 10);
      if (isNaN(amt) && row.id === null && !row.title) return prev; // 빈 신규행 무시
      doSave(row, amt);
      return prev.map(r => r._key === key ? { ...r, _dirty: false } : r);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, category.id]);

  const doSave = async (row: DraftRow, amt: number) => {
    setSaving(prev => new Set(prev).add(row._key));
    try {
      const payload = {
        category_id: category.id, club_id: clubId,
        title: row.title || null,
        amount: isNaN(amt) ? 0 : amt,
        note: row.note || null,
        date: row.date || null,
        attachment_url: row.attachment_url,
      };
      if (row.id) {
        await supabase.from('club_fee_records').update(payload).eq('id', row.id);
      } else {
        const { data } = await supabase.from('club_fee_records').insert(payload).select().single();
        if (data) {
          setRows(prev => prev.map(r => r._key === row._key ? { ...r, id: (data as FeeRecord).id, _saved: true } : r));
        }
      }
      setSaved(prev => { const n = new Set(prev); n.add(row._key); return n; });
      setTimeout(() => setSaved(prev => { const n = new Set(prev); n.delete(row._key); return n; }), 1500);
    } finally {
      setSaving(prev => { const n = new Set(prev); n.delete(row._key); return n; });
    }
  };

  /* 행 삭제 */
  const deleteRow = async (key: string) => {
    const row = rows.find(r => r._key === key);
    if (!row) return;
    if (row.id) await supabase.from('club_fee_records').delete().eq('id', row.id);
    setRows(prev => prev.filter(r => r._key !== key));
  };

  /* 첨부파일 업로드 */
  const handleAttach = async (key: string, file: File) => {
    const path = `${clubId}/${category.id}/${Date.now()}_${file.name}`;
    const { data: up, error } = await supabase.storage.from('fees').upload(path, file, { upsert: false });
    if (error || !up) return;
    const { data: { publicUrl } } = supabase.storage.from('fees').getPublicUrl(up.path);
    setRows(prev => prev.map(r => r._key === key ? { ...r, attachment_url: publicUrl, _dirty: true } : r));
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(() => autoSaveRow(key), 400);
  };

  /* Tab → 다음 셀 이동 (날짜0 지출명1 금액2 비고3) */
  const handleKeyDown = (e: React.KeyboardEvent, rowIdx: number, colIdx: number) => {
    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault();
      const cols = 4; // date, title, amount, note
      const nextCol = (colIdx + 1) % cols;
      const nextRow = nextCol === 0 ? rowIdx + 1 : rowIdx;
      const target = document.querySelector<HTMLInputElement>(
        `[data-cell="${nextRow}-${nextCol}"]`
      );
      if (target) target.focus();
      else if (nextRow >= rows.length) addRow();
    }
  };

  return (
    <div className="space-y-4">
      {/* 합계 카드 */}
      <div className="bg-white rounded-2xl border border-black/10 p-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-black text-black/40">{category.name} 지출 합계</p>
          <p className="text-2xl font-black text-black mt-0.5">{fmt(total)}<span className="text-sm font-medium text-black/40 ml-1">원</span></p>
        </div>
        <button onClick={onDeleteCat} className="text-[10px] font-black text-red-400/70 hover:text-red-500 transition-colors">
          구분 삭제
        </button>
      </div>

      {/* 엑셀 테이블 */}
      <div className="bg-white rounded-2xl border border-black/10 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-4 h-4 animate-spin text-black/30" />
          </div>
        ) : (
          <>
            {/* 헤더: 날짜 | 지출명 | 금액 | 비고 | 첨부 | '' */}
            <div className="grid grid-cols-[0.85fr_2fr_1.2fr_1.5fr_0.85fr_auto] border-b border-black/10 bg-black/[0.03]">
              {['날짜', '지출명', '금액 (원)', '비고', '첨부', ''].map((h, i) => (
                <div key={i} className={`px-2 py-2.5 text-[10px] font-black text-black/45 tracking-wide
                  ${i > 0 ? 'border-l border-black/8' : ''}`}>{h}</div>
              ))}
            </div>

            {/* 행 */}
            {rows.length === 0 ? (
              <div className="py-10 text-center text-sm font-black text-black/25">
                아래 버튼을 눌러 첫 항목을 추가하세요
              </div>
            ) : (
              rows.map((row, ri) => (
                <div key={row._key}
                  className={`grid grid-cols-[0.85fr_2fr_1.2fr_1.5fr_0.85fr_auto] border-b border-black/6 group
                    ${row._dirty ? 'bg-yellow-50/40' : ''}`}>

                  {/* 날짜 */}
                  <input
                    data-cell={`${ri}-0`}
                    type="date"
                    value={row.date}
                    onChange={e => handleChange(row._key, 'date', e.target.value)}
                    onKeyDown={e => handleKeyDown(e, ri, 0)}
                    className="px-1.5 py-2.5 text-xs font-medium text-black bg-transparent
                               focus:outline-none focus:bg-blue-50/40 border-r border-black/6 [color-scheme:light]"
                  />
                  {/* 지출명 */}
                  <input
                    data-cell={`${ri}-1`}
                    value={row.title}
                    onChange={e => handleChange(row._key, 'title', e.target.value)}
                    onKeyDown={e => handleKeyDown(e, ri, 1)}
                    placeholder="지출명"
                    className="px-3 py-2.5 text-sm font-medium text-black bg-transparent
                               focus:outline-none focus:bg-blue-50/40 border-r border-black/6"
                  />
                  {/* 금액 */}
                  <input
                    data-cell={`${ri}-2`}
                    type="number"
                    value={row.amount}
                    onChange={e => handleChange(row._key, 'amount', e.target.value)}
                    onKeyDown={e => handleKeyDown(e, ri, 2)}
                    placeholder="0"
                    className="px-2 py-2.5 text-sm font-black text-black bg-transparent
                               focus:outline-none focus:bg-blue-50/40 border-r border-black/6 text-right"
                  />
                  {/* 비고 */}
                  <input
                    data-cell={`${ri}-3`}
                    value={row.note}
                    onChange={e => handleChange(row._key, 'note', e.target.value)}
                    onKeyDown={e => handleKeyDown(e, ri, 3)}
                    placeholder="비고"
                    className="px-3 py-2.5 text-sm font-medium text-black bg-transparent
                               focus:outline-none focus:bg-blue-50/40 border-r border-black/6"
                  />
                  {/* 첨부 */}
                  <div className="flex items-center justify-center border-r border-black/6">
                    {row.attachment_url ? (
                      <a href={row.attachment_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-black
                                   text-blue-500 hover:bg-blue-50 transition-colors truncate max-w-full"
                        title="첨부파일 보기">
                        <Paperclip className="w-3 h-3 shrink-0" />
                        <span className="truncate">파일</span>
                      </a>
                    ) : (
                      <button onClick={() => attachRefs.current[row._key]?.click()}
                        className="flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-black
                                   text-black/25 hover:text-black/50 hover:bg-black/5 transition-colors">
                        <Paperclip className="w-3 h-3" />
                        <span>첨부</span>
                      </button>
                    )}
                    <input
                      type="file" className="hidden"
                      ref={el => { attachRefs.current[row._key] = el; }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleAttach(row._key, f); }}
                    />
                  </div>
                  {/* 저장 상태 + 삭제 */}
                  <div className="flex items-center justify-center gap-1 px-1.5">
                    {saving.has(row._key) && <Loader2 className="w-3 h-3 animate-spin text-black/25" />}
                    {saved.has(row._key)  && <Check className="w-3 h-3 text-emerald-500" />}
                    <button
                      onClick={() => deleteRow(row._key)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-400 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}

            {/* 합계 행 */}
            {rows.length > 0 && (
              <div className="grid grid-cols-[0.85fr_2fr_1.2fr_1.5fr_0.85fr_auto] bg-black/[0.03] border-t border-black/10">
                <div className="px-2 py-2.5 text-xs font-black text-black/50">합계</div>
                <div className="border-l border-black/8" />
                <div className="px-2 py-2.5 text-sm font-black text-black text-right border-l border-black/8">
                  {fmt(rows.reduce((s, r) => s + (parseInt(r.amount || '0', 10) || 0), 0))}
                </div>
                <div className="border-l border-black/8" />
                <div className="border-l border-black/8" />
                <div />
              </div>
            )}

            {/* 행 추가 버튼 */}
            <button
              onClick={addRow}
              className="w-full py-2.5 text-xs font-black text-black/35 hover:text-black hover:bg-black/[0.02]
                         transition-colors flex items-center justify-center gap-1.5 border-t border-black/6"
            >
              <Plus className="w-3.5 h-3.5" /> 행 추가
            </button>
          </>
        )}
      </div>

      <p className="text-[11px] text-black/30 text-center font-medium">
        Tab 또는 Enter로 다음 셀 이동 · 변경 시 자동 저장
      </p>
    </div>
  );
}
