-- ================================================================
-- Migration v13: 전체 테이블 RLS 재활성화 (프로덕션 보안 복구)
-- 배경: v7/v9/v10에서 개발 편의로 RLS를 비활성화한 것을 프로덕션에서 복구
-- 실행: Supabase Dashboard > SQL Editor
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- STEP 1. 누락 테이블 생성 (없는 경우에만)
-- ────────────────────────────────────────────────────────────────

-- activity_logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title      text        NOT NULL,
  content    text,
  image_url  text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- archive_folders
CREATE TABLE IF NOT EXISTS archive_folders (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id    uuid        REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  name       text        NOT NULL,
  color      text        DEFAULT '#6366f1',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS archive_documents (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id     uuid        REFERENCES clubs(id)           ON DELETE CASCADE  NOT NULL,
  folder_id   uuid        REFERENCES archive_folders(id) ON DELETE SET NULL,
  title       text        NOT NULL,
  description text,
  file_url    text,
  file_name   text,
  file_size   bigint      DEFAULT 0,
  mime_type   text,
  created_by  uuid        REFERENCES profiles(id)        ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

-- submissions 확장 컬럼 (누락 시 추가)
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES assignments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS file_name     text,
  ADD COLUMN IF NOT EXISTS file_size     text;

CREATE UNIQUE INDEX IF NOT EXISTS submissions_assignment_user_unique
  ON submissions (assignment_id, user_id)
  WHERE assignment_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────────
-- STEP 2. 모든 테이블 RLS 활성화
-- ────────────────────────────────────────────────────────────────
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

-- ────────────────────────────────────────────────────────────────
-- STEP 3. 기존 정책 전부 제거 후 명확하게 재등록
-- ────────────────────────────────────────────────────────────────

-- ── profiles ────────────────────────────────────────────────────
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "profiles: 전체 조회"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "profiles: 본인 등록"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: 본인 수정"
  ON profiles FOR UPDATE USING (auth.uid() = id);


-- ── clubs ────────────────────────────────────────────────────────
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'clubs' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON clubs', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "clubs: 공개 조회"
  ON clubs FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "clubs: 로그인 유저 생성"
  ON clubs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "clubs: 관리자 수정"
  ON clubs FOR UPDATE USING (auth.uid() = admin_id);

CREATE POLICY "clubs: 관리자 삭제"
  ON clubs FOR DELETE USING (auth.uid() = admin_id);


-- ── club_members ─────────────────────────────────────────────────
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'club_members' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON club_members', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "club_members: 동아리원 조회"
  ON club_members FOR SELECT USING (
    club_id IN (
      SELECT club_id FROM club_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "club_members: 본인 가입"
  ON club_members FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "club_members: 관리자 수정"
  ON club_members FOR UPDATE USING (
    club_id IN (
      SELECT id FROM clubs WHERE admin_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "club_members: 탈퇴/강퇴"
  ON club_members FOR DELETE USING (
    auth.uid() = user_id
    OR club_id IN (
      SELECT id FROM clubs WHERE admin_id = auth.uid() AND deleted_at IS NULL
    )
  );


-- ── schedules ────────────────────────────────────────────────────
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'schedules' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON schedules', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "schedules: 동아리원 조회"
  ON schedules FOR SELECT USING (
    club_id IN (
      SELECT club_id FROM club_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "schedules: 관리자 생성"
  ON schedules FOR INSERT WITH CHECK (
    club_id IN (
      SELECT id FROM clubs WHERE admin_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "schedules: 관리자 수정삭제"
  ON schedules FOR ALL USING (
    club_id IN (
      SELECT id FROM clubs WHERE admin_id = auth.uid() AND deleted_at IS NULL
    )
  );


-- ── attendance ───────────────────────────────────────────────────
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'attendance' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON attendance', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "attendance: 본인 또는 관리자 조회"
  ON attendance FOR SELECT USING (
    user_id = auth.uid()
    OR schedule_id IN (
      SELECT s.id FROM schedules s
      JOIN clubs c ON c.id = s.club_id
      WHERE c.admin_id = auth.uid() AND c.deleted_at IS NULL
    )
  );

-- SECURITY DEFINER RPC(mark_attendance_by_token)는 RLS 우회하므로 INSERT 정책 필요
CREATE POLICY "attendance: 본인 또는 관리자 기록"
  ON attendance FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR schedule_id IN (
      SELECT s.id FROM schedules s
      JOIN clubs c ON c.id = s.club_id
      WHERE c.admin_id = auth.uid() AND c.deleted_at IS NULL
    )
  );

CREATE POLICY "attendance: 관리자 수정"
  ON attendance FOR UPDATE USING (
    schedule_id IN (
      SELECT s.id FROM schedules s
      JOIN clubs c ON c.id = s.club_id
      WHERE c.admin_id = auth.uid() AND c.deleted_at IS NULL
    )
  );


-- ── submissions ──────────────────────────────────────────────────
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'submissions' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON submissions', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "submissions: 본인 또는 관리자 조회"
  ON submissions FOR SELECT USING (
    user_id = auth.uid()
    OR assignment_id IN (
      SELECT a.id FROM assignments a
      JOIN clubs c ON c.id = a.club_id
      WHERE c.admin_id = auth.uid() AND c.deleted_at IS NULL
    )
  );

CREATE POLICY "submissions: 본인 제출"
  ON submissions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "submissions: 본인 수정"
  ON submissions FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "submissions: 본인 삭제"
  ON submissions FOR DELETE USING (auth.uid() = user_id);


-- ── projects ─────────────────────────────────────────────────────
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'projects' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON projects', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "projects: 공개 조회"
  ON projects FOR SELECT USING (true);

CREATE POLICY "projects: 관리자 변경"
  ON projects FOR ALL USING (
    club_id IN (
      SELECT id FROM clubs WHERE admin_id = auth.uid() AND deleted_at IS NULL
    )
  );


-- ── project_members ──────────────────────────────────────────────
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'project_members' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON project_members', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "project_members: 로그인 조회"
  ON project_members FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "project_members: 관리자 변경"
  ON project_members FOR ALL USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN clubs c ON c.id = p.club_id
      WHERE c.admin_id = auth.uid() AND c.deleted_at IS NULL
    )
  );


-- ── archive_folders ──────────────────────────────────────────────
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'archive_folders' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON archive_folders', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "archive_folders: 동아리원 조회"
  ON archive_folders FOR SELECT USING (
    club_id IN (
      SELECT club_id FROM club_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "archive_folders: 관리자 변경"
  ON archive_folders FOR ALL USING (
    club_id IN (
      SELECT id FROM clubs WHERE admin_id = auth.uid() AND deleted_at IS NULL
    )
  );


-- ── archive_documents ────────────────────────────────────────────
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'archive_documents' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON archive_documents', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "archive_documents: 동아리원 조회"
  ON archive_documents FOR SELECT USING (
    club_id IN (
      SELECT club_id FROM club_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "archive_documents: 관리자 변경"
  ON archive_documents FOR ALL USING (
    club_id IN (
      SELECT id FROM clubs WHERE admin_id = auth.uid() AND deleted_at IS NULL
    )
  );


-- ── assignments ──────────────────────────────────────────────────
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'assignments' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON assignments', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "assignments: 동아리원 조회"
  ON assignments FOR SELECT USING (
    club_id IN (
      SELECT club_id FROM club_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "assignments: 관리자 변경"
  ON assignments FOR ALL USING (
    club_id IN (
      SELECT id FROM clubs WHERE admin_id = auth.uid() AND deleted_at IS NULL
    )
  );


-- ── activity_logs ────────────────────────────────────────────────
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'activity_logs' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON activity_logs', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "activity_logs: 공개 조회"
  ON activity_logs FOR SELECT USING (true);

CREATE POLICY "activity_logs: 본인 관리"
  ON activity_logs FOR ALL USING (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────────
-- STEP 4. 스키마 캐시 갱신
-- ────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ================================================================
-- 완료 체크리스트:
--   ✅ archive_folders / archive_documents 테이블 생성 (없으면)
--   ✅ profiles          — RLS 활성화 + 정책 3개
--   ✅ clubs             — RLS 활성화 + 공개 조회 유지 + 정책 4개
--   ✅ club_members      — RLS 활성화 + 정책 4개
--   ✅ schedules         — RLS 활성화 + 정책 3개
--   ✅ attendance        — RLS 활성화 + 정책 3개
--   ✅ submissions       — RLS 활성화 + 정책 4개
--   ✅ projects          — RLS 활성화 + 공개 조회 유지 + 정책 2개
--   ✅ project_members   — RLS 활성화 + 정책 2개
--   ✅ archive_folders   — RLS 활성화 + 정책 2개
--   ✅ archive_documents — RLS 활성화 + 정책 2개
--   ✅ assignments       — RLS 활성화 + 정책 2개
--   ✅ activity_logs     — RLS 활성화 + 공개 조회 유지
-- ================================================================
