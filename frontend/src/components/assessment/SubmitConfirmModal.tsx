import React, { useEffect, useRef } from 'react';

interface SubmitConfirmModalProps {
  isOpen: boolean;
  unansweredCount: number;
  totalQuestions: number;
  isSubmitting: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const SubmitConfirmModal: React.FC<SubmitConfirmModalProps> = ({
  isOpen,
  unansweredCount,
  totalQuestions,
  isSubmitting,
  error,
  onConfirm,
  onCancel,
}) => {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      confirmBtnRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const answeredCount = Math.max(0, totalQuestions - unansweredCount);
  const hasUnanswered = unansweredCount > 0;

  return (
    <div
      className="assessment-edit-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onCancel();
      }}
    >
      <div
        className="assessment-edit-modal-card"
        style={{ maxWidth: '520px', borderRadius: '16px' }}
      >
        {/* Header */}
        <div className="assessment-edit-modal-header" style={{ borderBottom: '1px solid #f1f5f9' }}>
          <div className="assessment-edit-modal-header-left">
            <div
              className="assessment-edit-modal-header-icon"
              style={{
                backgroundColor: hasUnanswered ? '#fef3c7' : '#dcfce7',
                color: hasUnanswered ? '#d97706' : '#16a34a',
                boxShadow: `inset 0 0 0 1px ${hasUnanswered ? 'rgba(217, 119, 6, 0.2)' : 'rgba(22, 163, 74, 0.2)'}`,
              }}
            >
              {hasUnanswered ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              )}
            </div>
            <div>
              <h3 id="submit-modal-title" className="assessment-edit-modal-title">
                ¿Finalizar y entregar evaluación?
              </h3>
              <p className="assessment-edit-modal-subtitle">Revisa el estado de tu cuestionario antes de enviar</p>
            </div>
          </div>
          <button
            type="button"
            className="assessment-edit-modal-close"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="assessment-edit-modal-body" style={{ padding: '20px 24px', gap: '16px' }}>
          {error && (
            <div className="alert alert-error" style={{ marginBottom: '0' }}>
              {error}
            </div>
          )}

          {/* Desglose de preguntas */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
              textAlign: 'center',
            }}
          >
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 8px' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                Total
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                {totalQuestions}
              </div>
            </div>

            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 8px' }}>
              <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                Respondidas
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d', marginTop: '2px' }}>
                {answeredCount}
              </div>
            </div>

            <div style={{ backgroundColor: hasUnanswered ? '#fffbeb' : '#f8fafc', border: `1px solid ${hasUnanswered ? '#fde68a' : '#e2e8f0'}`, borderRadius: '10px', padding: '10px 8px' }}>
              <div style={{ fontSize: '0.75rem', color: hasUnanswered ? '#92400e' : '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                Sin responder
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: hasUnanswered ? '#b45309' : '#64748b', marginTop: '2px' }}>
                {unansweredCount}
              </div>
            </div>
          </div>

          {/* Estado Informativo */}
          {hasUnanswered ? (
            <div
              style={{
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '12px',
                padding: '14px 16px',
                color: '#92400e',
                fontSize: '0.875rem',
                lineHeight: '1.45',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <span>Tienes {unansweredCount} {unansweredCount === 1 ? 'pregunta sin responder' : 'preguntas sin responder'}</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.825rem', color: '#b45309' }}>
                Las preguntas sin respuesta no otorgarán puntos. ¿Deseas entregar tu evaluación en este momento?
              </p>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '12px',
                padding: '14px 16px',
                color: '#166534',
                fontSize: '0.875rem',
                lineHeight: '1.45',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Todas las preguntas han sido respondidas</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.825rem', color: '#15803d' }}>
                ¡Excelente trabajo! Puedes confirmar el envío definitivo de tu examen.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="assessment-edit-modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isSubmitting}
            style={{ fontWeight: 600 }}
          >
            Seguir revisando
          </button>

          <button
            ref={confirmBtnRef}
            type="button"
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={isSubmitting}
            style={{
              fontWeight: 700,
              padding: '9px 20px',
              backgroundColor: '#16a34a',
              borderColor: '#16a34a',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {isSubmitting ? (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="loading-spinner-icon"
                  style={{ animation: 'spin 1s linear infinite' }}
                >
                  <line x1="12" y1="2" x2="12" y2="6"></line>
                  <line x1="12" y1="18" x2="12" y2="22"></line>
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                  <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                  <line x1="2" y1="12" x2="6" y2="12"></line>
                  <line x1="18" y1="12" x2="22" y2="12"></line>
                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                  <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                </svg>
                <span>Entregando evaluación...</span>
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Finalizar y entregar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
