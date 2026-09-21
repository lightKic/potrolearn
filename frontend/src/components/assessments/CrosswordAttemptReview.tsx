import React, { useState, useMemo, useCallback } from 'react';
import {
  StudentAssessmentDTO,
  TeacherAttemptDTO,
  StudentCrosswordLayoutEntry,
  CrosswordLayoutEntry,
  AssessmentQuestionDTO,
  AttemptAnswerDTO,
} from '../../types/assessment.js';
import { CrosswordGrid } from './CrosswordGrid.js';
import { CrosswordCluesList } from './CrosswordCluesList.js';
import {
  reconstructCellAnswers,
  findEntriesForCell,
  deriveWordText,
} from '../../utils/crossword-student.util.js';
import { WordValidationStatus } from '../../utils/crossword-validation.util.js';
import { MarkdownContent } from '../MarkdownContent.js';

export interface CrosswordAttemptReviewProps {
  attempt: TeacherAttemptDTO;
  assessment: StudentAssessmentDTO;
}

export const CrosswordAttemptReview: React.FC<CrosswordAttemptReviewProps> = ({
  attempt,
  assessment,
}) => {
  const layout = assessment.crosswordLayout;
  const entries = useMemo(() => layout?.entries || [], [layout]);

  // 1. Reconstrucción de cellAnswers a partir de las respuestas guardadas del alumno
  const cellAnswers = useMemo(() => {
    return reconstructCellAnswers(
      attempt.answers as unknown as AttemptAnswerDTO[],
      layout,
    ).cellAnswers;
  }, [attempt.answers, layout]);

  // 2. Cálculo de los estados de validación por palabra a partir del autocalificado server-side
  const wordStates = useMemo(() => {
    const states: Record<string, WordValidationStatus> = {};
    const ansMap = new Map(attempt.answers.map((a) => [a.questionId, a]));

    entries.forEach((entry) => {
      const key = `${entry.number}-${entry.direction}`;
      const ans = ansMap.get(entry.questionId);

      if (ans && ans.pointsEarned !== null && ans.pointsEarned !== undefined) {
        if (ans.isCorrect === true || ans.pointsEarned > 0) {
          states[key] = 'CORRECT';
        } else if (ans.textValue && ans.textValue.trim() !== '') {
          states[key] = 'INCORRECT';
        } else {
          states[key] = 'PENDING';
        }
      } else {
        states[key] = 'PENDING';
      }
    });

    return states;
  }, [entries, attempt.answers]);

  // 3. Resumen formativo de progreso del intento del estudiante
  const progressStats = useMemo(() => {
    let correctCount = 0;
    let incorrectCount = 0;
    let pendingCount = 0;

    entries.forEach((entry) => {
      const st = wordStates[`${entry.number}-${entry.direction}`] || 'PENDING';
      if (st === 'CORRECT') correctCount++;
      else if (st === 'INCORRECT') incorrectCount++;
      else pendingCount++;
    });

    const total = entries.length;
    const completedCount = correctCount + incorrectCount;
    const progressPercent = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    return {
      correctCount,
      incorrectCount,
      pendingCount,
      completedCount,
      total,
      progressPercent,
    };
  }, [entries, wordStates]);

  // 4. Estados de selección navegable para la revisión docente
  const [selectedEntry, setSelectedEntry] = useState<StudentCrosswordLayoutEntry | null>(() => {
    return entries.length > 0 ? (entries[0] as unknown as StudentCrosswordLayoutEntry) : null;
  });

  const [direction, setDirection] = useState<'ACROSS' | 'DOWN'>(() => {
    return entries.length > 0 ? entries[0].direction : 'ACROSS';
  });

  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(() => {
    if (entries.length > 0) {
      return { row: entries[0].startRow, col: entries[0].startCol };
    }
    return null;
  });

  const activeEntry = selectedEntry || (entries.length > 0 ? (entries[0] as unknown as StudentCrosswordLayoutEntry) : null);
  const activeAQ = useMemo(() => {
    if (!activeEntry || !assessment.questions) return null;
    return (assessment.questions as unknown as AssessmentQuestionDTO[]).find(
      (aq) => aq.questionId === activeEntry.questionId || aq.question?.id === activeEntry.questionId
    );
  }, [activeEntry, assessment.questions]);

  const activeTypedWord = activeEntry ? deriveWordText(cellAnswers, activeEntry) : '';
  const activeTypedLen = activeTypedWord.length;
  const activeTotalLen = activeEntry ? activeEntry.length : 0;
  const activeStatus = activeEntry
    ? wordStates[`${activeEntry.number}-${activeEntry.direction}`] || 'PENDING'
    : 'PENDING';

  // Manejo de clic en celda de la grilla para inspección docente (Sin edición)
  const handleCellClick = useCallback(
    (row: number, col: number) => {
      const cellEntries = findEntriesForCell(row, col, entries);
      if (cellEntries.length === 0) return;

      const isSameCell = selectedCell?.row === row && selectedCell?.col === col;

      if (isSameCell && cellEntries.length > 1) {
        const newDir = direction === 'ACROSS' ? 'DOWN' : 'ACROSS';
        const matchingEntry = cellEntries.find((e) => e.direction === newDir) || cellEntries[0];
        setDirection(newDir);
        setSelectedEntry(matchingEntry as unknown as StudentCrosswordLayoutEntry);
      } else {
        const matchingEntry = cellEntries.find((e) => e.direction === direction) || cellEntries[0];
        setDirection(matchingEntry.direction);
        setSelectedEntry(matchingEntry as unknown as StudentCrosswordLayoutEntry);
        setSelectedCell({ row, col });
      }
    },
    [direction, entries, selectedCell]
  );

  // Manejo de selección desde la lista de pistas
  const handleSelectEntry = useCallback((entry: CrosswordLayoutEntry) => {
    const studentEntry = entry as unknown as StudentCrosswordLayoutEntry;
    setSelectedEntry(studentEntry);
    setDirection(studentEntry.direction);
    setSelectedCell({ row: studentEntry.startRow, col: studentEntry.startCol });
  }, []);

  if (!layout || !layout.gridSize || !entries || entries.length === 0) {
    return (
      <div className="card-container" style={{ padding: '32px', textAlign: 'center', margin: '20px 0', borderRadius: '12px' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚠️</div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
          Crucigrama no disponible
        </h3>
        <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>
          Este intento no contiene un crucigrama configurado para revisión.
        </p>
      </div>
    );
  }

  return (
    <div className="crossword-attempt-review-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* 1. Tarjeta de Resumen del Crucigrama */}
      <div
        className="crossword-review-summary-card"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
              Crucigrama
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0284c7' }}>
              {progressStats.total} palabras ({progressStats.completedCount} respondidas)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', fontWeight: 700 }}>
            <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '4px 12px', borderRadius: '8px' }}>
              {progressStats.correctCount} correctas
            </span>
            <span style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '4px 12px', borderRadius: '8px' }}>
              {progressStats.incorrectCount} incorrectas
            </span>
            <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '4px 12px', borderRadius: '8px' }}>
              {progressStats.pendingCount} pendientes
            </span>
          </div>
        </div>

        {/* Visual Progress Bar fill */}
        <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${progressStats.progressPercent}%`,
              height: '100%',
              backgroundColor: progressStats.incorrectCount > 0 ? '#f59e0b' : '#10b981',
              borderRadius: '4px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* 2. Grid Principal de Revisión Docente: 2 columnas en Desktop */}
      <div
        className="crossword-review-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* Columna Izquierda: Grilla interactiva del crucigrama (READ-ONLY) */}
        <div
          className="crossword-grid-wrapper"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          {activeEntry && (
            <div
              className="active-clue-card"
              style={{
                marginBottom: '16px',
                padding: '14px 16px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#0284c7',
                    backgroundColor: '#e0f2fe',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  PISTA {activeEntry.number} · {activeEntry.direction === 'ACROSS' ? 'Horizontal' : 'Vertical'}
                </span>

                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>
                  {activeAQ?.points ?? 10} pts
                </span>
              </div>

              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a', marginBottom: '10px', lineHeight: 1.4 }}>
                <MarkdownContent content={activeAQ?.question?.statement || 'Selecciona una casilla del crucigrama'} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                  {activeTypedLen} / {activeTotalLen} letras escritas
                </span>

                <div>
                  {activeStatus === 'CORRECT' && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d', backgroundColor: '#dcfce7', border: '1px solid #86efac', padding: '2px 8px', borderRadius: '6px' }}>
                      Correcto
                    </span>
                  )}
                  {activeStatus === 'INCORRECT' && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b91c1c', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', padding: '2px 8px', borderRadius: '6px' }}>
                      Incorrecto
                    </span>
                  )}
                  {activeStatus === 'PENDING' && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: '6px' }}>
                      Sin completar
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <CrosswordGrid
            gridSize={layout.gridSize}
            entries={entries as CrosswordLayoutEntry[]}
            cellAnswers={cellAnswers}
            wordStates={wordStates}
            selectedCell={selectedCell}
            selectedEntry={selectedEntry as unknown as CrosswordLayoutEntry}
            showAnswerKey={false}
            onCellClick={handleCellClick}
            readOnly={true}
          />
        </div>

        {/* Columna Derecha: Lista de Pistas y Respuestas del Estudiante */}
        <div
          className="crossword-clues-wrapper-card"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <CrosswordCluesList
            questions={assessment.questions as unknown as AssessmentQuestionDTO[]}
            entries={entries as CrosswordLayoutEntry[]}
            wordStates={wordStates}
            selectedEntryNumber={selectedEntry?.number}
            selectedDirection={direction}
            onSelectEntry={handleSelectEntry}
            cellAnswers={cellAnswers}
            showAnswerKey={false}
          />
        </div>
      </div>
    </div>
  );
};
