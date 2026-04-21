-- ================================================================
-- Club DX — Migration V9
-- 동아리 찾기 + HOT 프로젝트 동기화
-- clubs / projects 테이블 공개 조회 허용 + 컬럼 추가
-- ================================================================

-- ① clubs: 모집 관련 컬럼 추가
ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS is_recruiting       BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recruit_link        TEXT,
  ADD COLUMN IF NOT EXISTS recruit_description TEXT;

-- ② clubs RLS 비활성화 + 기존 정책 제거
ALTER TABLE clubs DISABLE ROW LEVEL SECURITY;
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'clubs' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON clubs', r.policyname);
  END LOOP;
END $$;

-- ③ projects RLS 비활성화 + 기존 정책 제거
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'projects' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON projects', r.policyname);
  END LOOP;
END $$;

-- ④ club_members RLS 비활성화 (동아리 멤버 수 조회용)
ALTER TABLE club_members DISABLE ROW LEVEL SECURITY;

-- ⑤ profiles RLS 비활성화 (멤버 정보 조회용)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 스키마 캐시 갱신
NOTIFY pgrst, 'reload schema';

-- ================================================================
-- 완료 체크리스트:
--   ✅ clubs.is_recruiting / recruit_link / recruit_description 추가
--   ✅ clubs RLS 비활성화
--   ✅ projects RLS 비활성화 → HOT 프로젝트 조회 가능
--   ✅ club_members RLS 비활성화 → 멤버 수 조회 가능
--   ✅ profiles RLS 비활성화 → 부원 정보 조회 가능
-- ================================================================
