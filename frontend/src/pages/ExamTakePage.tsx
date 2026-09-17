import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AssessmentServiceAPI } from '../services/assessment.service.js';
import { AttemptDTO, SaveAnswerInput, StudentAssessmentQuestionDTO } from '../types/assessment.js';
import { ApiError } from '../services/api.js';
import { ExamTimer } from '../components/assessment/ExamTimer.js';
import { QuestionNavigator } from '../components/assessment/QuestionNavigator.js';
import { SaveStatusIndicator, SaveState } from '../components/assessment/SaveStatusIndicator.js';
import { SubmitConfirmModal } from '../components/assessment/SubmitConfirmModal.js';
import { MarkdownContent } from '../components/MarkdownContent.js';

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

  // Debounce timers por pregunta: questionId -> Timer
  const debounceTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const latestAnswersMapRef = useRef<Record<string, LocalAnswerState>>({});

  useEffect(() => {
    latestAnswersMapRef.current = answersMap;
  }, [answersMap]);

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

    // Flush de cualquier debounce pendiente antes de enviar
    Object.entries(debounceTimersRef.current).forEach(([qId, timer]) => {
      clearTimeout(timer);
      const stateToSave = latestAnswersMapRef.current[qId];
      if (stateToSave) {
        executeSaveAnswer(qId, stateToSave);
      }
    });

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

  if (loading) {
    return (
      <div className="loading-container" id="exam-take-loading">
        <div className="loading-spinner" />
        <p>Cargando examen...</p>
      </div>
    );
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
      {/* Barra Superior del Examen */}
      <header className="exam-header">
        <div className="exam-header-info">
          <h1 className="exam-title">{attempt.assessment.title}</h1>
          <span className="attempt-badge">Intento #{attempt.attemptNumber}</span>
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

          <button
            type="button"
            className="btn btn-success btn-submit-exam"
            onClick={() => setSubmitModalOpen(true)}
            disabled={isSubmitting || isTimeExpired}
          >
            {isSubmitting ? 'Enviando...' : 'Entregar Evaluación'}
          </button>
        </div>
      </header>

      {/* Banner de Expiración */}
      {isTimeExpired && (
        <div className="alert alert-warning expiration-banner" role="alert">
          ⏱️ El tiempo de la evaluación ha finalizado. Procesando entrega...
        </div>
      )}

      {/* Cuerpo Principal: Navegación + Pregunta Actual */}
      <div className="exam-body">
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
            <div className="question-card">
              <div className="question-card-header">
                <span className="question-number">
                  Pregunta {currentIndex + 1} de {totalQuestions}
                </span>
                <span className="question-points">{currentAq.points} pts</span>
              </div>

              <div className="question-statement">
                <MarkdownContent content={currentQ.statement} />
              </div>

              <div className="question-input-zone">
                {/* OPCIÓN ÚNICA (MC / TRUE_FALSE) */}
                {(currentQ.type === 'MULTIPLE_CHOICE' || currentQ.type === 'TRUE_FALSE') && (
                  <div className="options-group" role="radiogroup" aria-label="Opciones de respuesta">
                    {currentQ.options?.map((opt) => {
                      const isChecked = (answersMap[currentQId]?.optionIds || []).includes(opt.id);
                      return (
                        <label
                          key={opt.id}
                          className={`option-card ${isChecked ? 'selected' : ''}`}
                        >
                          <input
                            type="radio"
                            name={`q_${currentQId}`}
                            value={opt.id}
                            checked={isChecked}
                            onChange={() => handleOptionToggleSingle(currentQId, opt.id)}
                            disabled={isTimeExpired || isSubmitting}
                          />
                          <span className="option-text">{opt.text}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* OPCIÓN MÚLTIPLE (MS) */}
                {currentQ.type === 'MULTIPLE_SELECT' && (
                  <div className="options-group" role="group" aria-label="Selecciona una o más opciones">
                    {currentQ.options?.map((opt) => {
                      const isChecked = (answersMap[currentQId]?.optionIds || []).includes(opt.id);
                      return (
                        <label
                          key={opt.id}
                          className={`option-card ${isChecked ? 'selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            value={opt.id}
                            checked={isChecked}
                            onChange={() => handleOptionToggleMultiple(currentQId, opt.id)}
                            disabled={isTimeExpired || isSubmitting}
                          />
                          <span className="option-text">{opt.text}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* RESPUESTA NUMÉRICA */}
                {currentQ.type === 'NUMERIC' && (
                  <div className="numeric-input-group">
                    <label htmlFor={`num_${currentQId}`} className="form-label">
                      Introduce tu respuesta numérica:
                    </label>
                    <input
                      id={`num_${currentQId}`}
                      type="number"
                      step="any"
                      className="form-control"
                      value={answersMap[currentQId]?.numericValue ?? ''}
                      onChange={(e) => handleNumericChange(currentQId, e.target.value)}
                      disabled={isTimeExpired || isSubmitting}
                      placeholder="Ej. 42.5"
                    />
                  </div>
                )}

                {/* RESPUESTA ABIERTA (OPEN_TEXT) */}
                {currentQ.type === 'OPEN_TEXT' && (
                  <div className="open-text-input-group">
                    <label htmlFor={`text_${currentQId}`} className="form-label">
                      Redacta tu respuesta:
                    </label>
                    <textarea
                      id={`text_${currentQId}`}
                      rows={8}
                      maxLength={50000}
                      className="form-control textarea-open-text"
                      value={answersMap[currentQId]?.textValue ?? ''}
                      onChange={(e) => handleTextChange(currentQId, e.target.value)}
                      disabled={isTimeExpired || isSubmitting}
                      placeholder="Escribe tu respuesta aquí (máx. 50,000 caracteres)..."
                    />
                    <div className="character-count">
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
                    className="btn btn-success"
                    onClick={() => setSubmitModalOpen(true)}
                    disabled={isSubmitting || isTimeExpired}
                  >
                    Finalizar y Entregar
                  </button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modal de Confirmación de Entrega */}
      <SubmitConfirmModal
        isOpen={submitModalOpen}
        unansweredCount={unansweredCount}
        totalQuestions={totalQuestions}
        isSubmitting={isSubmitting}
        onConfirm={handleConfirmSubmit}
        onCancel={() => setSubmitModalOpen(false)}
      />
    </div>
  );
};
