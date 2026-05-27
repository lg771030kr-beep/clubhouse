-- ================================================================
-- Club DX — 데이터 초기화 (특정 계정 제외)
-- 실행 방법: Supabase Dashboard > SQL Editor에서 실행
-- ⚠️  주의: 아래 이메일을 이건호 계정 이메일로 반드시 수정하세요!
-- ================================================================

DO $$
DECLARE
  keep_id UUID;
BEGIN
  -- 이건호 계정 이메일 (확인 후 실행하세요)
  SELECT id INTO keep_id FROM profiles WHERE email = 'lgh1030kr@ajou.ac.kr';

  IF keep_id IS NULL THEN
    RAISE EXCEPTION '이메일을 찾을 수 없습니다. 이메일을 확인해 주세요.';
  END IF;

  -- 1. 출석 기록 전체 삭제
  DELETE FROM attendance;

  -- 2. 제출물 전체 삭제
  DELETE FROM submissions;

  -- 3. 과제 전체 삭제 (테이블이 있는 경우)
  DELETE FROM assignments;

  -- 4. 일정 전체 삭제
  DELETE FROM schedules;

  -- 5. 동아리 멤버 전체 삭제
  DELETE FROM club_members;

  -- 6. 프로젝트 전체 삭제 (테이블이 있는 경우)
  DELETE FROM projects;

  -- 7. 동아리 전체 삭제
  DELETE FROM clubs;

  -- 8. 활동 로그 삭제 (이건호 계정 제외)
  DELETE FROM activity_logs WHERE user_id != keep_id;

  -- 9. 프로필 삭제 (이건호 계정 제외)
  DELETE FROM profiles WHERE id != keep_id;

  -- 10. 이건호 계정 role을 USER로 초기화
  UPDATE profiles SET role = 'USER' WHERE id = keep_id;

  RAISE NOTICE '정리 완료! 유지된 계정 ID: %', keep_id;
END $$;

-- ================================================================
-- ★ 추가 작업 (SQL Editor에서는 불가 → Supabase 대시보드에서 직접):
--   Authentication > Users 에서 이건호 계정 외 나머지 유저 삭제
-- ================================================================
