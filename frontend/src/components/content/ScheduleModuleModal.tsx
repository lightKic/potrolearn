import React, { useState, useEffect, useRef } from 'react';
import { Module, Lesson, ScheduleModuleContentItemInput } from '../../types/academic.js';
import { StudentAssessmentDTO } from '../../types/assessment.js';
import { CourseServiceAPI } from '../../services/course.service.js';
import { ApiError } from '../../services/api.js';
import { ButtonSpinner } from '../common/loading/index.js';

interface ContentItemState {
  id: string;
  type: 'LESSON' | 'ASSESSMENT';
  title: string;
  isPublished: boolean;
  wasOriginallyScheduled: boolean;
  selected: boolean;
  date: string;
  time: string;
}

interface ScheduleModuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  module: Module;
  assessments: StudentAssessmentDTO[];
  onSuccess: () => Promise<void>;
}

export const ScheduleModuleModal: React.FC<ScheduleModuleModalProps> = ({
  isOpen,
  onClose,
  courseId,
  module,
  assessments,
  onSuccess,
}) => {
  const [moduleDate, setModuleDate] = useState('');
  const [moduleTime, setModuleTime] = useState('');
  const [items, setItems] = useState<ContentItemState[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  // Helper para desglosar ISO Date String
  const parseISO = (isoStr?: string | null): { date: string; time: string } => {
    if (!isoStr) return { date: '', time: '' };
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return { date: '', time: '' };
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
  };

  // Inicializar estado del modal al abrir
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSubmitting(false);

    // 1. Parsear fecha del módulo
    const parsedMod = parseISO(module.scheduledPublishAt);
    setModuleDate(parsedMod.date);
    setModuleTime(parsedMod.time);

    // 2. Mapear lecciones
    const lessonItems: ContentItemState[] = (module.lessons || []).map((les: Lesson) => {
      const parsedLes = parseISO(les.scheduledPublishAt);
      const isSched = Boolean(les.scheduledPublishAt);
      return {
        id: les.id,
        type: 'LESSON',
        title: les.title,
        isPublished: les.isPublished,
        wasOriginallyScheduled: isSched,
        selected: isSched,
        date: parsedLes.date,
        time: parsedLes.time,
      };
    });

    // 3. Mapear evaluaciones asociadas al módulo
    const assessmentItems: ContentItemState[] = (assessments || [])
      .filter((a) => a.moduleId === module.id)
      .map((ass: StudentAssessmentDTO) => {
        const parsedAss = parseISO(ass.scheduledPublishAt);
        const isSched = Boolean(ass.scheduledPublishAt);
        return {
          id: ass.id,
          type: 'ASSESSMENT',
          title: ass.title,
          isPublished: ass.isPublished,
          wasOriginallyScheduled: isSched,
          selected: isSched,
          date: parsedAss.date,
          time: parsedAss.time,
        };
      });

    setItems([...lessonItems, ...assessmentItems]);
  }, [isOpen, module, assessments]);

  // Manejar estado indeterminado del checkbox global "Seleccionar todo"
  const schedulableItems = items.filter((i) => !i.isPublished);
  const selectedSchedulableCount = schedulableItems.filter((i) => i.selected).length;
  const allSchedulableSelected = schedulableItems.length > 0 && selectedSchedulableCount === schedulableItems.length;
  const isIndeterminate = selectedSchedulableCount > 0 && selectedSchedulableCount < schedulableItems.length;

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  if (!isOpen) return null;

  // Cambiar fecha/hora principal del módulo
  const handleModuleDateTimeChange = (newDate: string, newTime: string) => {
    setModuleDate(newDate);
    setModuleTime(newTime);
  };

  // Manejador del checkbox global "Seleccionar todo"
  const handleToggleSelectAll = (checked: boolean) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.isPublished) return item;
        const newSelected = checked;
        // Si se selecciona y no tiene fecha/hora individual, usar la del módulo como inicial
        const itemDate = newSelected && !item.date ? moduleDate : item.date;
        const itemTime = newSelected && !item.time ? moduleTime : item.time;
        return {
          ...item,
          selected: newSelected,
          date: itemDate,
          time: itemTime,
        };
      })
    );
  };

  // Manejador de selección individual
  const handleToggleItemSelect = (id: string, checked: boolean) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id !== id || item.isPublished) return item;
        const itemDate = checked && !item.date ? moduleDate : item.date;
        const itemTime = checked && !item.time ? moduleTime : item.time;
        return {
          ...item,
          selected: checked,
          date: itemDate,
          time: itemTime,
        };
      })
    );
  };

  // Manejador de cambio de fecha/hora individual de un ítem
  const handleItemDateTimeChange = (id: string, field: 'date' | 'time', value: string) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          [field]: value,
        };
      })
    );
  };

  // Formatear texto amigable de resumen
  const formatFriendlyDate = (dateStr: string, timeStr: string): string => {
    if (!dateStr || !timeStr) return 'Sin fecha definida';
    const [y, m, d] = dateStr.split('-').map(Number);
    const [h, min] = timeStr.split(':').map(Number);
    const localDate = new Date(y, m - 1, d, h, min);
    if (isNaN(localDate.getTime())) return 'Fecha inválida';
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(localDate);
  };

  // Envío del formulario batch al backend
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validar módulo si hay fecha u hora parcial
    if ((moduleDate && !moduleTime) || (!moduleDate && moduleTime)) {
      setError('Por favor especifica tanto la fecha como la hora para la publicación del módulo.');
      return;
    }

    let moduleScheduledISO: string | null = null;
    if (moduleDate && moduleTime) {
      const [y, m, d] = moduleDate.split('-').map(Number);
      const [h, min] = moduleTime.split(':').map(Number);
      const dt = new Date(y, m - 1, d, h, min);
      if (isNaN(dt.getTime())) {
        setError('La fecha u hora del módulo es inválida.');
        return;
      }
      moduleScheduledISO = dt.toISOString();
    }

    // Preparar lista de contenidos
    const contentsPayload: ScheduleModuleContentItemInput[] = [];

    for (const item of items) {
      if (item.isPublished) continue; // No modificar items ya publicados

      if (item.selected) {
        if (!item.date || !item.time) {
          setError(`Por favor define la fecha y hora para el elemento "${item.title}".`);
          return;
        }
        const [y, m, d] = item.date.split('-').map(Number);
        const [h, min] = item.time.split(':').map(Number);
        const dt = new Date(y, m - 1, d, h, min);
        if (isNaN(dt.getTime())) {
          setError(`La fecha u hora para "${item.title}" es inválida.`);
          return;
        }
        contentsPayload.push({
          type: item.type,
          id: item.id,
          scheduledPublishAt: dt.toISOString(),
          action: 'SCHEDULE',
        });
      } else if (item.wasOriginallyScheduled) {
        // Si fue desmarcado un ítem que previamente tenía fecha -> Cancelar su programación
        contentsPayload.push({
          type: item.type,
          id: item.id,
          scheduledPublishAt: null,
          action: 'UNSCHEDULE',
        });
      }
    }

    setSubmitting(true);
    try {
      await CourseServiceAPI.scheduleModuleBatch(courseId, module.id, {
        moduleScheduledPublishAt: moduleScheduledISO,
        contents: contentsPayload.length > 0 ? contentsPayload : undefined,
      });

      await onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Error al guardar la programación del módulo.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const lessonsList = items.filter((i) => i.type === 'LESSON');
  const assessmentsList = items.filter((i) => i.type === 'ASSESSMENT');

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
          maxWidth: '780px',
          maxHeight: '90vh',
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
                backgroundColor: '#eff6ff',
                color: '#1d4ed8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                flexShrink: 0,
              }}
            >
              ⏰
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text, #1e293b)', margin: 0 }}>
                Programar publicación de módulo
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-muted, #64748b)', margin: 0 }}>
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

        {/* BODY (SCROLLABLE) */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {error && (
              <div className="alert alert-danger" style={{ marginBottom: 0 }}>
                {error}
              </div>
            )}

            {/* SECCIÓN 1: PUBLICACIÓN DEL MÓDULO */}
            <div
              style={{
                padding: '18px',
                borderRadius: 'var(--radius-md, 10px)',
                backgroundColor: '#f8fafc',
                border: '1px solid var(--color-border, #e2e8f0)',
              }}
            >
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text, #1e293b)', marginBottom: '4px' }}>
                1. Publicación del Módulo
              </h4>
              <p style={{ fontSize: '0.825rem', color: 'var(--color-muted, #64748b)', marginBottom: '14px' }}>
                Define cuándo estará disponible el encabezado del módulo para los estudiantes.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.825rem' }}>Fecha de publicación</label>
                  <input
                    type="date"
                    className="form-input"
                    value={moduleDate}
                    onChange={(e) => handleModuleDateTimeChange(e.target.value, moduleTime)}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.825rem' }}>Hora de publicación</label>
                  <input
                    type="time"
                    className="form-input"
                    value={moduleTime}
                    onChange={(e) => handleModuleDateTimeChange(moduleDate, e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN 2 & 3: CONTENIDO DEL MÓDULO & PROGRAMACIÓN INDIVIDUAL */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text, #1e293b)', margin: 0 }}>
                    2. Contenido del Módulo
                  </h4>
                  <p style={{ fontSize: '0.825rem', color: 'var(--color-muted, #64748b)', margin: 0 }}>
                    Selecciona qué lecciones y evaluaciones participarán en la programación.
                  </p>
                </div>

                {schedulableItems.length > 0 && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-primary, #0f4c81)' }}>
                    <input
                      ref={selectAllCheckboxRef}
                      type="checkbox"
                      checked={allSchedulableSelected}
                      onChange={(e) => handleToggleSelectAll(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    Seleccionar todo ({selectedSchedulableCount}/{schedulableItems.length})
                  </label>
                )}
              </div>

              {items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-muted, #64748b)', margin: 0 }}>
                    Este módulo no contiene lecciones ni evaluaciones registradas.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* SUB-SECCIÓN: LECCIONES */}
                  {lessonsList.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                        Lecciones ({lessonsList.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {lessonsList.map((les) => (
                          <div
                            key={les.id}
                            style={{
                              padding: '12px 16px',
                              borderRadius: '8px',
                              border: '1px solid var(--color-border, #e2e8f0)',
                              backgroundColor: les.selected ? '#f0f7ff' : '#ffffff',
                              transition: 'all 0.15s ease',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: les.isPublished ? 'not-allowed' : 'pointer', flex: 1 }}>
                                <input
                                  type="checkbox"
                                  checked={les.selected}
                                  disabled={les.isPublished}
                                  onChange={(e) => handleToggleItemSelect(les.id, e.target.checked)}
                                  style={{ width: '16px', height: '16px', cursor: les.isPublished ? 'not-allowed' : 'pointer' }}
                                />
                                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text, #1e293b)' }}>
                                  📖 {les.title}
                                </span>
                              </label>

                              {/* BADGE DE ESTADO */}
                              {les.isPublished ? (
                                <span className="role-pill student" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>Publicada 🟢</span>
                              ) : les.selected ? (
                                <span className="role-pill" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: '0.7rem', padding: '2px 8px' }}>
                                  Programada ⏰
                                </span>
                              ) : (
                                <span className="role-pill admin" style={{ backgroundColor: '#fef3c7', color: '#92400e', fontSize: '0.7rem', padding: '2px 8px' }}>
                                  Borrador (Sin programación) 🟡
                                </span>
                              )}
                            </div>

                            {/* CONTROLES FECHA/HORA INDIVIDUAL */}
                            {!les.isPublished && (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', opacity: les.selected ? 1 : 0.45 }}>
                                <div>
                                  <input
                                    type="date"
                                    className="form-input"
                                    style={{ fontSize: '0.85rem', padding: '6px 10px' }}
                                    value={les.date}
                                    disabled={!les.selected}
                                    onChange={(e) => handleItemDateTimeChange(les.id, 'date', e.target.value)}
                                  />
                                </div>
                                <div>
                                  <input
                                    type="time"
                                    className="form-input"
                                    style={{ fontSize: '0.85rem', padding: '6px 10px' }}
                                    value={les.time}
                                    disabled={!les.selected}
                                    onChange={(e) => handleItemDateTimeChange(les.id, 'time', e.target.value)}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SUB-SECCIÓN: EVALUACIONES */}
                  {assessmentsList.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                        Evaluaciones ({assessmentsList.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {assessmentsList.map((ass) => (
                          <div
                            key={ass.id}
                            style={{
                              padding: '12px 16px',
                              borderRadius: '8px',
                              border: '1px solid var(--color-border, #e2e8f0)',
                              backgroundColor: ass.selected ? '#f0f7ff' : '#ffffff',
                              transition: 'all 0.15s ease',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: ass.isPublished ? 'not-allowed' : 'pointer', flex: 1 }}>
                                <input
                                  type="checkbox"
                                  checked={ass.selected}
                                  disabled={ass.isPublished}
                                  onChange={(e) => handleToggleItemSelect(ass.id, e.target.checked)}
                                  style={{ width: '16px', height: '16px', cursor: ass.isPublished ? 'not-allowed' : 'pointer' }}
                                />
                                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text, #1e293b)' }}>
                                  📝 {ass.title}
                                </span>
                              </label>

                              {/* BADGE DE ESTADO */}
                              {ass.isPublished ? (
                                <span className="role-pill student" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>Publicada 🟢</span>
                              ) : ass.selected ? (
                                <span className="role-pill" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: '0.7rem', padding: '2px 8px' }}>
                                  Programada ⏰
                                </span>
                              ) : (
                                <span className="role-pill admin" style={{ backgroundColor: '#fef3c7', color: '#92400e', fontSize: '0.7rem', padding: '2px 8px' }}>
                                  Borrador (Sin programación) 🟡
                                </span>
                              )}
                            </div>

                            {/* CONTROLES FECHA/HORA INDIVIDUAL */}
                            {!ass.isPublished && (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', opacity: ass.selected ? 1 : 0.45 }}>
                                <div>
                                  <input
                                    type="date"
                                    className="form-input"
                                    style={{ fontSize: '0.85rem', padding: '6px 10px' }}
                                    value={ass.date}
                                    disabled={!ass.selected}
                                    onChange={(e) => handleItemDateTimeChange(ass.id, 'date', e.target.value)}
                                  />
                                </div>
                                <div>
                                  <input
                                    type="time"
                                    className="form-input"
                                    style={{ fontSize: '0.85rem', padding: '6px 10px' }}
                                    value={ass.time}
                                    disabled={!ass.selected}
                                    onChange={(e) => handleItemDateTimeChange(ass.id, 'time', e.target.value)}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SECCIÓN 4: RESUMEN DINÁMICO */}
            <div
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-md, 10px)',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e40af' }}>
                  Resumen de Programación
                </div>
                <div style={{ fontSize: '0.825rem', color: '#1e3a8a', marginTop: '2px' }}>
                  <strong>Módulo:</strong> {moduleDate && moduleTime ? formatFriendlyDate(moduleDate, moduleTime) : 'Sin programación de módulo'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '0.825rem', fontWeight: 600 }}>
                <span style={{ color: '#047857', backgroundColor: '#dcfce7', padding: '4px 10px', borderRadius: '6px' }}>
                  ✓ {items.filter((i) => i.selected).length} seleccionados
                </span>
                <span style={{ color: '#92400e', backgroundColor: '#fef3c7', padding: '4px 10px', borderRadius: '6px' }}>
                  • {items.filter((i) => !i.selected && !i.isPublished).length} sin programación
                </span>
              </div>
            </div>
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
              style={{ width: 'auto' }}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <ButtonSpinner /> Guardando programación...
                </>
              ) : (
                'Guardar programación'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
