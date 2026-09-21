import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { GradebookServiceAPI } from '../services/gradebook.service.js';
import { StudentGradesDTO } from '../types/gradebook.js';
import { ApiError } from '../services/api.js';
import { PageLoading } from '../components/common/loading/index.js';

export const StudentGradesPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [grades, setGrades] = useState<StudentGradesDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);

  useEffect(() => {
    if (!courseId) return;

    let isMounted = true;
    setLoading(true);

    GradebookServiceAPI.getStudentGrades(courseId)
      .then((data) => {
        if (isMounted) {
          setGrades(data);
          setError(null);
          setStatusCode(null);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          if (err instanceof ApiError) {
            setError(err.message);
            setStatusCode(err.status);
          } else {
            setError('Error al cargar las calificaciones del curso');
            setStatusCode(500);
          }
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [courseId]);

  const getStatusBadge = (status: 'GRADED' | 'PENDING_GRADING' | 'NO_ATTEMPT') => {
    switch (status) {
      case 'GRADED':
        return <span className="badge" style={styles.badgeSuccess}>Calificado</span>;
      case 'PENDING_GRADING':
        return <span className="badge" style={styles.badgeWarning}>Pendiente de revisión</span>;
      case 'NO_ATTEMPT':
        return <span className="badge" style={styles.badgeMuted}>Sin realizar</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const getEnrollmentBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="badge" style={styles.badgeActive}>Inscrito (Activo)</span>;
      case 'COMPLETED':
        return <span className="badge" style={styles.badgeCompleted}>Curso Completado</span>;
      case 'DROPPED':
        return <span className="badge" style={styles.badgeDropped}>Baja</span>;
      case 'SUSPENDED':
        return <span className="badge" style={styles.badgeSuspended}>Suspendido</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  if (loading && !grades) {
    return <PageLoading title="Cargando tus calificaciones..." />;
  }

  if (error || !grades) {
    return (
      <div className="error-container" style={{ padding: '24px 0' }}>
        <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
          {statusCode === 403
            ? 'Acceso denegado: No estás inscrito en este curso.'
            : statusCode === 404
            ? 'Curso no encontrado.'
            : error || 'Ocurrió un error inesperado'}
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate(courseId ? `/app/courses/${courseId}` : '/app/courses')}
        >
          ← Volver al curso
        </button>
      </div>
    );
  }

  return (
    <div className="student-grades-page" id="student-grades-page" style={{ paddingBottom: '40px' }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <Link
          to={`/app/courses/${courseId}`}
          className="back-link"
          style={{ textDecoration: 'none', color: 'var(--color-primary)', fontWeight: 600, display: 'inline-block', marginBottom: '8px' }}
        >
          ← Volver a {grades.courseName}
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 className="page-title" style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>
              Mis Calificaciones
            </h1>
            <p className="page-description" style={{ margin: '4px 0 0 0', color: 'var(--color-muted)' }}>
              Reporte de calificaciones e historial de evaluaciones en {grades.courseName}
            </p>
          </div>
          <div>
            {getEnrollmentBadge(grades.enrollmentStatus)}
          </div>
        </div>
      </div>

      {/* Grade Summary Cards */}
      <div style={styles.metricsGrid}>
        <div style={styles.metricCardCurrent}>
          <div style={styles.metricLabelCurrent}>Calificación Acumulada (Current Grade)</div>
          <div style={styles.metricValueCurrent}>
            {grades.currentGrade !== null ? (
              <span>{grades.currentGrade.toFixed(2)} <span style={{ fontSize: '1.1rem', fontWeight: 500 }}>/ 100</span></span>
            ) : (
              <span style={{ fontSize: '1.25rem', color: 'var(--color-muted)' }}>Sin evaluaciones evaluadas</span>
            )}
          </div>
          <div style={{ fontSize: '0.775rem', color: '#15803d', marginTop: '6px' }}>
            Promedio normalizado sobre ponderación calificada hasta la fecha
          </div>
        </div>

        <div style={styles.metricCardFinal}>
          <div style={styles.metricLabelFinal}>Calificación Final del Curso (Final Grade)</div>
          <div style={styles.metricValueFinal}>
            {grades.finalGrade !== null ? (
              <span>{grades.finalGrade.toFixed(2)} <span style={{ fontSize: '1.1rem', fontWeight: 500 }}>/ 100</span></span>
            ) : (
              <span style={{ fontSize: '1.25rem', color: 'var(--color-muted)' }}>
                {grades.courseStatus === 'FINISHED' ? 'Sin Calificación Final' : 'En Curso'}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.775rem', color: '#1e40af', marginTop: '6px' }}>
            {grades.courseStatus === 'FINISHED'
              ? 'Calificación oficial registrada al finalizar el curso'
              : 'Se oficializará al finalizar el ciclo académico del curso'}
          </div>
        </div>
      </div>

      {/* Assessment Table */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
          Desglose por Evaluación
        </h2>
      </div>

      {grades.assessments.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={{ color: 'var(--color-muted)', margin: 0 }}>
            Este curso no cuenta con evaluaciones publicadas por el momento.
          </p>
        </div>
      ) : (
        <div className="table-responsive" style={styles.tableWrapper}>
          <table id="student-grades-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-background)', borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px' }}>Evaluación</th>
                <th style={{ padding: '12px 16px' }}>Tipo</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Ponderación</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Mejor Calificación</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Aporte al Curso</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Intentos</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {grades.assessments.map((a) => (
                <tr key={a.assessmentId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--color-text)' }}>
                    {a.title}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span className="badge" style={a.type === 'EXAM' ? styles.badgeExam : styles.badgeQuiz}>
                      {a.type === 'EXAM' ? 'Examen' : 'Quiz'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--color-primary)' }}>
                    {a.weight}%
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 700 }}>
                    {a.bestScore !== null ? (
                      <span style={a.bestScore >= 60 ? styles.scorePass : styles.scoreFail}>
                        {a.bestScore.toFixed(1)} / 100
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-muted)' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text)' }}>
                    {a.weightContribution !== null ? (
                      <span>{a.weightContribution.toFixed(2)} pts</span>
                    ) : (
                      <span style={{ color: 'var(--color-muted)' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center', color: 'var(--color-muted)' }}>
                    {a.attemptsUsed} / {a.maxAttempts !== null ? a.maxAttempts : '∞'}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    {getStatusBadge(a.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const styles = {
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
    marginBottom: '32px',
  },
  metricCardCurrent: {
    backgroundColor: '#f0fdf4',
    borderRadius: 'var(--radius-md)',
    border: '1px solid #bbf7d0',
    padding: '20px 24px',
    boxShadow: 'var(--shadow-sm)',
  },
  metricLabelCurrent: {
    fontSize: '0.875rem',
    fontWeight: 700,
    color: '#166534',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  metricValueCurrent: {
    fontSize: '2rem',
    fontWeight: 800,
    color: '#15803d',
    marginTop: '6px',
  },
  metricCardFinal: {
    backgroundColor: '#eff6ff',
    borderRadius: 'var(--radius-md)',
    border: '1px solid #bfdbfe',
    padding: '20px 24px',
    boxShadow: 'var(--shadow-sm)',
  },
  metricLabelFinal: {
    fontSize: '0.875rem',
    fontWeight: 700,
    color: '#1e40af',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  metricValueFinal: {
    fontSize: '2rem',
    fontWeight: 800,
    color: '#1d4ed8',
    marginTop: '6px',
  },
  tableWrapper: {
    overflowX: 'auto' as const,
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    boxShadow: 'var(--shadow-sm)',
  },
  emptyState: {
    padding: '48px 24px',
    textAlign: 'center' as const,
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
  },
  badgeSuccess: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    padding: '4px 10px',
    borderRadius: '9999px',
    fontSize: '0.775rem',
    fontWeight: 700,
  },
  badgeWarning: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: '4px 10px',
    borderRadius: '9999px',
    fontSize: '0.775rem',
    fontWeight: 700,
  },
  badgeMuted: {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
    padding: '4px 10px',
    borderRadius: '9999px',
    fontSize: '0.775rem',
    fontWeight: 600,
  },
  badgeActive: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    padding: '4px 10px',
    borderRadius: '9999px',
    fontSize: '0.775rem',
    fontWeight: 700,
  },
  badgeCompleted: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    padding: '4px 10px',
    borderRadius: '9999px',
    fontSize: '0.775rem',
    fontWeight: 700,
  },
  badgeDropped: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    padding: '4px 10px',
    borderRadius: '9999px',
    fontSize: '0.775rem',
    fontWeight: 700,
  },
  badgeSuspended: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: '4px 10px',
    borderRadius: '9999px',
    fontSize: '0.775rem',
    fontWeight: 700,
  },
  badgeQuiz: {
    backgroundColor: '#f3e8ff',
    color: '#6b21a8',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  badgeExam: {
    backgroundColor: '#ffedd5',
    color: '#9a3412',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  scorePass: {
    color: '#166534',
  },
  scoreFail: {
    color: '#dc2626',
  },
};
