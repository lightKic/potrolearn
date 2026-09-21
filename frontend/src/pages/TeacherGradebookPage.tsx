import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { GradebookServiceAPI } from '../services/gradebook.service.js';
import { TeacherGradebookDTO } from '../types/gradebook.js';
import { ApiError } from '../services/api.js';
import { PageLoading } from '../components/common/loading/index.js';

export const TeacherGradebookPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [gradebook, setGradebook] = useState<TeacherGradebookDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);

  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    if (!courseId) return;

    let isMounted = true;
    setLoading(true);

    GradebookServiceAPI.getTeacherGradebook(courseId, { status: statusFilter, search })
      .then((data) => {
        if (isMounted) {
          setGradebook(data);
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
            setError('Error al cargar el libro de calificaciones del curso');
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
  }, [courseId, statusFilter, search]);

  const getEnrollmentBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="badge" style={styles.badgeActive}>Activo</span>;
      case 'COMPLETED':
        return <span className="badge" style={styles.badgeCompleted}>Completado</span>;
      case 'DROPPED':
        return <span className="badge" style={styles.badgeDropped}>Baja</span>;
      case 'SUSPENDED':
        return <span className="badge" style={styles.badgeSuspended}>Suspendido</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const getCourseStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="badge" style={styles.badgeActive}>En Curso</span>;
      case 'FINISHED':
        return <span className="badge" style={styles.badgeCompleted}>Finalizado</span>;
      case 'DRAFT':
        return <span className="badge" style={styles.badgeDraft}>Borrador</span>;
      case 'ARCHIVED':
        return <span className="badge" style={styles.badgeArchived}>Archivado</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  if (loading && !gradebook) {
    return <PageLoading title="Cargando libro de calificaciones..." />;
  }

  if (error || !gradebook) {
    return (
      <div className="error-container" style={{ padding: '24px 0' }}>
        <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
          {statusCode === 403
            ? 'Acceso denegado: No tienes permisos para ver el Gradebook de este curso.'
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
    <div className="teacher-gradebook-page" id="teacher-gradebook-page" style={{ paddingBottom: '40px' }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <Link
          to={`/app/courses/${courseId}`}
          className="back-link"
          style={{ textDecoration: 'none', color: 'var(--color-primary)', fontWeight: 600, display: 'inline-block', marginBottom: '8px' }}
        >
          ← Volver a {gradebook.courseName}
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 className="page-title" style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>
              Libro de Calificaciones (Gradebook)
            </h1>
            <p className="page-description" style={{ margin: '4px 0 0 0', color: 'var(--color-muted)' }}>
              {gradebook.courseName} • Ponderación Total Publicada: <strong>{gradebook.totalEvaluatedWeight}% / 100%</strong>
            </p>
          </div>
          <div>
            {getCourseStatusBadge(gradebook.courseStatus)}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={styles.metricsGrid}>
        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>Ponderación Evaluada</div>
          <div style={styles.metricValue}>
            {gradebook.totalEvaluatedWeight}%
            <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--color-muted)', marginLeft: '4px' }}>
              / 100%
            </span>
          </div>
          <div style={{ fontSize: '0.775rem', color: 'var(--color-muted)', marginTop: '4px' }}>
            {gradebook.assessments.length} evaluacion(es) publicada(s)
          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>Estudiantes Inscritos</div>
          <div style={styles.metricValue}>{gradebook.students.length}</div>
          <div style={{ fontSize: '0.775rem', color: 'var(--color-muted)', marginTop: '4px' }}>
            {gradebook.students.filter((s) => s.enrollmentStatus === 'ACTIVE').length} activos
          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>Estado del Curso</div>
          <div style={{ marginTop: '8px' }}>
            {getCourseStatusBadge(gradebook.courseStatus)}
          </div>
          <div style={{ fontSize: '0.775rem', color: 'var(--color-muted)', marginTop: '8px' }}>
            {gradebook.courseStatus === 'FINISHED' ? 'Calificaciones finales consolidadas' : 'Calculando Current Grade en vivo'}
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div style={styles.filterSection}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', width: '100%' }}>
          <div style={{ flex: '1 1 250px' }}>
            <input
              id="search-input"
              type="text"
              placeholder="Buscar por estudiante o matrícula..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-control"
              style={styles.searchInput}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label htmlFor="status-filter" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-muted)' }}>
              Estado Inscripción:
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-control"
              style={styles.selectInput}
            >
              <option value="ALL">Todos los Estados</option>
              <option value="ACTIVE">Activo</option>
              <option value="COMPLETED">Completado</option>
              <option value="DROPPED">Baja</option>
              <option value="SUSPENDED">Suspendido</option>
            </select>
          </div>
        </div>
      </div>

      {/* Gradebook Matrix Table */}
      {gradebook.students.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={{ color: 'var(--color-muted)', margin: 0 }}>
            No se encontraron estudiantes con los filtros seleccionados.
          </p>
        </div>
      ) : (
        <div className="table-responsive" style={styles.tableWrapper}>
          <table id="gradebook-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-background)', borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px', position: 'sticky', left: 0, backgroundColor: 'var(--color-background)', zIndex: 2 }}>Estudiante</th>
                <th style={{ padding: '12px 16px' }}>Matrícula</th>
                <th style={{ padding: '12px 16px' }}>Estado</th>
                {gradebook.assessments.map((a) => (
                  <th key={a.id} style={{ padding: '12px 16px', textAlign: 'center', minWidth: '130px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>{a.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                      Ponderación: {a.weight}%
                    </div>
                  </th>
                ))}
                <th style={{ padding: '12px 16px', textAlign: 'center', backgroundColor: '#f0fdf4', minWidth: '130px' }}>
                  <div style={{ fontWeight: 700, color: '#166534' }}>Current Grade</div>
                  <div style={{ fontSize: '0.75rem', color: '#15803d' }}>Acumulado</div>
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'center', backgroundColor: '#eff6ff', minWidth: '130px' }}>
                  <div style={{ fontWeight: 700, color: '#1e40af' }}>Final Grade</div>
                  <div style={{ fontSize: '0.75rem', color: '#1d4ed8' }}>Oficial</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {gradebook.students.map((st) => (
                <tr key={st.studentId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 600, position: 'sticky', left: 0, backgroundColor: 'var(--color-surface)', zIndex: 1 }}>
                    {st.studentName}
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--color-muted)' }}>
                    {st.studentNumber || '—'}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {getEnrollmentBadge(st.enrollmentStatus)}
                  </td>
                  {gradebook.assessments.map((a) => {
                    const gradeItem = st.grades[a.id];
                    if (!gradeItem) {
                      return (
                        <td key={a.id} style={{ padding: '14px 16px', textAlign: 'center', color: 'var(--color-muted)' }}>
                          —
                        </td>
                      );
                    }
                    if (gradeItem.status === 'GRADED' && gradeItem.score !== null) {
                      return (
                        <td key={a.id} style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 700 }}>
                          <span style={gradeItem.score >= 60 ? styles.scorePass : styles.scoreFail}>
                            {gradeItem.score.toFixed(1)} / 100
                          </span>
                        </td>
                      );
                    }
                    if (gradeItem.status === 'PENDING_GRADING') {
                      return (
                        <td key={a.id} style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <span style={styles.badgePending}>Pendiente</span>
                        </td>
                      );
                    }
                    return (
                      <td key={a.id} style={{ padding: '14px 16px', textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.8rem' }}>
                        Sin Intento
                      </td>
                    );
                  })}
                  <td style={{ padding: '14px 16px', textAlign: 'center', backgroundColor: '#f0fdf4', fontWeight: 700 }}>
                    {st.currentGrade !== null ? (
                      <span style={{ fontSize: '1rem', color: st.currentGrade >= 60 ? '#15803d' : '#b91c1c' }}>
                        {st.currentGrade.toFixed(2)}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-muted)' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center', backgroundColor: '#eff6ff', fontWeight: 700 }}>
                    {st.finalGrade !== null ? (
                      <span style={{ fontSize: '1rem', color: st.finalGrade >= 60 ? '#1d4ed8' : '#b91c1c' }}>
                        {st.finalGrade.toFixed(2)}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-muted)', fontSize: '0.8rem', fontWeight: 400 }}>
                        {gradebook.courseStatus === 'FINISHED' ? '—' : 'En Curso'}
                      </span>
                    )}
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  metricCard: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    padding: '16px 20px',
    boxShadow: 'var(--shadow-sm)',
  },
  metricLabel: {
    fontSize: '0.825rem',
    fontWeight: 600,
    color: 'var(--color-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  metricValue: {
    fontSize: '1.75rem',
    fontWeight: 700,
    color: 'var(--color-text)',
    marginTop: '4px',
  },
  filterSection: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    padding: '16px',
    marginBottom: '20px',
  },
  searchInput: {
    padding: '8px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    width: '100%',
    fontSize: '0.875rem',
  },
  selectInput: {
    padding: '8px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    fontSize: '0.875rem',
    backgroundColor: 'var(--color-surface)',
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
  badgeActive: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    padding: '4px 8px',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  badgeCompleted: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    padding: '4px 8px',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  badgeDropped: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    padding: '4px 8px',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  badgeSuspended: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: '4px 8px',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  badgeDraft: {
    backgroundColor: '#f3f4f6',
    color: '#374151',
    padding: '4px 8px',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  badgeArchived: {
    backgroundColor: '#e5e7eb',
    color: '#4b5563',
    padding: '4px 8px',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  badgePending: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: '4px 8px',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  scorePass: {
    color: '#166534',
  },
  scoreFail: {
    color: '#dc2626',
  },
};
