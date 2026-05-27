-- ================================================================
-- Club DX — Migration V7
-- 누락 컬럼/enum 값 추가 + 개발용 RLS 해제
-- 실행 방법: Supabase Dashboard > SQL Editor에서 실행
-- ================================================================

-- ① schedule_type enum에 'BOTH' 추가
--    (GENERAL=일반 일정, ASSIGNMENT=과제, BOTH=일정+과제 복합)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'BOTH'
      AND enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'schedule_type'
      )
  ) THEN
    ALTER TYPE schedule_type ADD VALUE 'BOTH';
  END IF;
END $$;

-- ② projects 테이블에 views 컬럼 추가 (인기 프로젝트 정렬용)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS views INT DEFAULT 0 NOT NULL;

-- ③ attendance 테이블 RLS 일시 해제 (개발 편의)
--    (production 전환 시 다시 ENABLE 후 정책 재설정 필요)
ALTER TABLE attendance   DISABLE ROW LEVEL SECURITY;
ALTER TABLE submissions  DISABLE ROW LEVEL SECURITY;

-- ④ schedules 테이블 RLS 해제 (관리자/부원 모두 조회 가능하게)
ALTER TABLE schedules    DISABLE ROW LEVEL SECURITY;

-- ⑤ profiles, clubs, club_members, projects RLS 해제
ALTER TABLE profiles     DISABLE ROW LEVEL SECURITY;
ALTER TABLE clubs        DISABLE ROW LEVEL SECURITY;
ALTER TABLE club_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects     DISABLE ROW LEVEL SECURITY;

-- 스키마 캐시 갱신
NOTIFY pgrst, 'reload schema';

-- ================================================================
-- 완료 체크리스트:
--   ✅ schedule_type에 'BOTH' 추가
--   ✅ projects.views 컬럼 추가
--   ✅ 개발용 RLS 전체 해제
-- ================================================================
