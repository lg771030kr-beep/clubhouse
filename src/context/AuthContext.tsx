import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdminMode: boolean;
  toggleAdminMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user,        setUser]        = useState<User | null>(null);
  const [profile,     setProfile]     = useState<UserProfile | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [isAdminMode, setIsAdminMode] = useState(false);

  useEffect(() => {
    /* ── 1. 현재 세션 확인 ── */
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        /* 비로그인 상태: MVP용 더미 프로필 시도 */
        fetchDummyProfile();
      }
    });

    /* ── 2. 세션 변경 구독 ── */
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
        setIsAdminMode(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  /* ── 실제 프로필 fetch (로그인 유저) ── */
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        const userProfile = data as UserProfile;
        setProfile(userProfile);
        setIsAdminMode(
          userProfile.role === 'ADMIN' || userProfile.role === 'LEADER'
        );
      }
    } catch {
      /* silent — 초기값 유지 */
    } finally {
      setLoading(false);
    }
  };

  /* ── MVP 더미 프로필 (비로그인 개발 환경용) ── */
  const fetchDummyProfile = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (data) {
        const userProfile = data as UserProfile;
        setProfile(userProfile);
        setUser({ id: userProfile.id, email: (userProfile as any).email } as User);
        setIsAdminMode(
          userProfile.role === 'ADMIN' || userProfile.role === 'LEADER'
        );
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  const toggleAdminMode = () => setIsAdminMode(prev => !prev);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdminMode, toggleAdminMode }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
