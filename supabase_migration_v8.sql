-- ================================================================
-- Club DX — Migration V8
-- club_members 역할 3단계 세분화
--   MEMBER  : 일반 부원 (기존 USER → 이전)
--   CAPTAIN : 팀장 (신규)
--   LEADER  : 운영진 (기존 유지)
--   ADMIN   : 동아리 최고 관리자 (기존 유지)
-- 실행 방법: Supabase Dashboard > SQL Editor에서 실행
-- ================================================================

-- ① enum에 MEMBER, CAPTAIN 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'MEMBER'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE user_role ADD VALUE 'MEMBER';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'CAPTAIN'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE user_role ADD VALUE 'CAPTAIN';
  END IF;
END $$;

-- ② 기존 club_members.role = 'USER' → 'MEMBER' 로 일괄 변환
--    (profiles.role의 USER는 건드리지 않음)
UPDATE club_members SET role = 'MEMBER' WHERE role = 'USER';

-- ③ club_members 기본값도 MEMBER로 변경
ALTER TABLE club_members
  ALTER COLUMN role SET DEFAULT 'MEMBER';

-- ④ clubs 테이블에 deleted_at 컬럼 추가 (소프트 삭제용)
ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- ⑤ clubs 추가 정보 컬럼 (동아리 찾기 페이지용)
ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS field     TEXT,     -- 동아리 분야 (category와 동일 용도, 통합)
  ADD COLUMN IF NOT EXISTS members   INT DEFAULT 0,  -- 멤버 수 캐시 (선택)
  ADD COLUMN IF NOT EXISTS founded   TEXT,     -- 창설 연도 (예: "2023")
  ADD COLUMN IF NOT EXISTS location  TEXT;     -- 활동 지역/캠퍼스

-- 스키마 캐시 갱신
NOTIFY pgrst, 'reload schema';

-- ================================================================
-- 완료 체크리스트:
--   ✅ user_role에 MEMBER, CAPTAIN 추가
--   ✅ 기존 USER → MEMBER 마이그레이션
--   ✅ club_members 기본값 MEMBER로 변경
--   ✅ clubs.deleted_at 소프트 삭제 컬럼 추가
--   ✅ clubs 추가 컬럼 (field, members, founded, location) 추가
-- ================================================================
