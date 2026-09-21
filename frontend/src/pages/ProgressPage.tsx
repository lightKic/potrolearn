import React, { useEffect, useState, useCallback } from 'react';
import { CourseServiceAPI } from '../services/course.service.js';
import { GradebookServiceAPI } from '../services/gradebook.service.js';
import { Course, CourseContent } from '../types/academic.js';
import { StudentGradesDTO, StudentAssessmentDetailGrade } from '../types/gradebook.js';
import { ApiError } from '../services/api.js';

import { PageLoading, SectionLoading } from '../components/common/loading/index.js';

interface CourseDetailState {
  loading: boolean;
  error: string | null;
  content?: CourseContent;
  grades?: StudentGradesDTO;
}

export const ProgressPage: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState<boolean>(true);
  const [errorCourses, setErrorCourses] = useState<string | null>(null);

  // Acordeón de cursos expandidos
  const [expandedCourseIds, setExpandedCourseIds] = useState<Record<string, boolean>>({});

  // Caché y estado por cada curso
  const [courseDetails, setCourseDetails] = useState<Record<string, CourseDetailState>>({});

  const loadCourses = useCallback(() => {
    setLoadingCourses(true);
    setErrorCourses(null);

    CourseServiceAPI.getCourses()
      .then((data) => {
        setCourses(data);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError) {
          setErrorCourses(err.message);
        } else {
          setErrorCourses('No se pudieron cargar tus cursos. Inténtalo nuevamente.');
        }
      })
      .finally(() => {
        setLoadingCourses(false);
      });
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  // Carga perezosa de contenido + calificaciones para un curso específico
  const loadCourseDetail = useCallback((courseId: string, force = false) => {
    const existing = courseDetails[courseId];
    if (!force && existing && (existing.content || existing.loading)) {
      return; // Ya está cargado o cargando
    }

    setCourseDetails((prev) => ({
      ...prev,
      [courseId]: { loading: true, error: null },
    }));

    Promise.all([
      CourseServiceAPI.getCourseContent(courseId),
      GradebookServiceAPI.getStudentGrades(courseId),
    ])
      .then(([content, grades]) => {
        setCourseDetails((prev) => ({
          ...prev,
          [courseId]: {
            loading: false,
            error: null,
            content,
            grades,
          },
        }));
      })
      .catch((err: unknown) => {
        const errorMsg = err instanceof ApiError ? err.message : 'Error al obtener el detalle del curso.';
        setCourseDetails((prev) => ({
          ...prev,
          [courseId]: {
            loading: false,
            error: errorMsg,
          },
        }));
      });
  }, [courseDetails]);

  // Manejador del acordeón
  const toggleCourseExpand = (courseId: string) => {
    const isCurrentlyExpanded = !!expandedCourseIds[courseId];
    const newExpandedState = !isCurrentlyExpanded;

    setExpandedCourseIds((prev) => ({
      ...prev,
      [courseId]: newExpandedState,
    }));

    if (newExpandedState) {
      loadCourseDetail(courseId);
    }
  };

  const getEnrollmentBadge = (status?: string) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="progress-badge badge-active">Inscrito (Activo)</span>;
      case 'COMPLETED':
        return <span className="progress-badge badge-completed">Completado</span>;
      case 'DROPPED':
        return <span className="progress-badge badge-dropped">Baja</span>;
      default:
        return <span className="progress-badge badge-active">Activo</span>;
    }
  };

  const getAssessmentStatusBadge = (status: StudentAssessmentDetailGrade['status']) => {
    switch (status) {
      case 'GRADED':
        return <span className="progress-badge badge-graded">Calificado</span>;
      case 'PENDING_GRADING':
        return <span className="progress-badge badge-pending">Pendiente de revisión</span>;
      case 'NO_ATTEMPT':
        return <span className="progress-badge badge-no-attempt">Sin intento</span>;
      default:
        return <span className="progress-badge">{status}</span>;
    }
  };

  if (loadingCourses) {
    return <PageLoading title="Cargando tu progreso académico..." />;
  }

  if (errorCourses) {
    return (
      <div className="progress-page progress-error-container" id="progress-error">
        <h1 className="page-title">Mi Progreso Académico</h1>
        <div className="alert alert-danger" style={{ marginTop: '16px', marginBottom: '16px' }}>
          {errorCourses}
        </div>
        <button type="button" className="btn-primary" style={{ width: 'auto' }} onClick={loadCourses}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="progress-page" id="progress-page">
      {/* Encabezado */}
      <div className="progress-header">
        <div>
          <h1 className="page-title">Mi Progreso Académico</h1>
          <p className="page-description">
            Consulta el avance en los contenidos y el detalle de calificaciones en cada uno de tus cursos.
          </p>
        </div>
      </div>

      {/* Tarjeta de Resumen Superior */}
      <div className="progress-summary-card">
        <div className="progress-summary-item">
          <div className="progress-summary-label">Cursos Inscritos</div>
          <div className="progress-summary-value">{courses.length}</div>
          <div className="progress-summary-sub">Asignaturas registradas en tu historial</div>
        </div>
        <div className="progress-summary-divider" />
        <div className="progress-summary-item">
          <div className="progress-summary-label">Cursos Activos</div>
          <div className="progress-summary-value">
            {courses.filter((c) => c.status === 'ACTIVE').length}
          </div>
          <div className="progress-summary-sub">En periodo académico actual</div>
        </div>
      </div>

      {/* Lista de Cursos */}
      <div className="progress-courses-container">
        <h2 className="progress-section-title">Mis Cursos</h2>

        {courses.length === 0 ? (
          <div className="progress-empty-state">
            <div className="progress-empty-icon">📘</div>
            <h3 className="progress-empty-title">Sin cursos inscritos</h3>
            <p className="progress-empty-desc">
              Actualmente no tienes cursos inscritos. Cuando seas matriculado en un curso, tu progreso y calificaciones aparecerán aquí.
            </p>
          </div>
        ) : (
          <div className="progress-courses-list">
            {courses.map((course) => {
              const isExpanded = !!expandedCourseIds[course.id];
              const detail = courseDetails[course.id];
              const teacherName = course.courseTeachers?.[0]?.teacher?.name || 'Maestro no asignado';

              return (
                <div key={course.id} className={`progress-course-card ${isExpanded ? 'expanded' : ''}`}>
                  {/* Encabezado del Curso (Click para expandir) */}
                  <div
                    className="progress-course-header"
                    onClick={() => toggleCourseExpand(course.id)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    aria-controls={`course-detail-${course.id}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleCourseExpand(course.id);
                      }
                    }}
                  >
                    <div className="progress-course-info">
                      <div className="progress-course-tags">
                        {course.subject?.code && (
                          <span className="progress-subject-code">{course.subject.code}</span>
                        )}
                        {getEnrollmentBadge(course.status === 'ACTIVE' ? 'ACTIVE' : course.status)}
                      </div>
                      <h3 className="progress-course-title">{course.name}</h3>
                      <p className="progress-course-meta">
                        <span>Profesor: <strong>{teacherName}</strong></span>
                        {course.subject?.name && <span> • Materia: <strong>{course.subject.name}</strong></span>}
                      </p>
                    </div>

                    <div className="progress-course-header-actions">
                      {detail?.grades && detail.grades.currentGrade !== null && (
                        <div className="progress-course-quick-grade">
                          <span className="quick-grade-label">Calificación Actual</span>
                          <span className="quick-grade-value">{detail.grades.currentGrade.toFixed(1)}</span>
                        </div>
                      )}

                      {detail?.content?.progress && (
                        <div className="progress-course-quick-progress">
                          <span className="quick-progress-label">Temario</span>
                          <span className="quick-progress-value">{detail.content.progress.percentage}%</span>
                        </div>
                      )}

                      <button
                        type="button"
                        className="progress-toggle-btn"
                        aria-label={isExpanded ? 'Contraer curso' : 'Expandir curso'}
                      >
                        <svg
                          className={`progress-chevron ${isExpanded ? 'open' : ''}`}
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Cuerpo del Curso Expandido */}
                  {isExpanded && (
                    <div className="progress-course-body" id={`course-detail-${course.id}`}>
                      {detail?.loading && (
                        <SectionLoading title="Cargando avance y evaluaciones..." minHeight="120px" size="small" />
                      )}

                      {detail?.error && (
                        <div className="progress-course-error alert alert-danger">
                          <span>{detail.error}</span>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ marginLeft: '12px', padding: '4px 10px', fontSize: '0.8rem' }}
                            onClick={() => loadCourseDetail(course.id, true)}
                          >
                            Reintentar
                          </button>
                        </div>
                      )}

                      {!detail?.loading && !detail?.error && detail?.content && detail?.grades && (
                        <div className="progress-course-details-grid">
                          {/* Sección 1: Progreso de Contenido / Temario */}
                          <div className="progress-section-block">
                            <h4 className="progress-block-title">Avance de Temario</h4>
                            
                            {detail.content.progress ? (
                              <div className="progress-bar-wrapper">
                                <div className="progress-bar-header">
                                  <span className="progress-bar-label">
                                    {detail.content.progress.completedLessons} de {detail.content.progress.totalLessons} lecciones completadas
                                  </span>
                                  <span className="progress-bar-percentage">
                                    {detail.content.progress.percentage}%
                                  </span>
                                </div>
                                <div className="progress-track">
                                  <div
                                    className="progress-fill"
                                    style={{ width: `${Math.min(100, Math.max(0, detail.content.progress.percentage))}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <p className="progress-text-muted">Sin información de avance disponible.</p>
                            )}

                            {/* Desglose de Módulos y Lecciones */}
                            <div className="progress-modules-list">
                              {detail.content.modules.length === 0 ? (
                                <p className="progress-text-muted">No hay módulos publicados en este curso.</p>
                              ) : (
                                detail.content.modules
                                  .filter((m) => m.isPublished)
                                  .map((module) => (
                                    <div key={module.id} className="progress-module-item">
                                      <div className="progress-module-title">{module.title}</div>
                                      <div className="progress-lessons-list">
                                        {module.lessons && module.lessons.length > 0 ? (
                                          module.lessons
                                            .filter((l) => l.isPublished)
                                            .map((lesson) => (
                                              <div key={lesson.id} className="progress-lesson-item">
                                                <span
                                                  className={`progress-lesson-icon ${
                                                    lesson.completed ? 'completed' : 'pending'
                                                  }`}
                                                >
                                                  {lesson.completed ? '✓' : '○'}
                                                </span>
                                                <span className="progress-lesson-name">{lesson.title}</span>
                                              </div>
                                            ))
                                        ) : (
                                          <div className="progress-text-muted" style={{ paddingLeft: '24px', fontSize: '0.8rem' }}>
                                            Sin lecciones en este módulo
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))
                              )}
                            </div>
                          </div>

                          {/* Sección 2: Desglose de Evaluaciones */}
                          <div className="progress-section-block">
                            <h4 className="progress-block-title">Evaluaciones del Curso</h4>

                            {detail.grades.assessments.length === 0 ? (
                              <p className="progress-text-muted">No hay evaluaciones publicadas para este curso.</p>
                            ) : (
                              <div className="table-responsive">
                                <table className="progress-assessments-table">
                                  <thead>
                                    <tr>
                                      <th>Evaluación</th>
                                      <th>Tipo</th>
                                      <th style={{ textAlign: 'center' }}>Peso</th>
                                      <th style={{ textAlign: 'center' }}>Calificación</th>
                                      <th style={{ textAlign: 'center' }}>Aporte</th>
                                      <th style={{ textAlign: 'center' }}>Intentos</th>
                                      <th style={{ textAlign: 'right' }}>Estado</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detail.grades.assessments.map((a) => (
                                      <tr key={a.assessmentId}>
                                        <td className="font-semibold">{a.title}</td>
                                        <td>
                                          <span className={`progress-badge badge-type-${a.type.toLowerCase()}`}>
                                            {a.type === 'EXAM' ? 'Examen' : 'Quiz'}
                                          </span>
                                        </td>
                                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{a.weight}%</td>
                                        <td style={{ textAlign: 'center', fontWeight: 700 }}>
                                          {a.bestScore !== null ? (
                                            <span className={a.bestScore >= 60 ? 'score-pass' : 'score-fail'}>
                                              {a.bestScore.toFixed(1)} / 100
                                            </span>
                                          ) : (
                                            <span className="progress-text-muted">—</span>
                                          )}
                                        </td>
                                        <td style={{ textAlign: 'center', fontWeight: 600 }}>
                                          {a.weightContribution !== null ? (
                                            `${a.weightContribution.toFixed(2)} pts`
                                          ) : (
                                            <span className="progress-text-muted">—</span>
                                          )}
                                        </td>
                                        <td style={{ textAlign: 'center', color: 'var(--color-muted)' }}>
                                          {a.attemptsUsed} / {a.maxAttempts !== null ? a.maxAttempts : '∞'}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>{getAssessmentStatusBadge(a.status)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {/* Resumen de Calificaciones por Curso */}
                            <div className="progress-course-grades-summary">
                              <div className="progress-grade-box current">
                                <span className="grade-box-label">Calificación Actual</span>
                                <span className="grade-box-value">
                                  {detail.grades.currentGrade !== null
                                    ? detail.grades.currentGrade.toFixed(2)
                                    : 'Sin evaluar'}
                                </span>
                              </div>
                              {detail.grades.finalGrade !== null && (
                                <div className="progress-grade-box final">
                                  <span className="grade-box-label">Calificación Final</span>
                                  <span className="grade-box-value">{detail.grades.finalGrade.toFixed(2)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
