-- ================================================================
-- Club DX — Migration V3
-- 실행 방법: Supabase Dashboard > SQL Editor에서 실행
-- 작성일: 2026-04-15
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- STEP 1. user_role ENUM 생성 또는 LEADER 추가
--   타입이 없으면 새로 생성, 있으면 LEADER 값만 추가
-- ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('ADMIN', 'USER', 'LEADER');
EXCEPTION
  WHEN duplicate_object THEN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'LEADER';
END $$;


-- ────────────────────────────────────────────────────────────────
-- STEP 2. profiles 테이블 — phone 컬럼 추가
-- ────────────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;


-- ────────────────────────────────────────────────────────────────
-- STEP 3. profiles 테이블 — INSERT RLS 정책 추가
--   기존에는 SELECT / UPDATE 만 있었음 → 회원가입 시 INSERT 실패
-- ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
    AND policyname = 'Users can insert their own profile'
  ) THEN
    CREATE POLICY "Users can insert their own profile"
      ON profiles FOR INSERT
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;


-- ================================================================
-- 완료 체크리스트:
--   ✅ user_role ENUM에 'LEADER' 추가
--   ✅ profiles.phone 컬럼 추가
--   ✅ profiles INSERT RLS 정책 추가 (회원가입 버그 수정)
-- ================================================================
