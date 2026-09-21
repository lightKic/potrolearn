import React from 'react';
import { CrosswordLayout, CrosswordUnplacedEntry } from '../../types/assessment.js';

export interface CrosswordPreviewProps {
  layout: CrosswordLayout | null;
  loading?: boolean;
  error?: string | null;
  unplacedEntries?: CrosswordUnplacedEntry[];
  isStale?: boolean;
  onGenerate?: () => void;
  onRegenerate?: () => void;
  onSaveLayout?: () => void;
  savingLayout?: boolean;
  hasUnsavedChanges?: boolean;
  canSave?: boolean;
  showAnswers?: boolean;
  lockedMessage?: string | null;
}

interface GridCellInfo {
  char: string | null;
  number: number | null;
}

export const CrosswordPreview: React.FC<CrosswordPreviewProps> = ({
  layout,
  loading = false,
  error = null,
  unplacedEntries = [],
  isStale = false,
  onGenerate,
  onRegenerate,
  onSaveLayout,
  savingLayout = false,
  hasUnsavedChanges = false,
  canSave = true,
  showAnswers = true,
  lockedMessage = null,
}) => {
  const placedCount = layout?.entries?.length ?? 0;
  const unplacedCount = unplacedEntries.length;
  const totalEntries = placedCount + unplacedCount;
  const isPartial = unplacedCount > 0;

  return (
    <div className="crossword-preview-card">
      {/* Header con Título, Badges de Estado y Acciones Directas */}
      <div
        className="crossword-preview-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px',
          paddingBottom: '12px',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <div>
          <h4 className="crossword-preview-title" style={{ margin: 0 }}>Vista Previa del Crucigrama</h4>
          <span className="crossword-preview-subtitle">Previsualización docente y control del tablero</span>

          {!lockedMessage && layout && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
              {isStale ? (
                <span className="crossword-badge-stale">⚠️ Vista previa desactualizada</span>
              ) : isPartial ? (
                <span
                  className="crossword-badge-warning"
                  style={{
                    background: '#fffbe6',
                    color: '#d97706',
                    border: '1px solid #ffe58f',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  🟡 Crucigrama parcial ({placedCount} de {totalEntries})
                </span>
              ) : (
                <span className="crossword-badge-success">🟢 Válido y completo ({placedCount} / {totalEntries})</span>
              )}

              {!isStale && hasUnsavedChanges && (
                <span
                  style={{
                    background: '#fef3c7',
                    color: '#92400e',
                    border: '1px solid #fcd34d',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  💾 Cambios sin guardar
                </span>
              )}
              {!isStale && !hasUnsavedChanges && (
                <span
                  style={{
                    background: '#dcfce7',
                    color: '#15803d',
                    border: '1px solid #86efac',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  ✅ Layout guardado
                </span>
              )}
            </div>
          )}
        </div>

        {/* Acciones Principales en Cabecera */}
        {!lockedMessage && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {(onGenerate || onRegenerate) && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={layout ? (onRegenerate || onGenerate) : onGenerate}
                disabled={loading || savingLayout}
                style={{ fontSize: '0.85rem', padding: '8px 14px', fontWeight: 600 }}
              >
                {loading ? 'Generando...' : layout ? '🎲 Regenerar' : '✨ Generar Crucigrama'}
              </button>
            )}

            {onSaveLayout && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={onSaveLayout}
                disabled={savingLayout || isStale || !layout || loading || !canSave}
                style={{ fontSize: '0.85rem', padding: '8px 16px', fontWeight: 700 }}
              >
                {savingLayout ? 'Guardando...' : '💾 Guardar Layout'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bloqueo de Estructura por Historial de Intentos */}
      {lockedMessage && (
        <div className="crossword-preview-locked-banner" style={{ marginBottom: '16px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <div>
            <strong>Estructura Bloqueada</strong>
            <p>{lockedMessage}</p>
          </div>
        </div>
      )}

      {/* Estado Carga */}
      {loading && (
        <div className="crossword-preview-loading">
          <div className="crossword-preview-spinner"></div>
          <p>Generando crucigrama...</p>
          <span className="crossword-preview-subtext">Optimizando intersecciones y dimensiones del tablero...</span>
        </div>
      )}

      {/* Estado Error / Palabras no colocadas en intento fallido */}
      {!loading && !layout && (error || unplacedEntries.length > 0) && (
        <div className="crossword-preview-error-banner">
          <div className="crossword-preview-error-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <div>
            <strong>No se pudo generar el crucigrama</strong>
            <p>{error || 'Existen respuestas que no pudieron integrarse al tablero.'}</p>

            {unplacedEntries.length > 0 && (
              <div className="crossword-preview-orphan-list">
                <span>Respuestas no integradas:</span>
                <ul>
                  {unplacedEntries.map((item, idx) => (
                    <li key={idx}>
                      <code>{item.answerNormalized}</code> {item.reason ? `— ${item.reason}` : '(sin intersecciones válidas)'}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Estado Inicial Sin Layout */}
      {!loading && !layout && !error && unplacedEntries.length === 0 && (
        <div className="crossword-preview-empty">
          <div className="crossword-preview-empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="3" y1="15" x2="21" y2="15"></line>
              <line x1="9" y1="3" x2="9" y2="21"></line>
              <line x1="15" y1="3" x2="15" y2="21"></line>
            </svg>
          </div>
          <h5>Tu crucigrama aparecerá aquí</h5>
          <p>Agrega las pistas necesarias y haz clic en "Generar Crucigrama" en la barra superior.</p>
        </div>
      )}

      {/* Contenido con Layout Generado */}
      {!loading && layout && (
        <>
          {isStale ? (
            <div className="crossword-preview-stale-banner" style={{ marginBottom: '16px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              <div>
                <strong>Las pistas o respuestas han cambiado</strong>
                <p>Debes regenerar el crucigrama y guardar el nuevo layout para reflejar los cambios.</p>
              </div>
            </div>
          ) : isPartial ? (
            <div className="crossword-preview-warning-banner" style={{ background: '#fffbe6', border: '1px solid #ffe58f', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px' }}>
              <strong style={{ color: '#873800' }}>Crucigrama Parcial ({placedCount} de {totalEntries} palabras colocadas)</strong>
              <p style={{ margin: '4px 0 8px 0', color: '#614700' }}>
                {unplacedCount} {unplacedCount === 1 ? 'palabra no pudo colocarse' : 'palabras no pudieron colocarse'} en el crucigrama.
              </p>
              <div className="crossword-preview-orphan-list">
                <strong style={{ color: '#873800' }}>Palabras no colocadas:</strong>
                <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                  {unplacedEntries.map((item, idx) => (
                    <li key={idx} style={{ color: '#614700' }}>
                      <code>{item.answerNormalized}</code> {item.reason ? `— ${item.reason}` : '(sin intersecciones ortogonales válidas)'}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {/* Grilla Visual del Tablero */}
          <div className="crossword-preview-grid-wrapper">
            {renderGrid(layout, showAnswers)}
          </div>

          {/* Barra Informativa Inferior (Únicamente Información, Sin Botones Duplicados) */}
          <div className="crossword-preview-meta-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="crossword-meta-pills">
              <span className="crossword-meta-pill">
                <strong>{placedCount} de {totalEntries}</strong> palabras colocadas
              </span>
              <span className="crossword-meta-pill">
                Dimensiones: <strong>{layout.gridSize.rows} × {layout.gridSize.columns}</strong>
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

function renderGrid(layout: CrosswordLayout, showAnswers: boolean) {
  const { rows, columns } = layout.gridSize;
  const matrix: GridCellInfo[][] = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => ({ char: null, number: null }))
  );

  for (const entry of layout.entries) {
    for (let i = 0; i < entry.length; i++) {
      const r = entry.direction === 'ACROSS' ? entry.startRow : entry.startRow + i;
      const c = entry.direction === 'ACROSS' ? entry.startCol + i : entry.startCol;
      const char = entry.answerNormalized ? entry.answerNormalized[i] : null;
      matrix[r][c].char = char;

      if (i === 0) {
        matrix[r][c].number = entry.number;
      }
    }
  }

  return (
    <div
      className="crossword-preview-grid"
      style={{
        display: 'grid',
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {matrix.map((row, rIdx) =>
        row.map((cell, cIdx) => {
          const isOccupied = cell.char !== null;
          return (
            <div
              key={`${rIdx}-${cIdx}`}
              className={`crossword-cell ${isOccupied ? 'is-occupied' : 'is-block'}`}
            >
              {isOccupied && (
                <>
                  {cell.number !== null && (
                    <span className="crossword-cell-number">{cell.number}</span>
                  )}
                  {showAnswers && (
                    <span className="crossword-cell-letter">{cell.char}</span>
                  )}
                </>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
