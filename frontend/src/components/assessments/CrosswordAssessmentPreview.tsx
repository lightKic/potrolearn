import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StudentAssessmentDTO, AssessmentQuestionDTO, CrosswordLayout, CrosswordLayoutEntry } from '../../types/assessment.js';
import { CrosswordGrid } from './CrosswordGrid.js';
import { CrosswordCluesList } from './CrosswordCluesList.js';
import {
  syncCrosswordEntries,
  calculateWordState,
  WordValidationStatus,
} from '../../utils/crossword-validation.util.js';

export interface CrosswordAssessmentPreviewProps {
  assessment: StudentAssessmentDTO;
  questions: AssessmentQuestionDTO[];
  showAnswerKey?: boolean;
  isSimulatedFinished?: boolean;
  isTimeExpired?: boolean;
  onFinishSimulation?: () => void;
  onResetSimulation?: () => void;
}

export const CrosswordAssessmentPreview: React.FC<CrosswordAssessmentPreviewProps> = ({
  assessment,
  questions,
  showAnswerKey = false,
  isSimulatedFinished = false,
  isTimeExpired = false,
}) => {
  const layout = assessment.crosswordLayout as CrosswordLayout | null;

  // Local cell answers state for simulation: key "r-c" -> uppercase char
  const [cellAnswers, setCellAnswers] = useState<Record<string, string>>({});
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<'ACROSS' | 'DOWN'>('ACROSS');
  const [selectedEntryNumber, setSelectedEntryNumber] = useState<number | null>(null);
  const [mobileTab, setMobileTab] = useState<'grid' | 'clues'>('grid');

  const containerRef = useRef<HTMLDivElement>(null);

  // Synchronize layout entries with current assessment questions
  const { validEntries, orphanEntries } = useMemo(() => {
    if (!layout || !layout.entries) {
      return { validEntries: [], orphanEntries: [] };
    }
    return syncCrosswordEntries(questions, layout.entries);
  }, [layout, questions]);

  // Set default selection when layout/validEntries load
  useEffect(() => {
    if (validEntries.length > 0) {
      const firstEntry = validEntries[0];
      setSelectedEntryNumber(firstEntry.number);
      setSelectedDirection(firstEntry.direction);
      setSelectedCell({ row: firstEntry.startRow, col: firstEntry.startCol });
    }
  }, [validEntries]);

  // Find active entry based on selectedEntryNumber and selectedDirection
  const activeEntry = useMemo(() => {
    if (selectedEntryNumber === null) return null;
    return (
      validEntries.find(
        (e) => e.number === selectedEntryNumber && e.direction === selectedDirection
      ) ||
      validEntries.find((e) => e.number === selectedEntryNumber) ||
      null
    );
  }, [validEntries, selectedEntryNumber, selectedDirection]);

  // Calculate validation states for each valid entry
  const { wordStates, correctCount, incorrectCount, pendingCount } = useMemo(() => {
    const states: Record<string, WordValidationStatus> = {};
    let correct = 0;
    let incorrect = 0;
    let pending = 0;

    for (const entry of validEntries) {
      const key = `${entry.number}-${entry.direction}`;
      const state = calculateWordState(entry, cellAnswers);
      states[key] = state;

      if (state === 'CORRECT') correct++;
      else if (state === 'INCORRECT') incorrect++;
      else pending++;
    }

    return {
      wordStates: states,
      correctCount: correct,
      incorrectCount: incorrect,
      pendingCount: pending,
    };
  }, [validEntries, cellAnswers]);

  // Find valid entries passing through a given cell
  const getEntriesForCell = useCallback(
    (row: number, col: number): CrosswordLayoutEntry[] => {
      return validEntries.filter((e) => {
        if (e.direction === 'ACROSS') {
          return e.startRow === row && col >= e.startCol && col < e.startCol + e.length;
        } else {
          return e.startCol === col && row >= e.startRow && row < e.startRow + e.length;
        }
      });
    },
    [validEntries]
  );

  // Handle selecting a clue entry from list
  const handleSelectEntry = useCallback((entry: CrosswordLayoutEntry) => {
    setSelectedEntryNumber(entry.number);
    setSelectedDirection(entry.direction);
    setSelectedCell({ row: entry.startRow, col: entry.startCol });
  }, []);

  // Handle cell click in grid
  const handleCellClick = useCallback(
    (row: number, col: number) => {
      const cellEntries = getEntriesForCell(row, col);
      if (cellEntries.length === 0) return;

      const isSameCell = selectedCell?.row === row && selectedCell?.col === col;

      if (isSameCell && cellEntries.length > 1) {
        // Toggle direction on dual-intersection cell
        const nextDir = selectedDirection === 'ACROSS' ? 'DOWN' : 'ACROSS';
        const matchingEntry = cellEntries.find((e) => e.direction === nextDir) || cellEntries[0];
        setSelectedDirection(matchingEntry.direction);
        setSelectedEntryNumber(matchingEntry.number);
      } else {
        // Pick entry matching current direction, or first available
        const matchingEntry =
          cellEntries.find((e) => e.direction === selectedDirection) || cellEntries[0];
        setSelectedDirection(matchingEntry.direction);
        setSelectedEntryNumber(matchingEntry.number);
      }
      setSelectedCell({ row, col });
    },
    [getEntriesForCell, selectedCell, selectedDirection]
  );

  // Move focus to next/prev cell along active entry
  const moveCellInActiveEntry = useCallback(
    (delta: 1 | -1) => {
      if (!activeEntry || !selectedCell) return;
      const { startRow, startCol, direction, length } = activeEntry;

      let currentIndexInEntry = -1;
      if (direction === 'ACROSS') {
        currentIndexInEntry = selectedCell.col - startCol;
      } else {
        currentIndexInEntry = selectedCell.row - startRow;
      }

      const nextIndex = currentIndexInEntry + delta;
      if (nextIndex >= 0 && nextIndex < length) {
        const nextRow = direction === 'ACROSS' ? startRow : startRow + nextIndex;
        const nextCol = direction === 'ACROSS' ? startCol + nextIndex : startCol;
        setSelectedCell({ row: nextRow, col: nextCol });
      }
    },
    [activeEntry, selectedCell]
  );

  // Handle Keyboard Input
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTimeExpired || isSimulatedFinished || !selectedCell) return;

      const key = e.key.toUpperCase();

      // Typing A-Z or Ñ
      if (/^[A-ZÑ]$/.test(key) && key.length === 1) {
        e.preventDefault();
        const cellKey = `${selectedCell.row}-${selectedCell.col}`;
        setCellAnswers((prev) => ({ ...prev, [cellKey]: key }));
        moveCellInActiveEntry(1);
        return;
      }

      // Backspace
      if (e.key === 'Backspace') {
        e.preventDefault();
        const cellKey = `${selectedCell.row}-${selectedCell.col}`;
        if (cellAnswers[cellKey]) {
          setCellAnswers((prev) => {
            const copy = { ...prev };
            delete copy[cellKey];
            return copy;
          });
        } else {
          moveCellInActiveEntry(-1);
        }
        return;
      }

      // Arrow navigation
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        let { row, col } = selectedCell;
        if (e.key === 'ArrowLeft') col = Math.max(0, col - 1);
        if (e.key === 'ArrowRight') col = col + 1;
        if (e.key === 'ArrowUp') row = Math.max(0, row - 1);
        if (e.key === 'ArrowDown') row = row + 1;

        const targetEntries = getEntriesForCell(row, col);
        if (targetEntries.length > 0) {
          handleCellClick(row, col);
        }
      }
    },
    [
      isTimeExpired,
      isSimulatedFinished,
      selectedCell,
      cellAnswers,
      moveCellInActiveEntry,
      getEntriesForCell,
      handleCellClick,
    ]
  );

  // Handle missing layout state
  if (!layout) {
    return (
      <div
        className="crossword-preview-card"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '2px dashed #cbd5e1',
          padding: '48px 24px',
          textAlign: 'center',
          maxWidth: '640px',
          margin: '30px auto',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🧩</div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
          Este crucigrama todavía no tiene un tablero generado y guardado.
        </h3>
        <p style={{ fontSize: '0.95rem', color: '#64748b', lineHeight: 1.5, marginBottom: '20px' }}>
          Genera y guarda el layout desde el editor de la evaluación antes de utilizar la vista previa.
        </p>
      </div>
    );
  }

  const placedCount = validEntries.length;
  const totalQuestions = questions.length;
  const isPartialLayout = placedCount < totalQuestions;
  const hasOrphanEntries = orphanEntries.length > 0;

  // Header status string
  let headerStatusText = `${correctCount} correctas · ${pendingCount} pendientes`;
  if (correctCount === placedCount && placedCount > 0) {
    headerStatusText = `Correcto y completo — ${placedCount} / ${placedCount}`;
  } else if (incorrectCount > 0) {
    headerStatusText = `${correctCount} correctas · ${incorrectCount} incorrectas · ${pendingCount} pendientes`;
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="crossword-simulation-container"
      style={{ outline: 'none' }}
    >
      {/* Banner de Layout Desincronizado (Entradas Huérfanas) */}
      {hasOrphanEntries && (
        <div
          style={{
            backgroundColor: '#fff1f2',
            border: '1px solid #fecdd3',
            borderRadius: '12px',
            padding: '14px 18px',
            marginBottom: '20px',
            fontSize: '0.9rem',
            color: '#9f1239',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>🚨</span>
          <div>
            <strong style={{ fontSize: '0.95rem', display: 'block', marginBottom: '2px' }}>
              El tablero guardado está desactualizado
            </strong>
            <span>
              {orphanEntries.length === 1
                ? '1 palabra del tablero guardado ya no corresponde a una pregunta actual de esta evaluación.'
                : `${orphanEntries.length} palabras del tablero guardado ya no corresponden a preguntas actuales de esta evaluación.`}{' '}
              Regenera y guarda el crucigrama desde el editor para sincronizar el tablero.
            </span>
          </div>
        </div>
      )}

      {/* Banner de Layout Parcial */}
      {isPartialLayout && !hasOrphanEntries && (
        <div
          style={{
            backgroundColor: '#fffbe6',
            border: '1px solid #ffe58f',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '20px',
            fontSize: '0.9rem',
            color: '#873800',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span>⚠️</span>
          <div>
            <strong>Aviso de Crucigrama Parcial:</strong> Este crucigrama contiene{' '}
            {totalQuestions - placedCount} {totalQuestions - placedCount === 1 ? 'palabra' : 'palabras'} que no fueron colocadas en el tablero. (Se muestran {placedCount} de {totalQuestions} pistas válidas).
          </div>
        </div>
      )}

      {/* Resumen al Finalizar Simulación */}
      {isSimulatedFinished && (
        <div
          style={{
            backgroundColor: '#f0fdf4',
            border: '2px solid #86efac',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.5rem' }}>🎉</span>
            <strong style={{ fontSize: '1.1rem', color: '#166534' }}>
              Simulación de Crucigrama Finalizada
            </strong>
          </div>
          <div style={{ fontSize: '0.9rem', color: '#15803d', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <span>✅ Correctas: <strong>{correctCount} / {placedCount}</strong></span>
            <span>✕ Incorrectas: <strong>{incorrectCount} / {placedCount}</strong></span>
            <span>⏳ Pendientes: <strong>{pendingCount} / {placedCount}</strong></span>
            <span>🧩 Total Válidas: <strong>{placedCount}</strong></span>
          </div>
        </div>
      )}

      {/* Sub-header de Estado Global de Respuestas */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '12px 20px',
          marginBottom: '20px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>Estado de Simulación:</span>
          <span
            style={{
              fontWeight: 700,
              fontSize: '0.9rem',
              color: correctCount === placedCount && placedCount > 0 ? '#15803d' : incorrectCount > 0 ? '#b91c1c' : '#0284c7',
              backgroundColor: correctCount === placedCount && placedCount > 0 ? '#dcfce7' : incorrectCount > 0 ? '#fee2e2' : '#e0f2fe',
              padding: '4px 12px',
              borderRadius: '20px',
            }}
          >
            {headerStatusText}
          </span>
        </div>
        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
          Pistas Válidas: <strong>{placedCount}</strong>
        </div>
      </div>

      {/* Tabs para Mobile/Tablet (< 768px) */}
      <div
        className="crossword-mobile-tabs"
        style={{
          display: 'none',
          marginBottom: '16px',
          gap: '8px',
        }}
      >
        <button
          type="button"
          className={`btn ${mobileTab === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setMobileTab('grid')}
          style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem', fontWeight: 700 }}
        >
          🧩 Tablero
        </button>
        <button
          type="button"
          className={`btn ${mobileTab === 'clues' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setMobileTab('clues')}
          style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem', fontWeight: 700 }}
        >
          📝 Pistas ({placedCount})
        </button>
      </div>

      {/* Grid + Clues Layout Container */}
      <div
        className="crossword-layout-grid-container"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 360px',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* Columna Tablero */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: mobileTab === 'clues' ? 'none' : 'block',
            width: '100%',
          }}
        >
          {/* Header Pista Activa */}
          {activeEntry ? (
            <div
              style={{
                backgroundColor: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '10px',
                padding: '12px 16px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <span
                style={{
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  color: '#0284c7',
                  backgroundColor: '#e0f2fe',
                  padding: '4px 10px',
                  borderRadius: '6px',
                }}
              >
                {activeEntry.number} {activeEntry.direction === 'ACROSS' ? '➡️ HORIZONTAL' : '⬇️ VERTICAL'}
              </span>
              <span style={{ fontSize: '0.9rem', color: '#0369a1', fontWeight: 600 }}>
                {questions.find((q) => q.questionId === activeEntry.questionId)?.question?.statement || '(Sin enunciado)'}
              </span>
            </div>
          ) : (
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '16px', fontStyle: 'italic' }}>
              Selecciona una celda o pista para comenzar a interactuar...
            </div>
          )}

          <CrosswordGrid
            gridSize={layout.gridSize}
            entries={validEntries}
            cellAnswers={cellAnswers}
            wordStates={wordStates}
            selectedCell={selectedCell}
            selectedEntry={activeEntry}
            showAnswerKey={showAnswerKey}
            onCellClick={handleCellClick}
            readOnly={isTimeExpired || isSimulatedFinished}
          />
        </div>

        {/* Columna Pistas */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            maxHeight: 'calc(100vh - 200px)',
            overflowY: 'auto',
          }}
        >
          <CrosswordCluesList
            questions={questions}
            entries={validEntries}
            wordStates={wordStates}
            selectedEntryNumber={selectedEntryNumber}
            selectedDirection={selectedDirection}
            onSelectEntry={handleSelectEntry}
            cellAnswers={cellAnswers}
            showAnswerKey={showAnswerKey}
          />
        </div>
      </div>
    </div>
  );
};
