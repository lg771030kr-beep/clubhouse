export type Role = 'ADMIN' | 'USER' | 'LEADER';
export type ScheduleType = 'GENERAL' | 'ASSIGNMENT';
export type AttendanceStatus = 'PRESENT' | 'ABSENT';

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  univ_name?: string;
  role: Role;
  created_at: string;
}

export interface Club {
  id: string;
  name: string;
  logo_url?: string;
  description?: string; // 한 줄 소개
  category?: string; // 동아리 카테고리
  /** UI 액센트용 hex (#RRGGBB). 없으면 클라이언트에서 키워드/해시로 배정 */
  theme_color?: string | null;
  admin_id: string;
  is_recruiting?: boolean; // 모집 중 여부
  recruit_link?: string; // 지원 링크
  recruit_description?: string; // 모집 공고 본문
  created_at: string;
}

export interface Project {
  id: string;
  club_id: string;
  title: string;
  description?: string;
  image_url?: string;
  link?: string;
  created_at: string;
}

export interface Schedule {
  id: string;
  club_id: string;
  title: string;
  description?: string;
  date: string;
  type: ScheduleType;
  qr_code_token?: string;
  is_approved?: boolean;
  report_url?: string;
  created_at: string;
}

export interface Attendance {
  id: string;
  schedule_id: string;
  user_id: string;
  status: AttendanceStatus;
  marked_at: string;
}

export interface Submission {
  id: string;
  schedule_id: string;
  user_id: string;
  file_url?: string;
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
