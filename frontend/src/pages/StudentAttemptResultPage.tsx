import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AssessmentServiceAPI } from '../services/assessment.service.js';
import { AttemptDTO } from '../types/assessment.js';
import { ApiError } from '../services/api.js';

export const StudentAttemptResultPage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();

  const [attempt, setAttempt] = useState<AttemptDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!attemptId) return;

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
  }, [attemptId]);

  if (loading) {
    return (
      <div className="loading-container" id="attempt-result-loading">
        <div className="loading-spinner" />
        <p>Cargando resultado de la evaluación...</p>
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div className="error-container">
        <div className="alert alert-error">{error || 'Intento no encontrado'}</div>
        <Link to="/app/courses" className="btn btn-secondary">
          Volver a Mis Cursos
        </Link>
      </div>
    );
  }

  const isGraded = attempt.status === 'GRADED';
  const isSubmitted = attempt.status === 'SUBMITTED';
  const courseId = attempt.assessment?.courseId;

  return (
    <div className="attempt-result-page">
      <div className="page-header">
        {courseId && (
          <Link to={`/app/courses/${courseId}`} className="back-link">
            ← Volver al Curso
          </Link>
        )}
      </div>

      <div className="result-card">
        <h1 className="result-title">{attempt.assessment?.title || 'Evaluación'}</h1>
        <p className="attempt-meta">
          Intento #{attempt.attemptNumber} • Entregado el{' '}
          {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : 'N/A'}
        </p>

        {isGraded && (
          <div className="result-summary graded">
            <div className="score-badge-circle">
              <span className="score-value">
                {attempt.score !== null && attempt.score !== undefined ? attempt.score : '0.00'}
              </span>
              <span className="score-max">/ 100</span>
            </div>

            {attempt.isPassed !== null && attempt.isPassed !== undefined && (
              <div className={`pass-status ${attempt.isPassed ? 'passed' : 'failed'}`}>
                {attempt.isPassed ? '🎉 Evaluación Aprobada' : '❌ Evaluación No Aprobada'}
              </div>
            )}

            <p className="result-notice">
              Tu evaluación ha sido calificada automáticamente por el sistema.
            </p>
          </div>
        )}

        {isSubmitted && (
          <div className="result-summary submitted">
            <div className="alert alert-info" role="alert">
              ⏳ <strong>Evaluación Entregada con Éxito</strong>
              <p>
                Tu examen contiene preguntas de respuesta abierta que requieren revisión manual por parte del profesor. Tu calificación final se mostrará aquí una vez concluida la evaluación.
              </p>
            </div>
          </div>
        )}

        {/* Resumen de Preguntas si existen respuestas en el DTO */}
        {attempt.answers && attempt.answers.length > 0 && (
          <div className="answers-summary-section">
            <h3>Resumen de Respuestas ({attempt.answers.length})</h3>
            <div className="answers-list">
              {attempt.answers.map((ans, idx) => (
                <div key={ans.questionId} className="answer-item-card">
                  <div className="answer-item-header">
                    <span>Pregunta #{idx + 1}</span>
                    {isGraded && ans.pointsEarned !== null && ans.pointsEarned !== undefined && (
                      <span className="answer-points">
                        {ans.pointsEarned} pts {ans.isCorrect ? '✓' : ''}
                      </span>
                    )}
                  </div>
                  {ans.textValue && (
                    <div className="answer-user-text">
                      <strong>Tu respuesta:</strong> {ans.textValue}
                    </div>
                  )}
                  {ans.feedback && (
                    <div className="answer-feedback">
                      <strong>Feedback del docente:</strong> {ans.feedback}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="result-actions">
          {courseId ? (
            <Link to={`/app/courses/${courseId}`} className="btn btn-primary">
              Volver al Curso
            </Link>
          ) : (
            <Link to="/app/courses" className="btn btn-primary">
              Ir a Mis Cursos
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
