-- ================================================================
-- Club DX — clubs 테이블 컬럼 전체 보완
-- 실행 방법: Supabase Dashboard > SQL Editor에서 실행
-- ================================================================

ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS logo_url            TEXT,
  ADD COLUMN IF NOT EXISTS description         TEXT,
  ADD COLUMN IF NOT EXISTS category            TEXT,
  ADD COLUMN IF NOT EXISTS is_recruiting       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS recruit_description TEXT,
  ADD COLUMN IF NOT EXISTS affiliation         TEXT,
  ADD COLUMN IF NOT EXISTS club_type           TEXT,
  ADD COLUMN IF NOT EXISTS brochure_url        TEXT;

-- PostgREST 스키마 캐시 갱신 (컬럼 추가 후 반드시 실행)
NOTIFY pgrst, 'reload schema';

-- ================================================================
-- 완료 체크리스트:
--   ✅ clubs.logo_url
--   ✅ clubs.description
--   ✅ clubs.category
--   ✅ clubs.is_recruiting
--   ✅ clubs.recruit_description
--   ✅ clubs.affiliation
--   ✅ clubs.club_type
--   ✅ clubs.brochure_url
-- ================================================================
