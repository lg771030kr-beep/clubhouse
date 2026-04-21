// ================================================================
// Club DX — API Service Layer
// Supabase 쿼리를 컴포넌트에서 분리해 재사용성 확보
// ================================================================
import { supabase } from './supabase';
import type {
  UserProfile, Club, ClubMember,
  Project, ProjectMember,
  Schedule, Attendance,
  Assignment, Submission,
  ActivityLog, MarkAttendanceResult,
} from '../types';

// ────────────────────────────────────────────────────────────────
// Profiles
// ────────────────────────────────────────────────────────────────

export const profilesApi = {
  /** 전체 프로필 목록 (어드민용) */
  async getAll(): Promise<UserProfile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as UserProfile[];
  },

  /** 단일 프로필 조회 */
  async getById(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data as UserProfile;
  },

  /** 현재 로그인 유저 프로필 */
  async getCurrent(): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    return profilesApi.getById(user.id);
  },

  /** 프로필 업데이트 */
  async update(userId: string, updates: Partial<UserProfile>): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);
    if (error) throw error;
  },

  /** 역할 변경 */
  async updateRole(userId: string, role: UserProfile['role']): Promise<void> {
    return profilesApi.update(userId, { role });
  },
};

// ────────────────────────────────────────────────────────────────
// Clubs
// ────────────────────────────────────────────────────────────────

export const clubsApi = {
  /** 전체 클럽 목록 (삭제된 동아리 제외) */
  async getAll(): Promise<Club[]> {
    const { data, error } = await supabase
      .from('clubs')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Club[];
  },

  /** 단일 클럽 조회 */
  async getById(clubId: string): Promise<Club | null> {
    const { data, error } = await supabase
      .from('clubs')
      .select('*')
      .eq('id', clubId)
      .single();
    if (error) throw error;
    return data as Club;
  },

  /** 클럽 생성 */
  async create(club: Omit<Club, 'id' | 'created_at'>): Promise<Club> {
    const { data, error } = await supabase
      .from('clubs')
      .insert([club])
      .select()
      .single();
    if (error) throw error;
    return data as Club;
  },

  /** 클럽 업데이트 */
  async update(clubId: string, updates: Partial<Club>): Promise<void> {
    const { error } = await supabase
      .from('clubs')
      .update(updates)
      .eq('id', clubId);
    if (error) throw error;
  },

  /** 모집 중인 클럽 목록 (삭제된 동아리 제외) */
  async getRecruiting(): Promise<Club[]> {
    const { data, error } = await supabase
      .from('clubs')
      .select('*')
      .eq('is_recruiting', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Club[];
  },
};

// ────────────────────────────────────────────────────────────────
// Club Members
// ────────────────────────────────────────────────────────────────

export const clubMembersApi = {
  /** 클럽의 전체 멤버 (프로필 JOIN) */
  async getByClub(clubId: string): Promise<(ClubMember & { profile: UserProfile })[]> {
    const { data, error } = await supabase
      .from('club_members')
      .select('*, profile:profiles(*)')
      .eq('club_id', clubId)
      .order('joined_at', { ascending: false });
    if (error) throw error;
    return data as (ClubMember & { profile: UserProfile })[];
  },

  /** 멤버 추가 */
  async add(clubId: string, userId: string, role: ClubMember['role'] = 'USER'): Promise<void> {
    const { error } = await supabase
      .from('club_members')
      .insert([{ club_id: clubId, user_id: userId, role }]);
    if (error) throw error;
  },

  /** 멤버 역할 변경 */
  async updateRole(clubId: string, userId: string, role: ClubMember['role']): Promise<void> {
    const { error } = await supabase
      .from('club_members')
      .update({ role })
      .eq('club_id', clubId)
      .eq('user_id', userId);
    if (error) throw error;
  },

  /** 멤버 제거 */
  async remove(clubId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('club_members')
      .delete()
      .eq('club_id', clubId)
      .eq('user_id', userId);
    if (error) throw error;
  },

  /** 특정 유저가 클럽 멤버인지 확인 */
  async isMember(clubId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('club_members')
      .select('id')
      .eq('club_id', clubId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  },
};

// ────────────────────────────────────────────────────────────────
// Projects
// ────────────────────────────────────────────────────────────────

export const projectsApi = {
  /** 클럽의 프로젝트 목록 */
  async getByClub(clubId: string): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('club_id', clubId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Project[];
  },

  /** 단일 프로젝트 (멤버 포함) */
  async getById(projectId: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*, project_members(*, profile:profiles(*))')
      .eq('id', projectId)
      .single();
    if (error) throw error;
    return data as Project;
  },

  /** 프로젝트 생성 */
  async create(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .insert([project])
      .select()
      .single();
    if (error) throw error;
    return data as Project;
  },

  /** 프로젝트 업데이트 */
  async update(projectId: string, updates: Partial<Project>): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId);
    if (error) throw error;
  },

  /** 프로젝트 삭제 */
  async remove(projectId: string): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);
    if (error) throw error;
  },

  /** 전체 프로젝트 (탐색 페이지용) */
  async getAll(): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*, clubs(name, logo_url, theme_color)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Project[];
  },
};

// ────────────────────────────────────────────────────────────────
// Project Members
// ────────────────────────────────────────────────────────────────

export const projectMembersApi = {
  /** 프로젝트 멤버 추가 */
  async add(projectId: string, userId: string, role = 'MEMBER'): Promise<void> {
    const { error } = await supabase
      .from('project_members')
      .insert([{ project_id: projectId, user_id: userId, role }]);
    if (error) throw error;
  },

  /** 프로젝트 멤버 제거 */
  async remove(projectId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);
    if (error) throw error;
  },
};

// ────────────────────────────────────────────────────────────────
// Schedules
// ────────────────────────────────────────────────────────────────

export const schedulesApi = {
  /** 클럽의 일정 목록 */
  async getByClub(clubId: string): Promise<Schedule[]> {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('club_id', clubId)
      .order('date', { ascending: true });
    if (error) throw error;
    return data as Schedule[];
  },

  /** 단일 일정 */
  async getById(scheduleId: string): Promise<Schedule | null> {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('id', scheduleId)
      .single();
    if (error) throw error;
    return data as Schedule;
  },

  /** 일정 생성 */
  async create(schedule: Omit<Schedule, 'id' | 'created_at'>): Promise<Schedule> {
    const { data, error } = await supabase
      .from('schedules')
      .insert([schedule])
      .select()
      .single();
    if (error) throw error;
    return data as Schedule;
  },

  /** 일정 업데이트 */
  async update(scheduleId: string, updates: Partial<Schedule>): Promise<void> {
    const { error } = await supabase
      .from('schedules')
      .update(updates)
      .eq('id', scheduleId);
    if (error) throw error;
  },

  /** 일정 삭제 */
  async remove(scheduleId: string): Promise<void> {
    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', scheduleId);
    if (error) throw error;
  },

  /** QR 토큰으로 일정 조회 */
  async getByQRToken(token: string): Promise<Schedule | null> {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('qr_code_token', token)
      .single();
    if (error) throw error;
    return data as Schedule;
  },
};

// ────────────────────────────────────────────────────────────────
// Attendance
// ────────────────────────────────────────────────────────────────

export const attendanceApi = {
  /** 일정별 출석 현황 */
  async getBySchedule(scheduleId: string): Promise<(Attendance & { profile: UserProfile })[]> {
    const { data, error } = await supabase
      .from('attendance')
      .select('*, profile:profiles(*)')
      .eq('schedule_id', scheduleId);
    if (error) throw error;
    return data as (Attendance & { profile: UserProfile })[];
  },

  /** QR 출석 처리 (RPC) */
  async markByQR(scheduleId: string, userId: string): Promise<MarkAttendanceResult> {
    const { data, error } = await supabase.rpc('mark_attendance', {
      p_schedule_id: scheduleId,
      p_user_id: userId,
    });
    if (error) throw error;
    return data as MarkAttendanceResult;
  },

  /** 유저의 출석 기록 */
  async getByUser(userId: string): Promise<(Attendance & { schedule: Schedule })[]> {
    const { data, error } = await supabase
      .from('attendance')
      .select('*, schedule:schedules(*)')
      .eq('user_id', userId)
      .order('marked_at', { ascending: false });
    if (error) throw error;
    return data as (Attendance & { schedule: Schedule })[];
  },
};

// ────────────────────────────────────────────────────────────────
// Assignments
// ────────────────────────────────────────────────────────────────

export const assignmentsApi = {
  /** 클럽의 과제 목록 */
  async getByClub(clubId: string): Promise<Assignment[]> {
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('club_id', clubId)
      .eq('is_active', true)
      .order('due_date', { ascending: true });
    if (error) throw error;
    return data as Assignment[];
  },

  /** 단일 과제 */
  async getById(assignmentId: string): Promise<Assignment | null> {
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('id', assignmentId)
      .single();
    if (error) throw error;
    return data as Assignment;
  },

  /** 과제 생성 */
  async create(assignment: Omit<Assignment, 'id' | 'created_at' | 'updated_at'>): Promise<Assignment> {
    const { data, error } = await supabase
      .from('assignments')
      .insert([assignment])
      .select()
      .single();
    if (error) throw error;
    return data as Assignment;
  },

  /** 과제 업데이트 */
  async update(assignmentId: string, updates: Partial<Assignment>): Promise<void> {
    const { error } = await supabase
      .from('assignments')
      .update(updates)
      .eq('id', assignmentId);
    if (error) throw error;
  },
};

// ────────────────────────────────────────────────────────────────
// Submissions
// ────────────────────────────────────────────────────────────────

export const submissionsApi = {
  /** 과제별 제출 현황 (어드민용) */
  async getByAssignment(assignmentId: string): Promise<(Submission & { profile: UserProfile })[]> {
    const { data, error } = await supabase
      .from('submissions')
      .select('*, profile:profiles(*)')
      .eq('assignment_id', assignmentId);
    if (error) throw error;
    return data as (Submission & { profile: UserProfile })[];
  },

  /** 유저의 제출 기록 */
  async getByUser(userId: string): Promise<Submission[]> {
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    return data as Submission[];
  },

  /** 제출 생성/업데이트 (upsert) */
  async upsert(submission: Omit<Submission, 'id' | 'submitted_at'>): Promise<void> {
    const { error } = await supabase
      .from('submissions')
      .upsert([submission], {
        onConflict: 'assignment_id,user_id',
      });
    if (error) throw error;
  },
};

// ────────────────────────────────────────────────────────────────
// Activity Logs
// ────────────────────────────────────────────────────────────────

export const activityLogsApi = {
  /** 유저의 활동 로그 */
  async getByUser(userId: string): Promise<ActivityLog[]> {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as ActivityLog[];
  },

  /** 활동 로그 생성 */
  async create(log: Omit<ActivityLog, 'id' | 'created_at'>): Promise<ActivityLog> {
    const { data, error } = await supabase
      .from('activity_logs')
      .insert([log])
      .select()
      .single();
    if (error) throw error;
    return data as ActivityLog;
  },

  /** 활동 로그 삭제 */
  async remove(logId: string): Promise<void> {
    const { error } = await supabase
      .from('activity_logs')
      .delete()
      .eq('id', logId);
    if (error) throw error;
  },
};
