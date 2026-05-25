-- ================================================================
-- Full Schema Migration (통합본)
-- 모든 마이그레이션을 하나로 합침
-- ================================================================

-- ── Enums ────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('ADMIN', 'USER', 'LEADER', 'MEMBER', 'CAPTAIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE schedule_type AS ENUM ('GENERAL', 'ASSIGNMENT', 'BOTH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE attendance_status AS ENUM ('PRESENT', 'ABSENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── profiles ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email      TEXT        UNIQUE NOT NULL,
  full_name  TEXT,
  univ_name  TEXT,
  role       user_role   DEFAULT 'USER' NOT NULL,
  phone      TEXT,
  team_name  TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ── clubs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clubs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL,
  logo_url            TEXT,
  description         TEXT,
  admin_id            UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  category            TEXT,
  theme_color         TEXT,
  is_recruiting       BOOLEAN     DEFAULT false,
  recruit_link        TEXT,
  recruit_description TEXT,
  affiliation         TEXT,
  club_type           TEXT,
  brochure_url        TEXT,
  field               TEXT,
  members             INT         DEFAULT 0,
  founded             TEXT,
  location            TEXT,
  deleted_at          TIMESTAMPTZ DEFAULT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ── projects ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      UUID        REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  title        TEXT        NOT NULL,
  description  TEXT,
  image_url    TEXT,
  link         TEXT,
  github_url   TEXT,
  demo_url     TEXT,
  start_date   DATE,
  end_date     DATE,
  leader_email TEXT,
  member_count INT         DEFAULT 0,
  views        INT         DEFAULT 0 NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ── assignments ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assignments (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id                 UUID        REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  project_id              UUID        REFERENCES projects(id) ON DELETE SET NULL,
  title                   TEXT        NOT NULL,
  description             TEXT,
  due_date                DATE        NOT NULL,
  assignment_template_url TEXT,
  created_by              UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  is_active               BOOLEAN     DEFAULT true,
  created_at              TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ── schedules ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schedules (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id                 UUID          REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  title                   TEXT          NOT NULL,
  description             TEXT,
  date                    TIMESTAMPTZ   NOT NULL,
  time                    TIME,
  location                TEXT,
  type                    schedule_type DEFAULT 'GENERAL' NOT NULL,
  qr_code_token           TEXT          UNIQUE,
  is_approved             BOOLEAN       DEFAULT true,
  assignment_template_url TEXT,
  report_url              TEXT,
  created_at              TIMESTAMPTZ   DEFAULT NOW() NOT NULL
);

-- ── attendance ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id          UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID              REFERENCES schedules(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID              REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status      attendance_status DEFAULT 'ABSENT' NOT NULL,
  marked_at   TIMESTAMPTZ       DEFAULT NOW() NOT NULL,
  UNIQUE(schedule_id, user_id)
);

-- ── submissions ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS submissions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id   UUID        REFERENCES schedules(id) ON DELETE CASCADE,
  assignment_id UUID        REFERENCES assignments(id) ON DELETE CASCADE,
  user_id       UUID        REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  file_url      TEXT,
  file_name     TEXT,
  file_size     TEXT,
  content       TEXT,
  submitted_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS submissions_assignment_user_unique
  ON submissions (assignment_id, user_id)
  WHERE assignment_id IS NOT NULL;

-- ── activity_logs ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title      TEXT        NOT NULL,
  content    TEXT,
  image_url  TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ── club_members ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS club_members (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id   UUID        REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  user_id   UUID        REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role      user_role   DEFAULT 'MEMBER' NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(club_id, user_id)
);

-- ── project_members ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_members (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID        REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID        REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role       TEXT        DEFAULT 'MEMBER',
  joined_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(project_id, user_id)
);

-- ── archive_folders ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS archive_folders (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id    UUID        REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  name       TEXT        NOT NULL,
  color      TEXT        DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── archive_documents ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS archive_documents (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id     UUID        REFERENCES clubs(id)           ON DELETE CASCADE  NOT NULL,
  folder_id   UUID        REFERENCES archive_folders(id) ON DELETE SET NULL,
  title       TEXT        NOT NULL,
  description TEXT,
  file_url    TEXT,
  file_name   TEXT,
  file_size   BIGINT      DEFAULT 0,
  mime_type   TEXT,
  created_by  UUID        REFERENCES profiles(id)        ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── updated_at 트리거 ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS assignments_updated_at ON assignments;
CREATE TRIGGER assignments_updated_at
  BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 인덱스 ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_schedules_club_id       ON schedules (club_id);
CREATE INDEX IF NOT EXISTS idx_schedules_date          ON schedules (date);
CREATE INDEX IF NOT EXISTS idx_schedules_qr_code_token ON schedules (qr_code_token) WHERE qr_code_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_schedule_id  ON attendance (schedule_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user_id      ON attendance (user_id);
CREATE INDEX IF NOT EXISTS idx_club_members_club_id    ON club_members (club_id);
CREATE INDEX IF NOT EXISTS idx_club_members_user_id    ON club_members (user_id);
CREATE INDEX IF NOT EXISTS idx_projects_club_id        ON projects (club_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members (project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id    ON project_members (user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_club_id     ON assignments (club_id);
CREATE INDEX IF NOT EXISTS idx_assignments_is_active   ON assignments (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON submissions (assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id       ON submissions (user_id);
CREATE INDEX IF NOT EXISTS idx_clubs_deleted_at        ON clubs (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clubs_admin_id          ON clubs (admin_id);
CREATE INDEX IF NOT EXISTS idx_clubs_is_recruiting     ON clubs (is_recruiting) WHERE is_recruiting = true;
CREATE INDEX IF NOT EXISTS idx_archive_folders_club_id   ON archive_folders (club_id);
CREATE INDEX IF NOT EXISTS idx_archive_documents_folder_id ON archive_documents (folder_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id   ON activity_logs (user_id);

-- ================================================================
-- RLS 활성화 + 정책
-- ================================================================

ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules         ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance        ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE archive_folders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE archive_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs     ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles: 전체 조회"   ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles: 본인 등록"   ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles: 본인 수정"   ON profiles FOR UPDATE USING (auth.uid() = id);

-- clubs
CREATE POLICY "clubs: 공개 조회"      ON clubs FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "clubs: 로그인 유저 생성" ON clubs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "clubs: 관리자 수정"    ON clubs FOR UPDATE USING (auth.uid() = admin_id);
CREATE POLICY "clubs: 관리자 삭제"    ON clubs FOR DELETE USING (auth.uid() = admin_id);

-- club_members
CREATE POLICY "club_members: 동아리원 조회" ON club_members FOR SELECT USING (
  club_id IN (SELECT club_id FROM club_members WHERE user_id = auth.uid())
);
CREATE POLICY "club_members: 본인 가입" ON club_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "club_members: 관리자 수정" ON club_members FOR UPDATE USING (
  club_id IN (SELECT id FROM clubs WHERE admin_id = auth.uid() AND deleted_at IS NULL)
);
CREATE POLICY "club_members: 탈퇴/강퇴" ON club_members FOR DELETE USING (
  auth.uid() = user_id
  OR club_id IN (SELECT id FROM clubs WHERE admin_id = auth.uid() AND deleted_at IS NULL)
);

-- schedules
CREATE POLICY "schedules: 동아리원 또는 관리자 조회" ON schedules FOR SELECT USING (
  club_id IN (SELECT club_id FROM club_members WHERE user_id = auth.uid())
  OR club_id IN (SELECT id FROM clubs WHERE admin_id = auth.uid())
);
CREATE POLICY "schedules: 관리자 생성" ON schedules FOR INSERT WITH CHECK (
  club_id IN (SELECT id FROM clubs WHERE admin_id = auth.uid())
);
CREATE POLICY "schedules: 관리자 수정삭제" ON schedules FOR ALL USING (
  club_id IN (SELECT id FROM clubs WHERE admin_id = auth.uid())
);

-- attendance
CREATE POLICY "attendance: 본인 또는 관리자 조회" ON attendance FOR SELECT USING (
  user_id = auth.uid()
  OR schedule_id IN (
    SELECT s.id FROM schedules s JOIN clubs c ON c.id = s.club_id
    WHERE c.admin_id = auth.uid() AND c.deleted_at IS NULL
  )
);
CREATE POLICY "attendance: 본인 또는 관리자 기록" ON attendance FOR INSERT WITH CHECK (
  user_id = auth.uid()
  OR schedule_id IN (
    SELECT s.id FROM schedules s JOIN clubs c ON c.id = s.club_id
    WHERE c.admin_id = auth.uid() AND c.deleted_at IS NULL
  )
);
CREATE POLICY "attendance: 관리자 수정" ON attendance FOR UPDATE USING (
  schedule_id IN (
    SELECT s.id FROM schedules s JOIN clubs c ON c.id = s.club_id
    WHERE c.admin_id = auth.uid() AND c.deleted_at IS NULL
  )
);

-- submissions
CREATE POLICY "submissions: 본인 또는 관리자 조회" ON submissions FOR SELECT USING (
  user_id = auth.uid()
  OR assignment_id IN (
    SELECT a.id FROM assignments a JOIN clubs c ON c.id = a.club_id
    WHERE c.admin_id = auth.uid() AND c.deleted_at IS NULL
  )
);
CREATE POLICY "submissions: 본인 제출" ON submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "submissions: 본인 수정" ON submissions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "submissions: 본인 삭제" ON submissions FOR DELETE USING (auth.uid() = user_id);

-- projects
CREATE POLICY "projects: 공개 조회" ON projects FOR SELECT USING (true);
CREATE POLICY "projects: 관리자 변경" ON projects FOR ALL USING (
  club_id IN (SELECT id FROM clubs WHERE admin_id = auth.uid() AND deleted_at IS NULL)
);

-- project_members
CREATE POLICY "project_members: 로그인 조회" ON project_members FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "project_members: 관리자 변경" ON project_members FOR ALL USING (
  project_id IN (
    SELECT p.id FROM projects p JOIN clubs c ON c.id = p.club_id
    WHERE c.admin_id = auth.uid() AND c.deleted_at IS NULL
  )
);

-- archive_folders
CREATE POLICY "archive_folders: 동아리원 조회" ON archive_folders FOR SELECT USING (
  club_id IN (SELECT club_id FROM club_members WHERE user_id = auth.uid())
);
CREATE POLICY "archive_folders: 관리자 변경" ON archive_folders FOR ALL USING (
  club_id IN (SELECT id FROM clubs WHERE admin_id = auth.uid() AND deleted_at IS NULL)
);

-- archive_documents
CREATE POLICY "archive_documents: 동아리원 조회" ON archive_documents FOR SELECT USING (
  club_id IN (SELECT club_id FROM club_members WHERE user_id = auth.uid())
);
CREATE POLICY "archive_documents: 관리자 변경" ON archive_documents FOR ALL USING (
  club_id IN (SELECT id FROM clubs WHERE admin_id = auth.uid() AND deleted_at IS NULL)
);

-- assignments
CREATE POLICY "assignments: 동아리원 조회" ON assignments FOR SELECT USING (
  club_id IN (SELECT club_id FROM club_members WHERE user_id = auth.uid())
);
CREATE POLICY "assignments: 관리자 변경" ON assignments FOR ALL USING (
  club_id IN (SELECT id FROM clubs WHERE admin_id = auth.uid() AND deleted_at IS NULL)
);

-- activity_logs
CREATE POLICY "activity_logs: 공개 조회" ON activity_logs FOR SELECT USING (true);
CREATE POLICY "activity_logs: 본인 관리" ON activity_logs FOR ALL USING (auth.uid() = user_id);

-- ================================================================
-- RPC 함수
-- ================================================================

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
  SELECT id, date, is_approved INTO v_schedule FROM schedules WHERE qr_code_token = p_token;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_token'); END IF;
  IF NOT v_schedule.is_approved THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_approved'); END IF;
  IF v_schedule.date::DATE <> p_today THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'wrong_date', 'schedule_date', v_schedule.date::TEXT);
  END IF;
  INSERT INTO attendance (schedule_id, user_id, status, marked_at)
    VALUES (v_schedule.id, p_user_id, 'PRESENT', NOW())
  ON CONFLICT (schedule_id, user_id) DO UPDATE SET status = 'PRESENT', marked_at = NOW();
  RETURN jsonb_build_object('ok', true, 'reason', 'marked_present');
END;
$$;

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
  SELECT id, date, is_approved INTO v_schedule FROM schedules WHERE id = p_schedule_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'schedule_not_found'); END IF;
  IF NOT v_schedule.is_approved THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_approved'); END IF;
  IF v_schedule.date::DATE <> p_today THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'wrong_date', 'schedule_date', v_schedule.date::TEXT);
  END IF;
  INSERT INTO attendance (schedule_id, user_id, status, marked_at)
    VALUES (p_schedule_id, p_user_id, 'PRESENT', NOW())
  ON CONFLICT (schedule_id, user_id) DO UPDATE SET status = 'PRESENT', marked_at = NOW();
  RETURN jsonb_build_object('ok', true, 'reason', 'marked_present');
END;
$$;

NOTIFY pgrst, 'reload schema';
