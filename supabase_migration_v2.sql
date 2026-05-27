-- ================================================================
-- Club DX — Migration V2: Schema 전체 정합성 보완
-- 실행 방법: Supabase Dashboard > SQL Editor에서 순서대로 실행
-- 작성일: 2026-04-14
-- ================================================================
-- 이 파일은 supabase_schema.sql + supabase_migration_assignments.sql 이후
-- 누락된 테이블/컬럼을 모두 보완합니다.
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- STEP 1. profiles 테이블 — 누락 컬럼 추가
-- ────────────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS team_name TEXT;           -- 소속 팀/파트 이름 (예: "기획팀", "개발팀")


-- ────────────────────────────────────────────────────────────────
-- STEP 2. clubs 테이블 — 누락 컬럼 추가
-- types.ts의 Club 인터페이스와 동기화
-- ────────────────────────────────────────────────────────────────
ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS category           TEXT,             -- 동아리 카테고리 (예: "개발", "디자인")
  ADD COLUMN IF NOT EXISTS theme_color        TEXT,             -- UI 액센트용 hex (#RRGGBB)
  ADD COLUMN IF NOT EXISTS is_recruiting      BOOLEAN DEFAULT false,  -- 모집 중 여부
  ADD COLUMN IF NOT EXISTS recruit_link       TEXT,             -- 지원 링크 URL
  ADD COLUMN IF NOT EXISTS recruit_description TEXT;            -- 모집 공고 본문


-- ────────────────────────────────────────────────────────────────
-- STEP 3. projects 테이블 생성
-- 동아리별 프로젝트. types.ts의 Project 인터페이스 + migration 확장 컬럼 통합
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      UUID        REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  title        TEXT        NOT NULL,
  description  TEXT,
  image_url    TEXT,
  link         TEXT,                              -- 외부 링크 (발표자료 등)
  github_url   TEXT,                              -- GitHub 저장소
  demo_url     TEXT,                              -- 데모/배포 URL
  start_date   DATE,
  end_date     DATE,
  leader_email TEXT,                              -- 팀장 이메일
  member_count INT         DEFAULT 0,             -- 팀원 수 (캐시용)
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- updated_at 자동 갱신 트리거 (update_updated_at 함수는 migration_assignments에서 생성됨)
DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "projects_select_authenticated"
  ON projects FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "projects_all_club_admin"
  ON projects FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM clubs
      WHERE clubs.id = projects.club_id
        AND clubs.admin_id = auth.uid()
    )
  );


-- ────────────────────────────────────────────────────────────────
-- STEP 4. project_members 테이블 생성
-- 프로젝트 참여 멤버 (ProjectDetail.tsx의 TeamMember 인터페이스 대응)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_members (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID        REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID        REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role       TEXT        DEFAULT 'MEMBER',        -- 프로젝트 내 역할 (예: "팀장", "개발", "디자인")
  joined_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(project_id, user_id)
);

-- RLS
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "project_members_select_authenticated"
  ON project_members FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "project_members_all_club_admin"
  ON project_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN clubs c ON c.id = p.club_id
      WHERE p.id = project_members.project_id
        AND c.admin_id = auth.uid()
    )
  );


-- ────────────────────────────────────────────────────────────────
-- STEP 5. club_members 테이블 생성
-- 동아리 멤버십 (admin_id 단일 필드만으로는 멤버 목록 관리 불가)
-- 현재 profiles.role로 관리 중인 방식과 병행 운영
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS club_members (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id   UUID        REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  user_id   UUID        REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role      user_role   DEFAULT 'USER' NOT NULL,  -- 해당 동아리 내 역할
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(club_id, user_id)
);

-- RLS
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "club_members_select_authenticated"
  ON club_members FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "club_members_all_club_admin"
  ON club_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM clubs
      WHERE clubs.id = club_members.club_id
        AND clubs.admin_id = auth.uid()
    )
  );

-- 본인 탈퇴 허용
CREATE POLICY IF NOT EXISTS "club_members_delete_self"
  ON club_members FOR DELETE
  USING (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────────
-- STEP 6. assignments 테이블 — update_updated_at 함수 보장 후 재생성
-- supabase_migration_assignments.sql과 동일하지만 IF NOT EXISTS로 안전 처리
-- ────────────────────────────────────────────────────────────────

-- update_updated_at 함수가 없을 경우를 대비해 재선언 (CREATE OR REPLACE로 안전)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

DROP TRIGGER IF EXISTS assignments_updated_at ON assignments;
CREATE TRIGGER assignments_updated_at
  BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "assignments_select_authenticated"
  ON assignments FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "assignments_all_club_admin"
  ON assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM clubs
      WHERE clubs.id = assignments.club_id
        AND clubs.admin_id = auth.uid()
    )
  );


-- ────────────────────────────────────────────────────────────────
-- STEP 7. submissions 테이블 — assignment_id 및 파일 관련 컬럼 추가
-- ────────────────────────────────────────────────────────────────
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS file_name     TEXT,
  ADD COLUMN IF NOT EXISTS file_size     TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS submissions_assignment_user_unique
  ON submissions (assignment_id, user_id)
  WHERE assignment_id IS NOT NULL;


-- ────────────────────────────────────────────────────────────────
-- STEP 8. mark_attendance RPC 함수 (QR 출석)
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


-- ================================================================
-- 완료! 실행 체크리스트:
--   ✅ profiles.team_name 추가
--   ✅ clubs 누락 컬럼 5개 추가 (category, theme_color, is_recruiting, recruit_link, recruit_description)
--   ✅ projects 테이블 생성 + RLS
--   ✅ project_members 테이블 생성 + RLS
--   ✅ club_members 테이블 생성 + RLS
--   ✅ assignments 테이블 생성 + RLS (통합)
--   ✅ submissions 확장 컬럼 추가
--   ✅ mark_attendance RPC 함수
-- ================================================================
