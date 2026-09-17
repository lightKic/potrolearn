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


const RootRedirect: React.FC = () => {
  const { user, status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="loading-screen" id="loading-screen">
        <div className="loading-content">
          <div className="loading-logo">PotroLearn</div>
          <div className="loading-spinner" />
          <p className="loading-text">Cargando...</p>
        </div>
      </div>
    );
  }

  if (status === 'authenticated') {
    if (user?.mustChangePassword) {
      return <Navigate to="/change-password" replace />;
    }
    return <Navigate to="/app" replace />;
  }

  return <Navigate to="/login" replace />;
};

const AdminTeachersPlaceholder: React.FC = () => (
  <div>
    <h1 className="page-title">Gestión de Maestros</h1>
    <p className="page-description">Módulo de administración para registro y asignación de docentes.</p>
    <div className="alert alert-success">Sección activa para el rol de Administrador.</div>
  </div>
);

const TeacherStudentsPlaceholder: React.FC = () => (
  <div>
    <h1 className="page-title">Alumnos Inscritos</h1>
    <p className="page-description">Gestión e inscripción de alumnos asignados a tus cursos.</p>
    <div className="alert alert-success">Sección activa para el rol de Maestro.</div>
  </div>
);

const StudentProgressPlaceholder: React.FC = () => (
  <div>
    <h1 className="page-title">Mi Progreso Académico</h1>
    <p className="page-description">Seguimiento detallado de tu avance en los contenidos y evaluaciones.</p>
    <div className="alert alert-success">Sección activa para el rol de Alumno.</div>
  </div>
);

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
          <Route path="teachers" element={<AdminTeachersPlaceholder />} />
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
          <Route path="students" element={<TeacherStudentsPlaceholder />} />
          <Route path="assessments/:assessmentId/grading" element={<TeacherGradingListPage />} />
          <Route path="courses/:courseId/assessments/:assessmentId/grading" element={<TeacherGradingListPage />} />
          <Route path="attempts/:attemptId/review" element={<TeacherAttemptReviewPage />} />
          <Route path="courses/:courseId/gradebook" element={<TeacherGradebookPage />} />
        </Route>

        {/* Progreso y Calificaciones del Estudiante (STUDENT) */}
        <Route element={<RoleRoute allowedRoles={['STUDENT']} />}>
          <Route path="progress" element={<StudentProgressPlaceholder />} />
          <Route path="courses/:courseId/my-grades" element={<StudentGradesPage />} />
        </Route>
      </Route>

      {/* Páginas de Error */}
      <Route path="/403" element={<ForbiddenPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
