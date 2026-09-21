import React, { useEffect, useState } from 'react';
import { Subject } from '../../types/academic.js';
import { SubjectServiceAPI } from '../../services/subject.service.js';
import { ApiError } from '../../services/api.js';
import { ButtonSpinner } from '../common/loading/index.js';
import { AssignTeacherModal } from './AssignTeacherModal.js';

interface EditSubjectModalProps {
  isOpen: boolean;
  subject: Subject | null;
  onClose: () => void;
  onSubjectSaved: () => void;
}

export const EditSubjectModal: React.FC<EditSubjectModalProps> = ({
  isOpen,
  subject,
  onClose,
  onSubjectSaved,
}) => {
  const [currentSubject, setCurrentSubject] = useState<Subject | null>(subject);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal de asignación de maestros
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Modal de confirmación para quitar maestro
  const [teacherToRemove, setTeacherToRemove] = useState<{ id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    setCurrentSubject(subject);
    if (subject) {
      setFormCode(subject.code);
      setFormName(subject.name);
      setFormDescription(subject.description || '');
    } else {
      setFormCode('');
      setFormName('');
      setFormDescription('');
    }
    setError(null);
    setSuccessMsg(null);
  }, [subject, isOpen]);

  const refreshSubjectData = async () => {
    if (!currentSubject) return;
    try {
      const allSubjects = await SubjectServiceAPI.getSubjects();
      const updated = allSubjects.find((s) => s.id === currentSubject.id);
      if (updated) {
        setCurrentSubject(updated);
      }
      onSubjectSaved();
    } catch (err) {
      console.error('Error refreshing subject:', err);
    }
  };

  if (!isOpen) return null;

  const handleSubmitInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!formCode.trim() || !formName.trim()) {
      setError('Por favor introduce la clave y el nombre de la materia.');
      return;
    }

    setSubmitting(true);
    try {
      if (currentSubject) {
        await SubjectServiceAPI.updateSubject(currentSubject.id, {
          code: formCode.trim(),
          name: formName.trim(),
          description: formDescription.trim(),
        });
        setSuccessMsg('Información de la materia actualizada.');
      } else {
        await SubjectServiceAPI.createSubject({
          code: formCode.trim(),
          name: formName.trim(),
          description: formDescription.trim(),
        });
      }
      onSubjectSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Error al guardar los datos de la materia.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmRemoveTeacher = async () => {
    if (!currentSubject || !teacherToRemove) return;
    setRemoving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await SubjectServiceAPI.removeTeacherFromSubject(currentSubject.id, teacherToRemove.id);
      setSuccessMsg(`Maestro ${teacherToRemove.name} retirado de la materia.`);
      setTeacherToRemove(null);
      await refreshSubjectData();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Error al remover al maestro de la materia.');
      }
    } finally {
      setRemoving(false);
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const isEditing = Boolean(currentSubject);

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-subject-modal-title"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="auth-card"
          style={{
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            overflow: 'hidden',
            borderRadius: 'var(--radius-lg, 12px)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--color-surface)',
            }}
          >
            <h2 id="edit-subject-modal-title" className="page-title" style={{ fontSize: '1.25rem', margin: 0 }}>
              {isEditing ? 'Editar materia' : 'Nueva materia'}
            </h2>
            <button
              type="button"
              className="btn-secondary"
              style={{
                padding: '4px 10px',
                fontSize: '0.9rem',
                borderRadius: 'var(--radius-md)',
                lineHeight: 1,
              }}
              onClick={onClose}
              aria-label="Cerrar modal"
            >
              ✕
            </button>
          </div>

          {/* Modal Body */}
          <div
            style={{
              padding: '24px',
              overflowY: 'auto',
              flex: 1,
            }}
          >
            {error && (
              <div className="alert alert-danger" style={{ marginBottom: '16px', fontSize: '0.875rem' }}>
                {error}
              </div>
            )}
            {successMsg && (
              <div className="alert alert-success" style={{ marginBottom: '16px', fontSize: '0.875rem' }}>
                {successMsg}
              </div>
            )}

            <form id="edit-subject-form" onSubmit={handleSubmitInfo}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '12px' }}>
                Información de la materia
              </h3>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" htmlFor="subject-code">
                  Clave / Código de materia
                </label>
                <input
                  id="subject-code"
                  type="text"
                  className="form-input"
                  placeholder="Ej: MAT-101, PROG-202"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" htmlFor="subject-name">
                  Nombre de la materia
                </label>
                <input
                  id="subject-name"
                  type="text"
                  className="form-input"
                  placeholder="Ej: Programación Orientada a Objetos"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" htmlFor="subject-description">
                  Descripción (Opcional)
                </label>
                <textarea
                  id="subject-description"
                  className="form-input"
                  rows={2}
                  placeholder="Breve resumen temático del contenido de la materia..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  disabled={submitting}
                />
              </div>

              {/* Unique Section: Maestros Autorizados */}
              {isEditing && (
                <div
                  style={{
                    borderTop: '1px solid var(--color-border)',
                    paddingTop: '20px',
                    marginTop: '20px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '12px',
                    }}
                  >
                    <div>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text)', margin: '0 0 2px 0' }}>
                        Maestros autorizados ({currentSubject?.subjectTeachers?.length || 0})
                      </h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', margin: 0 }}>
                        Los maestros asignados pueden crear cursos de esta materia.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.8rem',
                        width: 'auto',
                        whiteSpace: 'nowrap',
                      }}
                      onClick={() => setIsAssignModalOpen(true)}
                    >
                      + Asignar maestro
                    </button>
                  </div>

                  {currentSubject?.subjectTeachers && currentSubject.subjectTeachers.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                      {currentSubject.subjectTeachers.map((st) => (
                        <div
                          key={st.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            backgroundColor: 'var(--color-background, #f9fafb)',
                            borderRadius: 'var(--radius-md, 8px)',
                            border: '1px solid var(--color-border)',
                            gap: '12px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--color-primary-light, rgba(79, 70, 229, 0.1))',
                                color: 'var(--color-primary, #4f46e5)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 600,
                                fontSize: '0.8rem',
                                flexShrink: 0,
                              }}
                            >
                              {getInitials(st.teacher?.name || 'M')}
                            </div>
                            <div style={{ overflow: 'hidden' }}>
                              <div
                                style={{
                                  fontSize: '0.875rem',
                                  fontWeight: 600,
                                  color: 'var(--color-text)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {st.teacher?.name || 'Maestro'}
                              </div>
                              <div
                                style={{
                                  fontSize: '0.775rem',
                                  color: 'var(--color-muted)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {st.teacher?.email}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="btn-logout"
                            style={{
                              padding: '4px 10px',
                              fontSize: '0.775rem',
                              width: 'auto',
                              flexShrink: 0,
                            }}
                            onClick={() =>
                              setTeacherToRemove({
                                id: st.teacherId,
                                name: st.teacher?.name || 'este maestro',
                              })
                            }
                          >
                            Quitar
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '24px 16px',
                        backgroundColor: 'var(--color-background, #f9fafb)',
                        borderRadius: 'var(--radius-md, 8px)',
                        border: '1px dashed var(--color-border)',
                        marginTop: '12px',
                      }}
                    >
                      <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '12px' }}>
                        Aún no hay maestros asignados. Asigna el primer maestro para permitirle crear cursos de esta materia.
                      </p>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '6px 14px', fontSize: '0.8rem', width: 'auto', margin: '0 auto' }}
                        onClick={() => setIsAssignModalOpen(true)}
                      >
                        + Asignar maestro
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Form Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  marginTop: '24px',
                  borderTop: '1px solid var(--color-border)',
                  paddingTop: '16px',
                }}
              >
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ width: 'auto', padding: '8px 18px', fontSize: '0.875rem' }}
                  onClick={onClose}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ width: 'auto', padding: '8px 20px', fontSize: '0.875rem' }}
                  disabled={submitting}
                >
                  {submitting ? <><ButtonSpinner /> Guardando...</> : isEditing ? 'Guardar cambios' : 'Crear materia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Assign Teacher Drawer / Modal */}
      <AssignTeacherModal
        isOpen={isAssignModalOpen}
        subject={currentSubject}
        onClose={() => setIsAssignModalOpen(false)}
        onTeacherAssigned={() => {
          refreshSubjectData();
        }}
      />

      {/* Premium Confirm Modal for Teacher Removal */}
      {teacherToRemove && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !removing) setTeacherToRemove(null);
          }}
        >
          <div
            className="auth-card"
            style={{
              width: '100%',
              maxWidth: '440px',
              padding: '24px',
              borderRadius: 'var(--radius-lg, 12px)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
            }}
          >
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '12px' }}>
              Quitar maestro
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text)', lineHeight: 1.5, marginBottom: '12px' }}>
              ¿Quieres quitar a <strong>{teacherToRemove.name}</strong> de esta materia?
            </p>
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--color-muted)',
                backgroundColor: 'var(--color-background, #f9fafb)',
                padding: '12px',
                borderRadius: 'var(--radius-md, 6px)',
                marginBottom: '20px',
                lineHeight: 1.4,
              }}
            >
              • El maestro dejará de poder crear nuevos cursos de esta materia.<br />
              • Sus cursos existentes no se modificarán.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ width: 'auto', padding: '8px 16px', fontSize: '0.85rem' }}
                onClick={() => setTeacherToRemove(null)}
                disabled={removing}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-logout"
                style={{ width: 'auto', padding: '8px 18px', fontSize: '0.85rem', backgroundColor: '#ef4444', color: '#fff' }}
                onClick={handleConfirmRemoveTeacher}
                disabled={removing}
              >
                {removing ? <><ButtonSpinner /> Quitando...</> : 'Quitar maestro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
