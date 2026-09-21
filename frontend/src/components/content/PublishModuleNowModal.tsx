import React, { useState, useEffect } from 'react';
import { Module, Lesson } from '../../types/academic.js';
import { StudentAssessmentDTO } from '../../types/assessment.js';
import { CourseServiceAPI } from '../../services/course.service.js';
import { ApiError } from '../../services/api.js';
import { ButtonSpinner } from '../common/loading/index.js';

interface PublishModuleNowModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  module: Module;
  assessments: StudentAssessmentDTO[];
  onSuccess: () => Promise<void>;
}

interface SelectableContentItem {
  id: string;
  type: 'LESSON' | 'ASSESSMENT';
  title: string;
  isPublished: boolean;
}

export const PublishModuleNowModal: React.FC<PublishModuleNowModalProps> = ({
  isOpen,
  onClose,
  courseId,
  module,
  assessments,
  onSuccess,
}) => {
  const [publishMode, setPublishMode] = useState<'ONLY_MODULE' | 'MODULE_AND_CONTENT'>('MODULE_AND_CONTENT');
  const [selectableItems, setSelectableItems] = useState<SelectableContentItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSubmitting(false);
    setPublishMode('MODULE_AND_CONTENT');

    const lessonsList: SelectableContentItem[] = (module.lessons || []).map((l: Lesson) => ({
      id: l.id,
      type: 'LESSON',
      title: l.title,
      isPublished: l.isPublished,
    }));

    const assessmentsList: SelectableContentItem[] = (assessments || [])
      .filter((a) => a.moduleId === module.id)
      .map((a: StudentAssessmentDTO) => ({
        id: a.id,
        type: 'ASSESSMENT',
        title: a.title,
        isPublished: a.isPublished,
      }));

    const allItems = [...lessonsList, ...assessmentsList];
    setSelectableItems(allItems);

    // Seleccionar por defecto todos los que estén pendientes de publicación
    const initialMap: Record<string, boolean> = {};
    for (const item of allItems) {
      if (!item.isPublished) {
        initialMap[item.id] = true;
      }
    }
    setSelectedIds(initialMap);
  }, [isOpen, module, assessments]);

  if (!isOpen) return null;

  const handleToggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => ({
      ...prev,
      [id]: checked,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const activeSelectedIds = Object.keys(selectedIds).filter((id) => selectedIds[id]);

    setSubmitting(true);
    try {
      await CourseServiceAPI.publishModuleNow(courseId, module.id, {
        publishModuleOnly: publishMode === 'ONLY_MODULE',
        publishContentIds: publishMode === 'MODULE_AND_CONTENT' ? activeSelectedIds : undefined,
      });

      await onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Error al publicar el módulo.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = selectableItems.filter((i) => !i.isPublished).length;

  return (
    <div
      className="modal-overlay"
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
      onClick={onClose}
    >
      <div
        className="modal-card"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg, 16px)',
          boxShadow: 'var(--shadow-lg, 0 20px 25px -5px rgba(0, 0, 0, 0.1))',
          width: '100%',
          maxWidth: '620px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--color-border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#ecfdf5',
                color: '#047857',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                flexShrink: 0,
              }}
            >
              ⚡
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text, #1e293b)', margin: 0 }}>
                Publicar módulo ahora
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-muted, #64748b)', margin: 0 }}>
                {module.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.4rem',
              color: 'var(--color-muted, #64748b)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
            }}
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* BODY */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {error && (
              <div className="alert alert-danger" style={{ marginBottom: 0 }}>
                {error}
              </div>
            )}

            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text, #1e293b)' }}>
              ¿Qué deseas publicar inmediatamente en este módulo?
            </div>

            {/* RADIO OPTIONS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  backgroundColor: publishMode === 'ONLY_MODULE' ? '#f0f7ff' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <input
                  type="radio"
                  name="publishMode"
                  checked={publishMode === 'ONLY_MODULE'}
                  onChange={() => setPublishMode('ONLY_MODULE')}
                  style={{ marginTop: '3px', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text, #1e293b)' }}>
                    Solo el módulo
                  </div>
                  <div style={{ fontSize: '0.825rem', color: 'var(--color-muted, #64748b)', marginTop: '2px' }}>
                    Publica únicamente el encabezado del módulo. Las lecciones y evaluaciones conservan su estado actual.
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  backgroundColor: publishMode === 'MODULE_AND_CONTENT' ? '#f0f7ff' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <input
                  type="radio"
                  name="publishMode"
                  checked={publishMode === 'MODULE_AND_CONTENT'}
                  onChange={() => setPublishMode('MODULE_AND_CONTENT')}
                  style={{ marginTop: '3px', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text, #1e293b)' }}>
                    Módulo + contenido seleccionado ({pendingCount} disponibles)
                  </div>
                  <div style={{ fontSize: '0.825rem', color: 'var(--color-muted, #64748b)', marginTop: '2px' }}>
                    Publica el módulo y los elementos pedagógicos que selecciones a continuación.
                  </div>
                </div>
              </label>
            </div>

            {/* SELECCIÓN DE CONTENIDOS (SOLO SI MODULE_AND_CONTENT) */}
            {publishMode === 'MODULE_AND_CONTENT' && (
              <div
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Seleccionar contenido a publicar
                </div>

                {selectableItems.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-muted, #64748b)', margin: 0, fontStyle: 'italic' }}>
                    No hay contenidos asociados a este módulo.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                    {selectableItems.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: item.isPublished ? 'not-allowed' : 'pointer', flex: 1 }}>
                          <input
                            type="checkbox"
                            checked={Boolean(selectedIds[item.id])}
                            disabled={item.isPublished}
                            onChange={(e) => handleToggleSelect(item.id, e.target.checked)}
                            style={{ width: '16px', height: '16px', cursor: item.isPublished ? 'not-allowed' : 'pointer' }}
                          />
                          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text, #1e293b)' }}>
                            {item.type === 'LESSON' ? '📖' : '📝'} {item.title}
                          </span>
                        </label>

                        {item.isPublished ? (
                          <span className="role-pill student" style={{ fontSize: '0.675rem', padding: '1px 6px' }}>Ya publicada 🟢</span>
                        ) : (
                          <span className="role-pill admin" style={{ backgroundColor: '#fef3c7', color: '#92400e', fontSize: '0.675rem', padding: '1px 6px' }}>Pendiente 🟡</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* FOOTER */}
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--color-border, #e2e8f0)',
              backgroundColor: '#f8fafc',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
            }}
          >
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary"
              style={{ width: 'auto', backgroundColor: '#047857', borderColor: '#047857' }}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <ButtonSpinner /> Publicando...
                </>
              ) : (
                '⚡ Publicar ahora'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
