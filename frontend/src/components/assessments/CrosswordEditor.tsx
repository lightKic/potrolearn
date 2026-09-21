import React from 'react';

export interface CrosswordClueItem {
  id?: string;
  statement: string;
  answer: string;
}

interface CrosswordEditorProps {
  items: CrosswordClueItem[];
  onChange: (items: CrosswordClueItem[]) => void;
  disabled?: boolean;
}

/**
 * Normalizes an answer string according to QA-008-AL rules for real-time validation preview.
 */
function normalizeAnswerPreview(text: string): string {
  if (!text) return '';
  return text
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

export const CrosswordEditor: React.FC<CrosswordEditorProps> = ({ items, onChange, disabled = false }) => {
  const handleItemChange = (index: number, field: 'statement' | 'answer', value: string) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };

  const handleAddItem = () => {
    if (items.length >= 20 || disabled) return;
    onChange([...items, { statement: '', answer: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    if (disabled || items.length <= 1) return;
    const next = items.filter((_, idx) => idx !== index);
    onChange(next);
  };

  // Compute duplicate normalized answers for client validation
  const normalizedCounts = new Map<string, number>();
  items.forEach((item) => {
    const norm = normalizeAnswerPreview(item.answer);
    if (norm) {
      normalizedCounts.set(norm, (normalizedCounts.get(norm) || 0) + 1);
    }
  });

  return (
    <div className="crossword-editor-container">
      <div className="crossword-editor-header">
        <div>
          <h4 className="crossword-editor-title">Pistas y Respuestas del Crucigrama</h4>
          <p className="crossword-editor-subtitle">
            Agrega entre 2 y 20 preguntas con sus respuestas correspondientes. Cada respuesta será normalizada automáticamente.
          </p>
        </div>
        <span className="crossword-editor-badge">
          {items.length} / 20 palabras
        </span>
      </div>

      <div className="crossword-editor-list">
        {items.map((item, index) => {
          const norm = normalizeAnswerPreview(item.answer);
          const isTooShort = item.answer.trim().length > 0 && norm.length < 2;
          const isTooLong = norm.length > 20;
          const isDuplicate = norm.length >= 2 && (normalizedCounts.get(norm) || 0) > 1;

          return (
            <div key={index} className="crossword-editor-card">
              <div className="crossword-editor-card-header">
                <span className="crossword-editor-item-number">Pista #{index + 1}</span>
                {items.length > 1 && !disabled && (
                  <button
                    type="button"
                    className="btn-text-danger"
                    onClick={() => handleRemoveItem(index)}
                    aria-label={`Eliminar pista ${index + 1}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    Eliminar
                  </button>
                )}
              </div>

              <div className="crossword-editor-field-group">
                <div className="crossword-editor-field">
                  <label className="crossword-editor-label" htmlFor={`clue-statement-${index}`}>
                    Pista / Pregunta <span className="text-required">*</span>
                  </label>
                  <input
                    id={`clue-statement-${index}`}
                    type="text"
                    className="crossword-editor-input"
                    placeholder="Ej. ¿Figura geométrica de tres lados?"
                    value={item.statement}
                    onChange={(e) => handleItemChange(index, 'statement', e.target.value)}
                    disabled={disabled}
                    required
                  />
                </div>

                <div className="crossword-editor-field">
                  <label className="crossword-editor-label" htmlFor={`clue-answer-${index}`}>
                    Respuesta Correcta <span className="text-required">*</span>
                  </label>
                  <input
                    id={`clue-answer-${index}`}
                    type="text"
                    className="crossword-editor-input font-mono"
                    placeholder="Ej. Triángulo"
                    value={item.answer}
                    onChange={(e) => handleItemChange(index, 'answer', e.target.value)}
                    disabled={disabled}
                    required
                  />
                  {norm && (
                    <div className="crossword-editor-preview-tag">
                      Normalizada: <strong>{norm}</strong> ({norm.length} letras)
                    </div>
                  )}

                  {isTooShort && (
                    <div className="crossword-editor-warning">
                      ⚠️ La respuesta debe contener al menos 2 letras.
                    </div>
                  )}

                  {isTooLong && (
                    <div className="crossword-editor-warning">
                      ⚠️ La respuesta excede la longitud máxima de 20 caracteres.
                    </div>
                  )}

                  {isDuplicate && (
                    <div className="crossword-editor-warning">
                      ⚠️ Respuesta duplicada detectada ("{norm}"). Cada respuesta debe ser única.
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="crossword-editor-actions">
        <button
          type="button"
          className="btn btn-secondary btn-icon"
          onClick={handleAddItem}
          disabled={disabled || items.length >= 20}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          + Agregar pista
        </button>
      </div>
    </div>
  );
};
