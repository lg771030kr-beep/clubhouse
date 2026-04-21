// ================================================================
// Club DX — Type Definitions
// supabase_migration_v2.sql 스키마와 동기화됨
// 수정일: 2026-04-14
// ================================================================

// ────────────────────────────────────────────────────────────────
// Enum Types
// ────────────────────────────────────────────────────────────────
export type Role = 'ADMIN' | 'USER' | 'LEADER';
export type ScheduleType = 'GENERAL' | 'ASSIGNMENT';
export type AttendanceStatus = 'PRESENT' | 'ABSENT';

// ────────────────────────────────────────────────────────────────
// Core Entities
// ────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  univ_name?: string;
  team_name?: string;        // 소속 팀/파트 이름 (예: "기획팀", "개발팀")
  phone?: string;            // 휴대폰 번호 (010-XXXX-XXXX)
  role: Role;
  created_at: string;
}

export interface Club {
  id: string;
  name: string;
  logo_url?: string;
  description?: string;
  category?: string;         // 동아리 카테고리 (예: "개발", "디자인")
  theme_color?: string | null; // UI 액센트용 hex (#RRGGBB)
  admin_id: string;
  is_recruiting?: boolean;   // 모집 중 여부
  recruit_link?: string;     // 지원 링크 URL
  recruit_description?: string; // 모집 공고 본문
  created_at: string;
}

export interface ClubMember {
  id: string;
  club_id: string;
  user_id: string;
  role: Role;
  joined_at: string;
  // JOIN 시 포함될 수 있는 필드
  profile?: UserProfile;
}

export interface Project {
  id: string;
  club_id: string;
  title: string;
  description?: string;
  image_url?: string;
  link?: string;             // 외부 링크 (발표자료 등)
  github_url?: string;       // GitHub 저장소
  demo_url?: string;         // 데모/배포 URL
  start_date?: string;       // DATE (YYYY-MM-DD)
  end_date?: string;         // DATE (YYYY-MM-DD)
  leader_email?: string;     // 팀장 이메일
  member_count?: number;     // 팀원 수 (캐시용)
  created_at: string;
  updated_at?: string;
  // JOIN 시 포함될 수 있는 필드
  project_members?: ProjectMember[];
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: string;              // 프로젝트 내 역할 (예: "팀장", "개발", "디자인")
  joined_at: string;
  // JOIN 시 포함될 수 있는 필드
  profile?: UserProfile;
}

export interface Schedule {
  id: string;
  club_id: string;
  title: string;
  description?: string;
  date: string;
  time?: string;             // TIME (HH:MM:SS)
  location?: string;
  type: ScheduleType;
  qr_code_token?: string;
  is_approved?: boolean;
  report_url?: string;
  assignment_template_url?: string;
  created_at: string;
}

export interface Attendance {
  id: string;
  schedule_id: string;
  user_id: string;
  status: AttendanceStatus;
  marked_at: string;
}

export interface Assignment {
  id: string;
  club_id: string;
  project_id?: string;       // 연결된 프로젝트 (선택)
  title: string;
  description?: string;
  due_date: string;          // DATE (YYYY-MM-DD)
  assignment_template_url?: string;
  created_by?: string;       // 등록한 관리자 user_id
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  schedule_id?: string;      // 기존 방식 (하위 호환)
  assignment_id?: string;    // 신규 방식
  user_id: string;
  file_url?: string;
  file_name?: string;
  file_size?: string;
  content?: string;
  submitted_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  title: string;
  content?: string;
  image_url?: string;
  created_at: string;
}

// ────────────────────────────────────────────────────────────────
// RPC 응답 타입
// ────────────────────────────────────────────────────────────────

export interface MarkAttendanceResult {
  ok: boolean;
  reason: 'marked_present' | 'schedule_not_found' | 'not_approved' | 'wrong_date';
  schedule_date?: string;
}
