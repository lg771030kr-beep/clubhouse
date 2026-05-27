/**
 * useAdminGuard
 *
 * 관리자 페이지 진입 시 서버에서 동아리 소유권을 재검증.
 * - activeClubId 가 로그인 유저의 clubs.admin_id 인지 DB에서 확인
 * - 검증 실패 시 /dashboard 로 리다이렉트
 *
 * 사용법:
 *   const { verified, checking } = useAdminGuard();
 *   if (checking) return <Spinner />;
 *   if (!verified) return null;  // 리다이렉트 대기
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useAdminGuard() {
  const { user, activeClubId } = useAuth();
  const navigate = useNavigate();
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!user || !activeClubId) {
      navigate('/dashboard', { replace: true });
      setChecking(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        // 서버에서 "이 유저가 이 동아리의 admin_id인가?" 직접 확인
        const { data, error } = await supabase
          .from('clubs')
          .select('id')
          .eq('id', activeClubId)
          .eq('admin_id', user.id)
          .is('deleted_at', null)
          .maybeSingle();

        if (cancelled) return;

        if (error || !data) {
          navigate('/dashboard', { replace: true });
        } else {
          setVerified(true);
        }
      } catch {
        if (!cancelled) navigate('/dashboard', { replace: true });
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, activeClubId, navigate]);

  return { verified, checking };
}
