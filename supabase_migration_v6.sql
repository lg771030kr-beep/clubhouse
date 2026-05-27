-- ================================================================
-- Club DX — Migration V6
-- club_members INSERT 허용 정책 추가
-- 실행 방법: Supabase Dashboard > SQL Editor에서 실행
-- ================================================================

-- 본인이 직접 동아리에 가입(INSERT)할 수 있도록 허용
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'club_members'
    AND policyname = 'club_members_insert_self'
  ) THEN
    CREATE POLICY "club_members_insert_self"
      ON club_members FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 스키마 캐시 갱신
NOTIFY pgrst, 'reload schema';

-- ================================================================
-- 완료 체크리스트:
--   ✅ club_members INSERT 본인 허용 정책 추가
-- ================================================================
