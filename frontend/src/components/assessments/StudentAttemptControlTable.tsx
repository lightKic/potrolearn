import React from 'react';
import { StudentAttemptSummaryItemDTO } from '../../types/assessment.js';
import { TableSkeleton } from '../common/loading/index.js';

interface StudentAttemptControlTableProps {
  assessmentId: string;
  assessmentTitle: string;
  maxAttemptsGlobal: number | null;
  summaries: StudentAttemptSummaryItemDTO[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onOpenGrantModal: (student: StudentAttemptSummaryItemDTO) => void;
}

export const StudentAttemptControlTable: React.FC<StudentAttemptControlTableProps> = ({
  maxAttemptsGlobal,
  summaries,
  loading,
  error,
  onRefresh,
  onOpenGrantModal,
}) => {
  if (loading) {
    return (
      <div className="student-attempt-control-container" style={{ marginTop: '24px', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <TableSkeleton columns={6} rows={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error" style={{ margin: '16px 0' }}>
        <span>{error}</span>
        <button type="button" className="btn btn-secondary" onClick={onRefresh} style={{ marginLeft: '12px', padding: '4px 12px', fontSize: '0.8rem' }}>
          Reintentar
        </button>
      </div>
    );
  }

  const isUnlimited = maxAttemptsGlobal === null;

  return (
    <div className="student-attempt-control-container" style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            Control de Intentos por Alumno
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 0' }}>
            {isUnlimited
              ? 'Esta evaluación tiene intentos ilimitados globales.'
              : `Límite global: ${maxAttemptsGlobal} intentos permitidos por evaluación.`}
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={onRefresh}
          style={{ fontSize: '0.825rem', padding: '6px 12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          Actualizar
        </button>
      </div>

      {summaries.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          No hay alumnos inscritos activamente en este curso.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '12px 16px' }}>Alumno</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Usados</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Permitidos</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Disponibles</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Intentos Extras</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s, idx) => {
                const effectiveDisplay = s.effectiveMaxAttempts !== null ? s.effectiveMaxAttempts : '∞';
                const availableDisplay = s.attemptsAvailable !== null ? s.attemptsAvailable : '∞';
                const isExhausted = s.attemptsAvailable === 0;

                return (
                  <tr
                    key={s.studentId}
                    style={{
                      borderBottom: idx === summaries.length - 1 ? 'none' : '1px solid #f1f5f9',
                      backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                    }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{s.studentName}</div>
                      <div style={{ fontSize: '0.775rem', color: '#64748b' }}>{s.studentNumber}</div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ fontWeight: 700, color: '#334155' }}>{s.attemptsUsed}</span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ fontWeight: 700, color: '#0f4c81' }}>{effectiveDisplay}</span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '0.825rem',
                          backgroundColor: isExhausted ? '#fef2f2' : '#f0fdf4',
                          color: isExhausted ? '#dc2626' : '#166534',
                          border: `1px solid ${isExhausted ? '#fecaca' : '#bbf7d0'}`,
                        }}
                      >
                        {availableDisplay}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {s.additionalAttemptsGranted > 0 ? (
                        <span
                          style={{
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '0.8rem',
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                          }}
                        >
                          +{s.additionalAttemptsGranted} extra
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {!isUnlimited ? (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => onOpenGrantModal(s)}
                          style={{
                            fontSize: '0.8rem',
                            padding: '6px 12px',
                            fontWeight: 600,
                            backgroundColor: '#0f4c81',
                            color: '#ffffff',
                            borderColor: '#0f4c81',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                          Conceder Intento
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Ilimitado</span>
                      )}
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
