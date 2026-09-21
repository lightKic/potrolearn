import React, { useEffect, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { AssessmentServiceAPI } from '../services/assessment.service.js';
import { AttemptDTO } from '../types/assessment.js';
import { ApiError } from '../services/api.js';
import { PageLoading } from '../components/common/loading/index.js';
import { useAuth } from '../auth/useAuth.js';

export const StudentAttemptResultPage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { user } = useAuth();

  const [attempt, setAttempt] = useState<AttemptDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!attemptId || user?.role === 'TEACHER' || user?.role === 'ADMIN') return;

    let isMounted = true;
    setLoading(true);

    AssessmentServiceAPI.getAttempt(attemptId)
      .then((data) => {
        if (isMounted) {
          setAttempt(data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          if (err instanceof ApiError) {
            setError(err.message);
          } else {
            setError('Error al obtener los resultados del intento');
          }
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [attemptId, user?.role]);

  if (user?.role === 'TEACHER' || user?.role === 'ADMIN') {
    return <Navigate to={`/app/attempts/${attemptId}/review`} replace />;
  }

  if (loading) {
    return <PageLoading title="Cargando resultado de la evaluación..." />;
  }

  if (error || !attempt) {
    return (
      <div className="error-container" style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px' }}>
        <div className="alert alert-error">{error || 'Intento no encontrado'}</div>
        <Link to="/app/courses" className="btn btn-secondary" style={{ marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>Volver a Mis Cursos</span>
        </Link>
      </div>
    );
  }

  const isGraded = attempt.status === 'GRADED';
  const isSubmitted = attempt.status === 'SUBMITTED';
  const isAbandoned = attempt.status === 'ABANDONED';
  const courseId = attempt.assessment?.courseId;

  const dateFormatted = attempt.submittedAt
    ? new Date(attempt.submittedAt).toLocaleString()
    : attempt.startedAt
    ? new Date(attempt.startedAt).toLocaleString()
    : 'N/A';

  return (
    <div className="student-attempt-result-page">
      {/* 1. Header / Breadcrumb secundario */}
      <div className="result-breadcrumb-bar">
        {courseId ? (
          <Link to={`/app/courses/${courseId}`} className="result-back-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Volver al curso</span>
          </Link>
        ) : (
          <Link to="/app/courses" className="result-back-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Volver a Mis Cursos</span>
          </Link>
        )}
      </div>

      {/* 2. Hero Card de Resultado */}
      <div className="result-hero-card">
        <div className="result-hero-header">
          <div
            className={`result-hero-icon-container ${
              isGraded
                ? attempt.isPassed === true
                  ? 'passed'
                  : attempt.isPassed === false
                  ? 'failed'
                  : 'graded'
                : isSubmitted
                ? 'submitted'
                : 'abandoned'
            }`}
          >
            {isGraded ? (
              attempt.isPassed === true ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              ) : attempt.isPassed === false ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <path d="M9 15l2 2 4-4"></path>
                </svg>
              )
            ) : isSubmitted ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            )}
          </div>

          <div className="result-hero-details">
            <div className="result-meta-tags">
              <span className="result-tag attempt-tag">Intento #{attempt.attemptNumber}</span>
              <span className="result-tag date-tag">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                {isAbandoned ? 'Abandonado el ' : 'Entregado el '}
                {dateFormatted}
              </span>
            </div>
            <h1 className="result-hero-title">{attempt.assessment?.title || 'Evaluación'}</h1>
            {attempt.assessment?.description && (
              <p className="result-hero-subtitle">{attempt.assessment.description}</p>
            )}
          </div>
        </div>

        {/* 3. Hero Score Display para GRADED */}
        {isGraded && (
          <div className="result-score-block">
            <div className="score-hero-display">
              <div className="score-number-wrapper">
                <span className="score-main-value">
                  {attempt.score !== null && attempt.score !== undefined ? attempt.score.toFixed(1) : '0.0'}
                </span>
                <span className="score-max-value">/ 100 pts</span>
              </div>

              {attempt.isPassed !== null && attempt.isPassed !== undefined && (
                <div className={`result-status-pill ${attempt.isPassed ? 'passed' : 'failed'}`}>
                  {attempt.isPassed ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      <span>Evaluación Aprobada</span>
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                      <span>Evaluación No Aprobada</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <p className="score-auto-notice">
              Tu evaluación ha sido calificada automáticamente por el sistema.
            </p>
          </div>
        )}

        {/* 4. Banner para SUBMITTED (revision abierta pendiente) */}
        {isSubmitted && (
          <div className="result-status-banner info">
            <div className="banner-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <div>
              <h4 className="banner-title">Evaluación Entregada — Pendiente de Calificación</h4>
              <p className="banner-text">
                Tu examen contiene preguntas de respuesta abierta que requieren revisión manual por parte del profesor. Tu calificación final se actualizará aquí una vez concluida la revisión.
              </p>
            </div>
          </div>
        )}

        {/* 5. Banner para ABANDONED */}
        {isAbandoned && (
          <div className="result-status-banner warning">
            <div className="banner-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </div>
            <div>
              <h4 className="banner-title">Intento Abandonado Voluntariamente</h4>
              <p className="banner-text">
                Este intento de evaluación fue abandonado. Ha consumido 1 intento de los permitidos y no genera calificación ni afecta tu promedio acumulado.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 6. Resumen y Detalle de Respuestas */}
      {attempt.answers && attempt.answers.length > 0 && (
        <div className="result-answers-card">
          <div className="answers-card-header">
            <h3 className="answers-card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              <span>Resumen de Respuestas ({attempt.answers.length})</span>
            </h3>
          </div>

          <div className="answers-items-list">
            {attempt.answers.map((ans, idx) => (
              <div key={ans.questionId || idx} className="result-answer-item">
                <div className="answer-item-top">
                  <span className="answer-question-number">Pregunta #{idx + 1}</span>
                  {isGraded && ans.pointsEarned !== null && ans.pointsEarned !== undefined ? (
                    <span className={`answer-points-badge ${ans.isCorrect ? 'correct' : 'incorrect'}`}>
                      {ans.isCorrect ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      )}
                      <span>{ans.pointsEarned} pts</span>
                    </span>
                  ) : isSubmitted && ans.pointsEarned === null ? (
                    <span className="answer-points-badge pending">
                      <span>Pendiente</span>
                    </span>
                  ) : null}
                </div>

                {ans.textValue && (
                  <div className="answer-text-box">
                    <span className="answer-text-label">Tu respuesta redactada:</span>
                    <p className="answer-text-content">{ans.textValue}</p>
                  </div>
                )}

                {ans.feedback && (
                  <div className="answer-feedback-box">
                    <div className="feedback-label">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      </svg>
                      <span>Retroalimentación del docente:</span>
                    </div>
                    <p className="feedback-content">{ans.feedback}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Acción Principal Inferior */}
      <div className="result-footer-actions">
        {courseId ? (
          <Link to={`/app/courses/${courseId}`} className="btn btn-primary result-cta-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Volver al curso</span>
          </Link>
        ) : (
          <Link to="/app/courses" className="btn btn-primary result-cta-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Ir a Mis Cursos</span>
          </Link>
        )}
      </div>
    </div>
  );
};
