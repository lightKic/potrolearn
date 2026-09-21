import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.js';
import { ProtectedRoute } from '../auth/ProtectedRoute.js';
import { GuestRoute } from '../auth/GuestRoute.js';
import { RoleRoute } from '../auth/RoleRoute.js';
import { AppLayout } from '../layouts/AppLayout.js';

import { LoginPage } from '../pages/LoginPage.js';
import { ActivatePage } from '../pages/ActivatePage.js';
import { ResetAccessPage } from '../pages/ResetAccessPage.js';
import { ChangePasswordPage } from '../pages/ChangePasswordPage.js';
import { DashboardPage } from '../pages/DashboardPage.js';
import { SubjectsPage } from '../pages/SubjectsPage.js';
import { CoursesPage } from '../pages/CoursesPage.js';
import { CourseDetailPage } from '../pages/CourseDetailPage.js';
import { LessonDetailPage } from '../pages/LessonDetailPage.js';
import { AssessmentDetailPage } from '../pages/AssessmentDetailPage.js';
import { ExamTakePage } from '../pages/ExamTakePage.js';
import { StudentAttemptResultPage } from '../pages/StudentAttemptResultPage.js';
import { ForbiddenPage } from '../pages/ForbiddenPage.js';
import { NotFoundPage } from '../pages/NotFoundPage.js';
import { ProfilePage } from '../pages/ProfilePage.js';
import { AdminUsersPage } from '../pages/AdminUsersPage.js';
import { TeacherGradingListPage } from '../pages/TeacherGradingListPage.js';
import { TeacherAttemptReviewPage } from '../pages/TeacherAttemptReviewPage.js';
import { TeacherGradebookPage } from '../pages/TeacherGradebookPage.js';
import { StudentGradesPage } from '../pages/StudentGradesPage.js';
import { AssessmentPreviewPage } from '../pages/AssessmentPreviewPage.js';


import { TeacherStudentsPage } from '../pages/TeacherStudentsPage.js';
import { TeachersPage } from '../pages/TeachersPage.js';
import { ProgressPage } from '../pages/ProgressPage.js';

import { PageLoading } from '../components/common/loading/index.js';

const RootRedirect: React.FC = () => {
  const { user, status } = useAuth();

  if (status === 'loading') {
    return <PageLoading title="Restaurando tu sesión" description="Verificando tu acceso..." />;
  }

  if (status === 'authenticated') {
    if (user?.mustChangePassword) {
      return <Navigate to="/change-password" replace />;
    }
    return <Navigate to="/app" replace />;
  }

  return <Navigate to="/login" replace />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Ruta raíz */}
      <Route path="/" element={<RootRedirect />} />

      {/* Rutas de Invitados */}
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {/* Rutas públicas de activación y restablecimiento */}
      <Route path="/activate" element={<ActivatePage />} />
      <Route path="/reset-access" element={<ResetAccessPage />} />

      {/* Ruta protegida de cambio de contraseña */}
      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePasswordPage />
          </ProtectedRoute>
        }
      />

      {/* Rutas Autenticadas con AppLayout */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="profile" element={<ProfilePage />} />

        {/* Materias y Administración (Exclusivo ADMIN) */}
        <Route element={<RoleRoute allowedRoles={['ADMIN']} />}>
          <Route path="subjects" element={<SubjectsPage />} />
          <Route path="teachers" element={<TeachersPage />} />
          <Route path="admin/users" element={<AdminUsersPage />} />
        </Route>

        {/* Cursos y Evaluaciones (ADMIN, TEACHER, STUDENT) */}
        <Route element={<RoleRoute allowedRoles={['ADMIN', 'TEACHER', 'STUDENT']} />}>
          <Route path="courses" element={<CoursesPage />} />
          <Route path="courses/:courseId" element={<CourseDetailPage />} />
          <Route path="courses/:courseId/modules/:moduleId/lessons/:lessonId" element={<LessonDetailPage />} />
          <Route path="courses/:courseId/assessments/:assessmentId" element={<AssessmentDetailPage />} />
          <Route path="attempts/:attemptId/result" element={<StudentAttemptResultPage />} />
        </Route>

        {/* Examen / Reproductor de Intento (Exclusivo STUDENT) */}
        <Route element={<RoleRoute allowedRoles={['STUDENT']} />}>
          <Route path="attempts/:attemptId/take" element={<ExamTakePage />} />
        </Route>

        {/* Alumnos y Calificación de Evaluaciones (ADMIN, TEACHER) */}
        <Route element={<RoleRoute allowedRoles={['ADMIN', 'TEACHER']} />}>
          <Route path="students" element={<TeacherStudentsPage />} />
          <Route path="assessments/:assessmentId/grading" element={<TeacherGradingListPage />} />
          <Route path="courses/:courseId/assessments/:assessmentId/grading" element={<TeacherGradingListPage />} />
          <Route path="courses/:courseId/assessments/:assessmentId/preview" element={<AssessmentPreviewPage />} />
          <Route path="attempts/:attemptId/review" element={<TeacherAttemptReviewPage />} />
          <Route path="courses/:courseId/gradebook" element={<TeacherGradebookPage />} />
        </Route>

        {/* Progreso y Calificaciones del Estudiante (STUDENT) */}
        <Route element={<RoleRoute allowedRoles={['STUDENT']} />}>
          <Route path="progress" element={<ProgressPage />} />
          <Route path="courses/:courseId/my-grades" element={<StudentGradesPage />} />
        </Route>
      </Route>

      {/* Páginas de Error */}
      <Route path="/403" element={<ForbiddenPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
