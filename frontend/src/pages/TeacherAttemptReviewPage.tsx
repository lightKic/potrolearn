import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AssessmentServiceAPI } from '../services/assessment.service.js';
import { TeacherAttemptDTO } from '../types/assessment.js';
import { ApiError } from '../services/api.js';
import { MarkdownContent } from '../components/MarkdownContent.js';
import { PageLoading, ButtonSpinner } from '../components/common/loading/index.js';
import { CrosswordAttemptReview } from '../components/assessments/CrosswordAttemptReview.js';

export const TeacherAttemptReviewPage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState<TeacherAttemptDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);

  // Form states per questionId for OPEN_TEXT
  const [formValues, setFormValues] = useState<{
    [questionId: string]: { pointsEarned: string; feedback: string };
  }>({});
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null);
  const [questionErrors, setQuestionErrors] = useState<{ [questionId: string]: string }>({});
  const [questionSuccess, setQuestionSuccess] = useState<{ [questionId: string]: string }>({});

  useEffect(() => {
    if (!attemptId) return;

    let isMounted = true;
    setLoading(true);

    AssessmentServiceAPI.getAttemptReviewForTeacher(attemptId)
      .then((data) => {
        if (isMounted) {
          setAttempt(data);
          setError(null);
          setStatusCode(null);
          initForms(data);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          if (err instanceof ApiError) {
            setError(err.message);
            setStatusCode(err.status);
          } else {
            setError('Error al cargar la información del intento');
            setStatusCode(500);
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

  const initForms = (data: TeacherAttemptDTO) => {
    const initial: { [key: string]: { pointsEarned: string; feedback: string } } = {};
    for (const ans of data.answers) {
      if (ans.type === 'OPEN_TEXT') {
        initial[ans.questionId] = {
          pointsEarned: ans.pointsEarned !== null && ans.pointsEarned !== undefined ? String(ans.pointsEarned) : '',
          feedback: ans.feedback || '',
        };
      }
    }
    setFormValues(initial);
  };

  const handleInputChange = (questionId: string, field: 'pointsEarned' | 'feedback', value: string) => {
    setFormValues((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [field]: value,
      },
    }));
    setQuestionErrors((prev) => ({ ...prev, [questionId]: '' }));
    setQuestionSuccess((prev) => ({ ...prev, [questionId]: '' }));
  };

  const handleGradeSubmit = async (e: React.FormEvent, questionId: string, maxPoints: number) => {
    e.preventDefault();
    if (!attemptId || savingQuestionId) return;

    const currentForm = formValues[questionId];
    if (!currentForm) return;

    const pointsRaw = currentForm.pointsEarned.trim();
    if (pointsRaw === '') {
      setQuestionErrors((prev) => ({ ...prev, [questionId]: 'Ingresa el puntaje asignado' }));
      return;
    }

    const pointsNum = parseFloat(pointsRaw);
    if (isNaN(pointsNum) || !isFinite(pointsNum)) {
      setQuestionErrors((prev) => ({ ...prev, [questionId]: 'El puntaje debe ser un número válido' }));
      return;
    }

    if (pointsNum < 0 || pointsNum > maxPoints) {
      setQuestionErrors((prev) => ({
        ...prev,
        [questionId]: `El puntaje debe estar entre 0 y ${maxPoints}`,
      }));
      return;
    }

    const feedbackText = currentForm.feedback.trim();
    if (feedbackText.length > 10000) {
      setQuestionErrors((prev) => ({
        ...prev,
        [questionId]: 'El feedback excede los 10,000 caracteres permitidos',
      }));
      return;
    }

    setSavingQuestionId(questionId);
    setQuestionErrors((prev) => ({ ...prev, [questionId]: '' }));
    setQuestionSuccess((prev) => ({ ...prev, [questionId]: '' }));

    try {
      const updatedAttempt = await AssessmentServiceAPI.gradeAnswer(attemptId, questionId, {
        pointsEarned: pointsNum,
        feedback: feedbackText || null,
      });

      setAttempt(updatedAttempt);
      initForms(updatedAttempt);
      setQuestionSuccess((prev) => ({ ...prev, [questionId]: 'Calificación guardada correctamente' }));
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setQuestionErrors((prev) => ({ ...prev, [questionId]: err.message }));
      } else {
        setQuestionErrors((prev) => ({ ...prev, [questionId]: 'Error al guardar la calificación' }));
      }
    } finally {
      setSavingQuestionId(null);
    }
  };

  const formatDate = (isoString?: string | null): string => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'MULTIPLE_CHOICE':
        return 'Opción Múltiple';
      case 'MULTIPLE_SELECT':
        return 'Selección Múltiple';
      case 'TRUE_FALSE':
        return 'Verdadero / Falso';
      case 'NUMERIC':
        return 'Numérica';
      case 'OPEN_TEXT':
        return 'Texto Abierto';
      default:
        return type;
    }
  };

  if (loading) {
    return <PageLoading title="Cargando revisión del intento..." />;
  }

  if (error || !attempt) {
    return (
      <div className="error-container" style={{ padding: '24px 0' }}>
        <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
          {statusCode === 403
            ? 'Acceso denegado: No tienes permisos para revisar este intento.'
            : statusCode === 404
            ? 'Intento no encontrado.'
            : error}
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate('/app/courses')}
        >
          ← Volver
        </button>
      </div>
    );
  }

  return (
    <div className="teacher-attempt-review-page">
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <Link
          to={`/app/assessments/${attempt.assessmentId}/grading`}
          className="back-link"
          style={{ textDecoration: 'none', color: 'var(--color-primary)', fontWeight: 600, display: 'inline-block', marginBottom: '8px' }}
        >
          ← Volver al Centro de Calificación
        </Link>
        <h1 className="page-title">Revisión de Intento #{attempt.attemptNumber}</h1>
        <p className="page-description">
          Evaluación: <strong>{attempt.assessmentTitle}</strong>
        </p>
      </div>

      {/* Tarjeta de Información General */}
      <div className="info-card" style={styles.infoCard}>
        <div style={styles.infoGrid}>
          <div>
            <span style={styles.infoLabel}>Estudiante</span>
            <div style={styles.infoValue}>{attempt.studentName}</div>
            <div style={{ fontSize: '0.825rem', color: 'var(--color-muted)' }}>
              Matrícula: {attempt.studentNumber || '—'}
            </div>
          </div>
          <div>
            <span style={styles.infoLabel}>Estado</span>
            <div>
              {attempt.status === 'GRADED' ? (
                <span className="badge badge-success" style={styles.badgeSuccess}>Calificado</span>
              ) : (
                <span className="badge badge-warning" style={styles.badgeWarning}>
                  Entregado ({attempt.pendingOpenTextCount} pendiente{attempt.pendingOpenTextCount > 1 ? 's' : ''})
                </span>
              )}
            </div>
          </div>
          <div>
            <span style={styles.infoLabel}>Puntaje Final</span>
            <div style={{ ...styles.infoValue, fontSize: '1.25rem', color: attempt.score !== null ? 'var(--color-primary)' : 'var(--color-muted)' }}>
              {attempt.score !== null ? `${attempt.score} / 100` : 'Pendiente de revisión'}
            </div>
          </div>
          <div>
            <span style={styles.infoLabel}>Fechas</span>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>
              <strong>Inicio:</strong> {formatDate(attempt.startedAt)}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>
              <strong>Entrega:</strong> {formatDate(attempt.submittedAt)}
            </div>
          </div>
        </div>
      </div>

      {/* Sección especial de Crucigrama interactivo para evaluaciones de tipo CROSSWORD */}
      {(attempt.assessment?.type === 'CROSSWORD' || attempt.answers.some((a) => a.type === 'CROSSWORD_CLUE')) && attempt.assessment && (
        <div style={{ marginTop: '24px' }}>
          <CrosswordAttemptReview attempt={attempt} assessment={attempt.assessment} />
        </div>
      )}

      {/* Detalle por Pregunta */}
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '28px 0 16px 0' }}>Detalle de Respuestas</h2>

      <div className="questions-list" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {attempt.answers.map((ans, idx) => {
          const isPending = ans.isPendingGrading;
          const isGradedOpenText = ans.type === 'OPEN_TEXT' && !isPending;
          const currentForm = formValues[ans.questionId] || { pointsEarned: '', feedback: '' };

          return (
            <div
              key={ans.questionId}
              style={{
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-md)',
                border: isPending ? '2px solid #f59e0b' : '1px solid var(--color-border)',
                padding: '24px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {/* Header de la Pregunta */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--color-primary)' }}>
                    Pregunta #{idx + 1}
                  </span>
                  <span style={styles.typeBadge}>{getTypeLabel(ans.type)}</span>
                  {ans.type === 'OPEN_TEXT' && (
                    <span style={isPending ? styles.badgeWarning : styles.badgeSuccess}>
                      {isPending ? 'Pendiente' : 'Calificada'}
                    </span>
                  )}
                </div>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-muted)' }}>
                  Max: {ans.maxPoints} pts
                </span>
              </div>

              {/* Enunciado */}
              <div style={{ marginBottom: '16px' }}>
                <MarkdownContent content={ans.statement} />
              </div>

              {/* Respuesta del Estudiante */}
              <div style={{ backgroundColor: 'var(--color-background)', padding: '14px 16px', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Respuesta del Estudiante:
                </span>
                {ans.type === 'OPEN_TEXT' ? (
                  ans.textValue ? (
                    <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem', color: 'var(--color-text)' }}>{ans.textValue}</p>
                  ) : (
                    <p style={{ fontStyle: 'italic', color: 'var(--color-muted)', fontSize: '0.9rem' }}>Sin respuesta enviada.</p>
                  )
                ) : ans.type === 'NUMERIC' ? (
                  <p style={{ fontSize: '1rem', fontWeight: 600 }}>{ans.numericValue !== null ? ans.numericValue : 'Sin respuesta'}</p>
                ) : ans.type === 'CROSSWORD_CLUE' || ans.textValue ? (
                  ans.textValue ? (
                    <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text)' }}>{ans.textValue}</p>
                  ) : (
                    <p style={{ fontStyle: 'italic', color: 'var(--color-muted)', fontSize: '0.9rem' }}>Sin respuesta</p>
                  )
                ) : ans.selectedOptions && ans.selectedOptions.length > 0 ? (
                  <ul style={{ paddingLeft: '20px', margin: 0 }}>
                    {ans.selectedOptions.map((opt) => (
                      <li key={opt.id} style={{ fontSize: '0.95rem', fontWeight: 600 }}>{opt.text}</li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ fontStyle: 'italic', color: 'var(--color-muted)', fontSize: '0.9rem' }}>Sin respuesta seleccionada.</p>
                )}
              </div>

              {/* Detalle para Preguntas Objetivas (Solo lectura) */}
              {ans.type !== 'OPEN_TEXT' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.9rem' }}>
                  <div>
                    <strong>Puntos Otorgados:</strong>{' '}
                    <span style={{ fontWeight: 700, color: ans.isCorrect ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {ans.pointsEarned !== null ? `${ans.pointsEarned} / ${ans.maxPoints} pts` : '0 pts'}
                    </span>
                  </div>
                  <div>
                    {ans.isCorrect === true && <span className="badge badge-success" style={styles.badgeSuccess}>Correcto</span>}
                    {ans.isCorrect === false && <span className="badge badge-danger" style={styles.badgeDanger}>Incorrecto</span>}
                  </div>
                </div>
              )}

              {/* Formulario para Preguntas OPEN_TEXT */}
              {ans.type === 'OPEN_TEXT' && (
                <form
                  onSubmit={(e) => handleGradeSubmit(e, ans.questionId, ans.maxPoints)}
                  style={{
                    borderTop: '1px solid var(--color-border)',
                    paddingTop: '16px',
                    marginTop: '16px',
                  }}
                >
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>
                    {isGradedOpenText ? 'Modificar Calificación Manual' : 'Asignar Calificación Manual'}
                  </h4>

                  {questionErrors[ans.questionId] && (
                    <div className="alert alert-danger" style={{ padding: '8px 12px', fontSize: '0.85rem', marginBottom: '12px' }}>
                      {questionErrors[ans.questionId]}
                    </div>
                  )}

                  {questionSuccess[ans.questionId] && (
                    <div className="alert alert-success" style={{ padding: '8px 12px', fontSize: '0.85rem', marginBottom: '12px' }}>
                      {questionSuccess[ans.questionId]}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '16px', marginBottom: '12px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.825rem' }}>
                        Puntaje (0 - {ans.maxPoints})
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={ans.maxPoints}
                        step="0.01"
                        className="form-input"
                        value={currentForm.pointsEarned}
                        onChange={(e) => handleInputChange(ans.questionId, 'pointsEarned', e.target.value)}
                        disabled={savingQuestionId === ans.questionId}
                        placeholder="0.00"
                        required
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label className="form-label" style={{ fontSize: '0.825rem' }}>
                          Retroalimentación (opcional)
                        </label>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                          {currentForm.feedback.length} / 10,000
                        </span>
                      </div>
                      <textarea
                        className="form-input"
                        style={{ minHeight: '60px', fontFamily: 'inherit', resize: 'vertical' }}
                        value={currentForm.feedback}
                        onChange={(e) => handleInputChange(ans.questionId, 'feedback', e.target.value)}
                        disabled={savingQuestionId === ans.questionId}
                        maxLength={10000}
                        placeholder="Escribe aquí los comentarios para el estudiante..."
                      />
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.875rem' }}
                      disabled={savingQuestionId === ans.questionId}
                    >
                      {savingQuestionId === ans.questionId && <ButtonSpinner size={14} />}
                      {savingQuestionId === ans.questionId ? 'Guardando...' : 'Guardar Calificación'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const styles = {
  infoCard: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    padding: '20px 24px',
    boxShadow: 'var(--shadow-sm)',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
  },
  infoLabel: {
    fontSize: '0.775rem',
    fontWeight: 700,
    color: 'var(--color-muted)',
    textTransform: 'uppercase' as const,
    display: 'block',
    marginBottom: '4px',
  },
  infoValue: {
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--color-text)',
  },
  typeBadge: {
    fontSize: '0.75rem',
    fontWeight: 700,
    backgroundColor: 'var(--color-primary-light)',
    color: 'var(--color-primary)',
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
  },
  badgeWarning: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: '3px 8px',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  badgeSuccess: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    padding: '3px 8px',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  badgeDanger: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    padding: '3px 8px',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 700,
  },
};
