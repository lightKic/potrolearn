import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Course, CourseStatus, Subject } from '../types/academic.js';
import { CourseServiceAPI } from '../services/course.service.js';
import { SubjectServiceAPI } from '../services/subject.service.js';
import { useAuth } from '../auth/useAuth.js';
import { ApiError } from '../services/api.js';
import { PageLoading, ButtonSpinner } from '../components/common/loading/index.js';

export const CoursesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estado para el filtro de materia
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('ALL');

  // Modal para Nuevo Curso
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchCoursesAndSubjects = React.useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const coursesData = await CourseServiceAPI.getCourses();
      setCourses(coursesData);

      if (user?.role === 'ADMIN' || user?.role === 'TEACHER') {
        const subjectsData = await SubjectServiceAPI.getSubjects();
        setSubjects(subjectsData);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('No fue posible cargar el listado de cursos.');
      }
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    fetchCoursesAndSubjects();
  }, [fetchCoursesAndSubjects]);

  // Derivar únicamente las materias presentes en los cursos visibles del usuario
  const availableSubjects = useMemo(() => {
    const map = new Map<string, { id: string; code: string; name: string }>();
    courses.forEach((c) => {
      if (c.subjectId && c.subject) {
        map.set(c.subjectId, {
          id: c.subject.id,
          code: c.subject.code,
          name: c.subject.name,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [courses]);

  // Cursos filtrados cliente-side segun la materia seleccionada
  const filteredCourses = useMemo(() => {
    if (selectedSubjectId === 'ALL') return courses;
    return courses.filter((c) => c.subjectId === selectedSubjectId);
  }, [courses, selectedSubjectId]);

  const handleOpenCreateModal = () => {
    setFormSubjectId(subjects.length > 0 ? subjects[0].id : '');
    setFormName('');
    setFormDescription('');

    const today = new Date().toISOString().split('T')[0];
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setFormStartDate(today);
    setFormEndDate(nextMonth);

    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formSubjectId) {
      setFormError('Debes seleccionar una materia.');
      return;
    }

    if (!formName.trim() || !formStartDate || !formEndDate) {
      setFormError('Por favor completa todos los campos requeridos.');
      return;
    }

    if (new Date(formStartDate) > new Date(formEndDate)) {
      setFormError('La fecha de inicio no puede ser posterior a la fecha de término.');
      return;
    }

    setFormSubmitting(true);
    try {
      await CourseServiceAPI.createCourse({
        subjectId: formSubjectId,
        name: formName.trim(),
        description: formDescription.trim(),
        startDate: formStartDate,
        endDate: formEndDate,
      });

      setIsModalOpen(false);
      await fetchCoursesAndSubjects();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError('Error al crear el curso.');
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const getStatusBadge = (status: CourseStatus) => {
    if (user?.role === 'STUDENT') {
      return null;
    }
    switch (status) {
      case 'DRAFT':
        return <span className="role-pill admin" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>Borrador</span>;
      case 'ACTIVE':
        return <span className="role-pill student">Activo</span>;
      case 'FINISHED':
        return <span className="role-pill teacher">Finalizado</span>;
      case 'ARCHIVED':
        return <span className="role-pill admin" style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>Archivado</span>;
      default:
        return status;
    }
  };

  const getTitleByRole = () => {
    if (user?.role === 'ADMIN') return 'Gestión Global de Cursos';
    if (user?.role === 'TEACHER') return 'Mis Cursos Impartidos';
    return 'Mis Cursos Inscritos';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title" id="courses-page-title">
            {getTitleByRole()}
          </h1>
          <p className="page-description" id="courses-page-desc" style={{ marginBottom: 0 }}>
            {user?.role === 'ADMIN' && 'Visualiza, crea y administra los cursos del sistema.'}
            {user?.role === 'TEACHER' && 'Cursos asignados donde impartes cátedra e inscribes alumnos.'}
            {user?.role === 'STUDENT' && 'Cursos en los que te encuentras inscrito para estudiar.'}
          </p>
        </div>

        {(user?.role === 'ADMIN' || user?.role === 'TEACHER') && (
          <button
            type="button"
            id="btn-new-course"
            className="btn-primary"
            style={{ width: 'auto' }}
            onClick={handleOpenCreateModal}
          >
            + Nuevo curso
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="alert alert-danger" id="courses-error-alert" style={{ marginBottom: '16px' }}>
          {errorMessage}
        </div>
      )}

      {/* Filter Toolbar (Visible when courses exist) */}
      {!loading && courses.length > 0 && (
        <div
          id="courses-filter-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            marginBottom: '20px',
            flexWrap: 'wrap',
            backgroundColor: 'var(--color-surface)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1, minWidth: '240px' }}>
            <label
              htmlFor="filter-subject-select"
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--color-text)',
                whiteSpace: 'nowrap',
                margin: 0,
              }}
            >
              Materia
            </label>
            <select
              id="filter-subject-select"
              className="form-input"
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              aria-label="Filtrar cursos por materia"
              style={{
                width: 'auto',
                minWidth: '240px',
                maxWidth: '100%',
                fontSize: '0.875rem',
                padding: '6px 12px',
              }}
            >
              <option value="ALL">Todas las materias ({courses.length})</option>
              {availableSubjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.code} — {sub.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: '0.825rem', color: 'var(--color-muted)' }}>
            Mostrando {filteredCourses.length} de {courses.length} {courses.length === 1 ? 'curso' : 'cursos'}
          </div>
        </div>
      )}

      {loading ? (
        <PageLoading title="Cargando cursos..." />
      ) : courses.length === 0 ? (
        <div className="dashboard-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <h3 className="dashboard-card-title">Aún no hay cursos para mostrar</h3>
          <p className="dashboard-card-desc" style={{ marginBottom: '20px' }}>
            {user?.role === 'ADMIN' && 'Crea el primer curso en estado Borrador.'}
            {user?.role === 'TEACHER' && 'Aún no tienes cursos asignados ni creados.'}
            {user?.role === 'STUDENT' && 'Aún no estás inscrito en ningún curso.'}
          </p>
          {(user?.role === 'ADMIN' || user?.role === 'TEACHER') && (
            <button
              type="button"
              className="btn-primary"
              style={{ width: 'auto', margin: '0 auto' }}
              onClick={handleOpenCreateModal}
            >
              Crear nuevo curso
            </button>
          )}
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="dashboard-card" id="courses-filter-empty-state" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <h3 className="dashboard-card-title" style={{ fontSize: '1.05rem', marginBottom: '8px' }}>
            Sin cursos en esta materia
          </h3>
          <p className="dashboard-card-desc" style={{ marginBottom: '20px', fontSize: '0.875rem' }}>
            No hay cursos disponibles para la materia seleccionada.
          </p>
          <button
            type="button"
            id="btn-reset-subject-filter"
            className="btn-secondary"
            style={{ width: 'auto', margin: '0 auto', fontSize: '0.875rem', padding: '8px 20px' }}
            onClick={() => setSelectedSubjectId('ALL')}
          >
            Ver todas las materias
          </button>
        </div>
      ) : (
        <div className="dashboard-grid">
          {filteredCourses.map((course) => (
            <div className="dashboard-card" key={course.id} id={`course-card-${course.id}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <span className="role-pill teacher" style={{ fontSize: '0.75rem' }}>
                  {course.subject?.code || 'Materia'}
                </span>
                {getStatusBadge(course.status)}
              </div>

              <h3 className="dashboard-card-title">{course.name}</h3>
              <p className="dashboard-card-desc" style={{ marginBottom: '16px' }}>
                {course.subject?.name}
              </p>

              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px', marginBottom: '16px', fontSize: '0.825rem', color: 'var(--color-muted)' }}>
                <div>
                  <strong>Maestros:</strong>{' '}
                  {course.courseTeachers && course.courseTeachers.length > 0
                    ? course.courseTeachers.map((ct) => ct.teacher?.name).join(', ')
                    : 'Sin maestros asignados'}
                </div>
                <div style={{ marginTop: '4px' }}>
                  <strong>Inscritos:</strong> {course._count?.enrollments ?? 0} alumnos
                </div>
              </div>

              <button
                type="button"
                id={`btn-view-course-${course.id}`}
                className="btn-primary"
                style={{ width: '100%' }}
                onClick={() => navigate(`/app/courses/${course.id}`)}
              >
                Ver detalle del curso
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Crear Curso */}
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
          <div className="auth-card" style={{ maxWidth: '540px' }}>
            <h2 className="page-title" style={{ fontSize: '1.35rem', marginBottom: '16px' }}>
              Nuevo Curso (Borrador)
            </h2>

            {formError && (
              <div className="alert alert-danger" id="course-modal-error">
                {formError}
              </div>
            )}

            {subjects.length === 0 ? (
              <div>
                <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
                  {user?.role === 'ADMIN'
                    ? 'No hay materias registradas en la plataforma. Debes registrar al menos una materia antes de poder crear un curso.'
                    : 'No tienes materias asignadas para crear cursos. Solicita al administrador que te asigne una materia.'}
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cerrar
                  </button>
                  {user?.role === 'ADMIN' && (
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ flex: 1 }}
                      onClick={() => {
                        setIsModalOpen(false);
                        navigate('/app/subjects');
                      }}
                    >
                      Ir a Materias
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateSubmit} id="course-create-form">
                <div className="form-group">
                  <label className="form-label" htmlFor="course-subject-select">
                    Materia asociada
                  </label>
                  <select
                    id="course-subject-select"
                    className="form-input"
                    value={formSubjectId}
                    onChange={(e) => setFormSubjectId(e.target.value)}
                    disabled={formSubmitting}
                    required
                  >
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.code} — {sub.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="course-name">
                    Nombre del curso o grupo
                  </label>
                  <input
                    id="course-name"
                    type="text"
                    className="form-input"
                    placeholder="Ej: Grupo 01 — Semestre 2026-A"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    disabled={formSubmitting}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="course-description">
                    Descripción (Opcional)
                  </label>
                  <textarea
                    id="course-description"
                    className="form-input"
                    rows={2}
                    placeholder="Detalles sobre horario, aula o modalidad..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    disabled={formSubmitting}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="course-start-date">
                      Fecha inicio
                    </label>
                    <input
                      id="course-start-date"
                      type="date"
                      className="form-input"
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      disabled={formSubmitting}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="course-end-date">
                      Fecha término
                    </label>
                    <input
                      id="course-end-date"
                      type="date"
                      className="form-input"
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      disabled={formSubmitting}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                  <button
                    type="button"
                    id="btn-cancel-course"
                    className="btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => setIsModalOpen(false)}
                    disabled={formSubmitting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    id="course-submit"
                    className="btn-primary"
                    style={{ flex: 1 }}
                    disabled={formSubmitting}
                  >
                    {formSubmitting ? <><ButtonSpinner /> Creando curso...</> : 'Crear curso'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
