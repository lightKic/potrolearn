import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AdminService } from '../services/admin.service.js';
import { CourseServiceAPI } from '../services/course.service.js';
import { SubjectServiceAPI } from '../services/subject.service.js';
import { AdminUserListItem } from '../types/auth.js';
import { Course, CourseStatus, Subject } from '../types/academic.js';
import { ApiError } from '../services/api.js';
import { TableSkeleton } from '../components/common/loading/index.js';

export const TeachersPage: React.FC = () => {
  const [teachers, setTeachers] = useState<AdminUserListItem[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

  // Búsqueda y Filtros
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal Nuevo Maestro
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [createName, setCreateName] = useState<string>('');
  const [createEmail, setCreateEmail] = useState<string>('');
  const [createSubmitting, setCreateSubmitting] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Modal Gestión de Cursos de Maestro (Asignar / Ver cursos)
  const [selectedTeacherForCourses, setSelectedTeacherForCourses] = useState<AdminUserListItem | null>(null);
  const [assignCourseId, setAssignCourseId] = useState<string>('');
  const [assignSubmitting, setAssignSubmitting] = useState<boolean>(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);

  // Modal Detalle de Materia
  const [selectedSubjectDetail, setSelectedSubjectDetail] = useState<{
    teacher: AdminUserListItem;
    subject: Subject;
  } | null>(null);

  // Modal Restablecer Acceso
  const [resetAccessTarget, setResetAccessTarget] = useState<AdminUserListItem | null>(null);
  const [resetSubmitting, setResetSubmitting] = useState<boolean>(false);

  // Menú contextual activo
  const [activeMenuTeacherId, setActiveMenuTeacherId] = useState<string | null>(null);

  const fetchTeachersCoursesAndSubjects = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [usersData, coursesData, subjectsData] = await Promise.all([
        AdminService.getUsers(),
        CourseServiceAPI.getCourses(),
        SubjectServiceAPI.getSubjects(),
      ]);

      const teacherUsers = usersData.filter((u) => u.role === 'TEACHER');
      setTeachers(teacherUsers);
      setCourses(coursesData);
      setSubjects(subjectsData);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('No fue posible cargar la lista de maestros.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeachersCoursesAndSubjects();
  }, [fetchTeachersCoursesAndSubjects]);

  // Mapa de materias asignadas por ID de profesor (vía SubjectTeacher)
  const teacherSubjectsMap = useMemo(() => {
    const map = new Map<string, Subject[]>();
    teachers.forEach((t) => {
      const assigned = subjects.filter((s) =>
        s.subjectTeachers?.some((st) => st.teacherId === t.id)
      );
      map.set(t.id, assigned);
    });
    return map;
  }, [teachers, subjects]);

  // Mapa de cursos asignados por ID de profesor (vía CourseTeacher)
  const teacherCoursesMap = useMemo(() => {
    const map = new Map<string, Course[]>();
    courses.forEach((c) => {
      if (c.courseTeachers && c.courseTeachers.length > 0) {
        c.courseTeachers.forEach((ct) => {
          const list = map.get(ct.teacherId) || [];
          list.push(c);
          map.set(ct.teacherId, list);
        });
      }
    });
    return map;
  }, [courses]);

  // Obtener cursos de un profesor para una materia específica
  const getTeacherCoursesForSubject = useCallback(
    (teacherId: string, subjectId: string): Course[] => {
      const teacherCourses = teacherCoursesMap.get(teacherId) || [];
      return teacherCourses.filter((c) => c.subjectId === subjectId);
    },
    [teacherCoursesMap]
  );

  // Filtrado de maestros en tiempo real por búsqueda
  const filteredTeachers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return teachers;

    return teachers.filter(
      (t) => t.name.toLowerCase().includes(query) || t.email.toLowerCase().includes(query)
    );
  }, [teachers, searchQuery]);

  // Handlers para Crear Maestro
  const handleOpenCreateModal = () => {
    setCreateName('');
    setCreateEmail('');
    setCreateError(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!createName.trim() || !createEmail.trim()) {
      setCreateError('Por favor introduce el nombre y el correo del maestro.');
      return;
    }

    setCreateSubmitting(true);
    try {
      const res = await AdminService.createUser({
        role: 'TEACHER',
        name: createName.trim(),
        email: createEmail.trim().toLowerCase(),
      });

      setActionNotice({
        type: 'success',
        text: res.emailSent
          ? `Maestro ${res.user.name} registrado exitosamente. Se envió la invitación de acceso por correo.`
          : `Maestro ${res.user.name} registrado exitosamente. No se pudo entregar el correo de invitación.`,
      });

      setIsCreateModalOpen(false);
      await fetchTeachersCoursesAndSubjects();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setCreateError(err.message);
      } else {
        setCreateError('Error al crear el maestro.');
      }
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Handlers para Asignación de Cursos
  const handleOpenCoursesModal = (teacher: AdminUserListItem) => {
    setActiveMenuTeacherId(null);
    setSelectedTeacherForCourses(teacher);
    setAssignError(null);
    setAssignSuccess(null);

    const assigned = teacherCoursesMap.get(teacher.id) || [];
    const assignedIds = new Set(assigned.map((c) => c.id));
    const available = courses.filter((c) => !assignedIds.has(c.id));
    setAssignCourseId(available.length > 0 ? available[0].id : '');
  };

  const handleAssignCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacherForCourses || !assignCourseId) return;

    setAssignSubmitting(true);
    setAssignError(null);
    setAssignSuccess(null);

    try {
      await CourseServiceAPI.assignTeacher(assignCourseId, selectedTeacherForCourses.id);
      setAssignSuccess('Maestro asignado al curso exitosamente.');
      await fetchTeachersCoursesAndSubjects();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setAssignError(err.message);
      } else {
        setAssignError('Error al asignar el maestro al curso.');
      }
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleRemoveTeacherFromCourse = async (courseId: string) => {
    if (!selectedTeacherForCourses) return;

    setAssignSubmitting(true);
    setAssignError(null);
    setAssignSuccess(null);

    try {
      await CourseServiceAPI.removeTeacher(courseId, selectedTeacherForCourses.id);
      setAssignSuccess('Maestro desasignado del curso correctamente.');
      await fetchTeachersCoursesAndSubjects();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setAssignError(err.message);
      } else {
        setAssignError('Error al desasignar el maestro del curso.');
      }
    } finally {
      setAssignSubmitting(false);
    }
  };

  // Handler para Restablecer Acceso
  const handleConfirmResetAccess = async () => {
    if (!resetAccessTarget) return;

    setResetSubmitting(true);
    setActionNotice(null);

    try {
      const res = await AdminService.resetAccess(resetAccessTarget.id);
      setActionNotice({
        type: 'success',
        text: res.message || `Instrucciones de acceso enviadas a ${resetAccessTarget.name}.`,
      });
      setResetAccessTarget(null);
      await fetchTeachersCoursesAndSubjects();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Error al restablecer el acceso.';
      setActionNotice({ type: 'danger', text: msg });
    } finally {
      setResetSubmitting(false);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '—';
      return new Intl.DateTimeFormat('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(d);
    } catch {
      return '—';
    }
  };

  const getStatusBadge = (status: CourseStatus) => {
    switch (status) {
      case 'DRAFT':
        return <span className="role-pill admin" style={{ backgroundColor: '#fef3c7', color: '#92400e', fontSize: '0.725rem' }}>Borrador</span>;
      case 'ACTIVE':
        return <span className="role-pill student" style={{ fontSize: '0.725rem' }}>Activo</span>;
      case 'FINISHED':
        return <span className="role-pill teacher" style={{ fontSize: '0.725rem' }}>Finalizado</span>;
      case 'ARCHIVED':
        return <span className="role-pill admin" style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '0.725rem' }}>Archivado</span>;
      default:
        return <span className="role-pill" style={{ fontSize: '0.725rem' }}>{status}</span>;
    }
  };

  return (
    <div className="teachers-container" id="teachers-module">
      {/* HEADER BAR */}
      <div className="teachers-header-bar">
        <div>
          <h1 className="page-title" id="teachers-page-title">
            Gestión de Maestros
          </h1>
          <p className="page-description" id="teachers-page-desc">
            Administra docentes, materias autorizadas y cursos asignados.
          </p>
        </div>

        <button
          type="button"
          id="btn-open-create-teacher-modal"
          className="btn-primary-sm"
          onClick={handleOpenCreateModal}
        >
          + Nuevo Maestro
        </button>
      </div>

      {actionNotice && (
        <div
          className={`alert ${actionNotice.type === 'success' ? 'alert-success' : 'alert-danger'}`}
          id="teachers-action-notice"
        >
          {actionNotice.text}
        </div>
      )}

      {errorMessage && (
        <div className="alert alert-danger" id="teachers-error-alert">
          {errorMessage}
          <button
            type="button"
            className="btn-secondary-sm"
            style={{ marginLeft: '12px' }}
            onClick={fetchTeachersCoursesAndSubjects}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* TOOLBAR & SEARCH */}
      {!loading && !errorMessage && teachers.length > 0 && (
        <div className="teachers-toolbar">
          <div className="teachers-search-wrapper">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="search-icon">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              id="teachers-search-input"
              className="form-input search-input"
              placeholder="Buscar por nombre o correo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* SUMMARY COUNT */}
      {!loading && !errorMessage && teachers.length > 0 && (
        <div className="teachers-summary-text" id="teachers-count-summary">
          {filteredTeachers.length} {filteredTeachers.length === 1 ? 'maestro registrado' : 'maestros registrados'}
        </div>
      )}

      {/* CONTENT TABLE & STATES */}
      {loading ? (
        <div className="teachers-table-wrapper" style={{ padding: '20px' }}>
          <TableSkeleton columns={5} rows={5} />
        </div>
      ) : teachers.length === 0 ? (
        <div className="db-empty-state-card" id="teachers-empty-state">
          <div className="db-empty-icon">👨‍🏫</div>
          <h3 className="db-empty-title">No hay maestros registrados</h3>
          <p className="db-empty-desc">
            Registra a los profesores de la institución para poder asignarles materias y cursos.
          </p>
          <button
            type="button"
            id="btn-empty-create-teacher"
            className="btn-primary-sm"
            onClick={handleOpenCreateModal}
          >
            + Nuevo Maestro
          </button>
        </div>
      ) : filteredTeachers.length === 0 ? (
        <div className="db-empty-state-card" id="teachers-search-no-results">
          <div className="db-empty-icon">🔍</div>
          <h3 className="db-empty-title">No encontramos maestros con esos criterios</h3>
          <p className="db-empty-desc">
            Intenta modificar los términos introducidos en la búsqueda.
          </p>
          <button
            type="button"
            className="btn-secondary-sm"
            onClick={() => setSearchQuery('')}
          >
            Limpiar búsqueda
          </button>
        </div>
      ) : (
        <div className="teachers-table-wrapper">
          <table className="teachers-table" id="teachers-main-table">
            <thead>
              <tr>
                <th>Maestro</th>
                <th>Estado</th>
                <th>Materias Asignadas</th>
                <th>Registro</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeachers.map((teacher) => {
                const teacherSubs = teacherSubjectsMap.get(teacher.id) || [];
                const isMenuOpen = activeMenuTeacherId === teacher.id;

                return (
                  <tr key={teacher.id} id={`teacher-row-${teacher.id}`}>
                    <td>
                      <div className="teacher-identity-cell">
                        <span className="teacher-name-text">{teacher.name}</span>
                        <span className="teacher-email-text">{teacher.email}</span>
                      </div>
                    </td>
                    <td>
                      {teacher.activatedAt ? (
                        <span className="teachers-badge badge-active">● Activado</span>
                      ) : (
                        <span className="teachers-badge badge-pending">○ Pendiente</span>
                      )}
                    </td>
                    <td>
                      {teacherSubs.length === 0 ? (
                        <span className="no-courses-text">Sin materias asignadas</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px 0' }}>
                          {teacherSubs.map((sub) => {
                            const subCourses = getTeacherCoursesForSubject(teacher.id, sub.id);
                            return (
                              <div
                                key={sub.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '8px 12px',
                                  backgroundColor: 'var(--color-background, #f9fafb)',
                                  borderRadius: 'var(--radius-md, 6px)',
                                  border: '1px solid var(--color-border)',
                                  gap: '12px',
                                }}
                              >
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className="role-pill teacher" style={{ fontSize: '0.725rem' }}>
                                      {sub.code}
                                    </span>
                                    <span>{sub.name}</span>
                                  </div>
                                  <div style={{ fontSize: '0.775rem', color: 'var(--color-muted)', marginTop: '2px' }}>
                                    {subCourses.length} {subCourses.length === 1 ? 'curso' : 'cursos'}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  className="btn-secondary-sm"
                                  style={{ fontSize: '0.75rem', padding: '3px 10px', width: 'auto', flexShrink: 0 }}
                                  onClick={() => setSelectedSubjectDetail({ teacher, subject: sub })}
                                >
                                  Ver detalle
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="teacher-date-text">{formatDate(teacher.createdAt)}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="teachers-action-cell">
                        <button
                          type="button"
                          className="teachers-action-trigger"
                          id={`btn-actions-teacher-${teacher.id}`}
                          onClick={() => setActiveMenuTeacherId(isMenuOpen ? null : teacher.id)}
                        >
                          ⋮
                        </button>

                        {isMenuOpen && (
                          <div className="teachers-action-menu" id={`menu-teacher-${teacher.id}`}>
                            <button
                              type="button"
                              className="teachers-menu-item"
                              onClick={() => handleOpenCoursesModal(teacher)}
                            >
                              Asignar / Ver cursos
                            </button>

                            <button
                              type="button"
                              className="teachers-menu-item danger"
                              onClick={() => {
                                setActiveMenuTeacherId(null);
                                setResetAccessTarget(teacher);
                              }}
                            >
                              Restablecer acceso
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL DETALLE DE MATERIA */}
      {selectedSubjectDetail && (
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
            zIndex: 1100,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedSubjectDetail(null);
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
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
            }}
          >
            {/* Modal Header */}
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
                <h2 className="page-title" style={{ fontSize: '1.25rem', marginBottom: '4px' }}>
                  Detalle de materia
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--color-text)' }}>
                  <span className="role-pill teacher" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                    {selectedSubjectDetail.subject.code}
                  </span>
                  <strong>{selectedSubjectDetail.subject.name}</strong>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '4px' }}>
                  Maestro: <strong>{selectedSubjectDetail.teacher.name}</strong> ({selectedSubjectDetail.teacher.email})
                </div>
              </div>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.9rem', borderRadius: 'var(--radius-md)', lineHeight: 1 }}
                onClick={() => setSelectedSubjectDetail(null)}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {(() => {
                const subCourses = getTeacherCoursesForSubject(
                  selectedSubjectDetail.teacher.id,
                  selectedSubjectDetail.subject.id
                );

                return (
                  <div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '12px' }}>
                      Cursos asignados ({subCourses.length})
                    </h3>

                    {subCourses.length === 0 ? (
                      <div
                        style={{
                          textAlign: 'center',
                          padding: '24px 16px',
                          backgroundColor: 'var(--color-background, #f9fafb)',
                          borderRadius: 'var(--radius-md, 8px)',
                          border: '1px dashed var(--color-border)',
                        }}
                      >
                        <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', margin: 0 }}>
                          El maestro tiene autorizada esta materia, pero actualmente no participa en ningún curso específico de ella.
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {subCourses.map((c) => (
                          <div
                            key={c.id}
                            style={{
                              padding: '12px 14px',
                              backgroundColor: 'var(--color-background, #f9fafb)',
                              borderRadius: 'var(--radius-md, 8px)',
                              border: '1px solid var(--color-border)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '12px',
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text)' }}>
                                {c.name}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '2px' }}>
                                Inscritos: {c._count?.enrollments ?? 0} alumnos
                              </div>
                            </div>
                            <div>{getStatusBadge(c.status)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
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
                onClick={() => setSelectedSubjectDetail(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR NUEVO MAESTRO */}
      {isCreateModalOpen && (
        <div className="teachers-modal-overlay" id="create-teacher-modal-overlay">
          <div className="teachers-modal-card" id="create-teacher-modal-card">
            <div className="modal-header">
              <h2 className="modal-title">Nuevo Maestro</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={createSubmitting}
              >
                ✕
              </button>
            </div>

            {createError && <div className="alert alert-danger">{createError}</div>}

            <form onSubmit={handleCreateTeacherSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="create-teacher-name">
                  Nombre completo
                </label>
                <input
                  id="create-teacher-name"
                  type="text"
                  className="form-input"
                  placeholder="Ej: Mtro. Roberto Gómez"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  disabled={createSubmitting}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="create-teacher-email">
                  Correo electrónico
                </label>
                <input
                  id="create-teacher-email"
                  type="email"
                  className="form-input"
                  placeholder="Ej: docente@uaemex.mx"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  disabled={createSubmitting}
                  required
                />
                <span className="password-hint">
                  Se generará una contraseña temporal y se enviará la invitación por correo.
                </span>
              </div>

              <div className="modal-footer-bar">
                <button
                  type="button"
                  className="btn-secondary-sm"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={createSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary-sm"
                  disabled={createSubmitting}
                >
                  {createSubmitting ? 'Registrando...' : 'Crear Maestro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ASIGNACIÓN DE CURSOS */}
      {selectedTeacherForCourses && (
        <div className="teachers-modal-overlay" id="assign-courses-modal-overlay">
          <div className="teachers-modal-card" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Cursos asignados</h2>
                <p className="page-description" style={{ marginBottom: 0 }}>
                  Maestro: <strong>{selectedTeacherForCourses.name}</strong>
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedTeacherForCourses(null)}
                disabled={assignSubmitting}
              >
                ✕
              </button>
            </div>

            {assignSuccess && <div className="alert alert-success">{assignSuccess}</div>}
            {assignError && <div className="alert alert-danger">{assignError}</div>}

            {/* LISTA DE CURSOS ACTUALMENTE ASIGNADOS */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '10px' }}>
                Cursos impartidos actualmente:
              </h4>
              {(() => {
                const assigned = teacherCoursesMap.get(selectedTeacherForCourses.id) || [];
                if (assigned.length === 0) {
                  return <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Este maestro no tiene cursos asignados.</p>;
                }
                return (
                  <div className="assigned-courses-list">
                    {assigned.map((c) => (
                      <div key={c.id} className="assigned-course-item">
                        <div>
                          <strong>{c.subject?.code || 'MATERIA'}:</strong> {c.name}
                        </div>
                        <button
                          type="button"
                          className="btn-secondary-sm"
                          style={{ color: 'var(--color-danger)', borderColor: '#fecaca' }}
                          disabled={assignSubmitting}
                          onClick={() => handleRemoveTeacherFromCourse(c.id)}
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* FORMULARIO PARA ASIGNAR UN NUEVO CURSO */}
            {(() => {
              const assigned = teacherCoursesMap.get(selectedTeacherForCourses.id) || [];
              const assignedIds = new Set(assigned.map((c) => c.id));
              const availableCourses = courses.filter((c) => !assignedIds.has(c.id));

              if (availableCourses.length === 0) {
                return (
                  <div className="alert alert-success" style={{ marginTop: '12px' }}>
                    El maestro ya está asignado a todos los cursos disponibles del sistema.
                  </div>
                );
              }

              return (
                <form onSubmit={handleAssignCourseSubmit} style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="assign-course-select">
                      Asignar a un nuevo curso:
                    </label>
                    <select
                      id="assign-course-select"
                      className="form-input"
                      value={assignCourseId}
                      onChange={(e) => setAssignCourseId(e.target.value)}
                      disabled={assignSubmitting}
                    >
                      {availableCourses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.subject?.code || 'MATERIA'} — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="modal-footer-bar">
                    <button
                      type="button"
                      className="btn-secondary-sm"
                      onClick={() => setSelectedTeacherForCourses(null)}
                      disabled={assignSubmitting}
                    >
                      Cerrar
                    </button>
                    <button
                      type="submit"
                      className="btn-primary-sm"
                      disabled={assignSubmitting || !assignCourseId}
                    >
                      {assignSubmitting ? 'Asignando...' : '+ Asignar al curso'}
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN RESTABLECER ACCESO */}
      {resetAccessTarget && (
        <div className="teachers-modal-overlay">
          <div className="teachers-modal-card" style={{ maxWidth: '440px' }}>
            <h3 className="modal-title" style={{ marginBottom: '12px' }}>Restablecer acceso</h3>
            <p className="page-description" style={{ marginBottom: '20px' }}>
              ¿Deseas restablecer el acceso para el maestro <strong>{resetAccessTarget.name}</strong> ({resetAccessTarget.email})?
              Se generará una contraseña temporal y se enviarán las instrucciones por correo.
            </p>
            <div className="modal-footer-bar">
              <button
                type="button"
                className="btn-secondary-sm"
                onClick={() => setResetAccessTarget(null)}
                disabled={resetSubmitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary-sm"
                onClick={handleConfirmResetAccess}
                disabled={resetSubmitting}
              >
                {resetSubmitting ? 'Enviando...' : 'Confirmar y restablecer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
