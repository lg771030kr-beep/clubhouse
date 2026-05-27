-- ================================================================
-- Migration v11: 성능 인덱스 + RLS 정책
-- 실행 전: Supabase Dashboard > SQL Editor 에서 실행
-- ================================================================

-- ----------------------------------------------------------------
-- 1. 성능 인덱스 (자주 필터링되는 FK 컬럼)
-- ----------------------------------------------------------------

-- schedules
CREATE INDEX IF NOT EXISTS idx_schedules_club_id       ON schedules (club_id);
CREATE INDEX IF NOT EXISTS idx_schedules_date          ON schedules (date);
CREATE INDEX IF NOT EXISTS idx_schedules_qr_code_token ON schedules (qr_code_token) WHERE qr_code_token IS NOT NULL;

-- attendance
CREATE INDEX IF NOT EXISTS idx_attendance_schedule_id ON attendance (schedule_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user_id     ON attendance (user_id);

-- club_members
CREATE INDEX IF NOT EXISTS idx_club_members_club_id ON club_members (club_id);
CREATE INDEX IF NOT EXISTS idx_club_members_user_id ON club_members (user_id);

-- projects
CREATE INDEX IF NOT EXISTS idx_projects_club_id ON projects (club_id);

-- project_members
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members (project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id    ON project_members (user_id);

-- assignments
CREATE INDEX IF NOT EXISTS idx_assignments_club_id   ON assignments (club_id);
CREATE INDEX IF NOT EXISTS idx_assignments_is_active ON assignments (is_active) WHERE is_active = true;

-- submissions
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON submissions (assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id       ON submissions (user_id);

-- clubs (soft-delete 쿼리)
CREATE INDEX IF NOT EXISTS idx_clubs_deleted_at    ON clubs (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clubs_admin_id      ON clubs (admin_id);
CREATE INDEX IF NOT EXISTS idx_clubs_is_recruiting ON clubs (is_recruiting) WHERE is_recruiting = true;

-- archive
CREATE INDEX IF NOT EXISTS idx_archive_folders_club_id   ON archive_folders (club_id);
CREATE INDEX IF NOT EXISTS idx_archive_documents_folder_id ON archive_documents (folder_id);

-- activity_logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs (user_id);

-- ----------------------------------------------------------------
-- 2. RLS 활성화 + 역할 기반 정책
-- ----------------------------------------------------------------

-- ── profiles ────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 자신의 프로필만 수정 가능
CREATE POLICY "profiles: 본인 수정" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- 로그인한 유저는 모든 프로필 조회 가능 (멤버 목록 표시 필요)
CREATE POLICY "profiles: 로그인 유저 조회" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- ── clubs ────────────────────────────────────────────────────────
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

-- 누구나 삭제되지 않은 동아리 조회 가능
CREATE POLICY "clubs: 공개 조회" ON clubs
  FOR SELECT USING (deleted_at IS NULL);

-- 동아리 관리자만 수정
CREATE POLICY "clubs: 관리자 수정" ON clubs
  FOR UPDATE USING (auth.uid() = admin_id);

-- 로그인 유저만 동아리 생성
CREATE POLICY "clubs: 로그인 유저 생성" ON clubs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ── club_members ─────────────────────────────────────────────────
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;

-- 같은 동아리 멤버끼리 조회 가능
CREATE POLICY "club_members: 동아리원 조회" ON club_members
  FOR SELECT USING (
    club_id IN (
      SELECT club_id FROM club_members WHERE user_id = auth.uid()
    )
  );

-- 동아리 관리자(clubs.admin_id)만 멤버 추가/삭제
CREATE POLICY "club_members: 관리자 변경" ON club_members
  FOR ALL USING (
    club_id IN (
      SELECT id FROM clubs WHERE admin_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- ── schedules ────────────────────────────────────────────────────
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- 같은 동아리 멤버는 일정 조회 가능
CREATE POLICY "schedules: 동아리원 조회" ON schedules
  FOR SELECT USING (
    club_id IN (
      SELECT club_id FROM club_members WHERE user_id = auth.uid()
    )
  );

-- 관리자만 일정 생성/수정/삭제
CREATE POLICY "schedules: 관리자 변경" ON schedules
  FOR ALL USING (
    club_id IN (
      SELECT id FROM clubs WHERE admin_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- ── attendance ───────────────────────────────────────────────────
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- 같은 동아리 관리자이거나 본인 기록은 조회 가능
CREATE POLICY "attendance: 본인 또는 관리자 조회" ON attendance
  FOR SELECT USING (
    user_id = auth.uid()
    OR schedule_id IN (
      SELECT s.id FROM schedules s
      JOIN clubs c ON c.id = s.club_id
      WHERE c.admin_id = auth.uid() AND c.deleted_at IS NULL
    )
  );

-- 관리자만 출석 생성/수정
CREATE POLICY "attendance: 관리자 또는 RPC 기록" ON attendance
  FOR INSERT WITH CHECK (
    schedule_id IN (
      SELECT s.id FROM schedules s
      JOIN clubs c ON c.id = s.club_id
      WHERE c.admin_id = auth.uid() AND c.deleted_at IS NULL
    )
    OR user_id = auth.uid()
  );

-- ── submissions ──────────────────────────────────────────────────
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- 본인 제출물 또는 같은 동아리 관리자 조회
CREATE POLICY "submissions: 본인 또는 관리자 조회" ON submissions
  FOR SELECT USING (
    user_id = auth.uid()
    OR assignment_id IN (
      SELECT a.id FROM assignments a
      JOIN clubs c ON c.id = a.club_id
      WHERE c.admin_id = auth.uid() AND c.deleted_at IS NULL
    )
  );

-- 본인만 제출 가능
CREATE POLICY "submissions: 본인 제출" ON submissions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "submissions: 본인 수정" ON submissions
  FOR UPDATE USING (user_id = auth.uid());

-- ── projects ─────────────────────────────────────────────────────
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 공개 조회 (탐색 페이지)
CREATE POLICY "projects: 공개 조회" ON projects
  FOR SELECT USING (true);

-- 관리자만 생성/수정/삭제
CREATE POLICY "projects: 관리자 변경" ON projects
  FOR ALL USING (
    club_id IN (
      SELECT id FROM clubs WHERE admin_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- ── archive_folders & archive_documents ─────────────────────────
ALTER TABLE archive_folders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE archive_documents ENABLE ROW LEVEL SECURITY;

-- 동아리 멤버 조회
CREATE POLICY "archive_folders: 동아리원 조회" ON archive_folders
  FOR SELECT USING (
    club_id IN (
      SELECT club_id FROM club_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "archive_folders: 관리자 변경" ON archive_folders
  FOR ALL USING (
    club_id IN (
      SELECT id FROM clubs WHERE admin_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "archive_documents: 동아리원 조회" ON archive_documents
  FOR SELECT USING (
    folder_id IN (
      SELECT id FROM archive_folders
      WHERE club_id IN (
        SELECT club_id FROM club_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "archive_documents: 관리자 변경" ON archive_documents
  FOR ALL USING (
    folder_id IN (
      SELECT id FROM archive_folders
      WHERE club_id IN (
        SELECT id FROM clubs WHERE admin_id = auth.uid() AND deleted_at IS NULL
      )
    )
  );

-- ── assignments ──────────────────────────────────────────────────
-- (이미 RLS ENABLED — 정책만 보강)
-- 동아리 멤버 조회
CREATE POLICY IF NOT EXISTS "assignments: 동아리원 조회" ON assignments
  FOR SELECT USING (
    club_id IN (
      SELECT club_id FROM club_members WHERE user_id = auth.uid()
    )
  );

-- ── activity_logs ────────────────────────────────────────────────
-- (이미 RLS ENABLED — 정책만 보강)
CREATE POLICY IF NOT EXISTS "activity_logs: 본인 조회" ON activity_logs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "activity_logs: 본인 생성" ON activity_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());
