import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FolderOpen, Upload, Plus, Trash2, Download, FileText,
  ChevronRight, MoreVertical, Loader2, Lock, X,
  LayoutGrid, List, ChevronDown, ClipboardList, Users,
  Image, Film, Music, Package,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { BackButton } from '../../components/common/BackButton';

/* ══════════════════════════════════════════
   타입
══════════════════════════════════════════ */
type Tab      = 'documents' | 'submissions';
type ViewMode = 'list' | 'grid';

interface DocFolder {
  id: string;
  name: string;
  color: string;
  created_at: string;
}
interface DocFile {
  id: string;
  folder_id: string | null;
  title: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number;
  mime_type: string | null;
  created_at: string;
}
interface SubmissionGroup {
  scheduleId: string;
  scheduleTitle: string;
  scheduleDate: string;
  scheduleType: string;
  submissions: MemberSubmission[];
}
interface MemberSubmission {
  id: string;
  memberName: string;
  content: string | null;
  fileName: string | null;
  fileUrl: string | null;
  submittedAt: string;
}

/* ══════════════════════════════════════════
   상수 & 헬퍼
══════════════════════════════════════════ */
const FOLDER_COLORS = [
  '#4285f4','#ea4335','#fbbc05','#34a853',
  '#9c27b0','#ff6d00','#00bcd4','#607d8b',
];

type FileTypeInfo = { label: string; color: string; bg: string };
function getFileType(mime: string | null, name: string | null): FileTypeInfo {
  const ext = (name ?? '').split('.').pop()?.toLowerCase() ?? '';
  if (mime?.startsWith('image/') || ['jpg','jpeg','png','gif','webp','svg'].includes(ext))
    return { label: '이미지', color: '#34a853', bg: '#e6f4ea' };
  if (mime?.includes('pdf') || ext === 'pdf')
    return { label: 'PDF',   color: '#ea4335', bg: '#fce8e6' };
  if (['doc','docx'].includes(ext))
    return { label: 'Word',  color: '#4285f4', bg: '#e8f0fe' };
  if (['xls','xlsx'].includes(ext))
    return { label: 'Excel', color: '#34a853', bg: '#e6f4ea' };
  if (['ppt','pptx'].includes(ext))
    return { label: 'PPT',   color: '#fbbc05', bg: '#fef7e0' };
  if (mime?.startsWith('video/') || ['mp4','mov','avi','mkv'].includes(ext))
    return { label: '동영상', color: '#ea4335', bg: '#fce8e6' };
  if (mime?.startsWith('audio/') || ['mp3','wav','flac'].includes(ext))
    return { label: '오디오', color: '#9c27b0', bg: '#f3e5f5' };
  if (['zip','rar','7z','tar'].includes(ext))
    return { label: '압축',  color: '#ff6d00', bg: '#fff3e0' };
  return { label: '파일', color: '#5f6368', bg: '#f1f3f4' };
}

function FileTypeIcon({ mime, name, size = 20 }: { mime: string | null; name: string | null; size?: number }) {
  const ext = (name ?? '').split('.').pop()?.toLowerCase() ?? '';
  const cls = `shrink-0`;
  const px  = size;
  if (mime?.startsWith('image/') || ['jpg','jpeg','png','gif','webp'].includes(ext))
    return <Image width={px} height={px} className={cls} />;
  if (mime?.startsWith('video/') || ['mp4','mov','avi'].includes(ext))
    return <Film width={px} height={px} className={cls} />;
  if (mime?.startsWith('audio/') || ['mp3','wav'].includes(ext))
    return <Music width={px} height={px} className={cls} />;
  if (['zip','rar','7z'].includes(ext))
    return <Package width={px} height={px} className={cls} />;
  return <FileText width={px} height={px} className={cls} />;
}

function fmtSize(bytes: number) {
  if (bytes < 1024)             return `${bytes}B`;
  if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
function fmtDate(d: string) {
  const dt = new Date(d.length === 10 ? d + 'T00:00:00' : d);
  return `${dt.getFullYear()}.${String(dt.getMonth()+1).padStart(2,'0')}.${String(dt.getDate()).padStart(2,'0')}`;
}

/* ══════════════════════════════════════════
   Component
══════════════════════════════════════════ */
export function AdminArchive() {
  const { activeClubId, profile } = useAuth();
  const [clubName,     setClubName]     = useState('');
  const [tab,          setTab]          = useState<Tab>('documents');

  /* ── 공용 문서함 상태 ── */
  const [folders,          setFolders]          = useState<DocFolder[]>([]);
  const [files,            setFiles]            = useState<DocFile[]>([]);
  const [currentFolder,    setCurrentFolder]    = useState<DocFolder | null>(null); // null = 루트
  const [viewMode,         setViewMode]         = useState<ViewMode>('list');
  const [docsLoading,      setDocsLoading]      = useState(true);
  const [isUploading,      setIsUploading]      = useState(false);
  const [showNewMenu,      setShowNewMenu]       = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName,    setNewFolderName]    = useState('');
  const [newFolderColor,   setNewFolderColor]   = useState(FOLDER_COLORS[0]);
  const [activeMenu,       setActiveMenu]        = useState<string | null>(null); // file/folder id with open menu
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const newMenuRef    = useRef<HTMLDivElement>(null);

  /* ── 부원 제출 기록 상태 ── */
  const [submGroups,  setSubmGroups]  = useState<SubmissionGroup[]>([]);
  const [openGroups,  setOpenGroups]  = useState<Set<string>>(new Set());
  const [submLoading, setSubmLoading] = useState(true);

  useEffect(() => {
    if (!activeClubId) return;
    loadClubName();
    loadDocuments();
    loadSubmissions();
  }, [activeClubId]);

  // 바깥 클릭 시 NEW 메뉴 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setShowNewMenu(false);
      }
      setActiveMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function loadClubName() {
    const { data } = await supabase.from('clubs').select('name').eq('id', activeClubId!).single();
    if (data) setClubName(data.name);
  }

  /* ─────────────────────────────────────
     공용 문서함
  ───────────────────────────────────── */
  async function loadDocuments() {
    if (!activeClubId) return;
    setDocsLoading(true);
    try {
      const [{ data: foldersData }, { data: filesData }] = await Promise.all([
        supabase.from('archive_folders').select('*').eq('club_id', activeClubId).order('created_at'),
        supabase.from('archive_documents').select('*').eq('club_id', activeClubId).order('created_at', { ascending: false }),
      ]);
      setFolders(foldersData ?? []);
      setFiles(filesData ?? []);
    } finally {
      setDocsLoading(false);
    }
  }

  async function createFolder() {
    if (!newFolderName.trim() || !activeClubId) return;
    await supabase.from('archive_folders').insert({
      club_id: activeClubId,
      name: newFolderName.trim(),
      color: newFolderColor,
    });
    setShowCreateFolder(false);
    setShowNewMenu(false);
    setNewFolderName('');
    loadDocuments();
  }

  async function deleteFolder(f: DocFolder) {
    if (!confirm(`"${f.name}" 폴더와 내부 파일을 모두 삭제합니까?`)) return;
    const { data: inner } = await supabase.from('archive_documents').select('id, file_url').eq('folder_id', f.id);
    for (const doc of inner ?? []) {
      if (doc.file_url) {
        const path = doc.file_url.split('/storage/v1/object/public/archive/')[1];
        if (path) await supabase.storage.from('archive').remove([path]);
      }
      await supabase.from('archive_documents').delete().eq('id', doc.id);
    }
    await supabase.from('archive_folders').delete().eq('id', f.id);
    if (currentFolder?.id === f.id) setCurrentFolder(null);
    loadDocuments();
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeClubId) return;
    setIsUploading(true);
    setShowNewMenu(false);
    try {
      const path = `${activeClubId}/${Date.now()}_${file.name}`;
      const { data: up, error: upErr } = await supabase.storage.from('archive').upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('archive').getPublicUrl(up.path);
      await supabase.from('archive_documents').insert({
        club_id:    activeClubId,
        folder_id:  currentFolder?.id ?? null,
        title:      file.name,
        file_url:   publicUrl,
        file_name:  file.name,
        file_size:  file.size,
        mime_type:  file.type,
        created_by: profile?.id,
      });
      loadDocuments();
    } catch (err: unknown) {
      alert('업로드 실패. Supabase Storage에 "archive" 버킷(Public)을 확인해주세요.');
      console.error(err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function deleteFile(doc: DocFile) {
    if (!confirm(`"${doc.title}"을 삭제합니까?`)) return;
    if (doc.file_url) {
      const path = doc.file_url.split('/storage/v1/object/public/archive/')[1];
      if (path) await supabase.storage.from('archive').remove([path]);
    }
    await supabase.from('archive_documents').delete().eq('id', doc.id);
    loadDocuments();
  }

  /* ─────────────────────────────────────
     부원 제출 기록
  ───────────────────────────────────── */
  async function loadSubmissions() {
    if (!activeClubId) return;
    setSubmLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data: schedules } = await supabase
        .from('schedules').select('id, title, date, type')
        .eq('club_id', activeClubId).in('type', ['ASSIGNMENT', 'BOTH'])
        .lt('date', today).order('date', { ascending: false });

      if (!schedules?.length) { setSubmGroups([]); return; }

      interface ScheduleRow { id: string; title: string | null; date: string; type: string; }
      type ProfJoin = { name: string | null };
      interface SubmissionRow {
        id: string; schedule_id: string; content: string | null;
        file_name: string | null; file_url: string | null; submitted_at: string | null;
        profiles: ProfJoin | ProfJoin[] | null;
      }

      const scheduleIds = (schedules as ScheduleRow[]).map((s) => s.id);
      const { data: submissions } = await supabase
        .from('submissions')
        .select('id, schedule_id, content, file_name, file_url, submitted_at, profiles(name)')
        .in('schedule_id', scheduleIds).order('submitted_at', { ascending: false });

      const submMap: Record<string, MemberSubmission[]> = {};
      ((submissions ?? []) as unknown as SubmissionRow[]).forEach((s) => {
        if (!submMap[s.schedule_id]) submMap[s.schedule_id] = [];
        const prof = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
        submMap[s.schedule_id].push({
          id: s.id, memberName: prof?.name ?? '알 수 없음',
          content: s.content ?? null, fileName: s.file_name ?? null,
          fileUrl: s.file_url ?? null, submittedAt: s.submitted_at,
        });
      });

      setSubmGroups((schedules as ScheduleRow[]).map((s) => ({
        scheduleId: s.id, scheduleTitle: s.title ?? '일정',
        scheduleDate: s.date, scheduleType: s.type,
        submissions: submMap[s.id] ?? [],
      })));
    } finally { setSubmLoading(false); }
  }

  const toggleGroup = (id: string) =>
    setOpenGroups(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  /* ─── 현재 뷰에서 보여줄 폴더·파일 ─── */
  const visibleFolders: DocFolder[] = currentFolder
    ? [] // 폴더 내부에는 중첩 폴더 없음 (1-depth)
    : folders;

  const visibleFiles: DocFile[] = currentFolder
    ? files.filter(f => f.folder_id === currentFolder.id)
    : files.filter(f => f.folder_id === null); // 루트: 폴더 없는 파일만

  const isEmpty = visibleFolders.length === 0 && visibleFiles.length === 0;

  /* ══════════════════════════════════════════
     Render
  ══════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-white">

      {/* ── 공통 헤더 ── */}
      <div className="bg-white border-b border-black/8 px-4 md:px-6 pt-16 pb-4">
        <div className="max-w-3xl mx-auto">
          <BackButton to="/admin" label="뒤로가기" className="mb-3 text-black/60 hover:text-black" />
          <h1 className="text-xl font-black text-black tracking-tight">동아리 아카이브</h1>
        </div>
      </div>

      {/* ── 탭 ── */}
      <div className="bg-white border-b border-black/8 px-4 md:px-6">
        <div className="max-w-3xl mx-auto flex">
          {([
            { key: 'documents'   as Tab, label: '공용 문서함' },
            { key: 'submissions' as Tab, label: '부원 제출 기록' },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`py-3 px-1 mr-6 text-sm font-black border-b-2 transition-all
                ${tab === t.key
                  ? 'border-black text-black'
                  : 'border-transparent text-black/35 hover:text-black/70'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto">

        {/* ════════════════ Tab 1: 공용 문서함 ════════════════ */}
        {tab === 'documents' && (
          <div className="min-h-[60vh]">

            {/* 툴바 */}
            <div className="flex items-center gap-2 px-4 md:px-6 py-3 border-b border-black/6 bg-white">

              {/* NEW 버튼 */}
              <div className="relative" ref={newMenuRef}>
                <button
                  onClick={() => setShowNewMenu(v => !v)}
                  disabled={isUploading}
                  className="flex items-center gap-2 pl-3 pr-4 py-2 rounded-full shadow-sm border border-black/15
                             bg-white hover:bg-black/[0.03] text-sm font-black text-black transition-all
                             disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  {isUploading ? '업로드 중…' : '새로 만들기'}
                  <ChevronDown className="w-3.5 h-3.5 text-black/40" />
                </button>
                <AnimatePresence>
                  {showNewMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0,  scale: 1 }}
                      exit={{   opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 top-full mt-1 w-48 bg-white rounded-2xl shadow-xl
                                 border border-black/10 overflow-hidden z-30"
                    >
                      <button
                        onClick={() => { setShowCreateFolder(true); setShowNewMenu(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-black
                                   hover:bg-black/[0.04] transition-colors text-left"
                      >
                        <FolderOpen className="w-4 h-4 text-black/50" />
                        새 폴더
                      </button>
                      <div className="border-t border-black/6" />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-black
                                   hover:bg-black/[0.04] transition-colors text-left"
                      >
                        <Upload className="w-4 h-4 text-black/50" />
                        파일 업로드
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
              </div>

              {/* 브레드크럼 */}
              <div className="flex items-center gap-1 text-sm font-medium text-black/50 flex-1 min-w-0">
                <button
                  onClick={() => setCurrentFolder(null)}
                  className={`transition-colors truncate ${currentFolder ? 'hover:text-black' : 'text-black font-black'}`}
                >
                  내 드라이브
                </button>
                {currentFolder && (
                  <>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 text-black/25" />
                    <span
                      className="font-black truncate"
                      style={{ color: currentFolder.color }}
                    >
                      {currentFolder.name}
                    </span>
                  </>
                )}
              </div>

              {/* 뷰 모드 토글 */}
              <div className="flex items-center gap-0.5 bg-black/5 rounded-lg p-0.5">
                {(['list','grid'] as ViewMode[]).map(v => (
                  <button
                    key={v}
                    onClick={() => setViewMode(v)}
                    className={`w-7 h-7 flex items-center justify-center rounded-md transition-all
                      ${viewMode === v ? 'bg-white shadow-sm text-black' : 'text-black/35 hover:text-black/70'}`}
                  >
                    {v === 'list'
                      ? <List className="w-3.5 h-3.5" />
                      : <LayoutGrid className="w-3.5 h-3.5" />
                    }
                  </button>
                ))}
              </div>
            </div>

            {/* 새 폴더 생성 인라인 폼 */}
            <AnimatePresence>
              {showCreateFolder && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-b border-black/6 bg-[#f8f9fa]"
                >
                  <div className="px-4 md:px-6 py-4 flex items-center gap-4">
                    {/* 색상 선택 */}
                    <div className="flex gap-1.5 shrink-0">
                      {FOLDER_COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => setNewFolderColor(c)}
                          className={`w-5 h-5 rounded-full transition-all border-2
                            ${newFolderColor === c ? 'border-black/40 scale-125' : 'border-transparent'}`}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                    {/* 이름 입력 */}
                    <input
                      autoFocus
                      value={newFolderName}
                      onChange={e => setNewFolderName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') createFolder();
                        if (e.key === 'Escape') { setShowCreateFolder(false); setNewFolderName(''); }
                      }}
                      placeholder="폴더 이름을 입력하세요"
                      className="flex-1 text-sm font-medium bg-transparent outline-none text-black placeholder:text-black/30"
                    />
                    <button
                      onClick={createFolder}
                      className="px-4 py-1.5 bg-black text-white text-xs font-black rounded-full hover:bg-black/80 transition-colors shrink-0"
                    >
                      만들기
                    </button>
                    <button
                      onClick={() => { setShowCreateFolder(false); setNewFolderName(''); }}
                      className="p-1 text-black/30 hover:text-black transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 로딩 */}
            {docsLoading ? (
              <div className="flex items-center justify-center py-24 gap-2 text-black/30">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-black">불러오는 중...</span>
              </div>
            ) : isEmpty ? (
              /* 빈 상태 */
              <div className="flex flex-col items-center justify-center py-24 text-center px-4">
                <div className="w-20 h-20 rounded-2xl bg-black/[0.04] flex items-center justify-center mb-4">
                  <FolderOpen className="w-9 h-9 text-black/20" />
                </div>
                <p className="text-base font-black text-black/40">파일이 없습니다</p>
                <p className="text-sm text-black/25 mt-1.5 font-medium">
                  {currentFolder
                    ? `"${currentFolder.name}" 폴더가 비어 있습니다`
                    : '"새로 만들기" 버튼으로 폴더를 만들거나 파일을 업로드하세요'}
                </p>
              </div>
            ) : (
              <div>
                {/* ── 폴더 섹션 (루트일 때만) ── */}
                {visibleFolders.length > 0 && (
                  <div className="px-4 md:px-6 pt-4 pb-2">
                    <p className="text-xs font-black text-black/40 uppercase tracking-widest mb-3">폴더</p>
                    {viewMode === 'grid' ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {visibleFolders.map(f => (
                          <FolderCard
                            key={f.id} folder={f}
                            fileCount={files.filter(fi => fi.folder_id === f.id).length}
                            onOpen={() => setCurrentFolder(f)}
                            onDelete={() => deleteFolder(f)}
                            activeMenu={activeMenu} setActiveMenu={setActiveMenu}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-black/8 overflow-hidden">
                        {visibleFolders.map((f, i) => (
                          <FolderRow
                            key={f.id} folder={f}
                            fileCount={files.filter(fi => fi.folder_id === f.id).length}
                            onOpen={() => setCurrentFolder(f)}
                            onDelete={() => deleteFolder(f)}
                            isLast={i === visibleFolders.length - 1}
                            activeMenu={activeMenu} setActiveMenu={setActiveMenu}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── 파일 섹션 ── */}
                {visibleFiles.length > 0 && (
                  <div className="px-4 md:px-6 pt-4 pb-6">
                    {visibleFolders.length > 0 && (
                      <p className="text-xs font-black text-black/40 uppercase tracking-widest mb-3">파일</p>
                    )}
                    {viewMode === 'grid' ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {visibleFiles.map(f => (
                          <FileCard
                            key={f.id} file={f}
                            onDelete={() => deleteFile(f)}
                            activeMenu={activeMenu} setActiveMenu={setActiveMenu}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-black/8 overflow-hidden">
                        {/* 리스트 헤더 */}
                        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-4 py-2 bg-[#f8f9fa] border-b border-black/6">
                          <span className="text-[10px] font-black text-black/35 uppercase tracking-wider">이름</span>
                          <span className="text-[10px] font-black text-black/35 uppercase tracking-wider w-24 text-right">수정일</span>
                          <span className="text-[10px] font-black text-black/35 uppercase tracking-wider w-16 text-right">크기</span>
                          <span className="w-8" />
                        </div>
                        {visibleFiles.map((f, i) => (
                          <FileRow
                            key={f.id} file={f}
                            onDelete={() => deleteFile(f)}
                            isLast={i === visibleFiles.length - 1}
                            activeMenu={activeMenu} setActiveMenu={setActiveMenu}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════════════════ Tab 2: 부원 제출 기록 ════════════════ */}
        {tab === 'submissions' && (
          <div className="px-4 md:px-6 py-4 space-y-3 pb-16">

            {/* 읽기 전용 안내 */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[#f8f9fa] rounded-2xl border border-black/8">
              <Lock className="w-3.5 h-3.5 text-black/35 shrink-0" />
              <p className="text-xs text-black/45 font-medium">
                부원 제출 기록은 활동 완료 시 자동 저장되며 운영진도 수정·삭제할 수 없습니다
              </p>
            </div>

            {submLoading ? (
              <div className="flex items-center justify-center py-20 gap-2 text-black/30">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-black">불러오는 중...</span>
              </div>
            ) : submGroups.length === 0 ? (
              <div className="py-20 text-center">
                <ClipboardList className="w-10 h-10 text-black/12 mx-auto mb-3" />
                <p className="text-sm font-black text-black/35">제출 기록이 없습니다</p>
                <p className="text-xs text-black/22 mt-1.5 font-medium">
                  과제 유형 활동이 완료되면 자동으로 쌓입니다
                </p>
              </div>
            ) : (
              submGroups.map(group => {
                const isOpen = openGroups.has(group.scheduleId);
                return (
                  <div key={group.scheduleId} className="rounded-2xl border border-black/8 overflow-hidden bg-white shadow-sm">
                    <button
                      onClick={() => toggleGroup(group.scheduleId)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-black/[0.02] transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-xl bg-black/6 flex items-center justify-center shrink-0">
                        <ClipboardList className="w-4 h-4 text-black/45" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                            group.scheduleType === 'BOTH' ? 'bg-black text-white' : 'bg-black/8 text-black'
                          }`}>
                            {group.scheduleType === 'BOTH' ? '활동+과제' : '과제'}
                          </span>
                          <span className="text-[10px] text-black/35 font-medium">{fmtDate(group.scheduleDate)}</span>
                        </div>
                        <p className="text-sm font-black text-black truncate">{group.scheduleTitle}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {group.submissions.length > 0 && (
                          <span className="w-5 h-5 rounded-full bg-black text-white text-[9px] font-black flex items-center justify-center">
                            {group.submissions.length}
                          </span>
                        )}
                        <ChevronDown className={`w-4 h-4 text-black/25 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden border-t border-black/6"
                        >
                          {group.submissions.length === 0 ? (
                            <p className="px-4 py-5 text-xs text-black/30 font-medium text-center">제출한 부원이 없습니다</p>
                          ) : (
                            <div className="divide-y divide-black/5">
                              {group.submissions.map(sub => (
                                <div key={sub.id} className="px-4 py-4">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-7 h-7 rounded-full bg-black/6 flex items-center justify-center shrink-0">
                                      <Users className="w-3.5 h-3.5 text-black/35" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-black text-black leading-tight">{sub.memberName}</p>
                                      <p className="text-[10px] text-black/30 font-medium">
                                        {new Date(sub.submittedAt).toLocaleString('ko-KR',{
                                          year:'numeric',month:'2-digit',day:'2-digit',
                                          hour:'2-digit',minute:'2-digit',hour12:false,
                                        })}
                                      </p>
                                    </div>
                                  </div>
                                  {sub.content && (
                                    <div className="bg-black/[0.03] rounded-xl px-3 py-2.5 text-xs text-black/55 leading-relaxed whitespace-pre-wrap font-medium mb-2">
                                      {sub.content}
                                    </div>
                                  )}
                                  {sub.fileName && sub.fileUrl && (
                                    <a
                                      href={sub.fileUrl} target="_blank" rel="noopener noreferrer"
                                      className="flex items-center gap-2 bg-black/[0.04] hover:bg-black/[0.07] rounded-xl px-3 py-2 transition-colors group/dl"
                                    >
                                      <FileText className="w-3.5 h-3.5 text-black/35 shrink-0" />
                                      <span className="text-xs font-black text-black/65 truncate flex-1">{sub.fileName}</span>
                                      <Download className="w-3 h-3 text-black/25 group-hover/dl:text-black/55 shrink-0 transition-colors" />
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            )}
          </div>
        )}

      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   서브 컴포넌트: 폴더 카드 (Grid)
══════════════════════════════════════════ */
function FolderCard({
  folder, fileCount, onOpen, onDelete, activeMenu, setActiveMenu,
}: {
  folder: DocFolder; fileCount: number;
  onOpen: () => void; onDelete: () => void;
  key?: React.Key; activeMenu: string | null; setActiveMenu: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const menuOpen = activeMenu === `f-${folder.id}`;
  return (
    <div className="relative group/card">
      <button
        onDoubleClick={onOpen}
        onClick={onOpen}
        className="w-full flex flex-col items-start p-3 rounded-2xl border border-black/8
                   hover:border-black/20 hover:bg-black/[0.02] transition-all text-left"
      >
        {/* 폴더 아이콘 */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2" style={{ background: `${folder.color}22` }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill={folder.color}>
            <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
          </svg>
        </div>
        <p className="text-xs font-black text-black truncate w-full">{folder.name}</p>
        <p className="text-[10px] text-black/35 font-medium mt-0.5">{fileCount}개 파일</p>
      </button>

      {/* ⋮ 메뉴 */}
      <div className="absolute top-2 right-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
        <button
          onClick={e => { e.stopPropagation(); setActiveMenu(menuOpen ? null : `f-${folder.id}`); }}
          className="w-6 h-6 rounded-full bg-white shadow-sm border border-black/10 flex items-center justify-center hover:bg-black/[0.05]"
        >
          <MoreVertical className="w-3 h-3 text-black/50" />
        </button>
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.1 }}
              className="absolute right-0 top-7 w-32 bg-white rounded-xl shadow-lg border border-black/10 overflow-hidden z-20"
            >
              <button
                onClick={e => { e.stopPropagation(); onOpen(); setActiveMenu(null); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-black hover:bg-black/[0.04]"
              >
                <FolderOpen className="w-3.5 h-3.5 text-black/40" /> 열기
              </button>
              <div className="border-t border-black/6" />
              <button
                onClick={e => { e.stopPropagation(); onDelete(); setActiveMenu(null); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> 삭제
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── 폴더 행 (List) ── */
function FolderRow({
  folder, fileCount, onOpen, onDelete, isLast, activeMenu, setActiveMenu,
}: {
  folder: DocFolder; fileCount: number;
  onOpen: () => void; onDelete: () => void; isLast: boolean;
  key?: React.Key; activeMenu: string | null; setActiveMenu: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const menuOpen = activeMenu === `f-${folder.id}`;
  return (
    <div className={`relative flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02] group/row transition-colors ${!isLast ? 'border-b border-black/5' : ''}`}>
      <button onClick={onOpen} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${folder.color}18` }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill={folder.color}>
            <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-black truncate">{folder.name}</p>
          <p className="text-[10px] text-black/35 font-medium">{fileCount}개 파일</p>
        </div>
      </button>
      {/* ⋮ */}
      <div className="relative opacity-0 group-hover/row:opacity-100 transition-opacity">
        <button
          onClick={e => { e.stopPropagation(); setActiveMenu(menuOpen ? null : `f-${folder.id}`); }}
          className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-black/[0.06] transition-colors"
        >
          <MoreVertical className="w-4 h-4 text-black/40" />
        </button>
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.1 }}
              className="absolute right-0 top-9 w-32 bg-white rounded-xl shadow-lg border border-black/10 overflow-hidden z-20"
            >
              <button onClick={e => { e.stopPropagation(); onOpen(); setActiveMenu(null); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-black hover:bg-black/[0.04]">
                <FolderOpen className="w-3.5 h-3.5 text-black/40" /> 열기
              </button>
              <div className="border-t border-black/6" />
              <button onClick={e => { e.stopPropagation(); onDelete(); setActiveMenu(null); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5" /> 삭제
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   서브 컴포넌트: 파일 카드 (Grid)
══════════════════════════════════════════ */
function FileCard({
  file, onDelete, activeMenu, setActiveMenu,
}: {
  file: DocFile; onDelete: () => void;
  key?: React.Key; activeMenu: string | null; setActiveMenu: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const { color, bg, label } = getFileType(file.mime_type, file.file_name);
  const menuOpen = activeMenu === `d-${file.id}`;
  return (
    <div className="relative group/card">
      <div className="flex flex-col p-3 rounded-2xl border border-black/8 hover:border-black/20 hover:bg-black/[0.01] transition-all">
        {/* 파일 썸네일 영역 */}
        <div className="w-full aspect-square rounded-xl flex items-center justify-center mb-2" style={{ background: bg }}>
          <FileTypeIcon mime={file.mime_type} name={file.file_name} size={28} />
        </div>
        <p className="text-xs font-black text-black truncate">{file.title}</p>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ color, background: `${color}18` }}>
            {label}
          </span>
          <span className="text-[9px] text-black/30 font-medium">{fmtSize(file.file_size)}</span>
        </div>
      </div>

      {/* ⋮ */}
      <div className="absolute top-2 right-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
        <button
          onClick={e => { e.stopPropagation(); setActiveMenu(menuOpen ? null : `d-${file.id}`); }}
          className="w-6 h-6 rounded-full bg-white shadow-sm border border-black/10 flex items-center justify-center hover:bg-black/[0.05]"
        >
          <MoreVertical className="w-3 h-3 text-black/50" />
        </button>
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.1 }}
              className="absolute right-0 top-7 w-32 bg-white rounded-xl shadow-lg border border-black/10 overflow-hidden z-20"
            >
              {file.file_url && (
                <>
                  <a href={file.file_url} download={file.file_name ?? undefined} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-black hover:bg-black/[0.04]">
                    <Download className="w-3.5 h-3.5 text-black/40" /> 다운로드
                  </a>
                  <div className="border-t border-black/6" />
                </>
              )}
              <button onClick={e => { e.stopPropagation(); onDelete(); setActiveMenu(null); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5" /> 삭제
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── 파일 행 (List) ── */
function FileRow({
  file, onDelete, isLast, activeMenu, setActiveMenu,
}: {
  file: DocFile; onDelete: () => void; isLast: boolean;
  key?: React.Key; activeMenu: string | null; setActiveMenu: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const { color, bg, label } = getFileType(file.mime_type, file.file_name);
  const menuOpen = activeMenu === `d-${file.id}`;
  return (
    <div className={`relative flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02] group/row transition-colors ${!isLast ? 'border-b border-black/5' : ''}`}>
      {/* 파일 아이콘 */}
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: bg }}>
        <FileTypeIcon mime={file.mime_type} name={file.file_name} size={16} />
      </div>

      {/* 이름 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-black truncate">{file.title}</p>
        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ color, background: `${color}18` }}>
          {label}
        </span>
      </div>

      {/* 날짜 */}
      <span className="text-[11px] text-black/35 font-medium w-24 text-right shrink-0 hidden sm:block">
        {fmtDate(file.created_at)}
      </span>

      {/* 크기 */}
      <span className="text-[11px] text-black/35 font-medium w-16 text-right shrink-0 hidden sm:block">
        {fmtSize(file.file_size)}
      </span>

      {/* ⋮ 메뉴 */}
      <div className="relative opacity-0 group-hover/row:opacity-100 transition-opacity w-8 shrink-0">
        <button
          onClick={e => { e.stopPropagation(); setActiveMenu(menuOpen ? null : `d-${file.id}`); }}
          className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-black/[0.06] transition-colors"
        >
          <MoreVertical className="w-4 h-4 text-black/40" />
        </button>
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.1 }}
              className="absolute right-0 top-9 w-36 bg-white rounded-xl shadow-lg border border-black/10 overflow-hidden z-20"
            >
              {file.file_url && (
                <>
                  <a href={file.file_url} download={file.file_name ?? undefined} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-black hover:bg-black/[0.04]">
                    <Download className="w-3.5 h-3.5 text-black/40" /> 다운로드
                  </a>
                  <div className="border-t border-black/6" />
                </>
              )}
              <button onClick={e => { e.stopPropagation(); onDelete(); setActiveMenu(null); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-red-500 hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5" /> 삭제
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
