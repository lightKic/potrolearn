import React, { useEffect, useState } from 'react';
import { QuestionDTO, QuestionType, AssessmentDTO } from '../../types/assessment.js';
import { QuestionServiceAPI } from '../../services/question.service.js';
import { ApiError } from '../../services/api.js';
import { MarkdownContent } from '../MarkdownContent.js';

interface QuestionBankDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  assessmentId: string;
  existingQuestionIds: string[];
  onQuestionAdded: (updatedAssessment?: AssessmentDTO) => void;
}

export const QuestionBankDrawer: React.FC<QuestionBankDrawerProps> = ({
  isOpen,
  onClose,
  assessmentId,
  existingQuestionIds = [],
  onQuestionAdded,
}) => {
  const [bankQuestions, setBankQuestions] = useState<QuestionDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  // Estado para la pregunta en proceso de agregar
  const [addingQuestionId, setAddingQuestionId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Carga de preguntas del banco al abrir
  useEffect(() => {
    if (!isOpen) return;

    fetchBankQuestions();
    setSearchQuery('');
    setSelectedType('ALL');
    setActionMessage(null);
  }, [isOpen]);

  const fetchBankQuestions = () => {
    setLoading(true);
    setError(null);

    QuestionServiceAPI.getQuestions()
      .then((data) => {
        setBankQuestions(data);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Error al cargar las preguntas del Banco de Preguntas');
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // Agregar pregunta seleccionada a la evaluación
  const handleAddQuestion = async (q: QuestionDTO) => {
    setAddingQuestionId(q.id);
    setActionMessage(null);
    setError(null);

    try {
      const updatedAssessment = await QuestionServiceAPI.addQuestionToAssessment(assessmentId, {
        questionId: q.id,
        points: q.defaultPoints,
      });

      setActionMessage(`✓ Pregunta agregada exitosamente a la evaluación.`);
      onQuestionAdded(updatedAssessment);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409 || err.code === 'QUESTION_ALREADY_IN_ASSESSMENT') {
          setError('Esta pregunta ya fue agregada previamente a esta evaluación.');
        } else if (err.status === 409 || err.code === 'ASSESSMENT_HAS_ATTEMPTS') {
          setError('No se pueden agregar nuevas preguntas porque esta evaluación ya cuenta con intentos de alumnos entregados.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Error al agregar la pregunta a la evaluación.');
      }
    } finally {
      setAddingQuestionId(null);
    }
  };

  if (!isOpen) return null;

  // Filtrado en el cliente
  const filteredQuestions = bankQuestions.filter((q) => {
    const matchesSearch = searchQuery.trim() === '' || q.statement.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'ALL' || q.type === selectedType;
    return matchesSearch && matchesType;
  });

  const getQuestionTypeBadge = (type: QuestionType) => {
    switch (type) {
      case 'MULTIPLE_CHOICE':
        return { label: 'Opción múltiple', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
      case 'MULTIPLE_SELECT':
        return { label: 'Selección múltiple', bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' };
      case 'TRUE_FALSE':
        return { label: 'Verdadero / Falso', bg: '#fefce8', color: '#a16207', border: '#fef08a' };
      case 'NUMERIC':
        return { label: 'Respuesta numérica', bg: '#faf5ff', color: '#7e22ce', border: '#e9d5ff' };
      case 'OPEN_TEXT':
        return { label: 'Respuesta abierta', bg: '#fff7ed', color: '#c2410c', border: '#ffedd5' };
      default:
        return { label: type, bg: '#f1f5f9', color: '#334155', border: '#cbd5e1' };
    }
  };

  const existingSet = new Set(existingQuestionIds);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(3px)',
        zIndex: 999,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      {/* Contenedor del Drawer Lateral */}
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          height: '100%',
          backgroundColor: 'var(--color-surface, #ffffff)',
          boxShadow: '-10px 0 25px -5px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Header del Drawer */}
        <div
          style={{
            padding: '24px 24px 16px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            backgroundColor: '#ffffff',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text, #0f172a)' }}>
              📚 Banco de Preguntas
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-muted, #64748b)', marginTop: '4px' }}>
              Explora e importa reactivos existentes a esta evaluación.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
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

        {/* Barra de Filtros y Búsqueda */}
        <div style={{ padding: '16px 24px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ marginBottom: '10px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="🔎 Buscar por enunciado..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select
              className="form-input"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              style={{ fontSize: '0.85rem', fontWeight: 600, flex: 1 }}
            >
              <option value="ALL">Todos los tipos</option>
              <option value="MULTIPLE_CHOICE">🔘 Opción múltiple</option>
              <option value="MULTIPLE_SELECT">☑️ Selección múltiple</option>
              <option value="TRUE_FALSE">⚖️ Verdadero / Falso</option>
              <option value="NUMERIC">🔢 Respuesta numérica</option>
              <option value="OPEN_TEXT">✍️ Respuesta abierta</option>
            </select>
          </div>
        </div>

        {/* Notificaciones y Alertas */}
        <div style={{ padding: actionMessage || error ? '12px 24px 0 24px' : '0' }}>
          {actionMessage && (
            <div className="alert alert-success" style={{ fontSize: '0.85rem', padding: '10px 14px', marginBottom: '8px' }}>
              {actionMessage}
            </div>
          )}
          {error && (
            <div className="alert alert-error" style={{ fontSize: '0.85rem', padding: '10px 14px', marginBottom: '8px' }}>
              {error}
            </div>
          )}
        </div>

        {/* Lista de Preguntas del Banco */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[1, 2, 3, 4].map((idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '16px',
                    opacity: 0.6,
                    animation: 'pulse 1.5s infinite ease-in-out',
                  }}
                >
                  <div style={{ width: '100px', height: '18px', backgroundColor: '#e2e8f0', borderRadius: '4px', marginBottom: '8px' }} />
                  <div style={{ width: '80%', height: '16px', backgroundColor: '#e2e8f0', borderRadius: '4px' }} />
                </div>
              ))}
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: '#64748b' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔍</div>
              <h4 style={{ fontWeight: 700, color: '#334155' }}>No se encontraron reactivos</h4>
              <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                {searchQuery || selectedType !== 'ALL'
                  ? 'Intenta cambiar los filtros de búsqueda.'
                  : 'Aún no existen preguntas registradas en el Banco de Preguntas.'}
              </p>
            </div>
          ) : (
            filteredQuestions.map((q) => {
              const isAdded = existingSet.has(q.id);
              const badge = getQuestionTypeBadge(q.type);
              const isAdding = addingQuestionId === q.id;

              return (
                <div
                  key={q.id}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: `1px solid ${isAdded ? '#bbf7d0' : '#e2e8f0'}`,
                    padding: '16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '12px',
                      }}
                    >
                      {badge.label}
                    </span>

                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                      Puntos base: {q.defaultPoints} pts
                    </span>
                  </div>

                  <div style={{ fontSize: '0.875rem' }}>
                    <MarkdownContent content={q.statement} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                    {isAdded ? (
                      <span
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          color: '#15803d',
                          backgroundColor: '#dcfce7',
                          padding: '4px 12px',
                          borderRadius: '8px',
                          border: '1px solid #86efac',
                        }}
                      >
                        ✓ Ya agregada
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleAddQuestion(q)}
                        disabled={isAdding}
                        style={{ fontSize: '0.8rem', padding: '6px 14px', fontWeight: 700, width: 'auto' }}
                      >
                        {isAdding ? 'Agregando...' : '➕ Agregar'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
