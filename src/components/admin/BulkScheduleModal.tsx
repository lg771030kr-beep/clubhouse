import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import {
  X, Download, Upload, CheckCircle2, AlertCircle,
  Loader2, FileSpreadsheet, Trash2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface RowData {
  title: string;
  type: 'GENERAL';
  date: string;
  time: string;
  location: string;
  description: string;
  valid: boolean;
  error?: string;
}

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

/* ── 엑셀 날짜 직렬번호 → YYYY-MM-DD 변환 ── */
function excelDateToString(val: unknown): string {
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.y}-${pad(d.m)}-${pad(d.d)}`;
    }
  }
  return String(val ?? '').trim();
}

/* ── 유형 정규화 (일괄 등록은 GENERAL 전용) ── */
function normalizeType(_val: unknown): 'GENERAL' {
  return 'GENERAL';
}

/* ── 시간 정규화 HH:MM ── */
function normalizeTime(val: unknown): string {
  const s = String(val ?? '').trim();
  if (!s) return '00:00';
  // 엑셀 시간 직렬번호 (0~1 사이 소수)
  if (typeof val === 'number' && val < 1) {
    const totalMin = Math.round(val * 24 * 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  // "9:00", "09:00:00" 등
  const match = s.match(/^(\d{1,2}):(\d{2})/);
  if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;
  return '00:00';
}

/* ── 날짜 유효성 ── */
function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

export function BulkScheduleModal({ onClose, onSaved }: Props) {
  const { activeClubId } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows,       setRows]       = useState<RowData[]>([]);
  const [isParsed,   setIsParsed]   = useState(false);
  const [isSaving,   setIsSaving]   = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [fileName,   setFileName]   = useState('');

  /* ── 템플릿 다운로드 ── */
  const handleDownloadTemplate = () => {
    const headers = ['제목*', '날짜*', '시간', '장소', '설명'];
    const examples = [
      ['OT 오리엔테이션', '2026-05-01', '18:00', 'A동 101호', '신입 부원 오리엔테이션'],
      ['정기 세션 4주차', '2026-05-15', '19:00', 'B동 세미나실', ''],
      ['해커톤 킥오프', '2026-05-22', '10:00', '대회의실', '팀 구성 및 주제 선정'],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...examples]);

    // 열 너비
    ws['!cols'] = [
      { wch: 24 }, { wch: 14 },
      { wch: 10 }, { wch: 18 }, { wch: 28 },
    ];

    // 헤더 메모
    ws['B1'].c = [{ a: 'Club DX', t: 'YYYY-MM-DD 형식으로 입력하세요. (예: 2026-05-01)' }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '일정 목록');
    XLSX.writeFile(wb, 'ClubDX_일정_일괄등록_양식.xlsx');
  };

  /* ── 파일 파싱 ── */
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const wb   = XLSX.read(data, { type: 'array', cellDates: false });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

        const parsed: RowData[] = json.map((row) => {
          const title    = String(row['제목*'] ?? row['제목'] ?? '').trim();
          const type     = normalizeType(null);
          const date     = excelDateToString(row['날짜*'] ?? row['날짜']);
          const time     = normalizeTime(row['시간']);
          const location = String(row['장소'] ?? '').trim();
          const description = String(row['설명'] ?? '').trim();

          let error: string | undefined;
          if (!title)           error = '제목 없음';
          else if (!isValidDate(date)) error = `날짜 형식 오류 (${date})`;

          return { title, type, date, time, location, description, valid: !error, error };
        });

        setRows(parsed);
        setIsParsed(true);
      } catch (err) {
        alert('파일을 읽는 중 오류가 발생했습니다. 올바른 엑셀 파일인지 확인해주세요.');
      }
    };
    reader.readAsArrayBuffer(file);
    // input 초기화 (동일 파일 재업로드 허용)
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));

  const validRows   = rows.filter(r => r.valid);
  const invalidRows = rows.filter(r => !r.valid);

  /* ── Supabase 저장 ── */
  const handleSave = async () => {
    if (validRows.length === 0) return;
    setIsSaving(true);
    try {
      const inserts = validRows.map(r => ({
        title:       r.title,
        type:        r.type,
        date:        r.date,
        time:        r.time,
        location:    r.location || null,
        description: r.description || null,
        is_approved: true,
        ...(activeClubId ? { club_id: activeClubId } : {}),
      }));

      const { error } = await supabase.from('schedules').insert(inserts);
      if (error) throw error;

      setSavedCount(inserts.length);
      setTimeout(() => { onSaved(); onClose(); }, 1800);
    } catch (err: unknown) {
      alert('저장 중 오류: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  const typeLabel = { GENERAL: '일정' } as const;
  const typeBadge = {
    GENERAL: 'bg-black/8 text-black border border-black/20',
  } as const;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className="relative w-full max-w-2xl max-h-[88vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* 헤더 */}
        <div className="shrink-0 flex items-center justify-between px-7 py-5 border-b border-black/10">
          <div>
            <h2 className="text-lg font-black text-black">일정 일괄 등록</h2>
            <p className="text-xs text-black/40 mt-0.5">엑셀 양식을 작성하여 한 번에 등록하세요</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-black/8 hover:bg-black/15 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-black" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-5">

          {/* STEP 1 — 템플릿 다운로드 */}
          <div className="rounded-2xl border border-black/15 p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-6 h-6 rounded-full bg-black text-white text-xs font-black flex items-center justify-center shrink-0">1</span>
              <p className="font-black text-black text-sm">엑셀 양식 다운로드</p>
            </div>
            <p className="text-xs text-black/50 mb-3 font-medium">
              아래 버튼으로 양식을 받아 작성한 뒤 업로드하세요.<br />
              일괄 등록은 <strong>활동 일정</strong>만 지원합니다. 과제는 일정 상세에서 추가하세요.<br />
              <strong>날짜</strong>: YYYY-MM-DD 형식
            </p>
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black text-white text-xs font-black hover:bg-black/90 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              ClubDX_일정_일괄등록_양식.xlsx 다운로드
            </button>
          </div>

          {/* STEP 2 — 파일 업로드 */}
          <div className="rounded-2xl border border-black/15 p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-6 h-6 rounded-full bg-black text-white text-xs font-black flex items-center justify-center shrink-0">2</span>
              <p className="font-black text-black text-sm">작성한 파일 업로드</p>
            </div>
            <div
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 py-8 rounded-2xl border-2 border-dashed border-black/20
                         hover:border-black/40 hover:bg-black/[0.02] transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-8 h-8 text-black/25" />
              {fileName
                ? <p className="text-sm font-black text-black">{fileName}</p>
                : <p className="text-sm font-black text-black/40">클릭하여 엑셀 파일 선택</p>
              }
              <p className="text-xs text-black/30">.xlsx / .xls 파일</p>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
          </div>

          {/* STEP 3 — 미리보기 */}
          {isParsed && (
            <div className="rounded-2xl border border-black/15 p-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-6 h-6 rounded-full bg-black text-white text-xs font-black flex items-center justify-center shrink-0">3</span>
                <p className="font-black text-black text-sm">등록 미리보기</p>
                <div className="ml-auto flex items-center gap-2 text-xs font-black">
                  <span className="text-black">{validRows.length}건 정상</span>
                  {invalidRows.length > 0 && <span className="text-red-500">{invalidRows.length}건 오류</span>}
                </div>
              </div>

              {/* 오류 행 */}
              {invalidRows.length > 0 && (
                <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200">
                  <p className="text-xs font-black text-red-600 mb-1.5 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" /> 아래 행은 오류로 제외됩니다
                  </p>
                  {invalidRows.map((r, i) => (
                    <p key={i} className="text-xs text-red-500 font-medium">
                      · {r.title || '(제목없음)'} — {r.error}
                    </p>
                  ))}
                </div>
              )}

              {/* 정상 행 목록 */}
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {rows.filter(r => r.valid).map((r, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-black/15 bg-white group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${typeBadge[r.type]}`}>
                          {typeLabel[r.type]}
                        </span>
                        <p className="font-black text-black text-xs truncate">{r.title}</p>
                      </div>
                      <p className="text-[11px] text-black/50 font-medium">
                        {r.date} {r.time}{r.location ? ` · ${r.location}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => removeRow(rows.indexOf(r))}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-black/8 transition-all text-black/30 hover:text-black/60"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 성공 메시지 */}
          {savedCount !== null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-black text-white font-black text-sm"
            >
              <CheckCircle2 className="w-5 h-5" />
              {savedCount}개 일정이 등록되었습니다!
            </motion.div>
          )}
        </div>

        {/* 푸터 */}
        <div className="shrink-0 border-t border-black/10 px-7 py-4 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-2xl border border-black/20 text-sm font-black text-black/50 hover:bg-black/5 hover:text-black transition-colors">
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={!isParsed || validRows.length === 0 || isSaving || savedCount !== null}
            className="flex-[3] py-3 rounded-2xl bg-black text-white font-black text-sm disabled:opacity-40
                       disabled:cursor-not-allowed hover:bg-black/90 active:scale-[0.98] transition-all
                       flex items-center justify-center gap-2"
          >
            {isSaving
              ? <><Loader2 className="w-4 h-4 animate-spin" />저장 중...</>
              : <><Upload className="w-4 h-4" />{validRows.length}개 일정 한 번에 등록</>
            }
          </button>
        </div>
      </motion.div>
    </div>
  );
}
