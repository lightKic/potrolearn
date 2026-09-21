import React, { useState, useEffect, useCallback } from 'react';
import { Course, CourseStudent, ImportPreviewResult, BulkConfirmResult } from '../types/academic.js';
import { CourseServiceAPI } from '../services/course.service.js';
import { ApiError } from '../services/api.js';
import { TableSkeleton } from '../components/common/loading/index.js';

interface StudentWithCourse {
  student: CourseStudent;
  courseId: string;
  courseName: string;
  subjectCode: string;
}

export const TeacherStudentsPage: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [studentsWithCourse, setStudentsWithCourse] = useState<StudentWithCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

  // Filtros y Búsqueda
  const [selectedCourseId, setSelectedCourseId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modales
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalTab, setAddModalTab] = useState<'SELECT' | 'SEARCH' | 'REGISTER' | 'EXCEL'>('SELECT');
  const [targetCourseId, setTargetCourseId] = useState<string>('');

  // Búsqueda Alumno Existente
  const [existSearchQuery, setExistSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; email: string; studentNumber: string; isAlreadyEnrolled: boolean }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const [enrollingStudentId, setEnrollingStudentId] = useState<string | null>(null);

  // Registro Manual
  const [manualName, setManualName] = useState('');
  const [manualStudentNumber, setManualStudentNumber] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // Importación Excel
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewResult | null>(null);
  const [importConfirmResult, setImportConfirmResult] = useState<BulkConfirmResult | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Restablecimiento de acceso & Menú de acciones por alumno
  const [resendingStudentId, setResendingStudentId] = useState<string | null>(null);
  const [activeMenuStudentId, setActiveMenuStudentId] = useState<string | null>(null);

  // Modal de doble confirmación para Quitar Alumno del Curso (QA-007.9)
  const [dropTargetStudent, setDropTargetStudent] = useState<StudentWithCourse | null>(null);
  const [dropConfirmStep, setDropConfirmStep] = useState<1 | 2>(1);
  const [dropLoading, setDropLoading] = useState<boolean>(false);
  const [dropError, setDropError] = useState<string | null>(null);

  const fetchStudentsData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const coursesRes = await CourseServiceAPI.getCourses();
      setCourses(coursesRes);

      if (coursesRes.length > 0 && !targetCourseId) {
        setTargetCourseId(coursesRes[0].id);
      }

      // Obtener alumnos de todos los cursos asignados en paralelo
      const studentPromises = coursesRes.map(async (c) => {
        try {
          const list = await CourseServiceAPI.getCourseStudents(c.id);
          return list.map((st) => ({
            student: st,
            courseId: c.id,
            courseName: c.name,
            subjectCode: c.subject?.code || c.subject?.name || 'MATERIA',
          }));
        } catch {
          return [];
        }
      });

      const results = await Promise.all(studentPromises);
      const flattened = results.flat();

      setStudentsWithCourse(flattened);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('No fue posible cargar el listado de alumnos.');
      }
    } finally {
      setLoading(false);
    }
  }, [targetCourseId]);

  useEffect(() => {
    fetchStudentsData();
  }, [fetchStudentsData]);

  // Filtrado reactivo de la lista
  const filteredStudents = studentsWithCourse.filter((item) => {
    const matchesCourse = selectedCourseId === 'ALL' || item.courseId === selectedCourseId;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return matchesCourse;

    const matchesName = item.student.name.toLowerCase().includes(query);
    const matchesNumber = item.student.studentNumber.toLowerCase().includes(query);
    const matchesEmail = item.student.email.toLowerCase().includes(query);

    return matchesCourse && (matchesName || matchesNumber || matchesEmail);
  });

  // Open main add modal
  const handleOpenAddModal = () => {
    if (courses.length > 0) {
      setTargetCourseId(courses[0].id);
    }
    setAddModalTab('SELECT');
    setExistSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setSearchSubmitted(false);
    setManualName('');
    setManualStudentNumber('');
    setManualEmail('');
    setManualError(null);
    setImportFile(null);
    setImportPreview(null);
    setImportConfirmResult(null);
    setImportError(null);
    setIsAddModalOpen(true);
  };

  // Search existing student handler
  const handleSearchExistingStudents = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCourseId || !existSearchQuery.trim()) {
      setSearchError('Por favor introduce un término de búsqueda.');
      return;
    }

    setSearchLoading(true);
    setSearchError(null);
    setSearchSubmitted(true);
    try {
      const results = await CourseServiceAPI.searchStudents(targetCourseId, existSearchQuery.trim());
      setSearchResults(results);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setSearchError(err.message);
      } else {
        setSearchError('Error al buscar alumnos.');
      }
    } finally {
      setSearchLoading(false);
    }
  };

  // Enroll existing student
  const handleEnrollExistingStudent = async (st: { name: string; email: string; studentNumber: string }) => {
    if (!targetCourseId) return;
    setEnrollingStudentId(st.studentNumber);
    setSearchError(null);
    try {
      await CourseServiceAPI.enrollStudent(targetCourseId, {
        name: st.name,
        email: st.email,
        studentNumber: st.studentNumber,
      });

      setActionNotice({
        type: 'success',
        text: `Alumno ${st.name} inscrito exitosamente en el curso.`,
      });
      setIsAddModalOpen(false);
      await fetchStudentsData();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setSearchError(err.message);
      } else {
        setSearchError('Error al inscribir al alumno.');
      }
    } finally {
      setEnrollingStudentId(null);
    }
  };

  // Submit new manual student
  const handleManualStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCourseId) {
      setManualError('Debes seleccionar un curso.');
      return;
    }

    if (!manualName.trim() || !manualStudentNumber.trim() || !manualEmail.trim()) {
      setManualError('Todos los campos son requeridos.');
      return;
    }

    setManualSubmitting(true);
    setManualError(null);
    try {
      await CourseServiceAPI.enrollStudent(targetCourseId, {
        name: manualName.trim(),
        studentNumber: manualStudentNumber.trim(),
        email: manualEmail.trim(),
      });

      setActionNotice({
        type: 'success',
        text: `Alumno ${manualName} registrado e inscrito exitosamente.`,
      });
      setIsAddModalOpen(false);
      await fetchStudentsData();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setManualError(err.message);
      } else {
        setManualError('Error al registrar al alumno.');
      }
    } finally {
      setManualSubmitting(false);
    }
  };

  // Excel Preview Handler
  const handlePreviewImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCourseId || !importFile) {
      setImportError('Selecciona un archivo Excel (.xlsx o .csv).');
      return;
    }

    setImportLoading(true);
    setImportError(null);
    setImportPreview(null);
    setImportConfirmResult(null);

    try {
      const preview = await CourseServiceAPI.previewStudentImport(targetCourseId, importFile);
      setImportPreview(preview);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setImportError(err.message);
      } else {
        setImportError('Error al procesar la vista previa del archivo.');
      }
    } finally {
      setImportLoading(false);
    }
  };

  // Confirm Excel Import Handler
  const handleConfirmImport = async () => {
    if (!targetCourseId || !importPreview) return;

    const validRows = importPreview.rows
      .filter((r) => r.status === 'NEW' || r.status === 'EXISTING_TO_ENROLL')
      .map((r) => ({
        name: r.name,
        studentNumber: r.studentNumber,
        email: r.email,
      }));

    if (validRows.length === 0) {
      setImportError('No hay alumnos válidos o nuevos para procesar.');
      return;
    }

    setImportLoading(true);
    setImportError(null);

    try {
      const confirmRes = await CourseServiceAPI.confirmStudentImport(targetCourseId, validRows);
      setImportConfirmResult(confirmRes);
      setActionNotice({
        type: 'success',
        text: `Importación procesada: ${confirmRes.createdCount + confirmRes.enrolledExistingCount} alumnos procesados.`,
      });
      await fetchStudentsData();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setImportError(err.message);
      } else {
        setImportError('Error al confirmar la importación.');
      }
    } finally {
      setImportLoading(false);
    }
  };

  // Action: Resend Invitation
  const handleResendInvitation = async (item: StudentWithCourse) => {
    setActiveMenuStudentId(null);
    setResendingStudentId(`${item.courseId}-${item.student.id}`);
    setActionNotice(null);

    try {
      await CourseServiceAPI.resendInvitation(item.courseId, item.student.id);
      setActionNotice({
        type: 'success',
        text: `Invitación de acceso reenviada a ${item.student.name} (${item.student.email}).`,
      });
      await fetchStudentsData();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Error al reenviar la invitación.';
      setActionNotice({ type: 'danger', text: msg });
    } finally {
      setResendingStudentId(null);
    }
  };

  // Quitar alumno del curso (Doble confirmación QA-007.9)
  const handleInitiateDropStudent = (item: StudentWithCourse) => {
    setDropTargetStudent(item);
    setDropConfirmStep(1);
    setDropError(null);
  };

  const handleConfirmDropStudent = async () => {
    if (!dropTargetStudent) return;

    setDropLoading(true);
    setDropError(null);
    setActionNotice(null);

    try {
      await CourseServiceAPI.dropStudent(dropTargetStudent.courseId, dropTargetStudent.student.id);
      setActionNotice({
        type: 'success',
        text: `Alumno ${dropTargetStudent.student.name} retirado del curso exitosamente.`,
      });
      setDropTargetStudent(null);
      await fetchStudentsData();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setDropError(err.message);
      } else {
        setDropError('Error al retirar al alumno del curso.');
      }
    } finally {
      setDropLoading(false);
    }
  };

  const getAccountBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="students-badge badge-active">Activo</span>;
      case 'PENDING':
        return <span className="students-badge badge-pending">Pendiente</span>;
      case 'EXPIRED':
        return <span className="students-badge badge-expired">Expirado</span>;
      default:
        return <span className="students-badge">{status}</span>;
    }
  };

  const getActivationBadge = (activatedAt: string | null) => {
    if (activatedAt) {
      return <span className="students-badge badge-active">● Activado</span>;
    }
    return <span className="students-badge badge-pending">○ Pendiente de activación</span>;
  };

  return (
    <div className="students-container" id="students-module">
      {/* HEADER BAR */}
      <div className="students-header-bar">
        <div>
          <h1 className="page-title" id="students-page-title">
            Alumnos inscritos
          </h1>
          <p className="page-description" id="students-page-desc">
            Gestiona los alumnos inscritos en tus cursos asignados.
          </p>
        </div>

        {courses.length > 0 && (
          <button
            type="button"
            id="btn-open-add-student-modal"
            className="btn-primary-sm"
            onClick={handleOpenAddModal}
          >
            + Agregar alumno
          </button>
        )}
      </div>

      {actionNotice && (
        <div
          className={`alert ${actionNotice.type === 'success' ? 'alert-success' : 'alert-danger'}`}
          id="students-action-notice"
        >
          {actionNotice.text}
        </div>
      )}

      {errorMessage && (
        <div className="alert alert-danger" id="students-error-alert">
          {errorMessage}
          <button type="button" className="btn-secondary-sm" style={{ marginLeft: '12px' }} onClick={fetchStudentsData}>
            Reintentar
          </button>
        </div>
      )}

      {/* TOOLBAR & SEARCH */}
      {!loading && !errorMessage && studentsWithCourse.length > 0 && (
        <div className="students-toolbar">
          <div className="students-search-wrapper">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="search-icon">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              id="students-search-input"
              className="form-input search-input"
              placeholder="Buscar por nombre, matrícula o correo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {courses.length > 1 && (
            <div className="students-filter-wrapper">
              <label htmlFor="students-course-filter" className="filter-label">
                Curso:
              </label>
              <select
                id="students-course-filter"
                className="form-input filter-select"
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
              >
                <option value="ALL">Todos los cursos ({studentsWithCourse.length})</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.subject?.code || 'MATERIA'} — {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* SUMMARY COUNT */}
      {!loading && !errorMessage && studentsWithCourse.length > 0 && (
        <div className="students-summary-text" id="students-count-summary">
          {filteredStudents.length} {filteredStudents.length === 1 ? 'alumno encontrado' : 'alumnos inscritos'}
        </div>
      )}

      {/* CONTENT LISTING / TABLE / STATES */}
      {loading ? (
        <div className="students-table-wrapper" style={{ padding: '20px' }}>
          <TableSkeleton columns={7} rows={5} />
        </div>
      ) : studentsWithCourse.length === 0 ? (
        <div className="db-empty-state-card" id="students-empty-state">
          <div className="db-empty-icon">👥</div>
          <h3 className="db-empty-title">Aún no tienes alumnos inscritos</h3>
          <p className="db-empty-desc">
            Agrega un alumno manualmente o importa varios mediante un archivo de Excel.
          </p>

          {courses.length > 0 ? (
            <button
              type="button"
              id="btn-empty-add-student"
              className="btn-primary-sm"
              onClick={handleOpenAddModal}
            >
              + Agregar alumno
            </button>
          ) : (
            <div className="alert alert-danger" style={{ marginTop: '12px' }}>
              No tienes cursos asignados. Solicita a tu administrador que te asigne un curso para inscribir alumnos.
            </div>
          )}
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="db-empty-state-card" id="students-search-no-results">
          <div className="db-empty-icon">🔍</div>
          <h3 className="db-empty-title">No encontramos alumnos con esos criterios</h3>
          <p className="db-empty-desc">
            Intenta cambiar los términos de búsqueda o ajustar el filtro de curso seleccionado.
          </p>
          <button
            type="button"
            className="btn-secondary-sm"
            onClick={() => {
              setSearchQuery('');
              setSelectedCourseId('ALL');
            }}
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="students-table-wrapper">
          <table className="students-table" id="students-main-table">
            <thead>
              <tr>
                <th>Alumno</th>
                <th>Matrícula</th>
                <th>Correo</th>
                <th>Curso</th>
                <th>Estado de cuenta</th>
                <th>Activación</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((item) => {
                const key = `${item.courseId}-${item.student.id}`;
                const isResending = resendingStudentId === key;
                const isMenuOpen = activeMenuStudentId === key;

                return (
                  <tr key={key} id={`student-row-${item.student.id}`}>
                    <td>
                      <div className="student-name-cell">
                        <span className="student-name-text">{item.student.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="student-code-text">{item.student.studentNumber}</span>
                    </td>
                    <td>
                      <span className="student-email-text">{item.student.email}</span>
                    </td>
                    <td>
                      <span className="student-course-badge" title={item.courseName}>
                        {item.subjectCode}
                      </span>
                    </td>
                    <td>{getAccountBadge(item.student.accountStatus)}</td>
                    <td>{getActivationBadge(item.student.activatedAt)}</td>
                    <td style={{ textAlign: 'right', position: 'relative' }}>
                      <div className="students-action-cell">
                        <button
                          type="button"
                          className="students-action-trigger"
                          id={`btn-actions-${item.student.id}`}
                          onClick={() => setActiveMenuStudentId(isMenuOpen ? null : key)}
                        >
                          ⋮
                        </button>

                        {isMenuOpen && (
                          <div className="students-action-menu" id={`menu-${item.student.id}`}>
                            {(!item.student.activatedAt || item.student.accountStatus === 'PENDING') && (
                              <button
                                type="button"
                                className="students-menu-item"
                                disabled={isResending}
                                onClick={() => handleResendInvitation(item)}
                              >
                                {isResending ? 'Enviando...' : 'Reenviar invitación'}
                              </button>
                            )}

                            <button
                              type="button"
                              className="students-menu-item danger"
                              onClick={() => {
                                setActiveMenuStudentId(null);
                                handleInitiateDropStudent(item);
                              }}
                            >
                              Quitar del curso
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

      {/* MODAL PRINCIPAL: AGREGAR ALUMNO (UX-002) */}
      {isAddModalOpen && (
        <div className="students-modal-overlay" id="add-student-modal-overlay">
          <div className="students-modal-card" id="add-student-modal-card">
            <div className="modal-header">
              <h2 className="modal-title">
                {addModalTab === 'SELECT' && 'Agregar alumno'}
                {addModalTab === 'SEARCH' && 'Buscar alumno existente'}
                {addModalTab === 'REGISTER' && 'Registrar nuevo alumno'}
                {addModalTab === 'EXCEL' && 'Importar desde Excel'}
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsAddModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* CURSO TARGET SELECTION */}
            {courses.length > 1 && addModalTab !== 'SELECT' && (
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" htmlFor="modal-target-course">
                  Curso destino para inscripción:
                </label>
                <select
                  id="modal-target-course"
                  className="form-input"
                  value={targetCourseId}
                  onChange={(e) => setTargetCourseId(e.target.value)}
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.subject?.code || 'MATERIA'} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* TAB SELECT: 3 OPCIONES */}
            {addModalTab === 'SELECT' && (
              <div className="students-options-grid">
                <button
                  type="button"
                  id="option-search-existing"
                  className="students-option-card"
                  onClick={() => setAddModalTab('SEARCH')}
                >
                  <div className="option-icon primary">🔎</div>
                  <div className="option-text">
                    <span className="option-title">Buscar alumno existente</span>
                    <span className="option-desc">Reutiliza su cuenta y acceso actual en la plataforma.</span>
                  </div>
                </button>

                <button
                  type="button"
                  id="option-register-new"
                  className="students-option-card"
                  onClick={() => setAddModalTab('REGISTER')}
                >
                  <div className="option-icon accent">👤</div>
                  <div className="option-text">
                    <span className="option-title">Registrar nuevo alumno</span>
                    <span className="option-desc">Crea su cuenta y envía su proceso de activación inicial.</span>
                  </div>
                </button>

                <button
                  type="button"
                  id="option-import-excel"
                  className="students-option-card"
                  onClick={() => setAddModalTab('EXCEL')}
                >
                  <div className="option-icon success">📊</div>
                  <div className="option-text">
                    <span className="option-title">Importar desde Excel</span>
                    <span className="option-desc">Carga masiva de alumnos mediante archivo estructurado.</span>
                  </div>
                </button>
              </div>
            )}

            {/* TAB SEARCH: BUSCAR EXISTENTE */}
            {addModalTab === 'SEARCH' && (
              <div className="modal-tab-content">
                {searchError && <div className="alert alert-danger">{searchError}</div>}

                <form onSubmit={handleSearchExistingStudents} className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" htmlFor="exist-search-input">
                    Buscar por nombre, matrícula o correo:
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      id="exist-search-input"
                      type="text"
                      className="form-input"
                      placeholder="Ej: 20250001, Juan..."
                      value={existSearchQuery}
                      onChange={(e) => setExistSearchQuery(e.target.value)}
                    />
                    <button type="submit" className="btn-primary-sm" disabled={searchLoading}>
                      {searchLoading ? 'Buscando...' : 'Buscar'}
                    </button>
                  </div>
                </form>

                {searchSubmitted && !searchLoading && searchResults.length === 0 && (
                  <div className="alert alert-danger">No se encontraron alumnos registrados que coincidan con la búsqueda.</div>
                )}

                {searchResults.length > 0 && (
                  <div className="search-results-list">
                    {searchResults.map((st) => (
                      <div key={st.id} className="search-result-item">
                        <div>
                          <div className="result-name">{st.name}</div>
                          <div className="result-meta">
                            Matrícula: <strong>{st.studentNumber}</strong> | Correo: <strong>{st.email}</strong>
                          </div>
                        </div>

                        {st.isAlreadyEnrolled ? (
                          <span className="students-badge badge-pending">Ya inscrito</span>
                        ) : (
                          <button
                            type="button"
                            className="btn-primary-sm"
                            disabled={enrollingStudentId === st.studentNumber}
                            onClick={() => handleEnrollExistingStudent(st)}
                          >
                            {enrollingStudentId === st.studentNumber ? 'Inscribiendo...' : 'Inscribir'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="modal-footer-bar">
                  <button type="button" className="btn-secondary-sm" onClick={() => setAddModalTab('SELECT')}>
                    ← Volver a opciones
                  </button>
                </div>
              </div>
            )}

            {/* TAB REGISTER: ALTA MANUAL */}
            {addModalTab === 'REGISTER' && (
              <form onSubmit={handleManualStudentSubmit} className="modal-tab-content">
                {manualError && <div className="alert alert-danger">{manualError}</div>}

                <div className="form-group">
                  <label className="form-label" htmlFor="manual-name">Nombre completo</label>
                  <input
                    id="manual-name"
                    type="text"
                    className="form-input"
                    placeholder="Ej: Juan Carlos Pérez"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    disabled={manualSubmitting}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="manual-number">Matrícula o número de estudiante</label>
                  <input
                    id="manual-number"
                    type="text"
                    className="form-input"
                    placeholder="Ej: 20250001"
                    value={manualStudentNumber}
                    onChange={(e) => setManualStudentNumber(e.target.value)}
                    disabled={manualSubmitting}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="manual-email">Correo electrónico</label>
                  <input
                    id="manual-email"
                    type="email"
                    className="form-input"
                    placeholder="Ej: alumno@uaemex.mx"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    disabled={manualSubmitting}
                    required
                  />
                </div>

                <div className="modal-footer-bar">
                  <button type="button" className="btn-secondary-sm" onClick={() => setAddModalTab('SELECT')} disabled={manualSubmitting}>
                    ← Volver
                  </button>
                  <button type="submit" className="btn-primary-sm" disabled={manualSubmitting}>
                    {manualSubmitting ? 'Registrando...' : 'Registrar e inscribir'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB EXCEL: IMPORTACIÓN */}
            {addModalTab === 'EXCEL' && (
              <div className="modal-tab-content">
                {importError && <div className="alert alert-danger">{importError}</div>}

                {!importPreview && !importConfirmResult && (
                  <form onSubmit={handlePreviewImport}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="excel-file-input">
                        Seleccionar archivo Excel (.xlsx, .csv):
                      </label>
                      <input
                        id="excel-file-input"
                        type="file"
                        accept=".xlsx,.csv"
                        className="form-input"
                        onChange={(e) => setImportFile(e.target.files ? e.target.files[0] : null)}
                        disabled={importLoading}
                        required
                      />
                      <span className="password-hint">El archivo debe incluir las columnas: Nombre, Matrícula, Correo.</span>
                    </div>

                    <div className="modal-footer-bar">
                      <button type="button" className="btn-secondary-sm" onClick={() => setAddModalTab('SELECT')} disabled={importLoading}>
                        ← Volver
                      </button>
                      <button type="submit" className="btn-primary-sm" disabled={importLoading || !importFile}>
                        {importLoading ? 'Analizando...' : 'Ver vista previa'}
                      </button>
                    </div>
                  </form>
                )}

                {importPreview && !importConfirmResult && (
                  <div>
                    <div className="excel-summary-box">
                      <span>Total: <strong>{importPreview.summary.total}</strong></span>
                      <span>Nuevos: <strong style={{ color: 'var(--color-success)' }}>{importPreview.summary.new}</strong></span>
                      <span>Existentes: <strong>{importPreview.summary.existingToEnroll}</strong></span>
                      <span>Ya inscritos: <strong>{importPreview.summary.alreadyEnrolled}</strong></span>
                      <span>Conflictos: <strong style={{ color: 'var(--color-danger)' }}>{importPreview.summary.conflicts + importPreview.summary.invalid}</strong></span>
                    </div>

                    <div className="excel-rows-preview" style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '16px' }}>
                      {importPreview.rows.map((row) => (
                        <div key={row.rowNumber} className="search-result-item" style={{ fontSize: '0.85rem' }}>
                          <div>
                            <strong>#{row.rowNumber} {row.name}</strong> ({row.studentNumber}) — {row.email}
                          </div>
                          <div>
                            {row.status === 'NEW' && <span className="students-badge badge-active">NUEVO</span>}
                            {row.status === 'EXISTING_TO_ENROLL' && <span className="students-badge badge-pending">EXISTENTE</span>}
                            {row.status === 'ALREADY_ENROLLED' && <span className="students-badge">YA INSCRITO</span>}
                            {(row.status === 'CONFLICT' || row.status === 'INVALID') && <span className="students-badge badge-expired">CONFLICTO</span>}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="modal-footer-bar">
                      <button type="button" className="btn-secondary-sm" onClick={() => setImportPreview(null)} disabled={importLoading}>
                        Cambiar archivo
                      </button>
                      <button type="button" className="btn-primary-sm" onClick={handleConfirmImport} disabled={importLoading}>
                        {importLoading ? 'Procesando...' : 'Confirmar e inscribir válidos'}
                      </button>
                    </div>
                  </div>
                )}

                {importConfirmResult && (
                  <div className="alert alert-success">
                    <h4>Importación finalizada</h4>
                    <p>Total procesados: {importConfirmResult.totalProcessed}</p>
                    <p>Alumnos creados: {importConfirmResult.createdCount}</p>
                    <p>Alumnos existentes inscritos: {importConfirmResult.enrolledExistingCount}</p>
                    <button type="button" className="btn-primary-sm" style={{ marginTop: '12px' }} onClick={() => setIsAddModalOpen(false)}>
                      Cerrar modal
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE DOBLE CONFIRMACIÓN PARA QUITAR ALUMNO DEL CURSO (QA-007.9) */}
      {dropTargetStudent && (
        <div className="students-modal-overlay">
          <div className="students-modal-card" style={{ maxWidth: '480px' }}>
            {dropConfirmStep === 1 ? (
              <>
                <h3 className="modal-title" style={{ marginBottom: '12px' }}>
                  ¿Quitar alumno del curso?
                </h3>
                <p className="page-description" style={{ marginBottom: '20px', fontSize: '0.9rem' }}>
                  El alumno dejará de formar parte de este curso. Su avance e historial académico se conservarán.
                </p>
                {dropError && <div className="alert alert-danger" style={{ marginBottom: '16px' }}>{dropError}</div>}
                <div className="modal-footer-bar">
                  <button
                    type="button"
                    className="btn-secondary-sm"
                    onClick={() => {
                      setDropTargetStudent(null);
                      setDropError(null);
                    }}
                    disabled={dropLoading}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn-primary-sm"
                    onClick={() => setDropConfirmStep(2)}
                    disabled={dropLoading}
                  >
                    Continuar
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="modal-title" style={{ marginBottom: '12px', color: 'var(--color-danger)' }}>
                  Confirmación final
                </h3>
                <p className="page-description" style={{ marginBottom: '20px', fontSize: '0.9rem' }}>
                  ¿Estás seguro de que deseas quitar a <strong>{dropTargetStudent.student.name}</strong> del curso <strong>{dropTargetStudent.courseName}</strong>?
                  El alumno perderá su acceso activo al curso, pero su historial académico será conservado.
                </p>
                {dropError && <div className="alert alert-danger" style={{ marginBottom: '16px' }}>{dropError}</div>}
                <div className="modal-footer-bar">
                  <button
                    type="button"
                    className="btn-secondary-sm"
                    onClick={() => {
                      setDropTargetStudent(null);
                      setDropError(null);
                    }}
                    disabled={dropLoading}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn-primary-sm"
                    style={{ backgroundColor: '#dc2626', borderColor: '#dc2626' }}
                    onClick={handleConfirmDropStudent}
                    disabled={dropLoading}
                  >
                    {dropLoading ? 'Quitando alumno...' : 'Sí, quitar del curso'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
