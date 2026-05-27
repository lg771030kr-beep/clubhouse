-- ============================================================
--  ClubDX  –  Org / Collab / Schedule 추가 테이블
--  실행 위치: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────────────────────
--  1. SCHEDULES 컬럼 추가 (회의록)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS meeting_notes text;


-- ─────────────────────────────────────────────────────────────
--  2. SESSION_NOTES  (개인 메모 – 부원 각자 저장)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_notes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid        NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     text,
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (schedule_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_session_notes_schedule ON session_notes (schedule_id);
CREATE INDEX IF NOT EXISTS idx_session_notes_user     ON session_notes (user_id);

ALTER TABLE session_notes ENABLE ROW LEVEL SECURITY;

-- 본인 메모만 읽기/쓰기
CREATE POLICY "session_notes: 본인만 조회"
  ON session_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "session_notes: 본인만 생성"
  ON session_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "session_notes: 본인만 수정"
  ON session_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "session_notes: 본인만 삭제"
  ON session_notes FOR DELETE
  USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────
--  3. ACTION_ITEMS  (액션 아이템 – 공유)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS action_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid        NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  club_id     uuid        NOT NULL,
  content     text        NOT NULL,
  assignee_id uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date    date,
  completed   boolean     DEFAULT false,
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_items_schedule ON action_items (schedule_id);
CREATE INDEX IF NOT EXISTS idx_action_items_club     ON action_items (club_id);

ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;

-- 동아리원 조회, 운영진 생성/수정/삭제
CREATE POLICY "action_items: 동아리원 조회"
  ON action_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_id = action_items.club_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "action_items: 운영진 쓰기"
  ON action_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_id = action_items.club_id
        AND user_id = auth.uid()
        AND role IN ('ADMIN','LEADER','CAPTAIN')
    )
  );


-- ─────────────────────────────────────────────────────────────
--  4. SESSION_LINKS  (작업 링크 – 공유)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_links (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid        NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  club_id     uuid        NOT NULL,
  title       text        NOT NULL,
  url         text        NOT NULL,
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_links_schedule ON session_links (schedule_id);

ALTER TABLE session_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_links: 동아리원 조회"
  ON session_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_id = session_links.club_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "session_links: 운영진 쓰기"
  ON session_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_id = session_links.club_id
        AND user_id = auth.uid()
        AND role IN ('ADMIN','LEADER','CAPTAIN')
    )
  );


-- ─────────────────────────────────────────────────────────────
--  5. SCHEDULE_ASSIGNMENTS  (부원 개별 지정)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schedule_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE (schedule_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_schedule_assignments_schedule ON schedule_assignments (schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_user     ON schedule_assignments (user_id);

ALTER TABLE schedule_assignments ENABLE ROW LEVEL SECURITY;

-- 동아리 관리자가 schedule 소유 여부 확인 후 모든 작업 허용
CREATE POLICY "schedule_assignments: 운영진 관리"
  ON schedule_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM schedules s
      JOIN club_members cm ON cm.club_id = s.club_id
      WHERE s.id = schedule_assignments.schedule_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('ADMIN','LEADER','CAPTAIN')
    )
  );

-- 본인 행은 SELECT 허용 (어느 일정에 배정됐는지 확인)
CREATE POLICY "schedule_assignments: 본인 조회"
  ON schedule_assignments FOR SELECT
  USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────
--  6. ABSENCE_REPORTS  (지각/결석 신고)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS absence_reports (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid        NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id     uuid        NOT NULL,
  type        text        NOT NULL CHECK (type IN ('LATE','ABSENT')),
  reason      text,
  reported_at timestamptz DEFAULT now(),
  UNIQUE (schedule_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_absence_reports_schedule ON absence_reports (schedule_id);
CREATE INDEX IF NOT EXISTS idx_absence_reports_club     ON absence_reports (club_id);

ALTER TABLE absence_reports ENABLE ROW LEVEL SECURITY;

-- 본인 신고 생성·수정·삭제
CREATE POLICY "absence_reports: 본인 쓰기"
  ON absence_reports FOR ALL
  USING (auth.uid() = user_id);

-- 운영진: 동아리 전체 조회
CREATE POLICY "absence_reports: 운영진 조회"
  ON absence_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_id = absence_reports.club_id
        AND user_id = auth.uid()
        AND role IN ('ADMIN','LEADER','CAPTAIN')
    )
  );


-- ─────────────────────────────────────────────────────────────
--  7. ORGANIZATIONS  (기관/기업 계정)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  type        text        NOT NULL DEFAULT 'institution'
                CHECK (type IN ('institution','enterprise')),
  description text,
  logo_url    text,
  website     text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations (owner_id);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- 오너: 전체 권한
CREATE POLICY "organizations: 오너 전체"
  ON organizations FOR ALL
  USING (auth.uid() = owner_id);

-- 모든 인증 사용자: 읽기
CREATE POLICY "organizations: 인증 사용자 조회"
  ON organizations FOR SELECT
  USING (auth.uid() IS NOT NULL);


-- ─────────────────────────────────────────────────────────────
--  8. ORG_PROGRAMS  (기관 프로그램)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_programs (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                  text        NOT NULL,
  type                  text        NOT NULL
                          CHECK (type IN ('CLUB','CAMPAIGN','CONTEST','EVENT')),
  phase                 text        NOT NULL DEFAULT 'DRAFT'
                          CHECK (phase IN ('DRAFT','RECRUITING','REVIEWING','OPERATING','COMPLETED')),
  description           text,
  field                 text,
  thumbnail_url         text,
  start_date            date,
  end_date              date,
  recruit_start         date,
  recruit_end           date,
  capacity              int,
  is_public             boolean     DEFAULT true,

  -- CLUB 전용
  category              text,
  has_fee               boolean     DEFAULT false,

  -- CAMPAIGN 전용 (지원 질문 배열: [{id, text}])
  questions             jsonb,

  -- CONTEST 전용 (제출 형식 배열: [{id, label}])
  submission_types      jsonb,

  -- EVENT 전용
  is_online             boolean     DEFAULT false,
  location              text,

  -- 공고
  announcement_content  text,

  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_programs_org     ON org_programs (org_id);
CREATE INDEX IF NOT EXISTS idx_org_programs_phase   ON org_programs (phase);
CREATE INDEX IF NOT EXISTS idx_org_programs_type    ON org_programs (type);
CREATE INDEX IF NOT EXISTS idx_org_programs_public  ON org_programs (is_public) WHERE is_public = true;

ALTER TABLE org_programs ENABLE ROW LEVEL SECURITY;

-- 오너(org 소유자): 전체 권한
CREATE POLICY "org_programs: 오너 전체"
  ON org_programs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE id = org_programs.org_id AND owner_id = auth.uid()
    )
  );

-- 모든 인증 사용자: 공개 프로그램 읽기
CREATE POLICY "org_programs: 공개 조회"
  ON org_programs FOR SELECT
  USING (is_public = true AND auth.uid() IS NOT NULL);

-- 자동 updated_at
CREATE OR REPLACE FUNCTION set_org_programs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_org_programs_updated_at ON org_programs;
CREATE TRIGGER trg_org_programs_updated_at
  BEFORE UPDATE ON org_programs
  FOR EACH ROW EXECUTE FUNCTION set_org_programs_updated_at();


-- ─────────────────────────────────────────────────────────────
--  9. ORG_APPLICATIONS  (지원서)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_applications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  uuid        NOT NULL REFERENCES org_programs(id) ON DELETE CASCADE,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  name        text        NOT NULL,
  email       text        NOT NULL,
  phone       text,
  -- 질문 답변: { "q_<id>": "답변 내용", ... }
  answers     jsonb,
  status      text        NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING','REVIEWING','ACCEPTED','REJECTED','WAITLISTED')),
  note        text,           -- 운영자 내부 메모
  applied_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_applications_program ON org_applications (program_id);
CREATE INDEX IF NOT EXISTS idx_org_applications_user    ON org_applications (user_id);
CREATE INDEX IF NOT EXISTS idx_org_applications_status  ON org_applications (status);

ALTER TABLE org_applications ENABLE ROW LEVEL SECURITY;

-- 지원자 본인: 읽기 + 생성
CREATE POLICY "org_applications: 본인 조회"
  ON org_applications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "org_applications: 지원 생성"
  ON org_applications FOR INSERT
  WITH CHECK (
    -- 공개 모집 중인 프로그램만 지원 가능
    EXISTS (
      SELECT 1 FROM org_programs
      WHERE id = org_applications.program_id
        AND is_public = true
        AND phase = 'RECRUITING'
    )
  );

-- 운영자: 프로그램 소속 지원서 전체 관리
CREATE POLICY "org_applications: 운영자 관리"
  ON org_applications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM org_programs p
      JOIN organizations o ON o.id = p.org_id
      WHERE p.id = org_applications.program_id
        AND o.owner_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────────────────────
--  10. ORG_PROGRAM_MEMBERS  (합격 후 멤버)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_program_members (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  uuid        NOT NULL REFERENCES org_programs(id) ON DELETE CASCADE,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  name        text,
  email       text,
  phone       text,
  role        text        NOT NULL DEFAULT 'MEMBER'
                CHECK (role IN ('LEADER','MEMBER')),
  status      text        NOT NULL DEFAULT 'ACTIVE'
                CHECK (status IN ('ACTIVE','INACTIVE','WITHDRAWN')),
  joined_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_program_members_program ON org_program_members (program_id);
CREATE INDEX IF NOT EXISTS idx_org_program_members_user    ON org_program_members (user_id);

ALTER TABLE org_program_members ENABLE ROW LEVEL SECURITY;

-- 운영자: 전체 관리
CREATE POLICY "org_program_members: 운영자 관리"
  ON org_program_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM org_programs p
      JOIN organizations o ON o.id = p.org_id
      WHERE p.id = org_program_members.program_id
        AND o.owner_id = auth.uid()
    )
  );

-- 본인 멤버 행 조회
CREATE POLICY "org_program_members: 본인 조회"
  ON org_program_members FOR SELECT
  USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────
--  완료 확인 쿼리 (실행 후 아래 주석 해제해서 확인)
-- ─────────────────────────────────────────────────────────────
-- SELECT tablename FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'session_notes','action_items','session_links',
--     'schedule_assignments','absence_reports',
--     'organizations','org_programs','org_applications','org_program_members'
--   )
-- ORDER BY tablename;
