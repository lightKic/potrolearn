import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CourseServiceAPI } from '../../services/course.service.js';
import { Course } from '../../types/academic.js';
import { AuthUser } from '../../types/auth.js';

interface StudentDashboardProps {
  user: AuthUser;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myCourses, setMyCourses] = useState<Course[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadStudentData = async () => {
      setLoading(true);
      setError(null);
      try {
        const coursesRes = await CourseServiceAPI.getCourses();
        if (!isMounted) return;

        setMyCourses(coursesRes);
      } catch (err: unknown) {
        if (isMounted) {
          const message = err instanceof Error ? err.message : 'Error al cargar los cursos en los que estás inscrito.';
          setError(message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadStudentData();

    return () => {
      isMounted = false;
    };
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="db-status-badge db-status-active">En curso</span>;
      case 'FINISHED':
        return <span className="db-status-badge db-status-finished">Finalizado</span>;
      default:
        return <span className="db-status-badge">{status}</span>;
    }
  };

  return (
    <div className="db-container" id="student-dashboard">
      <div className="db-header-container">
        <h1 className="page-title" id="student-welcome-title">
          Hola, {user.name}
        </h1>
        <p className="page-description" id="student-welcome-desc">
          Continúa con tu aprendizaje
        </p>
      </div>

      {error && (
        <div className="alert alert-danger" id="student-dashboard-error" role="alert">
          {error}
        </div>
      )}

      {/* KPI CARD */}
      <div className="db-kpi-grid single">
        {loading ? (
          <div className="db-kpi-card db-skeleton-card" />
        ) : (
          <div className="db-kpi-card" id="kpi-student-courses">
            <div className="db-kpi-header">
              <span className="db-kpi-label">Mis cursos</span>
              <div className="db-kpi-icon-bubble primary">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            </div>
            <div className="db-kpi-value">{myCourses.length}</div>
            <div className="db-kpi-context">Cursos en los que te encuentras inscrito</div>
          </div>
        )}
      </div>

      {/* DASHBOARD SECTIONS */}
      <div className="db-main-grid">
        {/* CONTINUAR APRENDIENDO SECTION */}
        <div className="db-content-section">
          <div className="db-section-header">
            <h2 className="db-section-title">Continuar aprendiendo</h2>
            <Link to="/app/courses" className="db-section-link">
              Ver todos mis cursos →
            </Link>
          </div>

          {loading ? (
            <div className="db-course-cards-stack">
              <div className="db-skeleton-course-item" />
              <div className="db-skeleton-course-item" />
            </div>
          ) : myCourses.length === 0 ? (
            <div className="db-empty-state-card" id="student-empty-courses">
              <div className="db-empty-icon">🎓</div>
              <h3 className="db-empty-title">Aún no estás inscrito en ningún curso</h3>
              <p className="db-empty-desc">Revisa la lista de cursos ofertados para solicitar tu inscripción.</p>
              <Link to="/app/courses" className="btn-primary-sm">
                Ver mis cursos
              </Link>
            </div>
          ) : (
            <div className="db-course-cards-stack">
              {myCourses.map((course) => (
                <div key={course.id} className="db-course-card" id={`student-course-card-${course.id}`}>
                  <div className="db-course-card-header">
                    <div>
                      <span className="db-course-subject-code">{course.subject?.code || course.subject?.name || 'MATERIA'}</span>
                      <h3 className="db-course-card-name">{course.name}</h3>
                    </div>
                    {getStatusBadge(course.status)}
                  </div>
                  {course.description && <p className="db-course-card-desc">{course.description}</p>}
                  <div className="db-course-card-footer">
                    <Link to={`/app/courses/${course.id}`} className="btn-primary-sm">
                      Entrar al curso
                    </Link>
                    <Link to={`/app/courses/${course.id}/my-grades`} className="btn-secondary-sm">
                      Mis calificaciones
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* QUICK ACTIONS SIDEBAR */}
        <div className="db-sidebar-section">
          <h2 className="db-section-title">Acciones rápidas</h2>
          <div className="db-quick-actions-card">
            <Link to="/app/courses" className="db-quick-action-item" id="student-action-courses">
              <div className="db-action-icon primary">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div className="db-action-text">
                <span className="db-action-title">Ver mis cursos</span>
                <span className="db-action-desc">Acceder al contenido académico</span>
              </div>
            </Link>

            <Link to="/app/progress" className="db-quick-action-item" id="student-action-progress">
              <div className="db-action-icon info">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 012-2h2a2 2 0 012 2v6a2 2 0 01-2 2h-2a2 2 0 01-2-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="db-action-text">
                <span className="db-action-title">Mi progreso</span>
                <span className="db-action-desc">Estadísticas y calificaciones</span>
              </div>
            </Link>

            <Link to="/app/profile" className="db-quick-action-item" id="student-action-profile">
              <div className="db-action-icon accent">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="db-action-text">
                <span className="db-action-title">Mi perfil</span>
                <span className="db-action-desc">Datos de cuenta y acceso</span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
