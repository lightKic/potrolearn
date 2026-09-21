import React, { useEffect, useState } from 'react';
import { Subject } from '../types/academic.js';
import { SubjectServiceAPI } from '../services/subject.service.js';
import { useAuth } from '../auth/useAuth.js';
import { ApiError } from '../services/api.js';
import { PageLoading } from '../components/common/loading/index.js';
import { EditSubjectModal } from '../components/subject/EditSubjectModal.js';

export const SubjectsPage: React.FC = () => {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // State para modal de Crear / Editar Materia
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

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
    setSelectedSubject(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (subject: Subject) => {
    setSelectedSubject(subject);
    setIsModalOpen(true);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title" id="subjects-page-title">
            Gestión de Materias
          </h1>
          <p className="page-description" id="subjects-page-desc" style={{ marginBottom: 0 }}>
            {user?.role === 'ADMIN'
              ? 'Catálogo global de materias y asignación de maestros autorizados.'
              : 'Materias asignadas a las que tienes acceso para impartir cursos.'}
          </p>
        </div>
        {user?.role === 'ADMIN' && (
          <button
            type="button"
            id="btn-new-subject"
            className="btn-primary"
            style={{ width: 'auto' }}
            onClick={handleOpenCreate}
          >
            + Nueva materia
          </button>
        )}
      </div>

      {actionSuccess && (
        <div className="alert alert-success" id="subjects-success-alert" style={{ marginBottom: '16px' }}>
          {actionSuccess}
        </div>
      )}

      {errorMessage && (
        <div className="alert alert-danger" id="subjects-error-alert" style={{ marginBottom: '16px' }}>
          {errorMessage}
        </div>
      )}

      {loading ? (
        <PageLoading title="Cargando materias..." />
      ) : subjects.length === 0 ? (
        <div className="dashboard-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <h3 className="dashboard-card-title">
            {user?.role === 'ADMIN' ? 'Aún no hay materias registradas' : 'No tienes materias asignadas'}
          </h3>
          <p className="dashboard-card-desc" style={{ marginBottom: '20px' }}>
            {user?.role === 'ADMIN'
              ? 'Crea la primera materia para poder asociar cursos académicos y asignar maestros.'
              : 'Solicita a un Administrador que te asigne materias para poder abrir cursos.'}
          </p>
          {user?.role === 'ADMIN' && (
            <button
              type="button"
              className="btn-primary"
              style={{ width: 'auto', margin: '0 auto' }}
              onClick={handleOpenCreate}
            >
              Crear primera materia
            </button>
          )}
        </div>
      ) : (
        <div className="dashboard-grid">
          {subjects.map((subject) => {
            const teacherCount = subject.subjectTeachers?.length ?? 0;

            return (
              <div
                className="dashboard-card"
                key={subject.id}
                id={`subject-card-${subject.id}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px',
                  height: '100%',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span className="role-pill teacher" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      {subject.code}
                    </span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 500, color: subject.isActive ? 'var(--color-success, #10b981)' : 'var(--color-muted)' }}>
                      {subject.isActive ? '● Activa' : '○ Inactiva'}
                    </span>
                  </div>

                  <h3 className="dashboard-card-title" style={{ fontSize: '1.15rem', marginBottom: '8px' }}>
                    {subject.name}
                  </h3>

                  <p className="dashboard-card-desc" style={{ marginBottom: '16px', fontSize: '0.875rem' }}>
                    {subject.description || 'Sin descripción especificada.'}
                  </p>
                </div>

                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      backgroundColor: 'var(--color-background, #f9fafb)',
                      borderRadius: 'var(--radius-md, 6px)',
                      border: '1px solid var(--color-border)',
                      marginBottom: '16px',
                    }}
                  >
                    <span style={{ fontSize: '0.825rem', color: 'var(--color-muted)' }}>
                      Maestros autorizados:
                    </span>
                    <span
                      style={{
                        fontSize: '0.825rem',
                        fontWeight: 600,
                        color: teacherCount > 0 ? 'var(--color-primary, #4f46e5)' : 'var(--color-muted)',
                        backgroundColor: teacherCount > 0 ? 'var(--color-primary-light, rgba(79, 70, 229, 0.1))' : 'transparent',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full, 9999px)',
                      }}
                    >
                      {teacherCount}
                    </span>
                  </div>

                  {user?.role === 'ADMIN' && (
                    <button
                      type="button"
                      id={`btn-edit-subject-${subject.id}`}
                      className="btn-secondary"
                      style={{ width: '100%', padding: '8px 12px', fontSize: '0.875rem' }}
                      onClick={() => handleOpenEdit(subject)}
                    >
                      Editar materia
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Crear / Editar Materia */}
      <EditSubjectModal
        isOpen={isModalOpen}
        subject={selectedSubject}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedSubject(null);
        }}
        onSubjectSaved={async () => {
          await fetchSubjects();
          setActionSuccess('Cambios en la materia guardados correctamente.');
        }}
      />
    </div>
  );
};
