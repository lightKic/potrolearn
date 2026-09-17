import React, { useEffect, useState } from 'react';
import { Subject } from '../types/academic.js';
import { SubjectServiceAPI } from '../services/subject.service.js';
import { ApiError } from '../services/api.js';

export const SubjectsPage: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // State para modal/drawer de Crear / Editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchSubjects = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await SubjectServiceAPI.getSubjects();
      setSubjects(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('No fue posible cargar el catálogo de materias.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const handleOpenCreate = () => {
    setEditingSubject(null);
    setFormCode('');
    setFormName('');
    setFormDescription('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (subject: Subject) => {
    setEditingSubject(subject);
    setFormCode(subject.code);
    setFormName(subject.name);
    setFormDescription(subject.description || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formCode.trim() || !formName.trim()) {
      setFormError('Por favor introduce la clave y el nombre de la materia.');
      return;
    }

    setFormSubmitting(true);
    try {
      if (editingSubject) {
        await SubjectServiceAPI.updateSubject(editingSubject.id, {
          code: formCode.trim(),
          name: formName.trim(),
          description: formDescription.trim(),
        });
      } else {
        await SubjectServiceAPI.createSubject({
          code: formCode.trim(),
          name: formName.trim(),
          description: formDescription.trim(),
        });
      }
      setIsModalOpen(false);
      await fetchSubjects();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError('Error al guardar los datos de la materia.');
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" id="subjects-page-title">
            Gestión de Materias
          </h1>
          <p className="page-description" id="subjects-page-desc" style={{ marginBottom: 0 }}>
            Catálogo global de materias registradas en PotroLearn.
          </p>
        </div>
        <button
          type="button"
          id="btn-new-subject"
          className="btn-primary"
          style={{ width: 'auto' }}
          onClick={handleOpenCreate}
        >
          + Nueva materia
        </button>
      </div>

      {errorMessage && (
        <div className="alert alert-danger" id="subjects-error-alert">
          {errorMessage}
        </div>
      )}

      {loading ? (
        <div className="loading-content" style={{ padding: '40px 0' }}>
          <div className="loading-spinner" />
          <p className="loading-text">Cargando materias...</p>
        </div>
      ) : subjects.length === 0 ? (
        <div className="dashboard-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <h3 className="dashboard-card-title">Aún no hay materias registradas</h3>
          <p className="dashboard-card-desc" style={{ marginBottom: '20px' }}>
            Crea la primera materia para poder asociar cursos académicos.
          </p>
          <button
            type="button"
            className="btn-primary"
            style={{ width: 'auto', margin: '0 auto' }}
            onClick={handleOpenCreate}
          >
            Crear primera materia
          </button>
        </div>
      ) : (
        <div className="dashboard-grid">
          {subjects.map((subject) => (
            <div className="dashboard-card" key={subject.id} id={`subject-card-${subject.id}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <span className="role-pill teacher" style={{ fontSize: '0.8rem' }}>
                  {subject.code}
                </span>
                <span style={{ fontSize: '0.8rem', color: subject.isActive ? 'var(--color-success)' : 'var(--color-muted)' }}>
                  {subject.isActive ? '● Activa' : '○ Inactiva'}
                </span>
              </div>
              <h3 className="dashboard-card-title">{subject.name}</h3>
              <p className="dashboard-card-desc" style={{ marginBottom: '16px' }}>
                {subject.description || 'Sin descripción especificada.'}
              </p>
              <button
                type="button"
                id={`btn-edit-subject-${subject.id}`}
                className="btn-secondary"
                style={{ width: '100%' }}
                onClick={() => handleOpenEdit(subject)}
              >
                Editar materia
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Crear / Editar Materia */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div className="auth-card" style={{ maxWidth: '500px' }}>
            <h2 className="page-title" style={{ fontSize: '1.35rem', marginBottom: '16px' }}>
              {editingSubject ? 'Editar materia' : 'Nueva materia'}
            </h2>

            {formError && (
              <div className="alert alert-danger" id="subject-modal-error">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} id="subject-form">
              <div className="form-group">
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
                  disabled={formSubmitting}
                  required
                />
              </div>

              <div className="form-group">
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
                  disabled={formSubmitting}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="subject-description">
                  Descripción (Opcional)
                </label>
                <textarea
                  id="subject-description"
                  className="form-input"
                  rows={3}
                  placeholder="Breve resumen temático del contenido de la materia..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  disabled={formSubmitting}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button
                  type="button"
                  id="btn-cancel-subject"
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setIsModalOpen(false)}
                  disabled={formSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  id="subject-submit"
                  className="btn-primary"
                  style={{ flex: 1 }}
                  disabled={formSubmitting}
                >
                  {formSubmitting ? 'Guardando...' : editingSubject ? 'Actualizar' : 'Crear materia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
