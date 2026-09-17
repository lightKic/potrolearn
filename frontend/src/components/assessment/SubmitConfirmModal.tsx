import React, { useEffect, useRef } from 'react';

interface SubmitConfirmModalProps {
  isOpen: boolean;
  unansweredCount: number;
  totalQuestions: number;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const SubmitConfirmModal: React.FC<SubmitConfirmModalProps> = ({
  isOpen,
  unansweredCount,
  totalQuestions,
  isSubmitting,
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

  const answeredCount = totalQuestions - unansweredCount;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="submit-modal-title">
      <div className="modal-container">
        <h2 id="submit-modal-title" className="modal-title">
          ¿Entregar Evaluación?
        </h2>

        <div className="modal-body">
          <p>
            Has respondido <strong>{answeredCount}</strong> de <strong>{totalQuestions}</strong> preguntas.
          </p>

          {unansweredCount > 0 ? (
            <div className="alert alert-warning" role="alert">
              ⚠️ Tienes <strong>{unansweredCount}</strong> {unansweredCount === 1 ? 'pregunta sin responder' : 'preguntas sin responder'}. Una vez entregada, no podrás cambiar tus respuestas.
            </div>
          ) : (
            <p className="modal-confirm-text">
              Has respondido todas las preguntas. ¿Estás seguro de que deseas enviar tu examen ahora?
            </p>
          )}
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Volver al examen
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className="btn btn-primary btn-submit"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Enviando...' : 'Sí, Entregar Evaluación'}
          </button>
        </div>
      </div>
    </div>
  );
};
