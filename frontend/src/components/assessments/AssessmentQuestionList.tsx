import React, { useState } from 'react';
import { AssessmentQuestionDTO, QuestionType } from '../../types/assessment.js';
import { MarkdownContent } from '../MarkdownContent.js';

interface AssessmentQuestionListProps {
  questions: AssessmentQuestionDTO[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onEditQuestion?: (questionItem: AssessmentQuestionDTO) => void;
  onCreateQuestion?: () => void;
  onOpenBankDrawer?: () => void;
  onUpdatePoints?: (questionId: string, points: number) => Promise<void>;
  onRemoveQuestion?: (questionId: string) => Promise<void>;
  onReorderQuestions?: (items: Array<{ questionId: string; order: number }>) => Promise<void>;
  isReadOnly?: boolean;
}

export const AssessmentQuestionList: React.FC<AssessmentQuestionListProps> = ({
  questions,
  loading = false,
  error = null,
  onRetry,
  onEditQuestion,
  onCreateQuestion,
  onOpenBankDrawer,
  onUpdatePoints,
  onRemoveQuestion,
  onReorderQuestions,
  isReadOnly = false,
}) => {
  // Estado para Edición Inline de Puntos
  const [editingPointsId, setEditingPointsId] = useState<string | null>(null);
  const [tempPointsValue, setTempPointsValue] = useState<string>('');
  const [savingPoints, setSavingPoints] = useState(false);

  // Estado para Reordenamiento y Desasociación
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Traducir tipos de pregunta al español
  const getQuestionTypeBadge = (type: QuestionType) => {
    switch (type) {
      case 'MULTIPLE_CHOICE':
        return { label: 'Opción múltiple', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', icon: '🔘' };
      case 'MULTIPLE_SELECT':
        return { label: 'Selección múltiple', bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', icon: '☑️' };
      case 'TRUE_FALSE':
        return { label: 'Verdadero / Falso', bg: '#fefce8', color: '#a16207', border: '#fef08a', icon: '⚖️' };
      case 'NUMERIC':
        return { label: 'Respuesta numérica', bg: '#faf5ff', color: '#7e22ce', border: '#e9d5ff', icon: '🔢' };
      case 'OPEN_TEXT':
        return { label: 'Respuesta abierta', bg: '#fff7ed', color: '#c2410c', border: '#ffedd5', icon: '✍️' };
      default:
        return { label: type, bg: '#f1f5f9', color: '#334155', border: '#cbd5e1', icon: '❓' };
    }
  };

  const padIndex = (num: number) => (num < 10 ? `0${num}` : `${num}`);

  // Iniciar edición inline de puntos
  const handleStartEditPoints = (item: AssessmentQuestionDTO) => {
    setEditingPointsId(item.questionId);
    setTempPointsValue(String(item.points));
  };

  // Guardar puntos modificados
  const handleSavePoints = async (questionId: string) => {
    const num = Number(tempPointsValue);
    if (isNaN(num) || num <= 0) {
      alert('Por favor especifica un valor numérico positivo para los puntos.');
      return;
    }

    if (onUpdatePoints) {
      setSavingPoints(true);
      try {
        await onUpdatePoints(questionId, num);
        setEditingPointsId(null);
      } catch {
        // Error capturado en el handler superior
      } finally {
        setSavingPoints(false);
      }
    }
  };

  // Mover pregunta Arriba / Abajo
  const handleMove = async (currentIndex: number, direction: 'UP' | 'DOWN') => {
    const sorted = [...questions].sort((a, b) => a.order - b.order);
    const targetIndex = direction === 'UP' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    // Intercambiar elementos en copia local
    const itemA = sorted[currentIndex];
    const itemB = sorted[targetIndex];

    const reorderedList = [...sorted];
    reorderedList[currentIndex] = itemB;
    reorderedList[targetIndex] = itemA;

    // Mapear la secuencia 1..N
    const itemsPayload = reorderedList.map((item, idx) => ({
      questionId: item.questionId,
      order: idx + 1,
    }));

    if (onReorderQuestions) {
      setReorderingId(itemA.questionId);
      try {
        await onReorderQuestions(itemsPayload);
      } catch {
        // Error capturado superior con rollback
      } finally {
        setReorderingId(null);
      }
    }
  };

  // Desasociar pregunta
  const handleRemove = async (questionId: string) => {
    if (!window.confirm('¿Desasociar esta pregunta de la evaluación? La pregunta permanecerá guardada en el Banco de Preguntas.')) {
      return;
    }

    if (onRemoveQuestion) {
      setRemovingId(questionId);
      try {
        await onRemoveQuestion(questionId);
      } catch {
        // Error capturado superior
      } finally {
        setRemovingId(null);
      }
    }
  };

  // Skeleton Loading State
  if (loading) {
    return (
      <div className="question-list-loading" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {[1, 2, 3].map((idx) => (
          <div
            key={idx}
            style={{
              backgroundColor: 'var(--color-surface, #ffffff)',
              borderRadius: '12px',
              border: '1px solid var(--color-border, #e2e8f0)',
              padding: '20px',
              opacity: 0.7,
              animation: 'pulse 1.5s infinite ease-in-out',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ width: '120px', height: '24px', backgroundColor: '#e2e8f0', borderRadius: '6px' }} />
              <div style={{ width: '80px', height: '24px', backgroundColor: '#e2e8f0', borderRadius: '6px' }} />
            </div>
            <div style={{ width: '85%', height: '18px', backgroundColor: '#e2e8f0', borderRadius: '4px', marginBottom: '12px' }} />
            <div style={{ width: '60%', height: '18px', backgroundColor: '#e2e8f0', borderRadius: '4px', marginBottom: '16px' }} />
          </div>
        ))}
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div
        className="alert alert-error"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          padding: '24px',
          borderRadius: '12px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#991b1b',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '1.5rem' }}>⚠️</div>
        <div style={{ fontWeight: 600 }}>No pudimos cargar las preguntas de la evaluación</div>
        <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>{error}</div>
        {onRetry && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onRetry}
            style={{
              marginTop: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
            }}
          >
            🔄 Reintentar
          </button>
        )}
      </div>
    );
  }

  // Empty State Premium
  if (!questions || questions.length === 0) {
    return (
      <div
        className="question-list-empty"
        style={{
          backgroundColor: 'var(--color-surface, #ffffff)',
          borderRadius: '16px',
          border: '2px dashed var(--color-border, #e2e8f0)',
          padding: '48px 24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#eff6ff',
            color: '#2563eb',
            fontSize: '1.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
          }}
        >
          📝
        </div>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text, #1e293b)', marginBottom: '6px' }}>
          Aún no hay preguntas en esta evaluación
        </h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--color-muted, #64748b)', maxWidth: '420px', marginBottom: '20px' }}>
          Esta evaluación no cuenta con reactivos asignados actualmente.
        </p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {onCreateQuestion && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onCreateQuestion}
              style={{ width: 'auto', padding: '10px 20px', fontWeight: 700 }}
            >
              ➕ Crear primera pregunta
            </button>
          )}

          {onOpenBankDrawer && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onOpenBankDrawer}
              style={{ width: 'auto', padding: '10px 20px', fontWeight: 700, backgroundColor: '#f1f5f9', color: '#0f4c81', borderColor: '#cbd5e1' }}
            >
              📚 Agregar del banco
            </button>
          )}
        </div>
      </div>
    );
  }

  // Render de preguntas existentes
  const sortedQuestions = [...questions].sort((a, b) => a.order - b.order);

  return (
    <div className="assessment-question-list" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {sortedQuestions.map((item, index) => {
        const q = item.question;
        const displayOrder = item.order || index + 1;
        const badgeInfo = q ? getQuestionTypeBadge(q.type) : getQuestionTypeBadge('MULTIPLE_CHOICE');
        const isEditingPoints = editingPointsId === item.questionId;
        const isItemReordering = reorderingId === item.questionId;
        const isItemRemoving = removingId === item.questionId;

        return (
          <div
            key={item.id || item.questionId || index}
            className="question-card"
            style={{
              backgroundColor: 'var(--color-surface, #ffffff)',
              borderRadius: '14px',
              border: '1px solid var(--color-border, #e2e8f0)',
              padding: '24px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.03)',
              transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
              position: 'relative',
              opacity: isItemReordering || isItemRemoving ? 0.6 : 1,
            }}
          >
            {/* Encabezado de la Card de Pregunta */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                paddingBottom: '12px',
                borderBottom: '1px solid #f1f5f9',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Controles accesibles de Reordenamiento (Subir / Bajar) */}
                {!isReadOnly && onReorderQuestions && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <button
                      type="button"
                      onClick={() => handleMove(index, 'UP')}
                      disabled={index === 0 || isItemReordering}
                      style={{
                        background: 'none',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        fontSize: '0.65rem',
                        padding: '1px 5px',
                        cursor: index === 0 ? 'not-allowed' : 'pointer',
                        color: index === 0 ? '#cbd5e1' : '#334155',
                      }}
                      title="Mover pregunta hacia arriba"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(index, 'DOWN')}
                      disabled={index === sortedQuestions.length - 1 || isItemReordering}
                      style={{
                        background: 'none',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        fontSize: '0.65rem',
                        padding: '1px 5px',
                        cursor: index === sortedQuestions.length - 1 ? 'not-allowed' : 'pointer',
                        color: index === sortedQuestions.length - 1 ? '#cbd5e1' : '#334155',
                      }}
                      title="Mover pregunta hacia abajo"
                    >
                      ▼
                    </button>
                  </div>
                )}

                <span
                  style={{
                    fontSize: '1rem',
                    fontWeight: 800,
                    color: 'var(--color-primary, #0f4c81)',
                    fontFamily: 'monospace',
                  }}
                >
                  {padIndex(displayOrder)}
                </span>

                <span
                  className="badge"
                  style={{
                    backgroundColor: badgeInfo.bg,
                    color: badgeInfo.color,
                    border: `1px solid ${badgeInfo.border}`,
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    padding: '3px 10px',
                    borderRadius: '20px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>{badgeInfo.icon}</span> {badgeInfo.label}
                </span>
              </div>

              {/* Sección de Puntos y Acciones */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {/* Edición Inline de Puntos */}
                {isEditingPoints ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      min="0.1"
                      step="0.5"
                      className="form-input"
                      value={tempPointsValue}
                      onChange={(e) => setTempPointsValue(e.target.value)}
                      style={{ width: '70px', padding: '3px 8px', fontSize: '0.85rem', fontWeight: 700 }}
                      autoFocus
                    />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>pts</span>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleSavePoints(item.questionId)}
                      disabled={savingPoints}
                      style={{ fontSize: '0.75rem', padding: '4px 8px', width: 'auto' }}
                    >
                      {savingPoints ? '...' : '✓ OK'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setEditingPointsId(null)}
                      style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <span
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: '#334155',
                      backgroundColor: '#f8fafc',
                      padding: '4px 12px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    Puntos en este examen: <strong style={{ color: '#0f4c81' }}>{item.points} pts</strong>
                    {!isReadOnly && onUpdatePoints && (
                      <button
                        type="button"
                        onClick={() => handleStartEditPoints(item)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#2563eb',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          padding: '0 2px',
                        }}
                        title="Editar puntos asignados"
                      >
                        ✏️
                      </button>
                    )}
                  </span>
                )}

                {!isReadOnly && onEditQuestion && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => onEditQuestion(item)}
                    style={{ fontSize: '0.8rem', padding: '4px 10px', fontWeight: 600 }}
                  >
                    ✏️ Editar Pregunta
                  </button>
                )}

                {!isReadOnly && onRemoveQuestion && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleRemove(item.questionId)}
                    disabled={isItemRemoving}
                    style={{ fontSize: '0.8rem', padding: '4px 10px', fontWeight: 600, color: '#dc2626', borderColor: '#fca5a5' }}
                    title="Desasociar esta pregunta de la evaluación"
                  >
                    {isItemRemoving ? 'Removiendo...' : '🗑️ Desasociar'}
                  </button>
                )}
              </div>
            </div>

            {/* Enunciado de la Pregunta */}
            <div style={{ marginBottom: '18px' }}>
              {q ? (
                <MarkdownContent content={q.statement} />
              ) : (
                <div style={{ color: 'var(--color-muted)', fontStyle: 'italic' }}>Pregunta sin detalle disponible</div>
              )}
            </div>

            {/* Opciones y detalles por tipo */}
            {q && (
              <div style={{ marginTop: '14px' }}>
                {/* 1. OPCIÓN MÚLTIPLE / SELECCIÓN MÚLTIPLE / VERDADERO FALSO */}
                {(q.type === 'MULTIPLE_CHOICE' || q.type === 'MULTIPLE_SELECT' || q.type === 'TRUE_FALSE') &&
                  q.options &&
                  q.options.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {q.options.map((opt) => (
                        <div
                          key={opt.id}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            backgroundColor: opt.isCorrect ? '#f0fdf4' : '#f8fafc',
                            border: `1px solid ${opt.isCorrect ? '#bbf7d0' : '#e2e8f0'}`,
                            fontSize: '0.9rem',
                            gap: '12px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            <span style={{ color: opt.isCorrect ? '#16a34a' : '#64748b', marginTop: '2px', fontWeight: 700 }}>
                              {q.type === 'MULTIPLE_SELECT' ? (opt.isCorrect ? '☑' : '☐') : opt.isCorrect ? '🔘' : '⚪'}
                            </span>
                            <div>
                              <span style={{ fontWeight: opt.isCorrect ? 600 : 400, color: opt.isCorrect ? '#14532d' : '#334155' }}>
                                {opt.text}
                              </span>
                              {opt.explanation && (
                                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px', fontStyle: 'italic' }}>
                                  💡 Explicación de la opción: {opt.explanation}
                                </div>
                              )}
                            </div>
                          </div>

                          {opt.isCorrect && (
                            <span
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: '#15803d',
                                backgroundColor: '#dcfce7',
                                border: '1px solid #86efac',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              ✓ Respuesta Correcta
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                {/* 2. NUMÉRICA */}
                {q.type === 'NUMERIC' && (
                  <div
                    style={{
                      backgroundColor: '#faf5ff',
                      border: '1px solid #e9d5ff',
                      borderRadius: '8px',
                      padding: '14px 16px',
                      display: 'flex',
                      gap: '20px',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.8rem', color: '#6b21a8', display: 'block', fontWeight: 600 }}>
                        🎯 Valor Correcto Esperado:
                      </span>
                      <strong style={{ fontSize: '1.05rem', color: '#581c87' }}>
                        {q.correctNumericValue !== null && q.correctNumericValue !== undefined ? q.correctNumericValue : 'N/A'}
                      </strong>
                    </div>

                    <div style={{ borderLeft: '1px solid #d8b4fe', paddingLeft: '20px' }}>
                      <span style={{ fontSize: '0.8rem', color: '#6b21a8', display: 'block', fontWeight: 600 }}>
                        📐 Tolerancia Permitida:
                      </span>
                      <strong style={{ fontSize: '1.05rem', color: '#581c87' }}>
                        ±{q.numericTolerance !== null && q.numericTolerance !== undefined ? q.numericTolerance : '0.00'}
                      </strong>
                    </div>
                  </div>
                )}

                {/* 3. RESPUESTA ABIERTA */}
                {q.type === 'OPEN_TEXT' && (
                  <div
                    style={{
                      backgroundColor: '#fff7ed',
                      border: '1px solid #ffedd5',
                      borderRadius: '8px',
                      padding: '14px 16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#c2410c', fontWeight: 700, fontSize: '0.875rem' }}>
                      <span>✍️</span> Pregunta de Respuesta Abierta
                    </div>
                    <p style={{ fontSize: '0.825rem', color: '#9a3412', marginTop: '4px' }}>
                      La respuesta del alumno consistirá en un texto libre que será evaluado y calificado manualmente por el docente en el Centro de Calificación.
                    </p>
                  </div>
                )}

                {/* Retroalimentación / Explicación General de la Pregunta */}
                {q.explanation && (
                  <div
                    style={{
                      marginTop: '12px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      fontSize: '0.85rem',
                      color: '#475569',
                    }}
                  >
                    <strong style={{ color: '#334155' }}>💡 Retroalimentación / Criterio General:</strong> {q.explanation}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
