import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AssessmentServiceAPI } from '../services/assessment.service.js';
import { AttemptDTO, SaveAnswerInput, StudentAssessmentQuestionDTO } from '../types/assessment.js';
import { ApiError } from '../services/api.js';
import { ExamTimer } from '../components/assessment/ExamTimer.js';
import { QuestionNavigator } from '../components/assessment/QuestionNavigator.js';
import { SaveStatusIndicator, SaveState } from '../components/assessment/SaveStatusIndicator.js';
import { SubmitConfirmModal } from '../components/assessment/SubmitConfirmModal.js';
import { AbandonConfirmModal } from '../components/assessment/AbandonConfirmModal.js';
import { MarkdownContent } from '../components/MarkdownContent.js';
import { PageLoading } from '../components/common/loading/index.js';
import { CrosswordStudentAssessment } from '../components/assessments/CrosswordStudentAssessment.js';

interface LocalAnswerState {
  optionIds: string[];
  numericValue: number | null;
  textValue: string | null;
}

export const ExamTakePage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState<AttemptDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answersMap, setAnswersMap] = useState<Record<string, LocalAnswerState>>({});
  const [saveStatusMap, setSaveStatusMap] = useState<Record<string, SaveState>>({});

  const [submitModalOpen, setSubmitModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isTimeExpired, setIsTimeExpired] = useState<boolean>(false);

  // Estados para Modal de Abandono de Intento
  const [abandonModalOpen, setAbandonModalOpen] = useState<boolean>(false);
  const [isAbandoning, setIsAbandoning] = useState<boolean>(false);
  const [abandonError, setAbandonError] = useState<string | null>(null);
  const [pendingLeaveDetails, setPendingLeaveDetails] = useState<{ targetPath: string; isLogout?: boolean } | null>(null);

  // Debounce timers por pregunta: questionId -> Timer
  const debounceTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const latestAnswersMapRef = useRef<Record<string, LocalAnswerState>>({});
  const flushCrosswordRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    latestAnswersMapRef.current = answersMap;
  }, [answersMap]);

  // 1. Advertencia beforeunload del navegador
  useEffect(() => {
    if (!attempt || attempt.status !== 'IN_PROGRESS' || isSubmitting || isAbandoning) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [attempt, isSubmitting, isAbandoning]);

  // 2. Escuchar evento de intento de salida de la navegación principal (AppLayout)
  useEffect(() => {
    if (!attempt || attempt.status !== 'IN_PROGRESS') return;

    const handleLeaveRequest = (e: Event) => {
      const customEv = e as CustomEvent<{ targetPath: string; isLogout?: boolean }>;
      if (customEv.detail) {
        setPendingLeaveDetails({
          targetPath: customEv.detail.targetPath,
          isLogout: customEv.detail.isLogout,
        });
        setAbandonError(null);
        setAbandonModalOpen(true);
      }
    };

    window.addEventListener('exam-attempt-leave-request', handleLeaveRequest);
    return () => {
      window.removeEventListener('exam-attempt-leave-request', handleLeaveRequest);
    };
  }, [attempt]);

  // Cargar intento inicial / refresh recovery (F5)
  useEffect(() => {
    if (!attemptId) return;

    const debounceTimers = debounceTimersRef.current;
    let isMounted = true;
    setLoading(true);

    AssessmentServiceAPI.getAttempt(attemptId)
      .then((data) => {
        if (!isMounted) return;

        if (data.status !== 'IN_PROGRESS') {
          navigate(`/app/attempts/${attemptId}/result`, { replace: true });
          return;
        }

        setAttempt(data);

        // Mapear respuestas guardadas previamente en la BD
        const initialAnswers: Record<string, LocalAnswerState> = {};
        const initialStatuses: Record<string, SaveState> = {};

        if (data.answers) {
          data.answers.forEach((ans) => {
            initialAnswers[ans.questionId] = {
              optionIds: ans.optionIds || [],
              numericValue: ans.numericValue,
              textValue: ans.textValue,
            };
            initialStatuses[ans.questionId] = 'SAVED';
          });
        }

        setAnswersMap(initialAnswers);
        setSaveStatusMap(initialStatuses);
        setError(null);
      })
      .catch((err: unknown) => {
        if (isMounted) {
          if (err instanceof ApiError) {
            setError(err.message);
          } else {
            setError('Error al recuperar el intento del examen');
          }
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
      // Limpiar timers de debounce pendientes al desmontar
      Object.values(debounceTimers).forEach(clearTimeout);
    };
  }, [attemptId, navigate]);

  // Función núcleo de persistencia en backend
  const executeSaveAnswer = useCallback(
    async (qId: string, stateToSave: LocalAnswerState) => {
      if (!attemptId) return;

      setSaveStatusMap((prev) => ({ ...prev, [qId]: 'SAVING' }));

      const payload: SaveAnswerInput = {
        optionIds: stateToSave.optionIds,
        numericValue: stateToSave.numericValue,
        textValue: stateToSave.textValue,
      };

      try {
        await AssessmentServiceAPI.saveAnswer(attemptId, qId, payload);
        setSaveStatusMap((prev) => ({ ...prev, [qId]: 'SAVED' }));
      } catch (err: unknown) {
        setSaveStatusMap((prev) => ({ ...prev, [qId]: 'ERROR' }));
        if (err instanceof ApiError && (err.code === 'ATTEMPT_NOT_IN_PROGRESS' || err.code === 'ATTEMPT_EXPIRED')) {
          setIsTimeExpired(true);
          navigate(`/app/attempts/${attemptId}/result`, { replace: true });
        }
      }
    },
    [attemptId, navigate]
  );

  // Programar autosave con debounce para NUMERIC / OPEN_TEXT
  const scheduleDebouncedSave = useCallback(
    (qId: string, newState: LocalAnswerState) => {
      if (debounceTimersRef.current[qId]) {
        clearTimeout(debounceTimersRef.current[qId]);
      }

      debounceTimersRef.current[qId] = setTimeout(() => {
        executeSaveAnswer(qId, newState);
      }, 1000);
    },
    [executeSaveAnswer]
  );

  // Manejadores de cambios por tipo de pregunta
  const handleOptionToggleSingle = (qId: string, optionId: string) => {
    if (isTimeExpired || isSubmitting) return;

    const newState: LocalAnswerState = {
      optionIds: [optionId],
      numericValue: null,
      textValue: null,
    };

    setAnswersMap((prev) => ({ ...prev, [qId]: newState }));
    executeSaveAnswer(qId, newState);
  };

  const handleOptionToggleMultiple = (qId: string, optionId: string) => {
    if (isTimeExpired || isSubmitting) return;

    const currentOptionIds = answersMap[qId]?.optionIds || [];
    const exists = currentOptionIds.includes(optionId);
    const newOptionIds = exists
      ? currentOptionIds.filter((id) => id !== optionId)
      : [...currentOptionIds, optionId];

    const newState: LocalAnswerState = {
      optionIds: newOptionIds,
      numericValue: null,
      textValue: null,
    };

    setAnswersMap((prev) => ({ ...prev, [qId]: newState }));
    executeSaveAnswer(qId, newState);
  };

  const handleNumericChange = (qId: string, valStr: string) => {
    if (isTimeExpired || isSubmitting) return;

    let numVal: number | null = null;
    if (valStr.trim() !== '') {
      const parsed = parseFloat(valStr);
      if (!isNaN(parsed) && isFinite(parsed)) {
        numVal = parsed;
      }
    }

    const newState: LocalAnswerState = {
      optionIds: [],
      numericValue: numVal,
      textValue: null,
    };

    setAnswersMap((prev) => ({ ...prev, [qId]: newState }));
    scheduleDebouncedSave(qId, newState);
  };

  const handleTextChange = (qId: string, text: string) => {
    if (isTimeExpired || isSubmitting) return;

    const newState: LocalAnswerState = {
      optionIds: [],
      numericValue: null,
      textValue: text,
    };

    setAnswersMap((prev) => ({ ...prev, [qId]: newState }));
    scheduleDebouncedSave(qId, newState);
  };

  // Flush inmediato de debounce al cambiar de pregunta
  const handleSelectQuestion = (newIndex: number) => {
    if (!questions || questions.length === 0) return;
    const currentQId = questions[currentIndex]?.questionId;

    if (currentQId && debounceTimersRef.current[currentQId]) {
      clearTimeout(debounceTimersRef.current[currentQId]);
      delete debounceTimersRef.current[currentQId];
      const latestState = latestAnswersMapRef.current[currentQId];
      if (latestState) {
        executeSaveAnswer(currentQId, latestState);
      }
    }

    setCurrentIndex(newIndex);
  };

  // Envío final (Submit)
  const handleConfirmSubmit = useCallback(async () => {
    if (!attemptId || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitModalOpen(false);

    // Flush de cualquier debounce de examen estándar
    Object.entries(debounceTimersRef.current).forEach(([qId, timer]) => {
      clearTimeout(timer);
      const stateToSave = latestAnswersMapRef.current[qId];
      if (stateToSave) {
        executeSaveAnswer(qId, stateToSave);
      }
    });

    // Flush de cualquier respuesta de crucigrama pendiente
    if (flushCrosswordRef.current) {
      await flushCrosswordRef.current();
    }

    try {
      await AssessmentServiceAPI.submitAttempt(attemptId);
      navigate(`/app/attempts/${attemptId}/result`, { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.code === 'ATTEMPT_EXPIRED' || err.code === 'ATTEMPT_NOT_IN_PROGRESS') {
          navigate(`/app/attempts/${attemptId}/result`, { replace: true });
          return;
        }
        setError(err.message);
      } else {
        setError('Error al entregar la evaluación');
      }
      setIsSubmitting(false);
    }
  }, [attemptId, executeSaveAnswer, isSubmitting, navigate]);

  // Expiración automática por temporizador
  const handleTimeExpired = useCallback(() => {
    if (isTimeExpired) return;

    setIsTimeExpired(true);
    // Intentar entrega automática inmediata
    handleConfirmSubmit();
  }, [handleConfirmSubmit, isTimeExpired]);

  // Abandono voluntario de intento
  const handleConfirmAbandon = useCallback(async () => {
    if (!attemptId || isAbandoning) return;

    setIsAbandoning(true);
    setAbandonError(null);

    // Flush de cualquier debounce de examen estándar
    Object.entries(debounceTimersRef.current).forEach(([qId, timer]) => {
      clearTimeout(timer);
      const stateToSave = latestAnswersMapRef.current[qId];
      if (stateToSave) {
        executeSaveAnswer(qId, stateToSave);
      }
    });

    // Flush de cualquier respuesta de crucigrama pendiente
    if (flushCrosswordRef.current) {
      await flushCrosswordRef.current();
    }

    try {
      await AssessmentServiceAPI.abandonAttempt(attemptId);
      setAbandonModalOpen(false);

      if (pendingLeaveDetails?.isLogout) {
        navigate('/login', { replace: true });
      } else if (pendingLeaveDetails?.targetPath) {
        navigate(pendingLeaveDetails.targetPath, { replace: true });
      } else {
        navigate(`/app/attempts/${attemptId}/result`, { replace: true });
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setAbandonError(err.message);
      } else {
        setAbandonError('Error al abandonar el intento');
      }
      setIsAbandoning(false);
    }
  }, [attemptId, executeSaveAnswer, isAbandoning, navigate, pendingLeaveDetails]);

  // Sincronización de respuestas de crucigrama desde CrosswordStudentAssessment hacia el padre
  const handleCrosswordAnswerChange = useCallback((qId: string, textValue: string) => {
    setAnswersMap((prev) => ({
      ...prev,
      [qId]: {
        optionIds: prev[qId]?.optionIds || [],
        numericValue: prev[qId]?.numericValue ?? null,
        textValue: textValue,
      },
    }));
  }, []);

  if (loading) {
    return <PageLoading title="Cargando examen..." />;
  }

  if (error || !attempt || !attempt.assessment) {
    return (
      <div className="error-container">
        <div className="alert alert-error">{error || 'Intento no disponible'}</div>
      </div>
    );
  }

  const questions: StudentAssessmentQuestionDTO[] = attempt.assessment.questions || [];
  const currentAq = questions[currentIndex];
  const totalQuestions = questions.length;
  const currentQ = currentAq?.question;
  const currentQId = currentAq?.questionId;

  // Mapa de preguntas respondidas
  const answeredMap: Record<string, boolean> = {};
  questions.forEach((aq) => {
    const ans = answersMap[aq.questionId];
    if (ans) {
      const hasOpts = ans.optionIds && ans.optionIds.length > 0;
      const hasNum = ans.numericValue !== null && ans.numericValue !== undefined;
      const hasText = ans.textValue !== null && ans.textValue.trim() !== '';
      answeredMap[aq.questionId] = hasOpts || hasNum || hasText;
    } else {
      answeredMap[aq.questionId] = false;
    }
  });

  const unansweredCount = questions.filter((aq) => !answeredMap[aq.questionId]).length;

  return (
    <div className="exam-take-page">
      {/* Header Hero de Evaluación */}
      <header className="exam-header-card">
        <div className="exam-header-left">
          <div className="exam-header-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
              <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
            </svg>
          </div>
          <div>
            <div className="exam-title-badge-group">
              <h1 className="exam-header-title">{attempt.assessment.title}</h1>
              <span className="attempt-badge">Intento #{attempt.attemptNumber}</span>
            </div>
            <p className="exam-header-subtitle">
              {attempt.assessment.description || 'Responde las preguntas y envía tu evaluación antes de terminar el tiempo.'}
            </p>
          </div>
        </div>

        <div className="exam-header-actions">
          <SaveStatusIndicator
            status={saveStatusMap[currentQId] || 'IDLE'}
            onRetry={() => {
              const st = answersMap[currentQId];
              if (st) executeSaveAnswer(currentQId, st);
            }}
          />

          <ExamTimer
            startedAt={attempt.startedAt}
            timeLimitMinutes={attempt.assessment.timeLimitMinutes}
            onTimeExpired={handleTimeExpired}
          />
        </div>
      </header>

      {/* Banner de Expiración */}
      {isTimeExpired && (
        <div className="alert alert-warning expiration-banner" role="alert" style={{ borderRadius: '12px', margin: '0' }}>
          ⏱️ El tiempo de la evaluación ha finalizado. Procesando entrega...
        </div>
      )}

      {/* Renderizado de Evaluación según tipo */}
      {attempt.assessment.type === 'CROSSWORD' ? (
        <div style={{ marginTop: '20px' }}>
          <CrosswordStudentAssessment
            assessment={attempt.assessment}
            attempt={attempt}
            isTimeExpired={isTimeExpired}
            isSubmitting={isSubmitting}
            onConfirmSubmit={() => setSubmitModalOpen(true)}
            onRegisterFlush={(flushFn) => {
              flushCrosswordRef.current = flushFn;
            }}
            onAnswerChange={handleCrosswordAnswerChange}
          />
        </div>
      ) : (
        /* Cuerpo Principal: Grid de 2 columnas */
        <div className="exam-body-grid">
          <aside className="exam-sidebar">
            <QuestionNavigator
              totalQuestions={totalQuestions}
              currentIndex={currentIndex}
              answeredMap={answeredMap}
              questionIds={questions.map((q) => q.questionId)}
              onSelectQuestion={handleSelectQuestion}
            />
          </aside>

          <main className="exam-question-area">
            {currentAq && currentQ && (
              <div className="exam-question-card">
                <div className="question-card-header">
                  <span className="question-number-tag">
                    Pregunta {currentIndex + 1} de {totalQuestions}
                  </span>
                  <span className="question-points-tag">{currentAq.points} pts</span>
                </div>

                <div className="question-statement-text">
                  <MarkdownContent content={currentQ.statement} />
                </div>

                <div className="question-input-zone">
                  {/* OPCIÓN ÚNICA (MC / TRUE_FALSE) */}
                  {(currentQ.type === 'MULTIPLE_CHOICE' || currentQ.type === 'TRUE_FALSE') && (
                    <div className="exam-options-list" role="radiogroup" aria-label="Opciones de respuesta">
                      {currentQ.options?.map((opt) => {
                        const isChecked = (answersMap[currentQId]?.optionIds || []).includes(opt.id);
                        return (
                          <label
                            key={opt.id}
                            className={`exam-option-card ${isChecked ? 'selected' : ''}`}
                          >
                            <input
                              type="radio"
                              name={`q_${currentQId}`}
                              value={opt.id}
                              className="exam-option-input"
                              checked={isChecked}
                              onChange={() => handleOptionToggleSingle(currentQId, opt.id)}
                              disabled={isTimeExpired || isSubmitting}
                            />
                            <span className="exam-option-text">{opt.text}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* SELECCIÓN MÚLTIPLE (MS) */}
                  {currentQ.type === 'MULTIPLE_SELECT' && (
                    <div className="exam-options-list" role="group" aria-label="Selecciona una o más opciones">
                      {currentQ.options?.map((opt) => {
                        const isChecked = (answersMap[currentQId]?.optionIds || []).includes(opt.id);
                        return (
                          <label
                            key={opt.id}
                            className={`exam-option-card ${isChecked ? 'selected' : ''}`}
                          >
                            <input
                              type="checkbox"
                              value={opt.id}
                              className="exam-option-input"
                              checked={isChecked}
                              onChange={() => handleOptionToggleMultiple(currentQId, opt.id)}
                              disabled={isTimeExpired || isSubmitting}
                            />
                            <span className="exam-option-text">{opt.text}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* RESPUESTA NUMÉRICA */}
                  {currentQ.type === 'NUMERIC' && (
                    <div className="exam-input-container">
                      <label htmlFor={`num_${currentQId}`} className="exam-input-label">
                        Introduce tu respuesta numérica:
                      </label>
                      <input
                        id={`num_${currentQId}`}
                        type="number"
                        step="any"
                        className="assessment-edit-input"
                        value={answersMap[currentQId]?.numericValue ?? ''}
                        onChange={(e) => handleNumericChange(currentQId, e.target.value)}
                        disabled={isTimeExpired || isSubmitting}
                        placeholder="Ej. 42.5"
                      />
                    </div>
                  )}

                  {/* RESPUESTA ABIERTA (OPEN_TEXT) */}
                  {currentQ.type === 'OPEN_TEXT' && (
                    <div className="exam-input-container">
                      <label htmlFor={`text_${currentQId}`} className="exam-input-label">
                        Redacta tu respuesta:
                      </label>
                      <textarea
                        id={`text_${currentQId}`}
                        rows={6}
                        maxLength={50000}
                        className="assessment-edit-textarea"
                        value={answersMap[currentQId]?.textValue ?? ''}
                        onChange={(e) => handleTextChange(currentQId, e.target.value)}
                        disabled={isTimeExpired || isSubmitting}
                        placeholder="Escribe tu respuesta aquí (máx. 50,000 caracteres)..."
                      />
                      <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'right', marginTop: '4px' }}>
                        {(answersMap[currentQId]?.textValue || '').length} / 50,000 caracteres
                      </div>
                    </div>
                  )}
                </div>

                {/* Botones de Navegación Inferior */}
                <div className="question-card-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleSelectQuestion(currentIndex - 1)}
                    disabled={currentIndex === 0}
                  >
                    ← Anterior
                  </button>

                  {currentIndex < totalQuestions - 1 ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleSelectQuestion(currentIndex + 1)}
                    >
                      Siguiente →
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-success btn-submit-exam-final"
                      onClick={() => setSubmitModalOpen(true)}
                      disabled={isSubmitting || isTimeExpired}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      <span>Finalizar y entregar</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {/* Modal de Confirmación de Entrega */}
      <SubmitConfirmModal
        isOpen={submitModalOpen}
        unansweredCount={unansweredCount}
        totalQuestions={totalQuestions}
        isSubmitting={isSubmitting}
        error={error}
        onConfirm={handleConfirmSubmit}
        onCancel={() => setSubmitModalOpen(false)}
      />

      {/* Modal de Confirmación de Abandono */}
      <AbandonConfirmModal
        isOpen={abandonModalOpen}
        isAbandoning={isAbandoning}
        errorMessage={abandonError}
        onConfirm={handleConfirmAbandon}
        onCancel={() => {
          setAbandonModalOpen(false);
          setPendingLeaveDetails(null);
          setAbandonError(null);
        }}
      />
    </div>
  );
};
