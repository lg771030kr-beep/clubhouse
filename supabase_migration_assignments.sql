-- ================================================================
-- Club DX — Migration: Dedicated Assignments Table
-- 실행 방법: Supabase Dashboard > SQL Editor에서 순서대로 실행
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- STEP 1. assignments 전용 테이블 생성
--   schedules.type = 'ASSIGNMENT' 의존에서 분리
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assignments (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id                 UUID        REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  project_id              UUID        REFERENCES projects(id) ON DELETE SET NULL,  -- 프로젝트 연동 (선택)
  title                   TEXT        NOT NULL,
  description             TEXT,
  due_date                DATE        NOT NULL,                                    -- 제출 마감일
  assignment_template_url TEXT,                                                    -- 양식 파일 URL (Storage)
  created_by              UUID        REFERENCES profiles(id) ON DELETE SET NULL,  -- 등록한 관리자
  is_active               BOOLEAN     DEFAULT true,                                -- 활성 여부
  created_at              TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ────────────────────────────────────────────────────────────────
-- STEP 2. submissions 테이블 — assignment_id 컬럼 추가
--   기존 schedule_id 기반 제출도 유지(하위 호환), 신규는 assignment_id 사용
-- ────────────────────────────────────────────────────────────────
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS file_name     TEXT,
  ADD COLUMN IF NOT EXISTS file_size     TEXT;

-- assignment_id + user_id 중복 제출 방지
CREATE UNIQUE INDEX IF NOT EXISTS submissions_assignment_user_unique
  ON submissions (assignment_id, user_id)
  WHERE assignment_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────────
-- STEP 3. projects 테이블 — 관련 컬럼 보완
-- ────────────────────────────────────────────────────────────────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS start_date   DATE,
  ADD COLUMN IF NOT EXISTS end_date     DATE,
  ADD COLUMN IF NOT EXISTS github_url   TEXT,
  ADD COLUMN IF NOT EXISTS demo_url     TEXT,
  ADD COLUMN IF NOT EXISTS leader_email TEXT,
  ADD COLUMN IF NOT EXISTS member_count INT DEFAULT 0;

-- ────────────────────────────────────────────────────────────────
-- STEP 4. updated_at 자동 갱신 트리거 (assignments)
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS assignments_updated_at ON assignments;
CREATE TRIGGER assignments_updated_at
  BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────────────
-- STEP 5. Row Level Security (RLS) — assignments
-- ────────────────────────────────────────────────────────────────
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- 인증된 유저 전체 조회 가능
CREATE POLICY "assignments_select_authenticated"
  ON assignments FOR SELECT
  USING (auth.role() = 'authenticated');

-- 동아리 관리자만 등록/수정/삭제 가능
CREATE POLICY "assignments_all_club_admin"
  ON assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM clubs
      WHERE clubs.id = assignments.club_id
        AND clubs.admin_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────────
-- STEP 6. submissions RLS — assignment_id 기반 정책 추가
-- ────────────────────────────────────────────────────────────────
-- 부원 본인 제출 관리 (기존 정책 존재 시 스킵)
CREATE POLICY IF NOT EXISTS "submissions_user_own"
  ON submissions FOR ALL
  USING (auth.uid() = user_id);

-- 동아리 관리자가 해당 과제 제출 현황 조회
CREATE POLICY IF NOT EXISTS "submissions_admin_view_by_assignment"
  ON submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assignments a
      JOIN clubs c ON c.id = a.club_id
      WHERE a.id = submissions.assignment_id
        AND c.admin_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────────
-- STEP 7. QR 출석 upsert 함수 (RPC)
--   클라이언트에서 supabase.rpc('mark_attendance', {...}) 로 호출
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mark_attendance(
  p_schedule_id UUID,
  p_user_id     UUID,
  p_today       DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_schedule RECORD;
  v_result   TEXT;
BEGIN
  -- 1. 일정 존재 + 승인 여부 확인
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

  -- 2. 오늘 날짜 일치 여부 확인
  IF v_schedule.date::DATE <> p_today THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'wrong_date',
                              'schedule_date', v_schedule.date::TEXT);
  END IF;

  -- 3. 출석 기록 upsert (중복 방지)
  INSERT INTO attendance (schedule_id, user_id, status, marked_at)
    VALUES (p_schedule_id, p_user_id, 'PRESENT', NOW())
  ON CONFLICT (schedule_id, user_id)
    DO UPDATE SET status = 'PRESENT', marked_at = NOW();

  RETURN jsonb_build_object('ok', true, 'reason', 'marked_present');
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- STEP 8. 샘플 데이터 (개발/테스트용 — 운영 환경에서는 주석 처리)
-- ────────────────────────────────────────────────────────────────
-- INSERT INTO assignments (club_id, title, description, due_date)
-- VALUES (
--   '<your-club-uuid>',
--   '1주차 React 컴포넌트 과제',
--   'useState와 useEffect를 활용한 카운터 앱을 만들어 제출하세요.',
--   '2026-04-01'
-- );

-- ================================================================
-- 완료!  Supabase Dashboard에서 함수 테스트:
--   SELECT mark_attendance('<schedule_uuid>', '<user_uuid>');
-- ================================================================
