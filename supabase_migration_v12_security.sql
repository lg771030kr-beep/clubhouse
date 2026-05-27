-- ================================================================
-- Migration v12: QR 보안 강화 — mark_attendance_by_token RPC
-- 실행: Supabase Dashboard > SQL Editor
-- ================================================================

-- ── mark_attendance_by_token ─────────────────────────────────────
-- QR v3 방식: schedule_id 대신 qr_code_token 으로 출석 처리
--   - qr_code_token 은 schedules.qr_code_token 컬럼의 랜덤 UUID
--   - 클라이언트에 schedule_id 노출 없음
--   - 날짜 검증 포함 (오늘 날짜 QR만 유효)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION mark_attendance_by_token(
  p_token   TEXT,
  p_user_id UUID,
  p_today   DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_schedule RECORD;
BEGIN
  -- 1. 토큰으로 일정 조회
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

  -- 2. 오늘 날짜 검증
  IF v_schedule.date::DATE <> p_today THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'wrong_date',
                              'schedule_date', v_schedule.date::TEXT);
  END IF;

  -- 3. 출석 upsert
  INSERT INTO attendance (schedule_id, user_id, status, marked_at)
    VALUES (v_schedule.id, p_user_id, 'PRESENT', NOW())
  ON CONFLICT (schedule_id, user_id)
    DO UPDATE SET status = 'PRESENT', marked_at = NOW();

  RETURN jsonb_build_object('ok', true, 'reason', 'marked_present');
END;
$$;

-- ── mark_attendance rate-limit 보호 (Supabase built-in throttle) ──
-- Supabase Free 티어는 RPC 당 초당 ~100 req 제한이 있음.
-- 추가 rate-limit이 필요하면 아래 테이블 + 트리거로 구현 가능:
--
-- CREATE TABLE IF NOT EXISTS attendance_rate_limit (
--   user_id    UUID        NOT NULL,
--   window_end TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 minute',
--   count      INT         NOT NULL DEFAULT 1,
--   PRIMARY KEY (user_id)
-- );
-- (RPC 내부에서 count > 5 이면 early return 처리)
