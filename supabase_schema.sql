-- ===============================================================
-- Club DX Management Platform - Supabase Schema
-- ===============================================================

-- 1. Create Custom Types (Enums)
CREATE TYPE user_role AS ENUM ('ADMIN', 'USER');
CREATE TYPE schedule_type AS ENUM ('GENERAL', 'ASSIGNMENT');
CREATE TYPE attendance_status AS ENUM ('PRESENT', 'ABSENT');

-- 2. Profiles Table (Extends Auth.Users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  univ_name TEXT,
  role user_role DEFAULT 'USER' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Clubs Table
CREATE TABLE clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  description VARCHAR(300),
  admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. Schedules Table
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  date TIMESTAMPTZ NOT NULL,
  type schedule_type DEFAULT 'GENERAL' NOT NULL,
  qr_code_token TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. Attendance Table
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status attendance_status DEFAULT 'ABSENT' NOT NULL,
  marked_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(schedule_id, user_id)
);

-- 6. Submissions Table
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT,
  content TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 7. Activity Logs Table (Personal Portfolio)
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ===============================================================
-- Row Level Security (RLS) Policies
-- ===============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Clubs Policies
CREATE POLICY "Clubs are viewable by everyone" ON clubs FOR SELECT USING (true);
CREATE POLICY "Admins can manage their own club" ON clubs FOR ALL USING (auth.uid() = admin_id);

-- Schedules Policies
CREATE POLICY "Schedules are viewable by authenticated users" ON schedules FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Club admins can manage schedules" ON schedules FOR ALL USING (
  EXISTS (
    SELECT 1 FROM clubs WHERE clubs.id = schedules.club_id AND clubs.admin_id = auth.uid()
  )
);

-- Attendance Policies
CREATE POLICY "Users can view their own attendance" ON attendance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Club admins can manage attendance for their club" ON attendance FOR ALL USING (
  EXISTS (
    SELECT 1 FROM schedules 
    JOIN clubs ON schedules.club_id = clubs.id 
    WHERE schedules.id = attendance.schedule_id AND clubs.admin_id = auth.uid()
  )
);

-- Submissions Policies
CREATE POLICY "Users can manage their own submissions" ON submissions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Club admins can view submissions for their club" ON submissions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM schedules 
    JOIN clubs ON schedules.club_id = clubs.id 
    WHERE schedules.id = submissions.schedule_id AND clubs.admin_id = auth.uid()
  )
);

-- Activity Logs Policies
CREATE POLICY "Activity logs are viewable by everyone" ON activity_logs FOR SELECT USING (true);
CREATE POLICY "Users can manage their own activity logs" ON activity_logs FOR ALL USING (auth.uid() = user_id);

-- ===============================================================
-- 8. Alter tables for MVP Additions
-- ===============================================================
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS time TIME;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS assignment_template_url TEXT;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT true;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS report_url TEXT;

-- Enum update (must run separately or handles IF NOT EXISTS from PG 12+)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'LEADER';

-- Storage Setup (Run these manually in SQL Editor if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('assignments', 'assignments', true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', true) ON CONFLICT DO NOTHING;

-- ================================================================
-- ★ MVP 보완 마이그레이션 (별도 파일: supabase_migration_assignments.sql)
-- 아래 테이블/컬럼이 추가됩니다:
--   - assignments (전용 과제 테이블, club_id + project_id 연동)
--   - submissions.assignment_id 컬럼 추가
--   - projects.start_date / end_date / github_url / demo_url / leader_email / member_count
--   - mark_attendance() RPC 함수 (QR 출석 upsert, 날짜 검증 포함)
-- ================================================================
