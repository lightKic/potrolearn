import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AssessmentServiceAPI } from '../services/assessment.service.js';
import { AssessmentAttemptItemDTO, AttemptStatus } from '../types/assessment.js';
import { ApiError } from '../services/api.js';
import { PageLoading } from '../components/common/loading/index.js';

type FilterType = 'ALL' | 'SUBMITTED' | 'GRADED';

export const TeacherGradingListPage: React.FC = () => {
  const { courseId, assessmentId } = useParams<{ courseId?: string; assessmentId: string }>();
  const navigate = useNavigate();

  const [attempts, setAttempts] = useState<AssessmentAttemptItemDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<FilterType>('ALL');

  useEffect(() => {
    if (!assessmentId) return;

    let isMounted = true;
    setLoading(true);

    AssessmentServiceAPI.getAssessmentAttemptsForReview(assessmentId, statusFilter)
      .then((data) => {
        if (isMounted) {
          setAttempts(data);
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
            setError('Error al cargar la lista de intentos para revisión');
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
  }, [assessmentId, statusFilter]);

  const formatDate = (isoString?: string | null): string => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const getStatusBadge = (status: AttemptStatus, pendingCount: number) => {
    if (status === 'SUBMITTED') {
      return (
        <span className="badge badge-warning" style={styles.badgeWarning}>
          {pendingCount > 0 ? `Entregado (${pendingCount} pendiente${pendingCount > 1 ? 's' : ''})` : 'Entregado'}
        </span>
      );
    }
    if (status === 'GRADED') {
      return (
        <span className="badge badge-success" style={styles.badgeSuccess}>
          Calificado
        </span>
      );
    }
    if (status === 'IN_PROGRESS') {
      return (
        <span className="badge badge-info" style={styles.badgeInfo}>
          En progreso
        </span>
      );
    }
    return <span className="badge">{status}</span>;
  };

  if (loading && attempts.length === 0) {
    return <PageLoading title="Cargando lista de intentos..." />;
  }

  if (error) {
    return (
      <div className="error-container" style={{ padding: '24px 0' }}>
        <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
          {statusCode === 403
            ? 'Acceso denegado: No tienes permisos para revisar los intentos de esta evaluación.'
            : statusCode === 404
            ? 'Evaluación no encontrada.'
            : error}
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate(courseId ? `/app/courses/${courseId}` : '/app/courses')}
        >
          ← Volver
        </button>
      </div>
    );
  }

  return (
    <div className="grading-list-page">
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <Link
          to={courseId ? `/app/courses/${courseId}` : '/app/courses'}
          className="back-link"
          style={{ textDecoration: 'none', color: 'var(--color-primary)', fontWeight: 600, display: 'inline-block', marginBottom: '8px' }}
        >
          ← Volver
        </Link>
        <h1 className="page-title">Centro de Calificación</h1>
        <p className="page-description">Revisión de intentos entregados y calificación manual de preguntas abiertas.</p>
      </div>

      {/* Filtros por Pestañas */}
      <div className="filter-tabs" style={styles.filterTabs}>
        <button
          type="button"
          style={{
            ...styles.tabButton,
            ...(statusFilter === 'ALL' ? styles.tabButtonActive : {}),
          }}
          onClick={() => setStatusFilter('ALL')}
        >
          Todos
        </button>
        <button
          type="button"
          style={{
            ...styles.tabButton,
            ...(statusFilter === 'SUBMITTED' ? styles.tabButtonActive : {}),
          }}
          onClick={() => setStatusFilter('SUBMITTED')}
        >
          Pendientes de Calificación
        </button>
        <button
          type="button"
          style={{
            ...styles.tabButton,
            ...(statusFilter === 'GRADED' ? styles.tabButtonActive : {}),
          }}
          onClick={() => setStatusFilter('GRADED')}
        >
          Calificados
        </button>
      </div>

      {/* Lista / Tabla de Intentos */}
      {attempts.length === 0 ? (
        <div className="empty-state" style={styles.emptyState}>
          <p style={{ color: 'var(--color-muted)', fontSize: '1rem' }}>
            No hay intentos registrados para esta evaluación con el filtro seleccionado.
          </p>
        </div>
      ) : (
        <div className="table-responsive" style={{ overflowX: 'auto', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-background)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-muted)', fontWeight: 700 }}>
                <th style={{ padding: '12px 16px' }}>Estudiante</th>
                <th style={{ padding: '12px 16px' }}>Expediente / Matrícula</th>
                <th style={{ padding: '12px 16px' }}>Intento</th>
                <th style={{ padding: '12px 16px' }}>Fecha de Entrega</th>
                <th style={{ padding: '12px 16px' }}>Estado</th>
                <th style={{ padding: '12px 16px' }}>Calificación</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((att) => {
                const needsGrading = att.status === 'SUBMITTED' && att.pendingOpenTextCount > 0;
                return (
                  <tr
                    key={att.id}
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      backgroundColor: needsGrading ? '#fffbeb' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--color-text)' }}>
                      {att.studentName}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--color-muted)' }}>
                      {att.studentNumber || '—'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>#{att.attemptNumber}</td>
                    <td style={{ padding: '14px 16px', color: 'var(--color-muted)' }}>
                      {formatDate(att.submittedAt)}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {getStatusBadge(att.status, att.pendingOpenTextCount)}
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 700 }}>
                      {att.score !== null ? `${att.score} / 100` : <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}>Pendiente</span>}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.825rem' }}
                        onClick={() => navigate(`/app/attempts/${att.id}/review`)}
                      >
                        {needsGrading ? 'Calificar' : 'Revisar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const styles = {
  filterTabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '20px',
    borderBottom: '1px solid var(--color-border)',
    paddingBottom: '8px',
  },
  tabButton: {
    padding: '8px 16px',
    border: 'none',
    background: 'none',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--color-muted)',
    cursor: 'pointer',
    borderRadius: 'var(--radius-sm)',
    transition: 'all 0.15s ease',
  },
  tabButtonActive: {
    backgroundColor: 'var(--color-primary-light)',
    color: 'var(--color-primary)',
  },
  emptyState: {
    padding: '48px 24px',
    textAlign: 'center' as const,
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
  },
  badgeWarning: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: '4px 8px',
    borderRadius: '9999px',
    fontSize: '0.775rem',
    fontWeight: 700,
  },
  badgeSuccess: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    padding: '4px 8px',
    borderRadius: '9999px',
    fontSize: '0.775rem',
    fontWeight: 700,
  },
  badgeInfo: {
    backgroundColor: '#e0f2fe',
    color: '#075985',
    padding: '4px 8px',
    borderRadius: '9999px',
    fontSize: '0.775rem',
    fontWeight: 700,
  },
};
