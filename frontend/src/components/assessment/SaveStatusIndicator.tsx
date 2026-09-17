import React from 'react';

export type SaveState = 'IDLE' | 'SAVING' | 'SAVED' | 'ERROR';

interface SaveStatusIndicatorProps {
  status: SaveState;
  onRetry?: () => void;
}

export const SaveStatusIndicator: React.FC<SaveStatusIndicatorProps> = ({ status, onRetry }) => {
  if (status === 'SAVING') {
    return (
      <div className="save-indicator saving" aria-live="polite">
        <span className="save-spinner" /> Guardando...
      </div>
    );
  }

  if (status === 'SAVED') {
    return (
      <div className="save-indicator saved" aria-live="polite">
        ✓ Guardado
      </div>
    );
  }

  if (status === 'ERROR') {
    return (
      <div className="save-indicator error" aria-live="assertive">
        <span>❌ Error al guardar</span>
        {onRetry && (
          <button type="button" className="btn-retry" onClick={onRetry}>
            Reintentar
          </button>
        )}
      </div>
    );
  }

  return <div className="save-indicator idle" aria-hidden="true" />;
};
