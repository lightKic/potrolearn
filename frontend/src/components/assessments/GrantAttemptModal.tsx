import React, { useState, useEffect } from 'react';
import { AssessmentServiceAPI } from '../../services/assessment.service.js';
import { StudentAttemptSummaryItemDTO } from '../../types/assessment.js';
import { ApiError } from '../../services/api.js';
import { ButtonSpinner } from '../common/loading/index.js';

interface GrantAttemptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedSummary: StudentAttemptSummaryItemDTO) => void;
  assessmentId: string;
  assessmentTitle: string;
  student: {
    studentId: string;
    studentName: string;
    studentNumber: string;
    attemptsUsed: number;
    effectiveMaxAttempts: number | null;
    maxAttemptsGlobal: number | null;
  } | null;
}

export const GrantAttemptModal: React.FC<GrantAttemptModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  assessmentId,
  assessmentTitle,
  student,
}) => {
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setReason('');
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen || !student) return null;

  const currentMax = student.effectiveMaxAttempts ?? student.maxAttemptsGlobal ?? 0;
  const newMax = currentMax + quantity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity < 1) {
      setError('La cantidad debe ser al menos 1 intento.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const updated = await AssessmentServiceAPI.createAttemptGrant(assessmentId, student.studentId, {
        quantity,
        reason: reason.trim() || undefined,
      });
      onSuccess(updated);
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Error al conceder el intento adicional');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grant-attempt-modal-overlay" onClick={onClose}>
      <div className="grant-attempt-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="grant-attempt-modal-header">
          <div className="header-icon-badge">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </div>
          <div>
            <h3>Conceder Intento Adicional</h3>
            <p className="subtitle">Otorga intentos extra de forma individual a este alumno.</p>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Cerrar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grant-attempt-modal-body">
          {error && (
            <div className="modal-error-banner">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="student-info-card">
            <div className="info-row">
              <span className="label">Alumno:</span>
              <span className="value font-medium">{student.studentName} ({student.studentNumber})</span>
            </div>
            <div className="info-row">
              <span className="label">Evaluación:</span>
              <span className="value font-medium">{assessmentTitle}</span>
            </div>
            <div className="info-row">
              <span className="label">Estado actual:</span>
              <span className="value badge-neutral">{student.attemptsUsed} de {currentMax} intentos permitidos</span>
            </div>
            <div className="info-row highlight">
              <span className="label">Nuevo límite tras la concesión:</span>
              <span className="value badge-success">{student.attemptsUsed} de {newMax} permitidos</span>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="grant-quantity">Cantidad de Intentos Extras</label>
            <input
              id="grant-quantity"
              type="number"
              min="1"
              max="10"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              disabled={submitting}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="grant-reason">Justificación / Motivo (Opcional)</label>
            <textarea
              id="grant-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Falla en la conexión a internet durante el intento #2..."
              disabled={submitting}
              className="form-textarea"
            />
            <span className="help-text">Este motivo quedará guardado únicamente en el registro de auditoría del docente.</span>
          </div>

          <div className="grant-attempt-modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? <><ButtonSpinner /> Concediendo...</> : 'Conceder Intento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
