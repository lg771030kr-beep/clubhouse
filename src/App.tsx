/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/auth/Login';
import { SignUp } from './pages/auth/SignUp';
import { FindAccount } from './pages/auth/FindAccount';
import { Dashboard } from './pages/Dashboard';
import { MemberManagement } from './pages/admin/MemberManagement';
import { Schedules } from './pages/admin/Schedules';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Profile } from './pages/user/Profile';
import { Portfolio } from './pages/user/Portfolio';
import { Settings } from './pages/admin/Settings';
import { AdminRecruitment } from './pages/admin/AdminRecruitment';
import { AdminProjects } from './pages/admin/AdminProjects';
import { AllProjects } from './pages/AllProjects';
import { AdminProjectDetail } from './pages/admin/AdminProjectDetail';
import { AttendanceDetail } from './pages/admin/AttendanceDetail';
import { AssignmentStatus } from './pages/admin/AssignmentStatus';
import { AdminArchive } from './pages/admin/AdminArchive';
import { AdminActivity } from './pages/admin/AdminActivity';
import { AdminFees } from './pages/admin/AdminFees';
import { Recruitment } from './pages/explore/Recruitment';
import { Projects } from './pages/explore/Projects';
import { ScheduleCalendarPage } from './pages/user/ScheduleCalendarPage';
import { ScheduleDetail } from './pages/user/ScheduleDetail';
import { ClubDetail } from './pages/user/ClubDetail';
import { ClubList } from './pages/user/ClubList';
import { UserProjects } from './pages/user/UserProjects';
import { UserRecruitments } from './pages/user/UserRecruitments';
import { ExploreActivities } from './pages/user/ExploreActivities';
import { ActivityDetail } from './pages/user/ActivityDetail';
import { CreatePersonalProject } from './pages/user/CreatePersonalProject';
import { ProjectDetail } from './pages/user/ProjectDetail';
import { Welcome } from './pages/Welcome';
import { CreateClub } from './pages/clubs/CreateClub';
import { CreateActivity } from './pages/activity/CreateActivity';
import { SuperAdmin } from './pages/superadmin/SuperAdmin';
import { OrgHome } from './pages/org/OrgHome';
import { OrgDashboard } from './pages/org/OrgDashboard';
import { OrgProgramCreate } from './pages/org/OrgProgramCreate';
import { OrgProgramDetail } from './pages/org/OrgProgramDetail';
import { OrgMembers } from './pages/org/OrgMembers';
import { OrgAnalytics } from './pages/org/OrgAnalytics';
import { OrgSettings } from './pages/org/OrgSettings';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/login"        element={<Login />} />
            <Route path="/signup"       element={<SignUp />} />
            <Route path="/find-account" element={<FindAccount />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            
            {/* MVP: Redirect legacy individual routes to unified dashboard */}
            <Route path="/user/dashboard" element={<Navigate to="/dashboard" replace />} />
            
            {/* Real Admin Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/admin" element={<Dashboard />} />
              <Route path="/admin/schedules" element={<Schedules />} />
              <Route path="/admin/members" element={<MemberManagement />} />
              <Route path="/admin/settings"     element={<Settings />}          />
              <Route path="/admin/recruitment"      element={<AdminRecruitment />}   />
              <Route path="/admin/projects"         element={<AdminProjects />}      />
              <Route path="/admin/projects/:projectId" element={<AdminProjectDetail />} />
              {/* 정식 경로 */}
              <Route path="/admin/attendance"  element={<AttendanceDetail />} />
              <Route path="/admin/assignments" element={<AssignmentStatus />} />
              <Route path="/admin/archive"     element={<AdminArchive />} />
              <Route path="/admin/activity"    element={<AdminActivity />} />
              <Route path="/admin/fees"        element={<AdminFees />} />
              {/* 레거시 경로 → 리다이렉트 */}
              <Route path="/admin/attendance-detail" element={<Navigate to="/admin/attendance"  replace />} />
              <Route path="/admin/assignment-status" element={<Navigate to="/admin/assignments" replace />} />
            </Route>
            
            <Route path="/profile" element={<Profile />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/schedule/calendar" element={<ScheduleCalendarPage />} />
            <Route path="/schedule/detail" element={<ScheduleDetail />} />

            {/* Explore Routes */}
            <Route path="/explore/recruitment" element={<Recruitment />} />
            <Route path="/explore/projects" element={<Projects />} />
            <Route path="/explore/activities" element={<ExploreActivities />} />
            <Route path="/explore/activities/:id" element={<ActivityDetail />} />

            {/* User Explore Routes */}
            <Route path="/user/clubs" element={<ClubList />} />
            <Route path="/user/projects" element={<UserProjects />} />
            <Route path="/user/recruitments" element={<UserRecruitments />} />

            {/* All Projects Browse */}
            <Route path="/projects" element={<AllProjects />} />

            {/* Detail Routes */}
            <Route path="/club/:clubId" element={<ClubDetail />} />
            <Route path="/project/:projectId" element={<ProjectDetail />} />

            {/* Onboarding */}
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/clubs/create" element={<CreateClub />} />

            {/* 개인 프로젝트 */}
            <Route path="/projects/create" element={<CreatePersonalProject />} />

            {/* 통합 활동 등록 */}
            <Route path="/activity/create" element={<CreateActivity />} />

            {/* 슈퍼어드민 */}
            <Route path="/super-admin" element={<SuperAdmin />} />

            {/* 기관/기업 (Org) */}
            <Route path="/org"                element={<OrgHome />} />
            <Route path="/org/programs"       element={<OrgDashboard />} />
            <Route path="/org/programs/new"   element={<OrgProgramCreate />} />
            <Route path="/org/programs/:id"   element={<OrgProgramDetail />} />
            <Route path="/org/members"        element={<OrgMembers />} />
            <Route path="/org/analytics"      element={<OrgAnalytics />} />
            <Route path="/org/settings"       element={<OrgSettings />} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}
