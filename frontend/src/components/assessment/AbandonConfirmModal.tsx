import React from 'react';

interface AbandonConfirmModalProps {
  isOpen: boolean;
  isAbandoning?: boolean;
  isSubmitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  error?: string | null;
  errorMessage?: string | null;
}

export const AbandonConfirmModal: React.FC<AbandonConfirmModalProps> = ({
  isOpen,
  isAbandoning,
  isSubmitting,
  onConfirm,
  onCancel,
  error,
  errorMessage,
}) => {
  const busy = Boolean(isAbandoning || isSubmitting);
  const err = error || errorMessage;
  if (!isOpen) return null;

  return (
    <div
      className="assessment-edit-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className="assessment-edit-modal-card"
        style={{ maxWidth: '520px', borderRadius: '16px' }}
      >
        {/* Header con icono de advertencia */}
        <div className="assessment-edit-modal-header" style={{ borderBottom: '1px solid #fee2e2' }}>
          <div className="assessment-edit-modal-header-left">
            <div
              className="assessment-edit-modal-header-icon"
              style={{
                backgroundColor: '#fef2f2',
                color: '#dc2626',
                boxShadow: 'inset 0 0 0 1px rgba(220, 38, 38, 0.15)',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </div>
            <div>
              <h3 className="assessment-edit-modal-title" style={{ color: '#991b1b' }}>
                ¿Salir de la evaluación?
              </h3>
              <p className="assessment-edit-modal-subtitle">Tu evaluación todavía se encuentra en curso</p>
            </div>
          </div>
          <button
            type="button"
            className="assessment-edit-modal-close"
            onClick={onCancel}
            disabled={busy}
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="assessment-edit-modal-body" style={{ padding: '20px 24px', gap: '16px' }}>
          {err && (
            <div className="alert alert-error" style={{ marginBottom: '0' }}>
              {err}
            </div>
          )}

          <div style={{ backgroundColor: '#ffffff', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px', color: '#334155', fontSize: '0.9rem', lineHeight: '1.5' }}>
            <p style={{ margin: '0 0 10px 0', fontWeight: 600, color: '#1e293b' }}>
              Si abandonas ahora, este intento se marcará como <strong>abandonado</strong> y contará como uno de tus intentos permitidos.
            </p>
            <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '0.85rem', color: '#64748b' }}>
              <li>Tus respuestas guardadas se conservarán en el historial.</li>
              <li>Este intento NO podrá reanudarse ni enviarse posteriormente.</li>
              <li>Podrás iniciar otro intento sólo si aún dispones de intentos permitidos.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="assessment-edit-modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={busy}
            style={{ fontWeight: 700 }}
          >
            Continuar evaluación
          </button>

          <button
            type="button"
            className="btn btn-danger-outline"
            onClick={onConfirm}
            disabled={busy}
            style={{ fontWeight: 700, padding: '9px 18px' }}
          >
            {busy ? 'Abandonando...' : 'Abandonar intento'}
          </button>
        </div>
      </div>
    </div>
  );
};
