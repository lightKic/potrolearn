import React from 'react';
import { CrosswordLayoutEntry } from '../../types/assessment.js';
import { WordValidationStatus } from '../../utils/crossword-validation.util.js';

export interface CrosswordGridSize {
  rows: number;
  columns: number;
}

export interface CrosswordGridProps {
  gridSize: CrosswordGridSize;
  entries: CrosswordLayoutEntry[];
  cellAnswers?: Record<string, string>;
  wordStates?: Record<string, WordValidationStatus>; // key: `${number}-${direction}`
  selectedCell?: { row: number; col: number } | null;
  selectedEntry?: CrosswordLayoutEntry | null;
  showAnswerKey?: boolean;
  onCellClick?: (row: number, col: number) => void;
  readOnly?: boolean;
}

interface CellMatrixInfo {
  isOccupied: boolean;
  correctChar: string | null;
  number: number | null;
  entries: CrosswordLayoutEntry[];
}

export const CrosswordGrid: React.FC<CrosswordGridProps> = ({
  gridSize,
  entries,
  cellAnswers = {},
  wordStates = {},
  selectedCell = null,
  selectedEntry = null,
  showAnswerKey = false,
  onCellClick,
  readOnly = false,
}) => {
  const { rows, columns } = gridSize;

  // Build matrix representation
  const matrix: CellMatrixInfo[][] = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => ({
      isOccupied: false,
      correctChar: null,
      number: null,
      entries: [],
    }))
  );

  for (const entry of entries) {
    for (let i = 0; i < entry.length; i++) {
      const r = entry.direction === 'ACROSS' ? entry.startRow : entry.startRow + i;
      const c = entry.direction === 'ACROSS' ? entry.startCol + i : entry.startCol;

      if (r >= 0 && r < rows && c >= 0 && c < columns) {
        matrix[r][c].isOccupied = true;
        matrix[r][c].correctChar = entry.answerNormalized ? entry.answerNormalized[i] : null;
        matrix[r][c].entries.push(entry);

        if (i === 0 && (matrix[r][c].number === null || entry.number < matrix[r][c].number!)) {
          matrix[r][c].number = entry.number;
        }
      }
    }
  }

  // Set of cell keys (r-c) belonging to active entry
  const activeEntryCellKeys = new Set<string>();
  if (selectedEntry) {
    for (let i = 0; i < selectedEntry.length; i++) {
      const r = selectedEntry.direction === 'ACROSS' ? selectedEntry.startRow : selectedEntry.startRow + i;
      const c = selectedEntry.direction === 'ACROSS' ? selectedEntry.startCol + i : selectedEntry.startCol;
      activeEntryCellKeys.add(`${r}-${c}`);
    }
  }

  return (
    <div className="crossword-grid-container" style={{ width: '100%', overflowX: 'auto', padding: '4px' }}>
      <div
        className="crossword-preview-grid"
        style={{
          display: 'grid',
          gridTemplateRows: `repeat(${rows}, minmax(32px, 1fr))`,
          gridTemplateColumns: `repeat(${columns}, minmax(32px, 1fr))`,
          gap: '3px',
          backgroundColor: '#0f172a',
          padding: '4px',
          borderRadius: '10px',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
        }}
      >
        {matrix.map((rowCells, rIdx) =>
          rowCells.map((cell, cIdx) => {
            const cellKey = `${rIdx}-${cIdx}`;
            const isOccupied = cell.isOccupied;
            const isSelected = selectedCell?.row === rIdx && selectedCell?.col === cIdx;
            const isInActiveEntry = activeEntryCellKeys.has(cellKey);
            const userTypedChar = cellAnswers[cellKey] || '';
            const displayChar = showAnswerKey ? cell.correctChar || '' : userTypedChar;

            // Determine validation state for word(s) passing through this cell
            const entryStatuses = cell.entries.map((e) => wordStates[`${e.number}-${e.direction}`] || 'PENDING');
            const isAllCorrect = entryStatuses.length > 0 && entryStatuses.every((s) => s === 'CORRECT');
            const isAnyIncorrect = entryStatuses.some((s) => s === 'INCORRECT');

            let bgColor = '#1e293b'; // Block / empty cell
            let textColor = '#0f172a';
            let borderColor = '#cbd5e1';

            if (isOccupied) {
              if (isSelected) {
                bgColor = '#fef08a'; // Bright yellow for selected cell
                borderColor = '#ca8a04';
                textColor = '#854d0e';
              } else if (isInActiveEntry) {
                bgColor = '#e0f2fe'; // Soft blue for active word cells
                borderColor = '#0284c7';
                textColor = '#0369a1';
              } else if (isAllCorrect) {
                bgColor = '#dcfce7'; // Soft green for correct word
                borderColor = '#22c55e';
                textColor = '#15803d';
              } else if (isAnyIncorrect) {
                bgColor = '#fee2e2'; // Soft red for incorrect word
                borderColor = '#ef4444';
                textColor = '#b91c1c';
              } else {
                bgColor = '#ffffff'; // White for normal occupied cell
                borderColor = '#334155';
                textColor = '#0f172a';
              }
            }

            if (showAnswerKey && isOccupied && !isSelected && !isInActiveEntry) {
              textColor = '#15803d';
            }

            const cellStateText = isSelected
              ? 'Seleccionada'
              : isInActiveEntry
              ? 'Palabra Activa'
              : isAllCorrect
              ? 'Correcta'
              : isAnyIncorrect
              ? 'Incorrecta'
              : 'Pendiente';

            return (
              <div
                key={cellKey}
                role={isOccupied && !readOnly ? 'button' : undefined}
                tabIndex={isOccupied && !readOnly ? 0 : undefined}
                aria-label={
                  isOccupied
                    ? `Celda Fila ${rIdx + 1}, Columna ${cIdx + 1}${
                        cell.number ? `, Número ${cell.number}` : ''
                      }${displayChar ? `, Letra ${displayChar}` : ''}, Estado ${cellStateText}`
                    : `Bloque Fila ${rIdx + 1}, Columna ${cIdx + 1}`
                }
                onClick={() => {
                  if (isOccupied && onCellClick && !readOnly) {
                    onCellClick(rIdx, cIdx);
                  }
                }}
                onKeyDown={(e) => {
                  if (isOccupied && onCellClick && !readOnly && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onCellClick(rIdx, cIdx);
                  }
                }}
                style={{
                  position: 'relative',
                  backgroundColor: bgColor,
                  border: isSelected || isInActiveEntry ? `2px solid ${borderColor}` : `1px solid ${borderColor}`,
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  userSelect: 'none',
                  cursor: isOccupied && !readOnly ? 'pointer' : 'default',
                  fontWeight: 800,
                  fontSize: 'clamp(0.85rem, 2.2vw, 1.35rem)',
                  color: textColor,
                  transition: 'background-color 0.12s ease, border-color 0.12s ease',
                  minWidth: '32px',
                  minHeight: '32px',
                  aspectRatio: '1 / 1',
                  boxShadow: isSelected ? '0 0 0 2px rgba(202, 138, 4, 0.4)' : undefined,
                }}
              >
                {isOccupied && (
                  <>
                    {cell.number !== null && (
                      <span
                        className="crossword-cell-number"
                        style={{
                          position: 'absolute',
                          top: '3px',
                          left: '4px',
                          fontSize: 'clamp(0.6rem, 1.3vw, 0.8rem)',
                          fontWeight: 800,
                          color: isSelected ? '#854d0e' : isInActiveEntry ? '#0369a1' : '#475569',
                          lineHeight: 1,
                        }}
                      >
                        {cell.number}
                      </span>
                    )}
                    <span className="crossword-cell-letter" style={{ marginTop: '2px' }}>
                      {displayChar}
                    </span>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
