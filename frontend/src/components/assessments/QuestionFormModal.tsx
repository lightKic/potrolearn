import React, { useEffect, useState } from 'react';
import { AssessmentQuestionDTO, QuestionType } from '../../types/assessment.js';
import { QuestionServiceAPI } from '../../services/question.service.js';
import { ApiError } from '../../services/api.js';
import { MarkdownContent } from '../MarkdownContent.js';

interface QuestionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessmentId: string;
  initialData?: AssessmentQuestionDTO | null;
  onSuccess: () => void;
}

interface FormOptionItem {
  id?: string;
  text: string;
  isCorrect: boolean;
  explanation: string;
  order: number;
}

export const QuestionFormModal: React.FC<QuestionFormModalProps> = ({
  isOpen,
  onClose,
  assessmentId,
  initialData = null,
  onSuccess,
}) => {
  const isEditMode = Boolean(initialData && initialData.questionId);

  // Estados del Formulario
  const [statement, setStatement] = useState('');
  const [type, setType] = useState<QuestionType>('MULTIPLE_CHOICE');
  const [points, setPoints] = useState('10');
  const [explanation, setExplanation] = useState('');
  const [correctNumericValue, setCorrectNumericValue] = useState('');
  const [numericTolerance, setNumericTolerance] = useState('0.0');

  // Opciones de respuesta
  const [options, setOptions] = useState<FormOptionItem[]>([]);
  const [deletedOptionIds, setDeletedOptionIds] = useState<string[]>([]);

  // Estados UI
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);

  // Inicialización de campos al abrir el modal o cambiar initialData
  useEffect(() => {
    if (!isOpen) return;

    if (initialData && initialData.question) {
      const q = initialData.question;
      setStatement(q.statement || '');
      setType(q.type || 'MULTIPLE_CHOICE');
      setPoints(String(initialData.points ?? q.defaultPoints ?? 10));
      setExplanation(q.explanation || '');
      setCorrectNumericValue(
        q.correctNumericValue !== null && q.correctNumericValue !== undefined ? String(q.correctNumericValue) : ''
      );
      setNumericTolerance(
        q.numericTolerance !== null && q.numericTolerance !== undefined ? String(q.numericTolerance) : '0.0'
      );

      if (q.options && q.options.length > 0) {
        setOptions(
          q.options.map((o) => ({
            id: o.id,
            text: o.text,
            isCorrect: Boolean(o.isCorrect),
            explanation: o.explanation || '',
            order: o.order,
          }))
        );
      } else {
        initDefaultOptions(q.type || 'MULTIPLE_CHOICE');
      }
      setDeletedOptionIds([]);
    } else {
      // Modo Creación Limpio
      setStatement('');
      setType('MULTIPLE_CHOICE');
      setPoints('10');
      setExplanation('');
      setCorrectNumericValue('');
      setNumericTolerance('0.0');
      initDefaultOptions('MULTIPLE_CHOICE');
      setDeletedOptionIds([]);
    }

    setError(null);
    setShowMarkdownPreview(false);
  }, [isOpen, initialData]);

  // Inicializa opciones por defecto según el tipo
  const initDefaultOptions = (targetType: QuestionType) => {
    if (targetType === 'TRUE_FALSE') {
      setOptions([
        { text: 'Verdadero', isCorrect: true, explanation: '', order: 1 },
        { text: 'Falso', isCorrect: false, explanation: '', order: 2 },
      ]);
    } else if (targetType === 'MULTIPLE_CHOICE' || targetType === 'MULTIPLE_SELECT') {
      setOptions([
        { text: '', isCorrect: true, explanation: '', order: 1 },
        { text: '', isCorrect: false, explanation: '', order: 2 },
      ]);
    } else {
      setOptions([]);
    }
  };

  // Cambio dinámico de tipo de pregunta
  const handleTypeChange = (newType: QuestionType) => {
    setType(newType);
    if (!isEditMode) {
      initDefaultOptions(newType);
    } else if (newType === 'TRUE_FALSE' && options.length !== 2) {
      initDefaultOptions('TRUE_FALSE');
    }
  };

  // Manejo de Opciones
  const handleAddOption = () => {
    setOptions((prev) => [
      ...prev,
      {
        text: '',
        isCorrect: false,
        explanation: '',
        order: prev.length + 1,
      },
    ]);
  };

  const handleRemoveOption = (index: number) => {
    const itemToRemove = options[index];
    if (itemToRemove && itemToRemove.id) {
      setDeletedOptionIds((prev) => [...prev, itemToRemove.id as string]);
    }
    setOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOptionTextChange = (index: number, text: string) => {
    setOptions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], text };
      return copy;
    });
  };

  const handleOptionCorrectChange = (index: number, checked: boolean) => {
    if (type === 'MULTIPLE_CHOICE' || type === 'TRUE_FALSE') {
      // En Opción múltiple o Verdadero/Falso, solo 1 opción puede ser correcta
      setOptions((prev) =>
        prev.map((opt, i) => ({
          ...opt,
          isCorrect: i === index,
        }))
      );
    } else {
      // En Selección múltiple, se pueden marcar múltiples
      setOptions((prev) => {
        const copy = [...prev];
        copy[index] = { ...copy[index], isCorrect: checked };
        return copy;
      });
    }
  };

  const handleOptionExplanationChange = (index: number, explanationText: string) => {
    setOptions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], explanation: explanationText };
      return copy;
    });
  };

  // Validación Frontend
  const validateForm = (): boolean => {
    if (!statement.trim()) {
      setError('El enunciado de la pregunta es obligatorio.');
      return false;
    }

    const numPoints = Number(points);
    if (isNaN(numPoints) || numPoints <= 0) {
      setError('Los puntos en esta evaluación deben ser un número positivo > 0.');
      return false;
    }

    if (type === 'MULTIPLE_CHOICE') {
      if (options.length < 2) {
        setError('Una pregunta de opción múltiple debe tener al menos 2 opciones.');
        return false;
      }
      if (options.some((o) => !o.text.trim())) {
        setError('Todas las opciones deben tener un texto de respuesta no vacío.');
        return false;
      }
      const correctCount = options.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) {
        setError('Debe seleccionar exactamente 1 opción como respuesta correcta.');
        return false;
      }
    } else if (type === 'MULTIPLE_SELECT') {
      if (options.length < 2) {
        setError('Una pregunta de selección múltiple debe tener al menos 2 opciones.');
        return false;
      }
      if (options.some((o) => !o.text.trim())) {
        setError('Todas las opciones deben tener un texto de respuesta no vacío.');
        return false;
      }
      const correctCount = options.filter((o) => o.isCorrect).length;
      if (correctCount < 1) {
        setError('Debe seleccionar al menos 1 opción correcta para selección múltiple.');
        return false;
      }
    } else if (type === 'TRUE_FALSE') {
      if (options.length !== 2) {
        setError('Verdadero/Falso debe contener exactamente 2 opciones.');
        return false;
      }
      const correctCount = options.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) {
        setError('Debe seleccionar si Verdadero o Falso es la respuesta correcta.');
        return false;
      }
    } else if (type === 'NUMERIC') {
      if (correctNumericValue.trim() === '' || isNaN(Number(correctNumericValue))) {
        setError('Especifique un valor numérico correcto esperado válido.');
        return false;
      }
      const tolVal = Number(numericTolerance);
      if (isNaN(tolVal) || tolVal < 0) {
        setError('La tolerancia numérica debe ser un número igual o mayor a 0.');
        return false;
      }
    }

    return true;
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setError(null);

    const numPoints = Number(points);
    const numVal = type === 'NUMERIC' ? Number(correctNumericValue) : null;
    const numTol = type === 'NUMERIC' ? Number(numericTolerance) : 0.0;

    try {
      if (!isEditMode) {
        // --- MODO CREACIÓN ---
        // Step 1: Crear la Pregunta en el Banco
        const createdQuestion = await QuestionServiceAPI.createQuestion({
          statement: statement.trim(),
          type,
          defaultPoints: numPoints,
          explanation: explanation.trim() || null,
          correctNumericValue: numVal,
          numericTolerance: numTol,
          options:
            type !== 'NUMERIC' && type !== 'OPEN_TEXT'
              ? options.map((o, idx) => ({
                  text: o.text.trim(),
                  isCorrect: o.isCorrect,
                  explanation: o.explanation.trim() || null,
                  order: idx + 1,
                }))
              : undefined,
        });

        // Step 2: Asociar la Pregunta creada a la Evaluación actual
        await QuestionServiceAPI.addQuestionToAssessment(assessmentId, {
          questionId: createdQuestion.id,
          points: numPoints,
        });
      } else {
        // --- MODO EDICIÓN ---
        const questionId = initialData?.questionId as string;

        // Step 1: Actualizar metadatos de la Pregunta
        await QuestionServiceAPI.updateQuestion(questionId, {
          statement: statement.trim(),
          type,
          defaultPoints: numPoints,
          explanation: explanation.trim() || null,
          correctNumericValue: numVal,
          numericTolerance: numTol,
        });

        // Step 2: Actualizar puntos en esta evaluación
        await QuestionServiceAPI.updateAssessmentQuestionPoints(assessmentId, questionId, numPoints);

        // Step 3: Gestionar Opciones de Pregunta (si aplica)
        if (type !== 'NUMERIC' && type !== 'OPEN_TEXT') {
          // Eliminar opciones marcadas para borrar
          for (const optId of deletedOptionIds) {
            try {
              await QuestionServiceAPI.deleteOption(questionId, optId);
            } catch (err: unknown) {
              console.warn('Opción ya eliminada o en uso:', err);
            }
          }

          // Crear o actualizar opciones
          for (let i = 0; i < options.length; i++) {
            const opt = options[i];
            if (opt.id) {
              await QuestionServiceAPI.updateOption(questionId, opt.id, {
                text: opt.text.trim(),
                isCorrect: opt.isCorrect,
                explanation: opt.explanation.trim() || null,
                order: i + 1,
              });
            } else {
              await QuestionServiceAPI.createOption(questionId, {
                text: opt.text.trim(),
                isCorrect: opt.isCorrect,
                explanation: opt.explanation.trim() || null,
                order: i + 1,
              });
            }
          }
        }
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409 || err.code === 'QUESTION_HAS_ATTEMPTS' || err.code === 'ASSESSMENT_HAS_ATTEMPTS') {
          setError(
            '⚠️ Esta pregunta forma parte de una evaluación que ya cuenta con intentos entregados. Algunos cambios en opciones o estructura están protegidos para mantener la integridad histórica de las calificaciones.'
          );
        } else {
          setError(err.message);
        }
      } else {
        setError('Error al procesar la pregunta. Verifica los datos e intenta nuevamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <div
        className="dashboard-card"
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '92vh',
          overflowY: 'auto',
          backgroundColor: 'var(--color-surface, #ffffff)',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          position: 'relative',
        }}
      >
        {/* Encabezado del Modal */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '16px',
            marginBottom: '20px',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-text, #0f172a)' }}>
              {isEditMode ? '✏️ Editar Pregunta' : '➕ Nueva Pregunta'}
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-muted, #64748b)', marginTop: '4px' }}>
              {isEditMode
                ? 'Modifica la estructura, opciones o puntuación de este reactivo.'
                : 'Configura un nuevo reactivo y asígnalo a esta evaluación.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.35rem',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
            }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* SECCIÓN 1: TIPO DE PREGUNTA Y PUNTOS */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.875rem', marginBottom: '6px', color: '#334155' }}>
                01. Tipo de Pregunta *
              </label>
              <select
                className="form-input"
                value={type}
                onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
                style={{ fontWeight: 600 }}
              >
                <option value="MULTIPLE_CHOICE">🔘 Opción múltiple (Una respuesta correcta)</option>
                <option value="MULTIPLE_SELECT">☑️ Selección múltiple (Varias respuestas correctas)</option>
                <option value="TRUE_FALSE">⚖️ Verdadero / Falso</option>
                <option value="NUMERIC">🔢 Respuesta numérica (Valor exacto + Tolerancia)</option>
                <option value="OPEN_TEXT">✍️ Respuesta abierta (Calificación manual)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.875rem', marginBottom: '6px', color: '#334155' }}>
                02. Puntos en este examen *
              </label>
              <input
                type="number"
                min="0.1"
                step="0.5"
                className="form-input"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                required
              />
            </div>
          </div>

          {/* SECCIÓN 2: ENUNCIADO DE LA PREGUNTA */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontWeight: 700, fontSize: '0.875rem', color: '#334155' }}>
                03. Enunciado de la Pregunta *
              </label>
              <button
                type="button"
                onClick={() => setShowMarkdownPreview(!showMarkdownPreview)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '0.8rem',
                  color: '#2563eb',
                  cursor: 'pointer',
                  fontWeight: 600,
                  textDecoration: 'underline',
                }}
              >
                {showMarkdownPreview ? '✏️ Ocultar Vista Previa' : '👁️ Vista Previa Markdown/LaTeX'}
              </button>
            </div>

            <textarea
              className="form-input"
              rows={4}
              placeholder="Escribe aquí el enunciado del reactivo..."
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              required
            />
            <small style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginTop: '4px' }}>
              💡 Admite formato Markdown y expresiones matemáticas LaTeX (ej. $f(x) = \frac&#123;a&#125;&#123;b&#125;$).
            </small>

            {showMarkdownPreview && (
              <div
                style={{
                  marginTop: '10px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '14px',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
                  VISTA PREVIA DEL ENUNCIADO:
                </div>
                <MarkdownContent content={statement || '*(Enunciado vacío)*'} />
              </div>
            )}
          </div>

          {/* SECCIÓN 3: OPCIONES / RESPUESTAS SEGÚN EL TIPO */}
          <div
            style={{
              marginBottom: '22px',
              backgroundColor: '#f8fafc',
              padding: '18px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
            }}
          >
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', marginBottom: '14px' }}>
              04. Configuración de Respuestas ({type})
            </h4>

            {/* A. OPCIÓN MÚLTIPLE / SELECCIÓN MÚLTIPLE / VERDADERO FALSO */}
            {(type === 'MULTIPLE_CHOICE' || type === 'MULTIPLE_SELECT' || type === 'TRUE_FALSE') && (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
                  {options.map((opt, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        backgroundColor: '#ffffff',
                        border: `1px solid ${opt.isCorrect ? '#86efac' : '#cbd5e1'}`,
                        borderRadius: '8px',
                        padding: '10px 12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {type === 'MULTIPLE_SELECT' ? (
                          <input
                            type="checkbox"
                            checked={opt.isCorrect}
                            onChange={(e) => handleOptionCorrectChange(idx, e.target.checked)}
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                            title="Marcar como respuesta correcta"
                          />
                        ) : (
                          <input
                            type="radio"
                            name="question-correct-option"
                            checked={opt.isCorrect}
                            onChange={() => handleOptionCorrectChange(idx, true)}
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                            title="Marcar como la respuesta correcta"
                          />
                        )}

                        <input
                          type="text"
                          className="form-input"
                          placeholder={`Texto de la Opción ${idx + 1}`}
                          value={opt.text}
                          onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                          disabled={type === 'TRUE_FALSE'}
                          style={{ flex: 1, padding: '8px 12px', fontSize: '0.9rem' }}
                        />

                        {opt.isCorrect && (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: '#15803d',
                              backgroundColor: '#dcfce7',
                              padding: '3px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            ✓ Correcta
                          </span>
                        )}

                        {type !== 'TRUE_FALSE' && options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(idx)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#dc2626',
                              cursor: 'pointer',
                              fontSize: '1.1rem',
                              padding: '2px 6px',
                            }}
                            title="Eliminar opción"
                          >
                            🗑️
                          </button>
                        )}
                      </div>

                      <input
                        type="text"
                        placeholder="Explicación específica de esta opción (opcional)"
                        value={opt.explanation}
                        onChange={(e) => handleOptionExplanationChange(idx, e.target.value)}
                        style={{
                          fontSize: '0.8rem',
                          padding: '6px 10px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          color: '#475569',
                          backgroundColor: '#f8fafc',
                        }}
                      />
                    </div>
                  ))}
                </div>

                {type !== 'TRUE_FALSE' && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleAddOption}
                    style={{ fontSize: '0.85rem', padding: '6px 14px', fontWeight: 600 }}
                  >
                    ➕ Agregar opción
                  </button>
                )}
              </div>
            )}

            {/* B. RESPUESTA NUMÉRICA */}
            {type === 'NUMERIC' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                    Valor Correcto Esperado *
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="ej. 3.14159"
                    className="form-input"
                    value={correctNumericValue}
                    onChange={(e) => setCorrectNumericValue(e.target.value)}
                    required
                  />
                  <small style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginTop: '4px' }}>
                    Resultado exacto esperado.
                  </small>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                    Tolerancia Permitida (±)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="ej. 0.01"
                    className="form-input"
                    value={numericTolerance}
                    onChange={(e) => setNumericTolerance(e.target.value)}
                  />
                  <small style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginTop: '4px' }}>
                    Margen de error absoluto aceptado.
                  </small>
                </div>
              </div>
            )}

            {/* C. RESPUESTA ABIERTA */}
            {type === 'OPEN_TEXT' && (
              <div style={{ color: '#9a3412', backgroundColor: '#fff7ed', padding: '12px 14px', borderRadius: '8px', fontSize: '0.85rem' }}>
                ℹ️ Esta pregunta no requiere opciones. El alumno escribirá una respuesta en texto libre que el docente evaluará y calificará en el Centro de Calificación.
              </div>
            )}
          </div>

          {/* SECCIÓN 4: RETROALIMENTACIÓN / EXPLICACIÓN GENERAL */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.875rem', marginBottom: '6px', color: '#334155' }}>
              05. Retroalimentación / Criterio General (Opcional)
            </label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="Explicación global o criterio de evaluación..."
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
            />
          </div>

          {/* BOTONES DE ACCIÓN */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
              paddingTop: '16px',
              borderTop: '1px solid #e2e8f0',
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ width: 'auto', padding: '10px 24px', fontWeight: 700 }}
            >
              {submitting ? 'Guardando pregunta...' : isEditMode ? 'Guardar Cambios' : 'Crear Pregunta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
