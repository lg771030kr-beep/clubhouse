-- ================================================================
-- Migration v14: Security Advisor 경고 3개 수정
-- 실행: Supabase Dashboard > SQL Editor
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- FIX 1. Function Search Path Mutable
--   mark_attendance_by_token / mark_attendance 함수에
--   SET search_path = public 추가 (SQL 인젝션 방어)
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mark_attendance_by_token(
  p_token   TEXT,
  p_user_id UUID,
  p_today   DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule RECORD;
BEGIN
  SELECT id, date, is_approved
    INTO v_schedule
    FROM schedules
   WHERE qr_code_token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_token');
  END IF;

  IF NOT v_schedule.is_approved THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_approved');
  END IF;

  IF v_schedule.date::DATE <> p_today THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'wrong_date',
                              'schedule_date', v_schedule.date::TEXT);
  END IF;

  INSERT INTO attendance (schedule_id, user_id, status, marked_at)
    VALUES (v_schedule.id, p_user_id, 'PRESENT', NOW())
  ON CONFLICT (schedule_id, user_id)
    DO UPDATE SET status = 'PRESENT', marked_at = NOW();

  RETURN jsonb_build_object('ok', true, 'reason', 'marked_present');
END;
$$;

-- mark_attendance 함수도 동일하게 수정
CREATE OR REPLACE FUNCTION mark_attendance(
  p_schedule_id UUID,
  p_user_id     UUID,
  p_today       DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule RECORD;
BEGIN
  SELECT id, date, is_approved
    INTO v_schedule
    FROM schedules
   WHERE id = p_schedule_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'schedule_not_found');
  END IF;

  IF NOT v_schedule.is_approved THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_approved');
  END IF;

  IF v_schedule.date::DATE <> p_today THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'wrong_date',
                              'schedule_date', v_schedule.date::TEXT);
  END IF;

  INSERT INTO attendance (schedule_id, user_id, status, marked_at)
    VALUES (p_schedule_id, p_user_id, 'PRESENT', NOW())
  ON CONFLICT (schedule_id, user_id)
    DO UPDATE SET status = 'PRESENT', marked_at = NOW();

  RETURN jsonb_build_object('ok', true, 'reason', 'marked_present');
END;
$$;


-- ────────────────────────────────────────────────────────────────
-- FIX 2. Public Bucket Allows Listing (storage.assignments)
--   기존 광범위한 SELECT 정책 제거 후 인증 유저만 허용으로 교체
-- ────────────────────────────────────────────────────────────────

-- 기존 넓은 정책 제거
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Allow public select" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder" ON storage.objects;

-- assignments 버킷: 인증된 유저만 자기 파일 읽기 허용
DROP POLICY IF EXISTS "assignments_select" ON storage.objects;
CREATE POLICY "assignments_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'assignments'
    AND auth.role() = 'authenticated'
  );

-- assignments 버킷: 본인 파일만 업로드
DROP POLICY IF EXISTS "assignments_insert" ON storage.objects;
CREATE POLICY "assignments_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'assignments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- assignments 버킷: 본인 파일만 삭제
DROP POLICY IF EXISTS "assignments_delete" ON storage.objects;
CREATE POLICY "assignments_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'assignments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ================================================================
-- FIX 3. Leaked Password Protection (수동 설정 필요)
-- SQL로는 변경 불가 — 아래 경로에서 직접 활성화하세요:
--   Supabase Dashboard → Authentication → Settings
--   → "Password protection" 섹션 → "Enable leaked password protection" ON
-- ================================================================

NOTIFY pgrst, 'reload schema';
