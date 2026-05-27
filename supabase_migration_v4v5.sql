-- ================================================================
-- Club DX — Migration V4 + V5 통합
-- 실행 방법: Supabase Dashboard > SQL Editor에서 실행
-- ================================================================

ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS affiliation  TEXT,   -- 소속 학교/기관
  ADD COLUMN IF NOT EXISTS club_type    TEXT,   -- '교내' | '연합'
  ADD COLUMN IF NOT EXISTS brochure_url TEXT;   -- 소개서 PDF URL

-- ================================================================
-- 완료 체크리스트:
--   ✅ clubs.affiliation
--   ✅ clubs.club_type
--   ✅ clubs.brochure_url
-- ================================================================
