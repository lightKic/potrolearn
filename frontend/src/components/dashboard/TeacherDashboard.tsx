import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CourseServiceAPI } from '../../services/course.service.js';
import { SubjectServiceAPI } from '../../services/subject.service.js';
import { Course, Subject } from '../../types/academic.js';
import { AuthUser } from '../../types/auth.js';
import { SectionLoading } from '../common/loading/index.js';

interface TeacherDashboardProps {
  user: AuthUser;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myCourses, setMyCourses] = useState<Course[]>([]);
  const [totalStudents, setTotalStudents] = useState<number>(0);

  // State para Mis Materias
  const [mySubjects, setMySubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);

  const fetchSubjects = useCallback(async () => {
    setSubjectsLoading(true);
    setSubjectsError(null);
    try {
      const data = await SubjectServiceAPI.getSubjects();
      setMySubjects(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar tus materias asignadas.';
      setSubjectsError(message);
    } finally {
      setSubjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadTeacherData = async () => {
      setLoading(true);
      setError(null);
      try {
        const coursesRes = await CourseServiceAPI.getCourses();
        if (!isMounted) return;

        setMyCourses(coursesRes);
        const sum = coursesRes.reduce((acc, c) => acc + (c._count?.enrollments || 0), 0);
        setTotalStudents(sum);
      } catch (err: unknown) {
        if (isMounted) {
          const message = err instanceof Error ? err.message : 'Error al cargar los cursos asignados.';
          setError(message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadTeacherData();
    fetchSubjects();

    return () => {
      isMounted = false;
    };
  }, [fetchSubjects]);

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
    <div className="db-container" id="teacher-dashboard">
      <div className="db-header-container">
        <h1 className="page-title" id="teacher-welcome-title">
          Hola, {user.name}
        </h1>
        <p className="page-description" id="teacher-welcome-desc">
          Resumen de tu actividad académica y materias autorizadas
        </p>
      </div>

      {error && (
        <div className="alert alert-danger" id="teacher-dashboard-error" role="alert">
          {error}
        </div>
      )}

      {/* KPI CARDS */}
      <div className="db-kpi-grid columns-2">
        {loading ? (
          <>
            <div className="db-kpi-card db-skeleton-card" />
            <div className="db-kpi-card db-skeleton-card" />
          </>
        ) : (
          <>
            <div className="db-kpi-card" id="kpi-teacher-courses">
              <div className="db-kpi-header">
                <span className="db-kpi-label">Mis cursos</span>
                <div className="db-kpi-icon-bubble primary">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
              </div>
              <div className="db-kpi-value">{myCourses.length}</div>
              <div className="db-kpi-context">Cursos asignados actualmente</div>
            </div>

            <div className="db-kpi-card" id="kpi-teacher-students">
              <div className="db-kpi-header">
                <span className="db-kpi-label">Alumnos inscritos</span>
                <div className="db-kpi-icon-bubble success">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <div className="db-kpi-value">{totalStudents}</div>
              <div className="db-kpi-context">Total de estudiantes en tus grupos</div>
            </div>
          </>
        )}
      </div>

      {/* SECCIÓN PRINCIPAL: MIS MATERIAS */}
      <div className="db-content-section" style={{ marginBottom: '24px' }} id="teacher-subjects-section">
        <div className="db-section-header" style={{ marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 className="db-section-title">Mis materias</h2>
            <p style={{ fontSize: '0.825rem', color: 'var(--color-muted)', margin: '2px 0 0 0' }}>
              Materias a las que estás autorizado como maestro
            </p>
          </div>
          {mySubjects.length > 0 && (
            <Link to="/app/courses" className="db-section-link">
              Crear curso →
            </Link>
          )}
        </div>

        {subjectsLoading ? (
          <SectionLoading title="Cargando materias..." minHeight="140px" />
        ) : subjectsError ? (
          <div className="alert alert-danger" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <span>{subjectsError}</span>
            <button
              type="button"
              className="btn-secondary-sm"
              onClick={fetchSubjects}
              style={{ width: 'auto' }}
            >
              Reintentar
            </button>
          </div>
        ) : mySubjects.length === 0 ? (
          <div className="db-empty-state-card" id="teacher-empty-subjects" style={{ padding: '24px 16px' }}>
            <h3 className="db-empty-title" style={{ fontSize: '1rem', marginBottom: '6px' }}>
              Sin materias asignadas
            </h3>
            <p className="db-empty-desc" style={{ fontSize: '0.85rem', margin: 0 }}>
              Actualmente no tienes materias autorizadas para crear cursos.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '16px',
            }}
          >
            {mySubjects.map((subject) => (
              <div
                key={subject.id}
                id={`teacher-subject-card-${subject.id}`}
                className="dashboard-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '16px',
                  borderRadius: 'var(--radius-md, 8px)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  margin: 0,
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '10px',
                    }}
                  >
                    <span className="role-pill teacher" style={{ fontSize: '0.775rem', fontWeight: 600 }}>
                      {subject.code}
                    </span>
                    <span
                      style={{
                        fontSize: '0.775rem',
                        fontWeight: 500,
                        color: subject.isActive ? 'var(--color-success, #10b981)' : 'var(--color-muted)',
                      }}
                    >
                      {subject.isActive ? '● Activa' : '○ Inactiva'}
                    </span>
                  </div>

                  <h3
                    style={{
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: 'var(--color-text)',
                      marginBottom: '6px',
                      lineHeight: 1.35,
                    }}
                  >
                    {subject.name}
                  </h3>

                  {subject.description && (
                    <p
                      style={{
                        fontSize: '0.825rem',
                        color: 'var(--color-muted)',
                        lineHeight: 1.4,
                        marginBottom: '14px',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {subject.description}
                    </p>
                  )}
                </div>

                <div style={{ paddingTop: '10px', borderTop: '1px solid var(--color-border)' }}>
                  <Link
                    to="/app/courses"
                    className="db-section-link"
                    style={{ fontSize: '0.825rem', fontWeight: 500 }}
                  >
                    Ver cursos →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DASHBOARD GRID: MIS CURSOS & ACCIONES RÁPIDAS */}
      <div className="db-main-grid">
        {/* MY COURSES SECTION */}
        <div className="db-content-section">
          <div className="db-section-header">
            <h2 className="db-section-title">Mis cursos</h2>
            <Link to="/app/courses" className="db-section-link">
              Gestionar todos →
            </Link>
          </div>

          {loading ? (
            <div className="db-course-cards-stack">
              <div className="db-skeleton-course-item" />
              <div className="db-skeleton-course-item" />
            </div>
          ) : myCourses.length === 0 ? (
            <div className="db-empty-state-card" id="teacher-empty-courses">
              <div className="db-empty-icon">📖</div>
              <h3 className="db-empty-title">Aún no tienes cursos asignados</h3>
              <p className="db-empty-desc">Consulta el catálogo de cursos o solicita la asignación a tu administrador.</p>
              <Link to="/app/courses" className="btn-primary-sm">
                Ver mis cursos
              </Link>
            </div>
          ) : (
            <div className="db-course-cards-stack">
              {myCourses.map((course) => (
                <div key={course.id} className="db-course-card" id={`teacher-course-card-${course.id}`}>
                  <div className="db-course-card-header">
                    <div>
                      <span className="db-course-subject-code">{course.subject?.code || course.subject?.name || 'MATERIA'}</span>
                      <h3 className="db-course-card-name">{course.name}</h3>
                    </div>
                    {getStatusBadge(course.status)}
                  </div>
                  <div className="db-course-card-meta">
                    <span className="meta-item">
                      Alumnos: <strong>{course._count?.enrollments || 0} inscritos</strong>
                    </span>
                    {course.startDate && (
                      <span className="meta-item">
                        Inicio: <strong>{new Date(course.startDate).toLocaleDateString()}</strong>
                      </span>
                    )}
                  </div>
                  <div className="db-course-card-footer">
                    <Link to={`/app/courses/${course.id}`} className="btn-secondary-sm">
                      Gestionar contenido
                    </Link>
                    <Link to={`/app/courses/${course.id}/gradebook`} className="btn-secondary-sm">
                      Libro de calificaciones
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
            <Link to="/app/courses" className="db-quick-action-item" id="teacher-action-new-course">
              <div className="db-action-icon primary">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div className="db-action-text">
                <span className="db-action-title">Crear curso</span>
                <span className="db-action-desc">Nueva oferta académica</span>
              </div>
            </Link>

            <Link to="/app/courses" className="db-quick-action-item" id="teacher-action-my-courses">
              <div className="db-action-icon info">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="db-action-text">
                <span className="db-action-title">Ver mis cursos</span>
                <span className="db-action-desc">Catálogo completo asignado</span>
              </div>
            </Link>

            <Link to="/app/students" className="db-quick-action-item" id="teacher-action-students">
              <div className="db-action-icon success">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div className="db-action-text">
                <span className="db-action-title">Gestión de alumnos</span>
                <span className="db-action-desc">Inscripciones e invitaciones</span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
