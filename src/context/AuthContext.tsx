import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdminMode: boolean;
  isSuperAdmin: boolean;
  hasClub: boolean;
  activeClubId: string | null;
  switchClub: (id: string) => void;
  toggleAdminMode: () => void;
  enterAdminMode: () => void;   // profile.role 체크 없이 강제 진입 (club_members 기반 리더용)
  exitAdminMode:  () => void;   // 어드민 모드 강제 종료 (role 무관)
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, univName?: string, teamName?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user,         setUser]         = useState<User | null>(null);
  const [profile,      setProfile]      = useState<UserProfile | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [isAdminMode,  setIsAdminMode]  = useState(false); // 항상 USER 모드로 시작 (규칙 2)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [hasClub,      setHasClub]      = useState(false);
  const [activeClubId, setActiveClubId] = useState<string | null>(null);

  useEffect(() => {
    // onAuthStateChange 단일 구독 — getSession() 병행 금지 (경합 조건 원인)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setIsAdminMode(false);
        setIsSuperAdmin(false);
        setHasClub(false);
        setActiveClubId(null);
        setLoading(false);
      } else if (session?.user) {
        setLoading(true);
        setUser(session.user);
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  /**
   * 프로필 + 동아리 소속 로드
   * ★ isAdminMode는 여기서 절대 건드리지 않는다 (규칙 2: 로그인 시 항상 USER 모드)
   */
  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error || !data) {
        setHasClub(false);
        return;
      }

      setProfile(data as UserProfile);
      setIsSuperAdmin(!!(data as UserProfile).is_super_admin);

      // 1순위: club_members 테이블
      const { data: memberships, error: memErr } = await supabase
        .from('club_members')
        .select('club_id')
        .eq('user_id', userId)
        .limit(1);

      if (memberships && memberships.length > 0) {
        setHasClub(true);
      } else {
        // 2순위: 관리자(admin_id)로 등록된 동아리
        const { data: adminClubs, error: adminErr } = await supabase
          .from('clubs')
          .select('id')
          .eq('admin_id', userId)
          .is('deleted_at', null)
          .limit(1);

        if (adminClubs && adminClubs.length > 0) {
          setHasClub(true);
          supabase.from('club_members').upsert(
            [{ club_id: adminClubs[0].id, user_id: userId, role: 'LEADER' }],
            { onConflict: 'club_id,user_id' }
          ).then(() => {});
        } else {
          setHasClub(false);
        }
      }

      const isAdmin = (data as UserProfile).role === 'ADMIN' || (data as UserProfile).role === 'LEADER';
      if (isAdmin) {
        const { data: myClubs } = await supabase
          .from('clubs')
          .select('id')
          .eq('admin_id', userId)
          .is('deleted_at', null)
          .order('created_at', { ascending: true });
        if (myClubs && myClubs.length > 0) {
          setActiveClubId(cur => cur ?? myClubs[0].id);
        }
      }
    } catch (e) {
      console.error('[AUTH] loadProfile error:', e);
      setHasClub(false);
    } finally {
      setLoading(false);
    }
  };

  /* 동아리 생성/변경 후 강제 재로드 */
  const refreshProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) await loadProfile(session.user.id);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    univName?: string,
    teamName?: string,
  ) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        email,
        full_name: fullName || null,
        univ_name: univName || null,
        team_name: teamName || null,
        role: 'USER',
      });
      if (profileError) throw profileError;
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const switchClub = (id: string) => setActiveClubId(id);

  const toggleAdminMode = () => {
    if (profile?.role !== 'ADMIN' && profile?.role !== 'LEADER') return;
    setIsAdminMode(prev => !prev);
  };

  /** club_members 기반으로 Leader가 확인된 경우 profile.role 무관하게 어드민 모드 진입 */
  const enterAdminMode = () => setIsAdminMode(true);

  /** 어드민 모드 강제 종료 — profile.role 무관 */
  const exitAdminMode = () => setIsAdminMode(false);

  return (
    <AuthContext.Provider value={{
      user, profile, loading, isAdminMode, isSuperAdmin, hasClub,
      activeClubId, switchClub,
      toggleAdminMode, enterAdminMode, exitAdminMode, refreshProfile, signIn, signUp, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
