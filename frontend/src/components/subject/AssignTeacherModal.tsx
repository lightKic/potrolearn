import React, { useEffect, useState, useMemo } from 'react';
import { Subject } from '../../types/academic.js';
import { CourseServiceAPI, AdminTeacher } from '../../services/course.service.js';
import { SubjectServiceAPI } from '../../services/subject.service.js';
import { ApiError } from '../../services/api.js';
import { ButtonSpinner, SectionLoading } from '../common/loading/index.js';

interface AssignTeacherModalProps {
  isOpen: boolean;
  subject: Subject | null;
  onClose: () => void;
  onTeacherAssigned: () => void;
}

export const AssignTeacherModal: React.FC<AssignTeacherModalProps> = ({
  isOpen,
  subject,
  onClose,
  onTeacherAssigned,
}) => {
  const [teachers, setTeachers] = useState<AdminTeacher[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const assignedTeacherIds = useMemo(() => {
    return new Set(subject?.subjectTeachers?.map((st) => st.teacherId) || []);
  }, [subject]);

  useEffect(() => {
    if (isOpen && subject) {
      setSearchQuery('');
      setError(null);
      setSuccessMsg(null);
      setLoading(true);
      CourseServiceAPI.getAvailableTeachers()
        .then((data) => setTeachers(data))
        .catch((err) => {
          if (err instanceof ApiError) {
            setError(err.message);
          } else {
            setError('Error al cargar la lista de maestros.');
          }
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, subject]);

  if (!isOpen || !subject) return null;

  const filteredTeachers = teachers.filter((t) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q);
  });

  const handleAssign = async (teacherId: string, teacherName: string) => {
    setAssigningId(teacherId);
    setError(null);
    setSuccessMsg(null);
    try {
      await SubjectServiceAPI.assignTeacherToSubject(subject.id, teacherId);
      setSuccessMsg(`Maestro ${teacherName} asignado correctamente.`);
      onTeacherAssigned();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('No fue posible asignar al maestro.');
      }
    } finally {
      setAssigningId(null);
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-teacher-modal-title"
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
        zIndex: 1100,
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
          maxWidth: '520px',
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
            alignItems: 'flex-start',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          <div>
            <h2
              id="assign-teacher-modal-title"
              className="page-title"
              style={{ fontSize: '1.25rem', marginBottom: '4px' }}
            >
              Asignar Maestro Autorizado
            </h2>
            <p className="page-description" style={{ fontSize: '0.85rem', marginBottom: 0 }}>
              Selecciona un maestro para autorizar la creación de cursos en{' '}
              <strong style={{ color: 'var(--color-primary)' }}>{subject.code} — {subject.name}</strong>
            </p>
          </div>
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

        {/* Search Bar */}
        <div style={{ padding: '16px 24px 8px 24px', backgroundColor: 'var(--color-surface)' }}>
          <div style={{ position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-muted)',
                fontSize: '0.9rem',
              }}
            >
              🔍
            </span>
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '36px', fontSize: '0.9rem' }}
              placeholder="Buscar maestro por nombre o correo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Feedback Alerts */}
        <div style={{ padding: '0 24px' }}>
          {error && (
            <div className="alert alert-danger" style={{ marginTop: '8px', marginBottom: '8px', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}
          {successMsg && (
            <div className="alert alert-success" style={{ marginTop: '8px', marginBottom: '8px', fontSize: '0.85rem' }}>
              {successMsg}
            </div>
          )}
        </div>

        {/* Content list */}
        <div
          style={{
            padding: '8px 24px 20px 24px',
            overflowY: 'auto',
            flex: 1,
            maxHeight: '420px',
          }}
        >
          {loading ? (
            <SectionLoading title="Cargando maestros disponibles..." minHeight="140px" />
          ) : filteredTeachers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--color-muted)' }}>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>
                {searchQuery
                  ? 'No se encontraron maestros con ese criterio de búsqueda.'
                  : 'No hay maestros registrados en la plataforma.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredTeachers.map((teacher) => {
                const isAssigned = assignedTeacherIds.has(teacher.id);
                const isProcessing = assigningId === teacher.id;

                return (
                  <div
                    key={teacher.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md, 8px)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: isAssigned ? 'var(--color-background-alt, rgba(0, 0, 0, 0.02))' : 'var(--color-surface)',
                      transition: 'all 0.15s ease',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--color-primary-light, rgba(79, 70, 229, 0.1))',
                          color: 'var(--color-primary, #4f46e5)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          flexShrink: 0,
                        }}
                      >
                        {getInitials(teacher.name)}
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            color: 'var(--color-text)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {teacher.name}
                        </div>
                        <div
                          style={{
                            fontSize: '0.8rem',
                            color: 'var(--color-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {teacher.email}
                        </div>
                      </div>
                    </div>

                    <div style={{ flexShrink: 0 }}>
                      {isAssigned ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            fontSize: '0.8rem',
                            fontWeight: 500,
                            borderRadius: 'var(--radius-full, 9999px)',
                            backgroundColor: 'var(--color-success-light, rgba(16, 185, 129, 0.1))',
                            color: 'var(--color-success, #10b981)',
                          }}
                        >
                          ✓ Asignado
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn-primary"
                          style={{
                            padding: '6px 14px',
                            fontSize: '0.825rem',
                            width: 'auto',
                            minWidth: '85px',
                          }}
                          disabled={isProcessing}
                          onClick={() => handleAssign(teacher.id, teacher.name)}
                        >
                          {isProcessing ? <ButtonSpinner /> : 'Asignar'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            className="btn-secondary"
            style={{ width: 'auto', padding: '8px 18px', fontSize: '0.875rem' }}
            onClick={onClose}
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
