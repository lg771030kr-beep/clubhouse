import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2, Globe, FileText, Camera,
  ChevronRight, LogOut, Shield, Bell,
  Loader2, Check, X, Pencil, Trash2,
  AlertCircle, ExternalLink,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import type { Organization } from './OrgDashboard';

/* ════════════════════════ 타입 ════════════════════════ */
interface OrgForm {
  name: string;
  description: string;
  website: string;
}

/* ════════════════════════ 서브 컴포넌트 ════════════════════════ */
function SettingRow({
  icon,
  label,
  value,
  onClick,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 transition-colors
        ${danger ? 'hover:bg-red-50' : 'hover:bg-gray-50'}`}
    >
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0
        ${danger ? 'bg-red-50' : 'bg-gray-100'}`}>
        <span className={danger ? 'text-red-500' : 'text-gray-500'}>{icon}</span>
      </div>
      <div className="flex-1 text-left">
        <p className={`text-sm font-bold ${danger ? 'text-red-600' : 'text-gray-800'}`}>{label}</p>
        {value && <p className="text-xs text-gray-400 mt-0.5 truncate">{value}</p>}
      </div>
      {!danger && <ChevronRight className="w-4 h-4 text-gray-300" />}
    </button>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">{title}</p>
      </div>
      {children}
    </div>
  );
}

/* ════════════════════════ 메인 ════════════════════════ */
export function OrgSettings() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const [org,        setOrg]        = useState<Organization | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [editing,    setEditing]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);

  const [form,       setForm]       = useState<OrgForm>({ name: '', description: '', website: '' });
  const [logoUploading, setLogoUploading] = useState(false);

  const [showLogout, setShowLogout] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const fileRef = useRef<HTMLInputElement>(null);

  /* ── 데이터 로드 ── */
  useEffect(() => {
    if (!profile?.id) return;
    supabase.from('organizations').select('*').eq('owner_id', profile.id).single()
      .then(({ data }) => {
        if (data) {
          setOrg(data as Organization);
          setForm({ name: data.name ?? '', description: data.description ?? '', website: data.website ?? '' });
        }
        setLoading(false);
      });
  }, [profile?.id]);

  /* ── 저장 ── */
  const handleSave = async () => {
    if (!org) return;
    setSaving(true);
    await supabase.from('organizations').update({
      name:        form.name,
      description: form.description || null,
      website:     form.website     || null,
    }).eq('id', org.id);
    setOrg(prev => prev ? { ...prev, ...form } : prev);
    setSaving(false);
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 2000);
  };

  /* ── 로고 업로드 ── */
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !org) return;
    setLogoUploading(true);
    const ext  = file.name.split('.').pop();
    const path = `org-logos/${org.id}.${ext}`;
    await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    await supabase.from('organizations').update({ logo_url: publicUrl }).eq('id', org.id);
    setOrg(prev => prev ? { ...prev, logo_url: publicUrl } : prev);
    setLogoUploading(false);
  };

  /* ── 로그아웃 ── */
  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-5 pt-14 pb-5">
        <h1 className="text-xl font-black text-gray-900">설정</h1>
        <p className="text-xs text-gray-400 mt-0.5">기관 정보 및 계정 관리</p>
      </div>

      <div className="px-4 py-5 space-y-4">

        {/* 로고 + 기관명 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center overflow-hidden">
              {org?.logo_url ? (
                <img src={org.logo_url} alt="logo" className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-7 h-7 text-gray-400" />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={logoUploading}
              className="absolute -bottom-1 -right-1 w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center shadow-md"
            >
              {logoUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-gray-900 text-base truncate">{org?.name ?? '기관명 없음'}</p>
            <p className="text-xs text-gray-400 mt-0.5">{org?.type === 'enterprise' ? '기업' : '기관'}</p>
            {saved && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1 text-emerald-600 text-xs font-bold mt-1"
              >
                <Check className="w-3 h-3" />저장됨
              </motion.div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setEditing(v => !v)}
            className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center"
          >
            {editing ? <X className="w-4 h-4 text-gray-500" /> : <Pencil className="w-4 h-4 text-gray-500" />}
          </button>
        </div>

        {/* 편집 패널 */}
        <AnimatePresence>
          {editing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
                <FormField
                  label="기관명"
                  value={form.name}
                  onChange={v => setForm(p => ({ ...p, name: v }))}
                  placeholder="기관 이름"
                />
                <FormField
                  label="소개"
                  value={form.description}
                  onChange={v => setForm(p => ({ ...p, description: v }))}
                  placeholder="기관 소개 (선택)"
                  multiline
                />
                <FormField
                  label="웹사이트"
                  value={form.website}
                  onChange={v => setForm(p => ({ ...p, website: v }))}
                  placeholder="https://..."
                />
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !form.name.trim()}
                  className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-black disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  저장
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 정보 섹션 */}
        <SectionCard title="기관 정보">
          {org?.website && (
            <SettingRow
              icon={<Globe className="w-4 h-4" />}
              label="웹사이트"
              value={org.website}
              onClick={() => window.open(org.website!, '_blank')}
            />
          )}
          {org?.description && (
            <SettingRow
              icon={<FileText className="w-4 h-4" />}
              label="소개"
              value={org.description}
            />
          )}
        </SectionCard>

        {/* 알림 설정 */}
        <SectionCard title="알림">
          <NotifRow label="신규 지원자 알림" defaultOn />
          <NotifRow label="프로그램 기간 만료 알림" defaultOn />
          <NotifRow label="마케팅 수신" defaultOn={false} />
        </SectionCard>

        {/* 계정 */}
        <SectionCard title="계정">
          <SettingRow
            icon={<Shield className="w-4 h-4" />}
            label="비밀번호 변경"
            onClick={() => {/* TODO */}}
          />
          <div className="h-px bg-gray-100 mx-4" />
          <SettingRow
            icon={<LogOut className="w-4 h-4" />}
            label="로그아웃"
            onClick={() => setShowLogout(true)}
          />
          <div className="h-px bg-gray-100 mx-4" />
          <SettingRow
            icon={<Trash2 className="w-4 h-4" />}
            label="계정 삭제"
            onClick={() => setShowDelete(true)}
            danger
          />
        </SectionCard>

        <p className="text-center text-[10px] text-gray-300 pb-2">ClubDX Org v1.0</p>
      </div>

      {/* 로그아웃 확인 모달 */}
      <AnimatePresence>
        {showLogout && (
          <ConfirmModal
            title="로그아웃"
            desc="정말 로그아웃하시겠어요?"
            confirmLabel="로그아웃"
            onConfirm={handleLogout}
            onCancel={() => setShowLogout(false)}
          />
        )}
      </AnimatePresence>

      {/* 계정 삭제 모달 */}
      <AnimatePresence>
        {showDelete && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div className="absolute inset-0 bg-black/50" onClick={() => setShowDelete(false)} />
            <motion.div
              className="relative bg-white rounded-2xl p-6 w-full max-w-sm"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <h3 className="font-black text-gray-900">계정 삭제</h3>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                모든 프로그램, 멤버 데이터가 영구 삭제됩니다. 계속하려면 아래에 <strong>삭제</strong>를 입력하세요.
              </p>
              <input
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="삭제"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDelete(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={deleteConfirm !== '삭제'}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-black disabled:opacity-40"
                  onClick={() => {/* TODO: actual delete */}}
                >
                  영구 삭제
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── 폼 필드 ── */
function FormField({
  label, value, onChange, placeholder, multiline,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  const cls = "w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10";
  return (
    <div>
      <p className="text-[10px] font-black text-gray-400 tracking-wide mb-1.5">{label}</p>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={`${cls} resize-none`}
        />
      ) : (
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={cls}
        />
      )}
    </div>
  );
}

/* ── 알림 토글 행 ── */
function NotifRow({ label, defaultOn }: { label: string; defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center">
          <Bell className="w-4 h-4 text-gray-500" />
        </div>
        <p className="text-sm font-bold text-gray-800">{label}</p>
      </div>
      <button
        type="button"
        onClick={() => setOn(v => !v)}
        className={`w-11 h-6 rounded-full transition-colors relative ${on ? 'bg-gray-900' : 'bg-gray-200'}`}
      >
        <motion.span
          layout
          className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow"
          animate={{ left: on ? '22px' : '2px' }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  );
}

/* ── 확인 모달 ── */
function ConfirmModal({
  title, desc, confirmLabel, onConfirm, onCancel,
}: {
  title: string; desc: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <motion.div
        className="relative bg-white rounded-2xl p-6 w-full max-w-sm"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
      >
        <h3 className="font-black text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-5">{desc}</p>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600">
            취소
          </button>
          <button type="button" onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-black">
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
