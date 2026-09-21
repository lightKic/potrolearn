import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SubjectServiceAPI } from '../../services/subject.service.js';
import { CourseServiceAPI } from '../../services/course.service.js';
import { AdminService } from '../../services/admin.service.js';
import { Course } from '../../types/academic.js';
import { AuthUser } from '../../types/auth.js';

interface AdminDashboardProps {
  user: AuthUser;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [subjectsCount, setSubjectsCount] = useState<number>(0);
  const [coursesCount, setCoursesCount] = useState<number>(0);
  const [teachersCount, setTeachersCount] = useState<number>(0);
  const [studentsCount, setStudentsCount] = useState<number>(0);
  const [recentCourses, setRecentCourses] = useState<Course[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadAdminData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [subjectsRes, coursesRes, usersRes] = await Promise.all([
          SubjectServiceAPI.getSubjects(),
          CourseServiceAPI.getCourses(),
          AdminService.getUsers(),
        ]);

        if (!isMounted) return;

        setSubjectsCount(subjectsRes.length);
        setCoursesCount(coursesRes.length);

        const teachers = usersRes.filter((u) => u.role === 'TEACHER');
        const students = usersRes.filter((u) => u.role === 'STUDENT');
        setTeachersCount(teachers.length);
        setStudentsCount(students.length);

        setRecentCourses(coursesRes.slice(0, 6));
      } catch (err: unknown) {
        if (isMounted) {
          const message = err instanceof Error ? err.message : 'Error al cargar los datos de administración.';
          setError(message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadAdminData();

    return () => {
      isMounted = false;
    };
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="db-status-badge db-status-active">Activo</span>;
      case 'DRAFT':
        return <span className="db-status-badge db-status-draft">Borrador</span>;
      case 'FINISHED':
        return <span className="db-status-badge db-status-finished">Finalizado</span>;
      case 'ARCHIVED':
        return <span className="db-status-badge db-status-archived">Archivado</span>;
      default:
        return <span className="db-status-badge">{status}</span>;
    }
  };

  return (
    <div className="db-container" id="admin-dashboard">
      <div className="db-header-container">
        <h1 className="page-title" id="admin-welcome-title">
          Hola, {user.name}
        </h1>
        <p className="page-description" id="admin-welcome-desc">
          Resumen general de PotroLearn
        </p>
      </div>

      {error && (
        <div className="alert alert-danger" id="admin-dashboard-error" role="alert">
          {error}
        </div>
      )}

      {/* KPI CARDS */}
      <div className="db-kpi-grid">
        {loading ? (
          <>
            <div className="db-kpi-card db-skeleton-card" />
            <div className="db-kpi-card db-skeleton-card" />
            <div className="db-kpi-card db-skeleton-card" />
            <div className="db-kpi-card db-skeleton-card" />
          </>
        ) : (
          <>
            <div className="db-kpi-card" id="kpi-subjects">
              <div className="db-kpi-header">
                <span className="db-kpi-label">Materias registradas</span>
                <div className="db-kpi-icon-bubble primary">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
              </div>
              <div className="db-kpi-value">{subjectsCount}</div>
              <div className="db-kpi-context">Materias en el catálogo</div>
            </div>

            <div className="db-kpi-card" id="kpi-courses">
              <div className="db-kpi-header">
                <span className="db-kpi-label">Cursos registrados</span>
                <div className="db-kpi-icon-bubble accent">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
              </div>
              <div className="db-kpi-value">{coursesCount}</div>
              <div className="db-kpi-context">Cursos creados en la plataforma</div>
            </div>

            <div className="db-kpi-card" id="kpi-teachers">
              <div className="db-kpi-header">
                <span className="db-kpi-label">Maestros registrados</span>
                <div className="db-kpi-icon-bubble info">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
              <div className="db-kpi-value">{teachersCount}</div>
              <div className="db-kpi-context">Docentes con cuenta de usuario</div>
            </div>

            <div className="db-kpi-card" id="kpi-students">
              <div className="db-kpi-header">
                <span className="db-kpi-label">Alumnos registrados</span>
                <div className="db-kpi-icon-bubble success">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 01-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                  </svg>
                </div>
              </div>
              <div className="db-kpi-value">{studentsCount}</div>
              <div className="db-kpi-context">Estudiantes con cuenta de usuario</div>
            </div>
          </>
        )}
      </div>

      {/* DASHBOARD SECTIONS */}
      <div className="db-main-grid">
        {/* RECENT COURSES SECTION */}
        <div className="db-content-section">
          <div className="db-section-header">
            <h2 className="db-section-title">Cursos recientes</h2>
            <Link to="/app/courses" className="db-section-link">
              Ver todos los cursos →
            </Link>
          </div>

          {loading ? (
            <div className="db-course-cards-stack">
              <div className="db-skeleton-course-item" />
              <div className="db-skeleton-course-item" />
              <div className="db-skeleton-course-item" />
            </div>
          ) : recentCourses.length === 0 ? (
            <div className="db-empty-state-card" id="admin-empty-courses">
              <div className="db-empty-icon">📚</div>
              <h3 className="db-empty-title">Aún no hay cursos registrados</h3>
              <p className="db-empty-desc">Crea el primer curso del sistema para comenzar la oferta académica.</p>
              <Link to="/app/courses" className="btn-primary-sm">
                Crear curso
              </Link>
            </div>
          ) : (
            <div className="db-course-cards-stack">
              {recentCourses.map((course) => (
                <div key={course.id} className="db-course-card" id={`course-card-${course.id}`}>
                  <div className="db-course-card-header">
                    <div>
                      <span className="db-course-subject-code">{course.subject?.code || 'MATERIA'}</span>
                      <h3 className="db-course-card-name">{course.name}</h3>
                    </div>
                    {getStatusBadge(course.status)}
                  </div>
                  <div className="db-course-card-meta">
                    <span className="meta-item">
                      Profesor/Creador: <strong>{course.createdBy?.name || 'Administrador'}</strong>
                    </span>
                    <span className="meta-item">
                      Inscritos: <strong>{course._count?.enrollments || 0} alumnos</strong>
                    </span>
                  </div>
                  <div className="db-course-card-footer">
                    <Link to={`/app/courses/${course.id}`} className="btn-secondary-sm">
                      Ver detalle
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
            <Link to="/app/subjects" className="db-quick-action-item" id="action-new-subject">
              <div className="db-action-icon primary">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div className="db-action-text">
                <span className="db-action-title">Nueva materia</span>
                <span className="db-action-desc">Registrar materia en catálogo</span>
              </div>
            </Link>

            <Link to="/app/courses" className="db-quick-action-item" id="action-new-course">
              <div className="db-action-icon accent">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div className="db-action-text">
                <span className="db-action-title">Nuevo curso</span>
                <span className="db-action-desc">Crear oferta académica</span>
              </div>
            </Link>

            <Link to="/app/admin/users" className="db-quick-action-item" id="action-manage-users">
              <div className="db-action-icon info">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div className="db-action-text">
                <span className="db-action-title">Gestionar usuarios</span>
                <span className="db-action-desc">Alta de docentes y alumnos</span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
