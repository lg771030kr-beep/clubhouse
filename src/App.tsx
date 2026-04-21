/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/auth/Login';
import { SignUp } from './pages/auth/SignUp';
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
import { Recruitment } from './pages/explore/Recruitment';
import { Projects } from './pages/explore/Projects';
import { ScheduleCalendarPage } from './pages/user/ScheduleCalendarPage';
import { ScheduleDetail } from './pages/user/ScheduleDetail';
import { ClubDetail } from './pages/user/ClubDetail';
import { ClubList } from './pages/user/ClubList';
import { UserProjects } from './pages/user/UserProjects';
import { UserRecruitments } from './pages/user/UserRecruitments';
import { ProjectDetail } from './pages/user/ProjectDetail';
import { Welcome } from './pages/Welcome';
import { CreateClub } from './pages/clubs/CreateClub';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/login"  element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
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
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}
