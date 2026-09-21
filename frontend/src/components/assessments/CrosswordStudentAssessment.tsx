import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StudentAssessmentDTO,
  AttemptDTO,
  StudentCrosswordLayoutEntry,
  CrosswordLayoutEntry,
  AssessmentQuestionDTO,
  SaveAnswerInput,
} from '../../types/assessment.js';
import { CrosswordGrid } from './CrosswordGrid.js';
import { CrosswordCluesList } from './CrosswordCluesList.js';
import {
  reconstructCellAnswers,
  findEntriesForCell,
  isCellInEntry,
  deriveWordText,
  deriveAllWordAnswers,
} from '../../utils/crossword-student.util.js';
import { WordValidationStatus } from '../../utils/crossword-validation.util.js';
import { AssessmentServiceAPI } from '../../services/assessment.service.js';
import { SaveStatusIndicator, SaveState } from '../assessment/SaveStatusIndicator.js';

export interface CrosswordStudentAssessmentProps {
  assessment: StudentAssessmentDTO;
  attempt: AttemptDTO;
  isTimeExpired?: boolean;
  isSubmitting?: boolean;
  onConfirmSubmit?: () => void;
  onRegisterFlush?: (flushFn: () => Promise<void>) => void;
  onAnswerChange?: (questionId: string, textValue: string) => void;
}

export const CrosswordStudentAssessment: React.FC<CrosswordStudentAssessmentProps> = ({
  assessment,
  attempt,
  isTimeExpired = false,
  isSubmitting = false,
  onConfirmSubmit,
  onRegisterFlush,
  onAnswerChange,
}) => {
  const layout = assessment.crosswordLayout;
  const entries = useMemo(() => layout?.entries || [], [layout]);

  // 1. Estado local de respuestas por celda (cellAnswers)
  const [cellAnswers, setCellAnswers] = useState<Record<string, string>>(() => {
    return reconstructCellAnswers(attempt.answers, layout).cellAnswers;
  });

  // Ref a cellAnswers para derivación siempre actualizada en callbacks asíncronos/flush
  const cellAnswersRef = useRef<Record<string, string>>(cellAnswers);
  useEffect(() => {
    cellAnswersRef.current = cellAnswers;
  }, [cellAnswers]);

  // 3. Control de Feedback interactivo server-side (wordStates)
  const [wordStates, setWordStates] = useState<Record<string, WordValidationStatus>>({});
  const checkDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerInteractiveValidation = useCallback(async () => {
    if (!attempt.id || entries.length === 0) return;

    try {
      const allWords = deriveAllWordAnswers(cellAnswersRef.current, entries);
      const answersPayload = Object.entries(allWords).map(([questionId, textValue]) => ({
        questionId,
        textValue,
      }));

      const validationMap = await AssessmentServiceAPI.checkCrosswordValidation(
        attempt.id,
        answersPayload
      );

      const newWordStates: Record<string, WordValidationStatus> = {};
      entries.forEach((entry) => {
        const status = validationMap[entry.questionId] || 'PENDING';
        newWordStates[`${entry.number}-${entry.direction}`] = status as WordValidationStatus;
      });

      setWordStates(newWordStates);
    } catch (err: unknown) {
      // Si la validación interactiva falla por red, la UI permanece en PENDING sin interrumpir al alumno
    }
  }, [attempt.id, entries]);

  // Reconstrucción inicial / recovery al cargar el Attempt (se ejecuta 1 sola vez por attempt.id)
  const rehydratedAttemptIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (attempt.id && rehydratedAttemptIdRef.current !== attempt.id) {
      rehydratedAttemptIdRef.current = attempt.id;
      const report = reconstructCellAnswers(attempt.answers, layout);
      setCellAnswers(report.cellAnswers);
      cellAnswersRef.current = report.cellAnswers;

      if (onAnswerChange && entries.length > 0) {
        entries.forEach((entry) => {
          const wordText = deriveWordText(report.cellAnswers, entry);
          if (wordText) {
            onAnswerChange(entry.questionId, wordText);
          }
        });
      }

      if (Object.keys(report.cellAnswers).length > 0) {
        triggerInteractiveValidation();
      }
    }
  }, [attempt.id, attempt.answers, layout, entries, onAnswerChange, triggerInteractiveValidation]);

  // 2. Control de persistencia y estado DIRTY
  const dirtyQuestionIdsRef = useRef<Set<string>>(new Set());
  const debounceTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [saveStatusMap, setSaveStatusMap] = useState<Record<string, SaveState>>({});

  const scheduleInteractiveValidation = useCallback(
    (affectedEntries: StudentCrosswordLayoutEntry[]) => {
      // Resetear a PENDING las pistas afectadas por modificación activa de celda
      setWordStates((prev) => {
        const next = { ...prev };
        affectedEntries.forEach((e) => {
          next[`${e.number}-${e.direction}`] = 'PENDING';
        });
        return next;
      });

      if (checkDebounceTimerRef.current) {
        clearTimeout(checkDebounceTimerRef.current);
      }

      // Si alguna de las palabras afectadas está completa, validar de inmediato; si no, tras 300ms de tipeo
      const hasCompleteAffected = affectedEntries.some((e) => {
        const typed = deriveWordText(cellAnswersRef.current, e);
        return typed.length === e.length;
      });

      if (hasCompleteAffected) {
        triggerInteractiveValidation();
      } else {
        checkDebounceTimerRef.current = setTimeout(() => {
          triggerInteractiveValidation();
        }, 300);
      }
    },
    [triggerInteractiveValidation]
  );

  // Ejecución de guardado por pregunta (questionId) hacia la API
  const executeSaveQuestion = useCallback(
    async (qId: string, entry: StudentCrosswordLayoutEntry) => {
      if (!attempt.id) return;

      setSaveStatusMap((prev) => ({ ...prev, [qId]: 'SAVING' }));
      const wordText = deriveWordText(cellAnswersRef.current, entry);

      if (onAnswerChange) {
        onAnswerChange(qId, wordText);
      }

      const payload: SaveAnswerInput = {
        textValue: wordText,
      };

      try {
        await AssessmentServiceAPI.saveAnswer(attempt.id, qId, payload);
        dirtyQuestionIdsRef.current.delete(qId);
        if (debounceTimersRef.current[qId]) {
          delete debounceTimersRef.current[qId];
        }
        setSaveStatusMap((prev) => ({ ...prev, [qId]: 'SAVED' }));
        // Sincronizar estado de validación tras persistencia exitosa
        triggerInteractiveValidation();
      } catch (err: unknown) {
        setSaveStatusMap((prev) => ({ ...prev, [qId]: 'ERROR' }));
      }
    },
    [attempt.id, onAnswerChange, triggerInteractiveValidation]
  );

  // Programar guardado debounced y validación interactiva para pistas afectadas
  const scheduleDebouncedSaveForEntries = useCallback(
    (affectedEntries: StudentCrosswordLayoutEntry[]) => {
      affectedEntries.forEach((entry) => {
        const qId = entry.questionId;
        dirtyQuestionIdsRef.current.add(qId);

        const wordText = deriveWordText(cellAnswersRef.current, entry);
        if (onAnswerChange) {
          onAnswerChange(qId, wordText);
        }

        if (debounceTimersRef.current[qId]) {
          clearTimeout(debounceTimersRef.current[qId]);
        }

        debounceTimersRef.current[qId] = setTimeout(() => {
          executeSaveQuestion(qId, entry);
        }, 1000);
      });

      scheduleInteractiveValidation(affectedEntries);
    },
    [executeSaveQuestion, onAnswerChange, scheduleInteractiveValidation]
  );

  // Función de Flush para forzar guardado inmediato de todas las preguntas pendientes/dirty
  const flushPendingAnswers = useCallback(async () => {
    if (!attempt.id) return;

    // 1. Cancelar cualquier timer de debounce activo
    Object.entries(debounceTimersRef.current).forEach(([qId, timer]) => {
      clearTimeout(timer);
      delete debounceTimersRef.current[qId];
    });

    if (checkDebounceTimerRef.current) {
      clearTimeout(checkDebounceTimerRef.current);
    }

    // 2. Obtener todas las preguntas marcadas como dirty
    const dirtyIds = Array.from(dirtyQuestionIdsRef.current);
    if (dirtyIds.length === 0) return;

    // 3. Derivar texto actualizado desde cellAnswersRef y enviar peticiones
    const promises = dirtyIds.map(async (qId) => {
      const entry = entries.find((e) => e.questionId === qId);
      if (!entry) return;

      setSaveStatusMap((prev) => ({ ...prev, [qId]: 'SAVING' }));
      const wordText = deriveWordText(cellAnswersRef.current, entry);

      try {
        await AssessmentServiceAPI.saveAnswer(attempt.id, qId, { textValue: wordText });
        dirtyQuestionIdsRef.current.delete(qId);
        setSaveStatusMap((prev) => ({ ...prev, [qId]: 'SAVED' }));
      } catch (err: unknown) {
        setSaveStatusMap((prev) => ({ ...prev, [qId]: 'ERROR' }));
      }
    });

    await Promise.all(promises);
    await triggerInteractiveValidation();
  }, [attempt.id, entries, triggerInteractiveValidation]);

  // Registrar callback de Flush en el contenedor padre
  useEffect(() => {
    if (onRegisterFlush) {
      onRegisterFlush(flushPendingAnswers);
    }
  }, [flushPendingAnswers, onRegisterFlush]);

  // Limpiar timers al desmontar el componente
  useEffect(() => {
    const timers = debounceTimersRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
      if (checkDebounceTimerRef.current) {
        clearTimeout(checkDebounceTimerRef.current);
      }
    };
  }, []);

  // 4. Estados visuales locales de interacción
  const [selectedEntry, setSelectedEntry] = useState<StudentCrosswordLayoutEntry | null>(() => {
    return entries.length > 0 ? entries[0] : null;
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

  const containerRef = useRef<HTMLDivElement>(null);

  // Asegurar selección inicial cuando los datos cargan
  useEffect(() => {
    if (entries.length > 0 && !selectedEntry) {
      setSelectedEntry(entries[0]);
      setDirection(entries[0].direction);
      setSelectedCell({ row: entries[0].startRow, col: entries[0].startCol });
    }
  }, [entries, selectedEntry]);

  // Resumen formativo no oficial de progreso (Sin score ni puntos)
  const progressStats = useMemo(() => {
    let correctCount = 0;
    let reviewCount = 0;
    let pendingCount = 0;

    entries.forEach((entry) => {
      const st = wordStates[`${entry.number}-${entry.direction}`] || 'PENDING';
      if (st === 'CORRECT') correctCount++;
      else if (st === 'INCORRECT') reviewCount++;
      else pendingCount++;
    });

    const total = entries.length;
    const completedCount = correctCount + reviewCount;
    const progressPercent = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    return {
      correctCount,
      reviewCount,
      pendingCount,
      completedCount,
      total,
      progressPercent,
    };
  }, [entries, wordStates]);

  // Información de la Pista Activa seleccionada para la tarjeta de cabecera
  const activeEntry = selectedEntry || entries[0] || null;
  const activeQuestionDTO = useMemo(() => {
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

  // Manejo de clic en celda de la grilla
  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (isTimeExpired || isSubmitting) return;

      const cellEntries = findEntriesForCell(row, col, entries);
      if (cellEntries.length === 0) return;

      const isSameCell = selectedCell?.row === row && selectedCell?.col === col;

      if (isSameCell && cellEntries.length > 1) {
        // Alternar dirección si es celda de intersección
        const newDir = direction === 'ACROSS' ? 'DOWN' : 'ACROSS';
        const matchingEntry = cellEntries.find((e) => e.direction === newDir) || cellEntries[0];
        setDirection(newDir);
        setSelectedEntry(matchingEntry);
      } else {
        // Seleccionar celda en la dirección actual si existe entrada, de lo contrario tomar la primera
        const matchingEntry = cellEntries.find((e) => e.direction === direction) || cellEntries[0];
        setDirection(matchingEntry.direction);
        setSelectedEntry(matchingEntry);
        setSelectedCell({ row, col });
      }

      if (containerRef.current) {
        containerRef.current.focus();
      }
    },
    [direction, entries, isSubmitting, isTimeExpired, selectedCell]
  );

  // Manejo de selección desde la lista de pistas
  const handleSelectEntry = useCallback((entry: CrosswordLayoutEntry) => {
    const studentEntry = entry as unknown as StudentCrosswordLayoutEntry;
    setSelectedEntry(studentEntry);
    setDirection(studentEntry.direction);
    setSelectedCell({ row: studentEntry.startRow, col: studentEntry.startCol });

    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, []);

  // Manejo de teclado (Navegación, Backspace, Escritura A-Z / Ñ)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTimeExpired || isSubmitting || !selectedCell || !selectedEntry) return;

      const { row, col } = selectedCell;

      // Navegación con Teclas de Dirección
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        let targetRow = row;
        let targetCol = col;

        if (e.key === 'ArrowUp') targetRow--;
        if (e.key === 'ArrowDown') targetRow++;
        if (e.key === 'ArrowLeft') targetCol--;
        if (e.key === 'ArrowRight') targetCol++;

        const targetEntries = findEntriesForCell(targetRow, targetCol, entries);
        if (targetEntries.length > 0) {
          setSelectedCell({ row: targetRow, col: targetCol });
          const matchingEntry = targetEntries.find((entry) => entry.direction === direction) || targetEntries[0];
          setSelectedEntry(matchingEntry);
          setDirection(matchingEntry.direction);
        }
        return;
      }

      // Alternar dirección con Enter o Espacio en celdas de intersección
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const cellEntries = findEntriesForCell(row, col, entries);
        if (cellEntries.length > 1) {
          const newDir = direction === 'ACROSS' ? 'DOWN' : 'ACROSS';
          const matchingEntry = cellEntries.find((entry) => entry.direction === newDir) || cellEntries[0];
          setDirection(newDir);
          setSelectedEntry(matchingEntry);
        }
        return;
      }

      // Borrar carácter con Backspace
      if (e.key === 'Backspace') {
        e.preventDefault();
        const cellKey = `${row}-${col}`;
        const affectedEntries = findEntriesForCell(row, col, entries);

        setCellAnswers((prev) => {
          const next = { ...prev };
          if (next[cellKey]) {
            delete next[cellKey];
            return next;
          }
          return prev;
        });

        if (affectedEntries.length > 0) {
          scheduleDebouncedSaveForEntries(affectedEntries);
        }

        // Retroceder foco si la celda actual ya estaba vacía
        if (!cellAnswers[cellKey]) {
          const prevRow = direction === 'DOWN' ? row - 1 : row;
          const prevCol = direction === 'ACROSS' ? col - 1 : col;

          if (isCellInEntry(prevRow, prevCol, selectedEntry)) {
            setSelectedCell({ row: prevRow, col: prevCol });
            const prevCellKey = `${prevRow}-${prevCol}`;
            const prevAffectedEntries = findEntriesForCell(prevRow, prevCol, entries);

            setCellAnswers((prev) => {
              const next = { ...prev };
              delete next[prevCellKey];
              return next;
            });

            if (prevAffectedEntries.length > 0) {
              scheduleDebouncedSaveForEntries(prevAffectedEntries);
            }
          }
        }
        return;
      }

      // Capturar letras A-Z, a-z, Ñ, ñ
      if (/^[a-zA-ZñÑ]$/.test(e.key)) {
        e.preventDefault();
        const upperChar = e.key.toUpperCase();
        const cellKey = `${row}-${col}`;
        const affectedEntries = findEntriesForCell(row, col, entries);

        setCellAnswers((prev) => ({
          ...prev,
          [cellKey]: upperChar,
        }));

        if (affectedEntries.length > 0) {
          scheduleDebouncedSaveForEntries(affectedEntries);
        }

        // Avanzar foco a la siguiente celda en la dirección activa
        const nextRow = direction === 'DOWN' ? row + 1 : row;
        const nextCol = direction === 'ACROSS' ? col + 1 : col;

        if (isCellInEntry(nextRow, nextCol, selectedEntry)) {
          setSelectedCell({ row: nextRow, col: nextCol });
        }
      }
    },
    [cellAnswers, direction, entries, isSubmitting, isTimeExpired, scheduleDebouncedSaveForEntries, selectedCell, selectedEntry]
  );

  // Determinar estado de guardado global para la cabecera del crucigrama
  const globalSaveStatus: SaveState = useMemo(() => {
    const statuses = Object.values(saveStatusMap);
    if (statuses.some((s) => s === 'SAVING') || dirtyQuestionIdsRef.current.size > 0) return 'SAVING';
    if (statuses.some((s) => s === 'ERROR')) return 'ERROR';
    if (statuses.some((s) => s === 'SAVED')) return 'SAVED';
    return 'IDLE';
  }, [saveStatusMap]);

  // Si no hay layout o está nulo, mostrar mensaje seguro de evaluación sin crucigrama
  if (!layout || !layout.gridSize || !entries || entries.length === 0) {
    return (
      <div className="card-container" style={{ padding: '32px', textAlign: 'center', margin: '20px 0', borderRadius: '12px' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚠️</div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
          Crucigrama no disponible
        </h3>
        <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>
          Esta evaluación no tiene un crucigrama configurado. Contacta a tu profesor.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="crossword-student-assessment-container"
      style={{
        outline: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        width: '100%',
      }}
    >
      {/* 1. Barra de Resumen Formativo de Progreso (Única cabecera superior de resumen) */}
      <div
        className="crossword-student-progress-bar-card"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '14px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Progreso del Crucigrama
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0284c7' }}>
              {progressStats.completedCount} de {progressStats.total} palabras completadas
            </span>
            <SaveStatusIndicator
              status={globalSaveStatus}
              onRetry={() => {
                flushPendingAnswers();
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', fontWeight: 700 }}>
            <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '3px 9px', borderRadius: '6px' }}>
              🟢 {progressStats.correctCount} correctas
            </span>
            <span style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '3px 9px', borderRadius: '6px' }}>
              🔴 {progressStats.reviewCount} por revisar
            </span>
            <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '3px 9px', borderRadius: '6px' }}>
              ⚪ {progressStats.pendingCount} pendientes
            </span>
          </div>
        </div>

        {/* Visual Progress Bar fill */}
        <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${progressStats.progressPercent}%`,
              height: '100%',
              backgroundColor: '#0284c7',
              borderRadius: '4px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* 3. Grid Principal: 2 columnas en Desktop */}
      <div
        className="crossword-student-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* Columna Izquierda: Grilla interactiva del crucigrama */}
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
          {/* Tarjeta de Pista Activa (remplaza la cabecera anterior) */}
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
                  {activeQuestionDTO?.points ?? 10} pts
                </span>
              </div>

              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a', marginBottom: '10px', lineHeight: 1.4 }}>
                {activeQuestionDTO?.question?.statement || 'Selecciona una casilla del crucigrama'}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                  {activeTypedLen} / {activeTotalLen} letras
                </span>

                <div>
                  {activeStatus === 'CORRECT' && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#15803d',
                        backgroundColor: '#dcfce7',
                        border: '1px solid #86efac',
                        padding: '2px 8px',
                        borderRadius: '6px',
                      }}
                    >
                      Correcto
                    </span>
                  )}
                  {activeStatus === 'INCORRECT' && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#b91c1c',
                        backgroundColor: '#fee2e2',
                        border: '1px solid #fca5a5',
                        padding: '2px 8px',
                        borderRadius: '6px',
                      }}
                    >
                      Revisar
                    </span>
                  )}
                  {activeStatus === 'PENDING' && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#64748b',
                        backgroundColor: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        padding: '2px 8px',
                        borderRadius: '6px',
                      }}
                    >
                      Pendiente
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
            selectedEntry={selectedEntry as CrosswordLayoutEntry}
            showAnswerKey={false}
            onCellClick={handleCellClick}
            readOnly={isTimeExpired || isSubmitting}
          />
        </div>

        {/* Columna Derecha: Pistas Horizontales y Verticales */}
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

          {/* Botón de Finalizar en la columna de pistas si aplica */}
          {onConfirmSubmit && (
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                className="btn btn-success btn-submit-exam-final"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => {
                  flushPendingAnswers().then(() => {
                    onConfirmSubmit();
                  });
                }}
                disabled={isSubmitting || isTimeExpired}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Finalizar y entregar</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
