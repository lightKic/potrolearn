import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AssessmentServiceAPI } from '../services/assessment.service.js';
import { QuestionServiceAPI } from '../services/question.service.js';
import { StudentAssessmentDTO, AssessmentQuestionDTO } from '../types/assessment.js';
import { ApiError } from '../services/api.js';
import { PageLoading } from '../components/common/loading/index.js';
import { useAuth } from '../auth/useAuth.js';
import { QuestionNavigator } from '../components/assessment/QuestionNavigator.js';
import { MarkdownContent } from '../components/MarkdownContent.js';
import { CrosswordAssessmentPreview } from '../components/assessments/CrosswordAssessmentPreview.js';

interface LocalAnswerState {
  optionIds: string[];
  numericValue: number | null;
  textValue: string | null;
}

export const AssessmentPreviewPage: React.FC = () => {
  const { courseId, assessmentId } = useParams<{ courseId: string; assessmentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [assessment, setAssessment] = useState<StudentAssessmentDTO | null>(null);
  const [questions, setQuestions] = useState<AssessmentQuestionDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Estados locales de la simulación
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answersMap, setAnswersMap] = useState<Record<string, LocalAnswerState>>({});
  const [showAnswerKey, setShowAnswerKey] = useState<boolean>(false);
  const [isSimulatedFinished, setIsSimulatedFinished] = useState<boolean>(false);

  // Temporizador local (en memoria)
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isTimeExpired, setIsTimeExpired] = useState<boolean>(false);

  const isTeacherOrAdmin = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  // Guardia de autorización de rol
  useEffect(() => {
    if (user && !isTeacherOrAdmin) {
      navigate('/403', { replace: true });
    }
  }, [user, isTeacherOrAdmin, navigate]);

  // Carga inicial de datos administrativos (sin crear Attempt)
  useEffect(() => {
    if (!assessmentId) return;

    let isMounted = true;
    setLoading(true);

    Promise.all([
      AssessmentServiceAPI.getAssessmentDetail(assessmentId),
      QuestionServiceAPI.getQuestionsForAssessment(assessmentId),
    ])
      .then(([aData, qData]) => {
        if (!isMounted) return;
        setAssessment(aData);
        setQuestions(qData);
        setError(null);

        // Inicializar temporizador simulado en memoria
        if (aData.timeLimitMinutes && aData.timeLimitMinutes > 0) {
          setRemainingSeconds(aData.timeLimitMinutes * 60);
        } else {
          setRemainingSeconds(0);
        }
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Error al cargar la evaluación para vista previa');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [assessmentId]);

  // Cuenta regresiva local del temporizador simulado
  useEffect(() => {
    if (!assessment?.timeLimitMinutes || assessment.timeLimitMinutes <= 0 || isSimulatedFinished || isTimeExpired) {
      return;
    }

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsTimeExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [assessment?.timeLimitMinutes, isSimulatedFinished, isTimeExpired]);

  // Manejadores de entrada puramente locales (sin peticiones HTTP)
  const handleOptionToggleSingle = (qId: string, optionId: string) => {
    if (isTimeExpired || isSimulatedFinished) return;
    setAnswersMap((prev) => ({
      ...prev,
      [qId]: {
        optionIds: [optionId],
        numericValue: null,
        textValue: null,
      },
    }));
  };

  const handleOptionToggleMultiple = (qId: string, optionId: string) => {
    if (isTimeExpired || isSimulatedFinished) return;
    const currentOptionIds = answersMap[qId]?.optionIds || [];
    const exists = currentOptionIds.includes(optionId);
    const newOptionIds = exists
      ? currentOptionIds.filter((id) => id !== optionId)
      : [...currentOptionIds, optionId];

    setAnswersMap((prev) => ({
      ...prev,
      [qId]: {
        optionIds: newOptionIds,
        numericValue: null,
        textValue: null,
      },
    }));
  };

  const handleNumericChange = (qId: string, valStr: string) => {
    if (isTimeExpired || isSimulatedFinished) return;
    let numVal: number | null = null;
    if (valStr.trim() !== '') {
      const parsed = parseFloat(valStr);
      if (!isNaN(parsed) && isFinite(parsed)) {
        numVal = parsed;
      }
    }

    setAnswersMap((prev) => ({
      ...prev,
      [qId]: {
        optionIds: [],
        numericValue: numVal,
        textValue: null,
      },
    }));
  };

  const handleTextChange = (qId: string, text: string) => {
    if (isTimeExpired || isSimulatedFinished) return;
    setAnswersMap((prev) => ({
      ...prev,
      [qId]: {
        optionIds: [],
        numericValue: null,
        textValue: text,
      },
    }));
  };

  // Reiniciar la simulación local
  const handleResetSimulation = () => {
    setAnswersMap({});
    setCurrentIndex(0);
    setIsSimulatedFinished(false);
    setIsTimeExpired(false);
    if (assessment?.timeLimitMinutes && assessment.timeLimitMinutes > 0) {
      setRemainingSeconds(assessment.timeLimitMinutes * 60);
    } else {
      setRemainingSeconds(0);
    }
  };

  if (loading) {
    return <PageLoading title="Cargando simulación de vista previa..." />;
  }

  if (error || !assessment) {
    return (
      <div className="error-container" style={{ padding: '24px' }}>
        <div className="alert alert-error">{error || 'Evaluación no disponible para vista previa'}</div>
        <Link to={courseId ? `/app/courses/${courseId}` : '/app/courses'} className="btn btn-secondary" style={{ marginTop: '16px', display: 'inline-block' }}>
          Volver al Curso
        </Link>
      </div>
    );
  }

  const currentAq = questions[currentIndex];
  const totalQuestions = questions.length;
  const currentQ = currentAq?.question;
  const currentQId = currentAq?.questionId;

  // Construir mapa de preguntas respondidas para la barra de navegación
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

  const answeredCount = Object.values(answeredMap).filter(Boolean).length;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTimer = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="assessment-preview-page" style={{ position: 'relative', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      {/* Banner Prominente de Modo Vista Previa */}
      <div
        style={{
          backgroundColor: '#fef3c7',
          color: '#92400e',
          borderBottom: '2px solid #fcd34d',
          padding: '10px 20px',
          fontWeight: 700,
          fontSize: '0.875rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚠️ MODO VISTA PREVIA (SIMULACIÓN DOCENTE)</span>
          <span style={{ fontWeight: 400, fontSize: '0.8rem', color: '#b45309' }}>
            — Ninguna respuesta será enviada ni afectará calificaciones o intentos académicos.
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowAnswerKey(!showAnswerKey)}
            style={{ fontSize: '0.8rem', padding: '4px 10px', fontWeight: 700, backgroundColor: showAnswerKey ? '#dbeafe' : '#ffffff', color: showAnswerKey ? '#1e40af' : '#334155', borderColor: '#bfdbfe' }}
          >
            {showAnswerKey ? '🔑 Ocultar Clave' : '👁️ Mostrar Clave'}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleResetSimulation}
            style={{ fontSize: '0.8rem', padding: '4px 10px', fontWeight: 600 }}
          >
            🔄 Reiniciar
          </button>

          <Link
            to={`/app/courses/${courseId}/assessments/${assessmentId}`}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '4px 10px', fontWeight: 600, textDecoration: 'none' }}
          >
            ✕ Salir de Preview
          </Link>
        </div>
      </div>

      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header de la simulación */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', backgroundColor: '#ffffff', padding: '16px 24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>VISTA PREVIA DE EVALUACIÓN</span>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: '2px 0 0 0' }}>{assessment.title}</h1>
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {/* Temporizador Simulado */}
            <div style={{ backgroundColor: remainingSeconds <= 300 && remainingSeconds > 0 ? '#fef2f2' : '#f1f5f9', color: remainingSeconds <= 300 && remainingSeconds > 0 ? '#dc2626' : '#334155', border: `1px solid ${remainingSeconds <= 300 && remainingSeconds > 0 ? '#fca5a5' : '#cbd5e1'}`, padding: '6px 14px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 700 }}>
              ⏱️ {assessment.timeLimitMinutes ? formattedTimer : 'Sin límite de tiempo'}
            </div>

            {!isSimulatedFinished && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsSimulatedFinished(true)}
                style={{ fontSize: '0.85rem', padding: '8px 16px', fontWeight: 700 }}
              >
                Finalizar Simulación
              </button>
            )}
          </div>
        </div>

        {/* Aviso de Expiración de Tiempo */}
        {isTimeExpired && (
          <div className="alert alert-warning" style={{ marginBottom: '20px' }}>
            ⏱️ El tiempo límite de la simulación ha finalizado. La interacción de respuesta ha sido bloqueada.
          </div>
        )}

        {/* Vista de Resumen al Finalizar Simulación */}
        {isSimulatedFinished ? (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '40px', textAlign: 'center', maxWidth: '640px', margin: '40px auto' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎓</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>Simulación Finalizada</h2>
            <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '24px' }}>
              Has completado el recorrido de vista previa de esta evaluación.
            </p>

            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '24px', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Reactivos respondidos:</span>
                <strong style={{ color: '#0f4c81' }}>{answeredCount} de {totalQuestions}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Estado de la simulación:</span>
                <strong style={{ color: '#16a34a' }}>Completada sin registro académico</strong>
              </div>
            </div>

            <div className="alert alert-info" style={{ fontSize: '0.85rem', marginBottom: '24px', textAlign: 'left' }}>
              ℹ️ Esta simulación es puramente local. No se creó ninguna entrada en la base de datos (Attempt/Answer) ni se alteró el libro de calificaciones (Gradebook).
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button type="button" className="btn btn-secondary" onClick={handleResetSimulation} style={{ padding: '10px 20px', fontWeight: 700 }}>
                🔄 Reiniciar Simulación
              </button>
              <Link to={`/app/courses/${courseId}/assessments/${assessmentId}`} className="btn btn-primary" style={{ padding: '10px 20px', fontWeight: 700, textDecoration: 'none' }}>
                ← Volver a la Evaluación
              </Link>
            </div>
          </div>
        ) : assessment.type === 'CROSSWORD' ? (
          <CrosswordAssessmentPreview
            assessment={assessment}
            questions={questions}
            showAnswerKey={showAnswerKey}
            isSimulatedFinished={isSimulatedFinished}
            isTimeExpired={isTimeExpired}
            onFinishSimulation={() => setIsSimulatedFinished(true)}
            onResetSimulation={handleResetSimulation}
          />
        ) : totalQuestions === 0 ? (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '2px dashed #cbd5e1', padding: '48px 24px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📝</div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Esta evaluación aún no tiene preguntas</h3>
            <p style={{ fontSize: '0.9rem', marginBottom: '20px' }}>Agrega reactivos desde el Banco de Preguntas o crea nuevas preguntas para poder previsualizarlas.</p>
            <Link to={`/app/courses/${courseId}/assessments/${assessmentId}`} className="btn btn-primary" style={{ textDecoration: 'none' }}>
              Volver y agregar preguntas
            </Link>
          </div>
        ) : (
          /* Cuerpo de la Simulación: Navegación + Pregunta Actual */
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px' }}>
            <aside>
              <QuestionNavigator
                totalQuestions={totalQuestions}
                currentIndex={currentIndex}
                answeredMap={answeredMap}
                questionIds={questions.map((q) => q.questionId)}
                onSelectQuestion={(idx) => setCurrentIndex(idx)}
              />
            </aside>

            <main style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              {currentAq && currentQ && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontWeight: 700, color: '#0f4c81', fontSize: '0.9rem' }}>
                      Pregunta {currentIndex + 1} de {totalQuestions}
                    </span>
                    <span style={{ fontWeight: 700, color: '#0369a1', fontSize: '0.9rem', backgroundColor: '#e0f2fe', padding: '2px 10px', borderRadius: '12px' }}>
                      {currentAq.points} pts
                    </span>
                  </div>

                  <div style={{ marginBottom: '24px', fontSize: '1.05rem', color: '#1e293b', lineHeight: '1.6' }}>
                    <MarkdownContent content={currentQ.statement} />
                  </div>

                  {/* Entradas según Tipo de Pregunta */}
                  <div style={{ marginBottom: '28px' }}>
                    {/* OPCIÓN ÚNICA (MC / TRUE_FALSE) */}
                    {(currentQ.type === 'MULTIPLE_CHOICE' || currentQ.type === 'TRUE_FALSE') && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {currentQ.options?.map((opt) => {
                          const isChecked = (answersMap[currentQId]?.optionIds || []).includes(opt.id);
                          const isCorrect = showAnswerKey && opt.isCorrect;

                          return (
                            <label
                              key={opt.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '14px 18px',
                                borderRadius: '10px',
                                border: isCorrect
                                  ? '2px solid #22c55e'
                                  : isChecked
                                  ? '2px solid #0f4c81'
                                  : '1px solid #cbd5e1',
                                backgroundColor: isCorrect
                                  ? '#f0fdf4'
                                  : isChecked
                                  ? '#f0f9ff'
                                  : '#ffffff',
                                cursor: isTimeExpired ? 'not-allowed' : 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <input
                                type="radio"
                                name={`prev_q_${currentQId}`}
                                value={opt.id}
                                checked={isChecked}
                                onChange={() => handleOptionToggleSingle(currentQId, opt.id)}
                                disabled={isTimeExpired}
                              />
                              <span style={{ flex: 1, fontSize: '0.95rem', fontWeight: isChecked ? 600 : 400 }}>{opt.text}</span>
                              {isCorrect && (
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#15803d', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '6px' }}>
                                  ✓ Correcta
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {/* SELECCIÓN MÚLTIPLE (MS) */}
                    {currentQ.type === 'MULTIPLE_SELECT' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {currentQ.options?.map((opt) => {
                          const isChecked = (answersMap[currentQId]?.optionIds || []).includes(opt.id);
                          const isCorrect = showAnswerKey && opt.isCorrect;

                          return (
                            <label
                              key={opt.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '14px 18px',
                                borderRadius: '10px',
                                border: isCorrect
                                  ? '2px solid #22c55e'
                                  : isChecked
                                  ? '2px solid #0f4c81'
                                  : '1px solid #cbd5e1',
                                backgroundColor: isCorrect
                                  ? '#f0fdf4'
                                  : isChecked
                                  ? '#f0f9ff'
                                  : '#ffffff',
                                cursor: isTimeExpired ? 'not-allowed' : 'pointer',
                              }}
                            >
                              <input
                                type="checkbox"
                                value={opt.id}
                                checked={isChecked}
                                onChange={() => handleOptionToggleMultiple(currentQId, opt.id)}
                                disabled={isTimeExpired}
                              />
                              <span style={{ flex: 1, fontSize: '0.95rem', fontWeight: isChecked ? 600 : 400 }}>{opt.text}</span>
                              {isCorrect && (
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#15803d', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '6px' }}>
                                  ✓ Correcta
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {/* RESPUESTA NUMÉRICA */}
                    {currentQ.type === 'NUMERIC' && (
                      <div>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '0.9rem' }}>
                          Introduce tu respuesta numérica (simulación):
                        </label>
                        <input
                          type="number"
                          step="any"
                          className="input-field"
                          value={answersMap[currentQId]?.numericValue ?? ''}
                          onChange={(e) => handleNumericChange(currentQId, e.target.value)}
                          disabled={isTimeExpired}
                          placeholder="Ej. 42.5"
                          style={{ maxWidth: '300px' }}
                        />
                      </div>
                    )}

                    {/* RESPUESTA ABIERTA (OPEN_TEXT) */}
                    {currentQ.type === 'OPEN_TEXT' && (
                      <div>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '0.9rem' }}>
                          Redacta tu respuesta libre (simulación):
                        </label>
                        <textarea
                          rows={6}
                          className="input-field"
                          value={answersMap[currentQId]?.textValue ?? ''}
                          onChange={(e) => handleTextChange(currentQId, e.target.value)}
                          disabled={isTimeExpired}
                          placeholder="Escribe tu respuesta de prueba aquí..."
                        />
                      </div>
                    )}
                  </div>

                  {/* Panel Administrativo de Clave de Respuestas (si showAnswerKey === true) */}
                  {showAnswerKey && (
                    <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '16px', marginBottom: '24px' }}>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e40af', marginBottom: '8px', textTransform: 'uppercase' }}>
                        🔑 Clave de Respuestas Docente
                      </h4>

                      {currentQ.type === 'NUMERIC' && (
                        <p style={{ fontSize: '0.875rem', color: '#1e3a8a', margin: '4px 0' }}>
                          <strong>Valor correcto esperable:</strong> {currentQ.correctNumericValue ?? 'N/A'}{' '}
                          {currentQ.numericTolerance !== null && currentQ.numericTolerance !== undefined ? `(Tolerancia: ±${currentQ.numericTolerance})` : ''}
                        </p>
                      )}

                      {currentQ.explanation && (
                        <div style={{ marginTop: '8px', fontSize: '0.875rem', color: '#1e3a8a' }}>
                          <strong>Explicación pedagógica:</strong>
                          <div style={{ marginTop: '4px' }}>
                            <MarkdownContent content={currentQ.explanation} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Navegación Inferior */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                      disabled={currentIndex === 0}
                    >
                      ← Anterior
                    </button>

                    {currentIndex < totalQuestions - 1 ? (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                      >
                        Siguiente →
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setIsSimulatedFinished(true)}
                      >
                        Finalizar Simulación
                      </button>
                    )}
                  </div>
                </div>
              )}
            </main>
          </div>
        )}
      </div>
    </div>
  );
};
