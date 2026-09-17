import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Course, CourseStatus, CourseStudent, ImportPreviewResult, BulkConfirmResult, Module, Lesson, CourseContent } from '../types/academic.js';
import { CourseServiceAPI, AdminTeacher } from '../services/course.service.js';
import { AssessmentServiceAPI } from '../services/assessment.service.js';
import { StudentAssessmentDTO } from '../types/assessment.js';
import { useAuth } from '../auth/useAuth.js';
import { ApiError } from '../services/api.js';
import { MarkdownContent } from '../components/MarkdownContent.js';

export const CourseDetailPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<CourseStudent[]>([]);
  const [assessments, setAssessments] = useState<StudentAssessmentDTO[]>([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);
  const [courseContent, setCourseContent] = useState<CourseContent | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Estados para Módulos y Lecciones
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [moduleModalMode, setModuleModalMode] = useState<'create' | 'edit'>('create');
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [moduleTitle, setModuleTitle] = useState('');
  const [moduleDescription, setModuleDescription] = useState('');
  const [moduleIsPublished, setModuleIsPublished] = useState(true);
  const [moduleSubmitting, setModuleSubmitting] = useState(false);
  const [moduleError, setModuleError] = useState<string | null>(null);

  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [lessonModalMode, setLessonModalMode] = useState<'create' | 'edit'>('create');
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [lessonTargetModuleId, setLessonTargetModuleId] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDescription, setLessonDescription] = useState('');
  const [lessonContent, setLessonContent] = useState('');
  const [lessonIsPublished, setLessonIsPublished] = useState(true);
  const [lessonSubmitting, setLessonSubmitting] = useState(false);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const [lessonTab, setLessonTab] = useState<'edit' | 'preview'>('edit');

  // Estado para gestión de Maestros (ADMIN)
  const [availableTeachers, setAvailableTeachers] = useState<AdminTeacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [assigningTeacher, setAssigningTeacher] = useState(false);

  // Modal de confirmación para cambio de estado
  const [pendingTargetStatus, setPendingTargetStatus] = useState<CourseStatus | null>(null);

  // Estados para Alta Manual de Alumnos
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualStudentNumber, setManualStudentNumber] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // Estados para Importación Excel
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewResult | null>(null);
  const [importConfirmResult, setImportConfirmResult] = useState<BulkConfirmResult | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Modal de confirmación para Restablecer Acceso
  const [resetAccessStudent, setResetAccessStudent] = useState<CourseStudent | null>(null);
  const [resendingStudentId, setResendingStudentId] = useState<string | null>(null);

  const fetchCourseContentData = React.useCallback(async () => {
    if (!courseId) return;
    setContentLoading(true);
    try {
      const content = await CourseServiceAPI.getCourseContent(courseId);
      setCourseContent(content);
    } catch {
      // Ignorar o capturar según permisos
    } finally {
      setContentLoading(false);
    }
  }, [courseId]);

  const fetchCourseDetail = React.useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await CourseServiceAPI.getCourseDetail(courseId);
      setCourse(data);

      if (user?.role === 'ADMIN') {
        const teachers = await CourseServiceAPI.getAvailableTeachers();
        setAvailableTeachers(teachers);
        if (teachers.length > 0) {
          setSelectedTeacherId(teachers[0].id);
        }
      }

      // Cargar lista de alumnos si tiene permisos (ADMIN o TEACHER asignado)
      const isAssigned = user?.role === 'ADMIN' || data.courseTeachers?.some((ct) => ct.teacherId === user?.id);
      if (isAssigned) {
        setStudentsLoading(true);
        try {
          const studentsData = await CourseServiceAPI.getCourseStudents(courseId);
          setStudents(studentsData);
        } catch {
          // Ignorar si el usuario no tiene permisos
        } finally {
          setStudentsLoading(false);
        }
      }

      // Cargar contenido del curso (Módulos y Lecciones)
      await fetchCourseContentData();

      // Cargar evaluaciones del curso
      setAssessmentsLoading(true);
      try {
        const assessmentsData = await AssessmentServiceAPI.getCourseAssessments(courseId);
        setAssessments(assessmentsData);
      } catch {
        // Ignorar si falla o no hay evaluaciones
      } finally {
        setAssessmentsLoading(false);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('No fue posible cargar el detalle del curso.');
      }
    } finally {
      setLoading(false);
    }
  }, [courseId, user?.role, user?.id, fetchCourseContentData]);

  useEffect(() => {
    fetchCourseDetail();
  }, [fetchCourseDetail]);

  // Handlers para Módulos
  const handleOpenCreateModuleModal = () => {
    setModuleModalMode('create');
    setSelectedModule(null);
    setModuleTitle('');
    setModuleDescription('');
    setModuleIsPublished(true);
    setModuleError(null);
    setIsModuleModalOpen(true);
  };

  const handleOpenEditModuleModal = (mod: Module) => {
    setModuleModalMode('edit');
    setSelectedModule(mod);
    setModuleTitle(mod.title);
    setModuleDescription(mod.description || '');
    setModuleIsPublished(mod.isPublished);
    setModuleError(null);
    setIsModuleModalOpen(true);
  };

  const handleSaveModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    setModuleError(null);

    if (!moduleTitle.trim()) {
      setModuleError('El título del módulo es requerido.');
      return;
    }

    setModuleSubmitting(true);
    try {
      if (moduleModalMode === 'create') {
        await CourseServiceAPI.createModule(courseId, {
          title: moduleTitle.trim(),
          description: moduleDescription.trim() || undefined,
          isPublished: moduleIsPublished,
        });
        setActionSuccess('Módulo creado exitosamente.');
      } else if (selectedModule) {
        await CourseServiceAPI.updateModule(courseId, selectedModule.id, {
          title: moduleTitle.trim(),
          description: moduleDescription.trim() || undefined,
          isPublished: moduleIsPublished,
        });
        setActionSuccess('Módulo actualizado exitosamente.');
      }
      setIsModuleModalOpen(false);
      await fetchCourseContentData();
    } catch (err) {
      if (err instanceof ApiError) {
        setModuleError(err.message);
      } else {
        setModuleError('Error al guardar el módulo.');
      }
    } finally {
      setModuleSubmitting(false);
    }
  };

  const handleReorderModule = async (moduleId: string, direction: 'up' | 'down') => {
    if (!courseId || !courseContent || !courseContent.modules) return;

    const modules = [...courseContent.modules];
    const index = modules.findIndex((m) => m.id === moduleId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= modules.length) return;

    // Swap positions
    const temp = modules[index];
    modules[index] = modules[targetIndex];
    modules[targetIndex] = temp;

    const reorderedIds = modules.map((m) => m.id);

    try {
      setActionError(null);
      await CourseServiceAPI.reorderModules(courseId, reorderedIds);
      await fetchCourseContentData();
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError('Error al reordenar los módulos.');
      }
    }
  };

  // Handlers para Lecciones
  const handleOpenCreateLessonModal = (moduleId: string) => {
    setLessonModalMode('create');
    setSelectedLesson(null);
    setLessonTargetModuleId(moduleId);
    setLessonTitle('');
    setLessonDescription('');
    setLessonContent('');
    setLessonIsPublished(true);
    setLessonTab('edit');
    setLessonError(null);
    setIsLessonModalOpen(true);
  };

  const handleOpenEditLessonModal = (moduleId: string, lesson: Lesson) => {
    setLessonModalMode('edit');
    setSelectedLesson(lesson);
    setLessonTargetModuleId(moduleId);
    setLessonTitle(lesson.title);
    setLessonDescription(lesson.description || '');
    setLessonContent(lesson.content || '');
    setLessonIsPublished(lesson.isPublished);
    setLessonTab('edit');
    setLessonError(null);
    setIsLessonModalOpen(true);
  };

  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !lessonTargetModuleId) return;
    setLessonError(null);

    if (!lessonTitle.trim()) {
      setLessonError('El título de la lección es requerido.');
      return;
    }

    setLessonSubmitting(true);
    try {
      if (lessonModalMode === 'create') {
        await CourseServiceAPI.createLesson(courseId, lessonTargetModuleId, {
          title: lessonTitle.trim(),
          description: lessonDescription.trim() || undefined,
          content: lessonContent.trim() || undefined,
          isPublished: lessonIsPublished,
        });
        setActionSuccess('Lección creada exitosamente.');
      } else if (selectedLesson) {
        await CourseServiceAPI.updateLesson(courseId, lessonTargetModuleId, selectedLesson.id, {
          title: lessonTitle.trim(),
          description: lessonDescription.trim() || undefined,
          content: lessonContent.trim() || undefined,
          isPublished: lessonIsPublished,
        });
        setActionSuccess('Lección actualizada exitosamente.');
      }
      setIsLessonModalOpen(false);
      await fetchCourseContentData();
    } catch (err) {
      if (err instanceof ApiError) {
        setLessonError(err.message);
      } else {
        setLessonError('Error al guardar la lección.');
      }
    } finally {
      setLessonSubmitting(false);
    }
  };

  const handleReorderLesson = async (moduleId: string, lessonId: string, direction: 'up' | 'down') => {
    if (!courseId || !courseContent || !courseContent.modules) return;

    const mod = courseContent.modules.find((m) => m.id === moduleId);
    if (!mod || !mod.lessons) return;

    const lessons = [...mod.lessons];
    const index = lessons.findIndex((l) => l.id === lessonId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= lessons.length) return;

    // Swap positions
    const temp = lessons[index];
    lessons[index] = lessons[targetIndex];
    lessons[targetIndex] = temp;

    const reorderedIds = lessons.map((l) => l.id);

    try {
      setActionError(null);
      await CourseServiceAPI.reorderLessons(courseId, moduleId, reorderedIds);
      await fetchCourseContentData();
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError('Error al reordenar las lecciones.');
      }
    }
  };

  const refreshStudentsList = async () => {
    if (!courseId) return;
    setStudentsLoading(true);
    try {
      const studentsData = await CourseServiceAPI.getCourseStudents(courseId);
      setStudents(studentsData);
    } catch {
      // Ignore
    } finally {
      setStudentsLoading(false);
    }
  };

  const handleStatusChangeConfirm = async () => {
    if (!courseId || !pendingTargetStatus) return;
    setActionError(null);
    setActionSuccess(null);
    setActionLoading(true);

    try {
      const updatedCourse = await CourseServiceAPI.changeCourseStatus(courseId, pendingTargetStatus);
      setCourse(updatedCourse);
      setActionSuccess(`Estado del curso actualizado a ${pendingTargetStatus}.`);
      setPendingTargetStatus(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError('Error al cambiar el estado del curso.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !selectedTeacherId) return;
    setActionError(null);
    setActionSuccess(null);
    setAssigningTeacher(true);

    try {
      await CourseServiceAPI.assignTeacher(courseId, selectedTeacherId);
      setActionSuccess('Maestro asignado al curso exitosamente.');
      await fetchCourseDetail();
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError('Error al asignar el maestro al curso.');
      }
    } finally {
      setAssigningTeacher(false);
    }
  };

  const handleRemoveTeacher = async (teacherId: string) => {
    if (!courseId) return;
    setActionError(null);
    setActionSuccess(null);
    setActionLoading(true);

    try {
      await CourseServiceAPI.removeTeacher(courseId, teacherId);
      setActionSuccess('Maestro removido del curso.');
      await fetchCourseDetail();
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError('Error al remover el maestro del curso.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Alta Manual de Alumno
  const handleOpenManualModal = () => {
    setManualName('');
    setManualStudentNumber('');
    setManualEmail('');
    setManualError(null);
    setIsManualModalOpen(true);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    setManualError(null);

    if (!manualName.trim() || !manualStudentNumber.trim() || !manualEmail.trim()) {
      setManualError('Todos los campos son obligatorios.');
      return;
    }

    setManualSubmitting(true);
    try {
      const res = await CourseServiceAPI.enrollStudent(courseId, {
        name: manualName.trim(),
        studentNumber: manualStudentNumber.trim(),
        email: manualEmail.trim(),
      });

      setIsManualModalOpen(false);
      setActionError(null);

      if (res.isNewStudent) {
        if (res.emailSent) {
          setActionSuccess('Alumno agregado correctamente. Se envió una invitación por correo.');
        } else {
          setActionSuccess('El alumno fue agregado, pero el correo no pudo enviarse. Puedes reenviar la invitación.');
        }
      } else {
        setActionSuccess('Alumno inscrito correctamente en el curso.');
      }

      await fetchCourseDetail();
      await refreshStudentsList();
    } catch (err) {
      if (err instanceof ApiError) {
        setManualError(err.message);
      } else {
        setManualError('Error al inscribir al alumno.');
      }
    } finally {
      setManualSubmitting(false);
    }
  };

  // Importación Excel
  const handleOpenImportModal = () => {
    setImportFile(null);
    setImportPreview(null);
    setImportConfirmResult(null);
    setImportError(null);
    setIsImportModalOpen(true);
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImportFile(file);
    setImportPreview(null);
    setImportConfirmResult(null);
    setImportError(null);
  };

  const handlePreviewImport = async () => {
    if (!courseId || !importFile) return;
    setImportError(null);
    setImportLoading(true);

    try {
      const preview = await CourseServiceAPI.previewStudentImport(courseId, importFile);
      setImportPreview(preview);
    } catch (err) {
      if (err instanceof ApiError) {
        setImportError(err.message);
      } else {
        setImportError('Error al analizar el archivo Excel.');
      }
    } finally {
      setImportLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!courseId || !importPreview) return;
    setImportError(null);
    setImportLoading(true);

    const processableRows = importPreview.rows
      .filter((r) => r.status === 'NEW' || r.status === 'EXISTING_TO_ENROLL')
      .map((r) => ({
        name: r.name,
        studentNumber: r.studentNumber,
        email: r.email,
      }));

    if (processableRows.length === 0) {
      setImportError('No hay registros procesables para importar.');
      setImportLoading(false);
      return;
    }

    try {
      const result = await CourseServiceAPI.confirmStudentImport(courseId, processableRows);
      setImportConfirmResult(result);
      await fetchCourseDetail();
      await refreshStudentsList();
    } catch (err) {
      if (err instanceof ApiError) {
        setImportError(err.message);
      } else {
        setImportError('Error al confirmar la importación masiva.');
      }
    } finally {
      setImportLoading(false);
    }
  };

  // Reenviar invitación
  const handleResendInvitation = async (studentId: string) => {
    if (!courseId) return;
    setResendingStudentId(studentId);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await CourseServiceAPI.resendInvitation(courseId, studentId);
      if (res.emailSent) {
        setActionSuccess('Nueva invitación enviada por correo exitosamente.');
      } else {
        setActionSuccess('La invitación fue regenerada, pero el correo no pudo enviarse. Puedes intentarlo de nuevo.');
      }
      await refreshStudentsList();
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError('Error al reenviar la invitación.');
      }
    } finally {
      setResendingStudentId(null);
    }
  };

  // Restablecer acceso
  const handleResetAccessConfirm = async () => {
    if (!courseId || !resetAccessStudent) return;
    setActionError(null);
    setActionSuccess(null);
    setActionLoading(true);

    try {
      const res = await CourseServiceAPI.resetAccess(courseId, resetAccessStudent.id);
      if (res.emailSent) {
        setActionSuccess(`Acceso restablecido para ${resetAccessStudent.name}. Se enviaron las instrucciones por correo.`);
      } else {
        setActionSuccess(`Acceso restablecido para ${resetAccessStudent.name}, pero el correo no pudo enviarse.`);
      }
      setResetAccessStudent(null);
      await refreshStudentsList();
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError('Error al restablecer acceso.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status?: CourseStatus) => {
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

  const getAccountStatusBadge = (status: 'ACTIVE' | 'PENDING' | 'EXPIRED') => {
    switch (status) {
      case 'ACTIVE':
        return <span className="role-pill student" style={{ fontSize: '0.75rem' }}>Activo</span>;
      case 'PENDING':
        return <span className="role-pill admin" style={{ backgroundColor: '#fef3c7', color: '#92400e', fontSize: '0.75rem' }}>Pendiente de activación</span>;
      case 'EXPIRED':
        return <span className="role-pill admin" style={{ backgroundColor: '#fee2e2', color: '#991b1b', fontSize: '0.75rem' }}>Invitación expirada</span>;
    }
  };

  const getRowStatusPill = (status: string) => {
    switch (status) {
      case 'NEW':
        return <span className="role-pill student" style={{ fontSize: '0.75rem' }}>Nuevo</span>;
      case 'EXISTING_TO_ENROLL':
        return <span className="role-pill teacher" style={{ fontSize: '0.75rem' }}>Existente — listo</span>;
      case 'ALREADY_ENROLLED':
        return <span className="role-pill admin" style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '0.75rem' }}>Ya inscrito</span>;
      case 'CONFLICT':
        return <span className="role-pill admin" style={{ backgroundColor: '#fef3c7', color: '#92400e', fontSize: '0.75rem' }}>Conflicto</span>;
      case 'INVALID':
        return <span className="role-pill admin" style={{ backgroundColor: '#fee2e2', color: '#991b1b', fontSize: '0.75rem' }}>Inválido</span>;
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="loading-content" style={{ padding: '60px 0' }}>
        <div className="loading-spinner" />
        <p className="loading-text">Cargando detalle del curso...</p>
      </div>
    );
  }

  if (errorMessage || !course) {
    return (
      <div className="error-page-container">
        <div className="alert alert-danger" style={{ maxWidth: '440px', margin: '0 auto 20px' }}>
          {errorMessage || 'Curso no encontrado.'}
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate('/app/courses')}
        >
          Volver a Mis Cursos
        </button>
      </div>
    );
  }

  const isTeacherAssigned = course.courseTeachers?.some((ct) => ct.teacherId === user?.id);
  const canManageStatus = user?.role === 'ADMIN' || (user?.role === 'TEACHER' && isTeacherAssigned);
  const canManageTeachers = user?.role === 'ADMIN';
  const canManageStudents = user?.role === 'ADMIN' || (user?.role === 'TEACHER' && isTeacherAssigned);
  const isEnrollmentBlocked = course.status === 'FINISHED' || course.status === 'ARCHIVED';

  return (
    <div>
      <button
        type="button"
        className="btn-secondary"
        style={{ marginBottom: '16px' }}
        onClick={() => navigate('/app/courses')}
      >
        ← Volver a Cursos
      </button>

      {actionError && (
        <div className="alert alert-danger" id="course-action-error">
          {actionError}
        </div>
      )}

      {actionSuccess && (
        <div className="alert alert-success" id="course-action-success">
          {actionSuccess}
        </div>
      )}

      {/* Encabezado Principal del Curso */}
      <div className="dashboard-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <span className="role-pill teacher">{course.subject?.code}</span>
              {getStatusBadge(course.status)}
            </div>
            <h1 className="page-title" id="course-detail-name" style={{ marginBottom: '8px' }}>
              {course.name}
            </h1>
            <p className="page-description" style={{ marginBottom: '12px' }}>
              Materia: <strong>{course.subject?.name}</strong>
            </p>
          </div>

          {/* Botones de Cambio de Estado y Gradebook */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {canManageStatus && (
              <>
                <button
                  type="button"
                  id="btn-view-gradebook"
                  className="btn-secondary"
                  style={{ width: 'auto' }}
                  onClick={() => navigate(`/app/courses/${courseId}/gradebook`)}
                >
                  Libro de Calificaciones (Gradebook)
                </button>
                {course.status === 'DRAFT' && (
                  <button
                    type="button"
                    id="btn-activate-course"
                    className="btn-primary"
                    style={{ width: 'auto' }}
                    onClick={() => setPendingTargetStatus('ACTIVE')}
                    disabled={actionLoading}
                  >
                    Activar curso
                  </button>
                )}
                {course.status === 'ACTIVE' && (
                  <button
                    type="button"
                    id="btn-finish-course"
                    className="btn-secondary"
                    style={{ width: 'auto' }}
                    onClick={() => setPendingTargetStatus('FINISHED')}
                    disabled={actionLoading}
                  >
                    Finalizar curso
                  </button>
                )}
                {course.status === 'FINISHED' && (
                  <button
                    type="button"
                    id="btn-archive-course"
                    className="btn-secondary"
                    style={{ width: 'auto' }}
                    onClick={() => setPendingTargetStatus('ARCHIVED')}
                    disabled={actionLoading}
                  >
                    Archivar curso
                  </button>
                )}
              </>
            )}

            {user?.role === 'STUDENT' && (
              <button
                type="button"
                id="btn-view-my-grades"
                className="btn-primary"
                style={{ width: 'auto' }}
                onClick={() => navigate(`/app/courses/${courseId}/my-grades`)}
              >
                Mis Calificaciones
              </button>
            )}
          </div>
        </div>

        {course.description && (
          <p style={{ marginTop: '12px', color: 'var(--color-text)', fontSize: '0.95rem' }}>
            {course.description}
          </p>
        )}

        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)', fontSize: '0.875rem', color: 'var(--color-muted)' }}>
          <div>
            <strong>Fecha inicio:</strong> {new Date(course.startDate).toLocaleDateString()}
          </div>
          <div>
            <strong>Fecha término:</strong> {new Date(course.endDate).toLocaleDateString()}
          </div>
          <div>
            <strong>Creado por:</strong> {course.createdBy?.name} ({course.createdBy?.email})
          </div>
          <div>
            <strong>Alumnos inscritos:</strong> {students.length}
          </div>
        </div>
      </div>

      {/* Sección de Maestros Asignados */}
      <div className="dashboard-card" style={{ marginBottom: '24px' }}>
        <h3 className="dashboard-card-title" style={{ marginBottom: '16px' }}>
          Maestros Asignados ({course.courseTeachers?.length ?? 0})
        </h3>

        {course.courseTeachers && course.courseTeachers.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            {course.courseTeachers.map((ct) => (
              <div
                key={ct.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  backgroundColor: 'var(--color-background)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div>
                  <strong style={{ color: 'var(--color-text)' }}>{ct.teacher?.name}</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{ct.teacher?.email}</div>
                </div>

                {canManageTeachers && (
                  <button
                    type="button"
                    id={`btn-remove-teacher-${ct.teacherId}`}
                    className="btn-logout"
                    onClick={() => handleRemoveTeacher(ct.teacherId)}
                    disabled={actionLoading}
                  >
                    Quitar
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="dashboard-card-desc" style={{ marginBottom: '20px' }}>
            Este curso no cuenta con ningún maestro asignado actualmente.
          </p>
        )}

        {/* Panel de Asignación de Maestros (ADMIN) */}
        {canManageTeachers && (
          <form onSubmit={handleAssignTeacher} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <label className="form-label" htmlFor="select-teacher">
                Asignar un nuevo maestro
              </label>
              <select
                id="select-teacher"
                className="form-input"
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                disabled={assigningTeacher || availableTeachers.length === 0}
              >
                {availableTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.email})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              id="btn-assign-teacher"
              className="btn-primary"
              style={{ width: 'auto' }}
              disabled={assigningTeacher || availableTeachers.length === 0}
            >
              {assigningTeacher ? 'Asignando...' : 'Asignar maestro'}
            </button>
          </form>
        )}
      </div>

      {/* Sección Real de Alumnos del Curso (FASE 6B) */}
      {canManageStudents && (
        <div className="dashboard-card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div>
              <h3 className="dashboard-card-title" id="students-section-title">
                Alumnos del Curso ({students.length})
              </h3>
              <p className="dashboard-card-desc" style={{ marginBottom: 0 }}>
                Inscribe y administra los alumnos asignados a este grupo.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                id="btn-manual-add-student"
                className="btn-primary"
                style={{ width: 'auto' }}
                onClick={handleOpenManualModal}
                disabled={isEnrollmentBlocked}
              >
                + Agregar alumno
              </button>
              <button
                type="button"
                id="btn-import-excel"
                className="btn-secondary"
                style={{ width: 'auto' }}
                onClick={handleOpenImportModal}
                disabled={isEnrollmentBlocked}
              >
                📁 Importar Excel
              </button>
            </div>
          </div>

          {isEnrollmentBlocked && (
            <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
              Este curso ya no acepta nuevas inscripciones ({course.status}).
            </div>
          )}

          {studentsLoading ? (
            <div className="loading-content" style={{ padding: '20px 0' }}>
              <div className="loading-spinner" />
              <p className="loading-text">Cargando alumnos inscritos...</p>
            </div>
          ) : students.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 16px', backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-sm)' }}>
              <p className="dashboard-card-desc" style={{ marginBottom: 0 }}>
                Aún no hay alumnos inscritos en este curso.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-muted)' }}>
                    <th style={{ padding: '10px' }}>Nombre</th>
                    <th style={{ padding: '10px' }}>Matrícula</th>
                    <th style={{ padding: '10px' }}>Correo</th>
                    <th style={{ padding: '10px' }}>Estado Cuenta</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((st) => (
                    <tr key={st.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px 10px', fontWeight: 600 }}>{st.name}</td>
                      <td style={{ padding: '12px 10px', fontFamily: 'monospace' }}>{st.studentNumber}</td>
                      <td style={{ padding: '12px 10px' }}>{st.email}</td>
                      <td style={{ padding: '12px 10px' }}>{getAccountStatusBadge(st.accountStatus)}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                        {st.accountStatus !== 'ACTIVE' ? (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ fontSize: '0.775rem', padding: '4px 8px' }}
                            onClick={() => handleResendInvitation(st.id)}
                            disabled={resendingStudentId === st.id}
                          >
                            {resendingStudentId === st.id ? 'Reenviando...' : 'Reenviar invitación'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ fontSize: '0.775rem', padding: '4px 8px', color: '#991b1b', borderColor: '#fca5a5' }}
                            onClick={() => setResetAccessStudent(st)}
                            disabled={actionLoading}
                          >
                            Restablecer acceso
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Sección Real de Contenido del Curso (Fase 7A: Módulos y Lecciones) */}
      <div className="dashboard-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h3 className="dashboard-card-title" id="content-section-title">
              Contenido del Curso ({courseContent?.modules?.length ?? 0} Módulos)
            </h3>
            <p className="dashboard-card-desc" style={{ marginBottom: 0 }}>
              Estructura académica organizada por módulos y lecciones.
            </p>
          </div>

          {(user?.role === 'ADMIN' || (user?.role === 'TEACHER' && isTeacherAssigned)) && !isEnrollmentBlocked && (
            <button
              type="button"
              id="btn-add-module"
              className="btn-primary"
              style={{ width: 'auto' }}
              onClick={handleOpenCreateModuleModal}
            >
              + Nuevo módulo
            </button>
          )}
        </div>

        {/* Progreso Académico para Alumnos */}
        {user?.role === 'STUDENT' && courseContent?.progress && (
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--color-background)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text)' }}>
                Mi Progreso en el Curso
              </span>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#047857' }}>
                {courseContent.progress.completedLessons} de {courseContent.progress.totalLessons} lecciones completadas — {courseContent.progress.percentage}%
              </span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, Math.max(0, courseContent.progress.percentage))}%`,
                  backgroundColor: '#10b981',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )}

        {isEnrollmentBlocked && (
          <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
            {user?.role === 'STUDENT' ? (
              <>El contenido de este curso se encuentra en modo solo lectura.</>
            ) : (
              <>
                Este curso se encuentra en estado <strong>{course.status}</strong>. El contenido está en modo solo lectura.
              </>
            )}
          </div>
        )}

        {contentLoading ? (
          <div className="loading-content" style={{ padding: '20px 0' }}>
            <div className="loading-spinner" />
            <p className="loading-text">Cargando contenido del curso...</p>
          </div>
        ) : !courseContent?.modules || courseContent.modules.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 16px', backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-sm)' }}>
            <p className="dashboard-card-desc" style={{ marginBottom: 0 }}>
              {user?.role === 'STUDENT'
                ? 'Aún no hay contenido disponible para este curso.'
                : 'Aún no hay módulos registrados en este curso.'}
            </p>
            {user?.role === 'STUDENT' && (
              <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '4px', marginBottom: 0 }}>
                El contenido aparecerá aquí cuando esté disponible.
              </p>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {courseContent.modules.map((mod, modIdx) => (
              <div
                key={mod.id}
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  backgroundColor: 'var(--color-background)',
                }}
              >
                {/* Encabezado del Módulo */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span className="role-pill teacher" style={{ fontSize: '0.75rem' }}>
                        Módulo #{mod.order}
                      </span>
                      {user?.role !== 'STUDENT' && (
                        mod.isPublished ? (
                          <span className="role-pill student" style={{ fontSize: '0.75rem' }}>Publicado</span>
                        ) : (
                          <span className="role-pill admin" style={{ backgroundColor: '#fef3c7', color: '#92400e', fontSize: '0.75rem' }}>Borrador</span>
                        )
                      )}
                    </div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-text)', margin: '4px 0' }}>
                      {mod.title}
                    </h4>
                    {mod.description && (
                      <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', margin: 0 }}>
                        {mod.description}
                      </p>
                    )}
                  </div>

                  {/* Acciones del Módulo */}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {(user?.role === 'ADMIN' || (user?.role === 'TEACHER' && isTeacherAssigned)) && !isEnrollmentBlocked && (
                      <>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.775rem' }}
                          aria-label={`Subir módulo ${mod.title}`}
                          onClick={() => handleReorderModule(mod.id, 'up')}
                          disabled={modIdx === 0}
                        >
                          ↑ Subir
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.775rem' }}
                          aria-label={`Bajar módulo ${mod.title}`}
                          onClick={() => handleReorderModule(mod.id, 'down')}
                          disabled={modIdx === (courseContent.modules.length - 1)}
                        >
                          ↓ Bajar
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.775rem' }}
                          onClick={() => handleOpenEditModuleModal(mod)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ padding: '4px 10px', fontSize: '0.775rem', width: 'auto' }}
                          onClick={() => handleOpenCreateLessonModal(mod.id)}
                        >
                          + Lección
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Sub-lista de Lecciones */}
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px', marginTop: '8px' }}>
                  <div style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '8px' }}>
                    Lecciones ({mod.lessons?.length ?? 0})
                  </div>

                  {!mod.lessons || mod.lessons.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', fontStyle: 'italic', margin: 0 }}>
                      No hay lecciones registradas en este módulo.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {mod.lessons.map((les, lesIdx) => (
                        <div
                          key={les.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '8px',
                            padding: '8px 12px',
                            backgroundColor: 'var(--color-surface, #ffffff)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-sm)',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-muted)' }}>
                                {les.order}.
                              </span>
                              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text)' }}>
                                {les.title}
                              </span>
                              {user?.role !== 'STUDENT' && (
                                les.isPublished ? (
                                  <span className="role-pill student" style={{ fontSize: '0.675rem', padding: '1px 6px' }}>Publicada</span>
                                ) : (
                                  <span className="role-pill admin" style={{ backgroundColor: '#fef3c7', color: '#92400e', fontSize: '0.675rem', padding: '1px 6px' }}>Borrador</span>
                                )
                              )}
                              {les.completed && (
                                <span className="role-pill student" style={{ backgroundColor: '#ecfdf5', color: '#047857', fontSize: '0.675rem', padding: '1px 6px' }}>✓ Completada</span>
                              )}
                            </div>
                            {les.description && (
                              <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '2px' }}>
                                {les.description}
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            {(user?.role === 'ADMIN' || (user?.role === 'TEACHER' && isTeacherAssigned)) && !isEnrollmentBlocked && (
                              <>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ padding: '3px 6px', fontSize: '0.725rem' }}
                                  aria-label={`Subir lección ${les.title}`}
                                  onClick={() => handleReorderLesson(mod.id, les.id, 'up')}
                                  disabled={lesIdx === 0}
                                >
                                  ↑ Subir
                                </button>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ padding: '3px 6px', fontSize: '0.725rem' }}
                                  aria-label={`Bajar lección ${les.title}`}
                                  onClick={() => handleReorderLesson(mod.id, les.id, 'down')}
                                  disabled={lesIdx === (mod.lessons!.length - 1)}
                                >
                                  ↓ Bajar
                                </button>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ padding: '3px 6px', fontSize: '0.725rem' }}
                                  onClick={() => handleOpenEditLessonModal(mod.id, les)}
                                >
                                  Editar
                                </button>
                              </>
                            )}

                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '3px 8px', fontSize: '0.75rem', backgroundColor: 'var(--color-primary-light, #eff6ff)' }}
                              onClick={() => navigate(`/app/courses/${courseId}/modules/${mod.id}/lessons/${les.id}`)}
                            >
                              Ver lección →
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sección Real de Evaluaciones del Curso (Fase 8.4-F) */}
      <div className="dashboard-card" style={{ marginBottom: '24px' }}>
        <h3 className="dashboard-card-title" id="assessments-section-title" style={{ marginBottom: '16px' }}>
          Evaluaciones del Curso ({assessments.length})
        </h3>
        {assessmentsLoading ? (
          <p className="loading-text">Cargando evaluaciones...</p>
        ) : assessments.length === 0 ? (
          <p className="dashboard-card-desc" style={{ marginBottom: 0 }}>
            No hay evaluaciones disponibles en este curso.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {assessments.map((ass) => (
              <div
                key={ass.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  backgroundColor: 'var(--color-background)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ color: 'var(--color-text)', fontSize: '1rem' }}>{ass.title}</strong>
                    <span className={`role-pill ${ass.type === 'EXAM' ? 'admin' : 'student'}`} style={{ fontSize: '0.75rem' }}>
                      {ass.type === 'EXAM' ? 'Examen' : 'Cuestionario'}
                    </span>
                  </div>
                  {ass.description && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '4px' }}>
                      {ass.description}
                    </div>
                  )}
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '4px' }}>
                    {ass.timeLimitMinutes ? `⏱️ ${ass.timeLimitMinutes} min` : '⏱️ Sin límite de tiempo'} • {ass.questions?.length || 0} preguntas
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  style={{ width: 'auto', padding: '6px 16px', fontSize: '0.875rem' }}
                  onClick={() => navigate(`/app/courses/${courseId}/assessments/${ass.id}`)}
                >
                  Ver / Realizar Evaluación →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Alta Manual de Alumno */}
      {isManualModalOpen && (
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
          <div className="auth-card" style={{ maxWidth: '480px' }}>
            <h2 className="page-title" style={{ fontSize: '1.25rem', marginBottom: '16px' }}>
              Agregar Alumno Manualmente
            </h2>

            {manualError && (
              <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
                {manualError}
              </div>
            )}

            <form onSubmit={handleManualSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="manual-student-name">
                  Nombre completo
                </label>
                <input
                  id="manual-student-name"
                  type="text"
                  className="form-input"
                  placeholder="Ej: Juan Pérez López"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  disabled={manualSubmitting}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="manual-student-number">
                  Matrícula
                </label>
                <input
                  id="manual-student-number"
                  type="text"
                  className="form-input"
                  placeholder="Ej: 00012345"
                  value={manualStudentNumber}
                  onChange={(e) => setManualStudentNumber(e.target.value)}
                  disabled={manualSubmitting}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="manual-student-email">
                  Correo electrónico
                </label>
                <input
                  id="manual-student-email"
                  type="email"
                  className="form-input"
                  placeholder="alumno@ejemplo.com"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  disabled={manualSubmitting}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setIsManualModalOpen(false)}
                  disabled={manualSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 1 }}
                  disabled={manualSubmitting}
                >
                  {manualSubmitting ? 'Inscribiendo...' : 'Inscribir alumno'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Importación Excel */}
      {isImportModalOpen && (
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
          <div className="auth-card" style={{ maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 className="page-title" style={{ fontSize: '1.25rem', marginBottom: '8px' }}>
              Importación Masiva desde Excel (.xlsx)
            </h2>
            <p className="page-description" style={{ marginBottom: '16px', fontSize: '0.875rem' }}>
              El archivo debe incluir las columnas encabezado: <strong>nombre</strong>, <strong>matrícula</strong> y <strong>correo</strong>.
            </p>

            {importError && (
              <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
                {importError}
              </div>
            )}

            {/* Paso 1: Selección de archivo */}
            {!importPreview && !importConfirmResult && (
              <div>
                <div className="form-group">
                  <label className="form-label" htmlFor="excel-file-input">
                    Seleccionar archivo Excel
                  </label>
                  <input
                    id="excel-file-input"
                    type="file"
                    accept=".xlsx"
                    className="form-input"
                    onChange={handleImportFileChange}
                    disabled={importLoading}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => setIsImportModalOpen(false)}
                    disabled={importLoading}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ flex: 1 }}
                    onClick={handlePreviewImport}
                    disabled={!importFile || importLoading}
                  >
                    {importLoading ? 'Analizando archivo...' : 'Previsualizar'}
                  </button>
                </div>
              </div>
            )}

            {/* Paso 2: Previsualización de filas */}
            {importPreview && !importConfirmResult && (
              <div>
                {/* Resumen de Clasificación */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px', marginBottom: '16px' }}>
                  <div style={{ padding: '8px', backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>Total</div>
                    <strong style={{ fontSize: '1.1rem' }}>{importPreview.summary.total}</strong>
                  </div>
                  <div style={{ padding: '8px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#047857' }}>Nuevos</div>
                    <strong style={{ fontSize: '1.1rem', color: '#047857' }}>{importPreview.summary.new}</strong>
                  </div>
                  <div style={{ padding: '8px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#1d4ed8' }}>Existentes</div>
                    <strong style={{ fontSize: '1.1rem', color: '#1d4ed8' }}>{importPreview.summary.existingToEnroll}</strong>
                  </div>
                  <div style={{ padding: '8px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#475569' }}>Ya inscritos</div>
                    <strong style={{ fontSize: '1.1rem', color: '#475569' }}>{importPreview.summary.alreadyEnrolled}</strong>
                  </div>
                  <div style={{ padding: '8px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#b45309' }}>Conflictos</div>
                    <strong style={{ fontSize: '1.1rem', color: '#b45309' }}>{importPreview.summary.conflicts}</strong>
                  </div>
                  <div style={{ padding: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#b91c1c' }}>Inválidos</div>
                    <strong style={{ fontSize: '1.1rem', color: '#b91c1c' }}>{importPreview.summary.invalid}</strong>
                  </div>
                </div>

                {/* Tabla de Filas */}
                <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '6px', marginBottom: '20px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--color-background)', borderBottom: '1px solid var(--color-border)' }}>
                        <th style={{ padding: '6px 8px' }}>Fila</th>
                        <th style={{ padding: '6px 8px' }}>Nombre</th>
                        <th style={{ padding: '6px 8px' }}>Matrícula</th>
                        <th style={{ padding: '6px 8px' }}>Correo</th>
                        <th style={{ padding: '6px 8px' }}>Estado</th>
                        <th style={{ padding: '6px 8px' }}>Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.rows.map((r) => (
                        <tr key={r.rowNumber} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '6px 8px' }}>{r.rowNumber}</td>
                          <td style={{ padding: '6px 8px', fontWeight: 600 }}>{r.name || '—'}</td>
                          <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{r.studentNumber || '—'}</td>
                          <td style={{ padding: '6px 8px' }}>{r.email || '—'}</td>
                          <td style={{ padding: '6px 8px' }}>{getRowStatusPill(r.status)}</td>
                          <td style={{ padding: '6px 8px', color: 'var(--color-muted)', fontSize: '0.775rem' }}>{r.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => {
                      setImportPreview(null);
                      setImportFile(null);
                    }}
                    disabled={importLoading}
                  >
                    Seleccionar otro archivo
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ flex: 1 }}
                    onClick={handleConfirmImport}
                    disabled={importLoading || (importPreview.summary.new === 0 && importPreview.summary.existingToEnroll === 0)}
                  >
                    {importLoading ? 'Importando alumnos...' : 'Confirmar importación'}
                  </button>
                </div>
              </div>
            )}

            {/* Paso 3: Resultado de la Confirmación */}
            {importConfirmResult && (
              <div>
                <div className="alert alert-success" style={{ marginBottom: '16px' }}>
                  Importación masiva completada. Procesados: {importConfirmResult.totalProcessed} | Creados: {importConfirmResult.createdCount} | Inscritos: {importConfirmResult.enrolledExistingCount} | Omitidos: {importConfirmResult.skippedCount}
                </div>

                <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '6px', marginBottom: '20px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--color-background)', borderBottom: '1px solid var(--color-border)' }}>
                        <th style={{ padding: '6px 8px' }}>Matrícula</th>
                        <th style={{ padding: '6px 8px' }}>Nombre</th>
                        <th style={{ padding: '6px 8px' }}>Correo</th>
                        <th style={{ padding: '6px 8px' }}>Resultado</th>
                        <th style={{ padding: '6px 8px' }}>Correo Enviado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importConfirmResult.results.map((res, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{res.studentNumber}</td>
                          <td style={{ padding: '6px 8px' }}>{res.name}</td>
                          <td style={{ padding: '6px 8px' }}>{res.email}</td>
                          <td style={{ padding: '6px 8px' }}>{res.status}</td>
                          <td style={{ padding: '6px 8px' }}>{res.emailSent ? 'Sí 🟢' : 'No 🔴'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => setIsImportModalOpen(false)}
                >
                  Cerrar y ver lista de alumnos
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Estado del Curso */}
      {pendingTargetStatus && (
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
          <div className="auth-card" style={{ maxWidth: '440px', textAlign: 'center' }}>
            <h2 className="page-title" style={{ fontSize: '1.25rem', marginBottom: '12px' }}>
              Confirmar cambio de estado
            </h2>
            <p className="page-description" style={{ marginBottom: '24px' }}>
              ¿Estás seguro de que deseas cambiar el estado del curso a <strong>{pendingTargetStatus}</strong>?
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setPendingTargetStatus(null)}
                disabled={actionLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirm-status"
                className="btn-primary"
                style={{ flex: 1 }}
                onClick={handleStatusChangeConfirm}
                disabled={actionLoading}
              >
                {actionLoading ? 'Actualizando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Restablecer Acceso */}
      {resetAccessStudent && (
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
          <div className="auth-card" style={{ maxWidth: '460px', textAlign: 'center' }}>
            <h2 className="page-title" style={{ fontSize: '1.25rem', marginBottom: '12px' }}>
              Confirmar Restablecer Acceso
            </h2>
            <p className="page-description" style={{ marginBottom: '20px', fontSize: '0.9rem' }}>
              Esto cerrará las sesiones actuales del alumno <strong>{resetAccessStudent.name}</strong> y requerirá establecer nuevamente su contraseña.
            </p>
            <p style={{ marginBottom: '24px', fontWeight: 600 }}>¿Deseas continuar?</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setResetAccessStudent(null)}
                disabled={actionLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirm-reset-access"
                className="btn-primary"
                style={{ flex: 1, backgroundColor: '#dc2626' }}
                onClick={handleResetAccessConfirm}
                disabled={actionLoading}
              >
                {actionLoading ? 'Restableciendo...' : 'Restablecer acceso'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Creación / Edición de Módulo */}
      {isModuleModalOpen && (
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
          <div className="auth-card" style={{ maxWidth: '480px' }}>
            <h2 className="page-title" style={{ fontSize: '1.25rem', marginBottom: '16px' }}>
              {moduleModalMode === 'create' ? 'Nuevo Módulo' : 'Editar Módulo'}
            </h2>

            {moduleError && (
              <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
                {moduleError}
              </div>
            )}

            <form onSubmit={handleSaveModule}>
              <div className="form-group">
                <label className="form-label" htmlFor="module-title-input">
                  Título del módulo
                </label>
                <input
                  id="module-title-input"
                  type="text"
                  className="form-input"
                  placeholder="Ej: Módulo 1 — Introducción"
                  value={moduleTitle}
                  onChange={(e) => setModuleTitle(e.target.value)}
                  disabled={moduleSubmitting}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="module-description-input">
                  Descripción (Opcional)
                </label>
                <textarea
                  id="module-description-input"
                  className="form-input"
                  rows={3}
                  placeholder="Resumen del contenido del módulo..."
                  value={moduleDescription}
                  onChange={(e) => setModuleDescription(e.target.value)}
                  disabled={moduleSubmitting}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  id="module-published-checkbox"
                  type="checkbox"
                  checked={moduleIsPublished}
                  onChange={(e) => setModuleIsPublished(e.target.checked)}
                  disabled={moduleSubmitting}
                />
                <label htmlFor="module-published-checkbox" style={{ fontSize: '0.9rem', color: 'var(--color-text)', cursor: 'pointer' }}>
                  Publicado (visible para alumnos)
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setIsModuleModalOpen(false)}
                  disabled={moduleSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  id="btn-save-module"
                  className="btn-primary"
                  style={{ flex: 1 }}
                  disabled={moduleSubmitting}
                >
                  {moduleSubmitting ? 'Guardando...' : 'Guardar módulo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Creación / Edición de Lección */}
      {isLessonModalOpen && (
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
          <div className="auth-card" style={{ maxWidth: '560px' }}>
            <h2 className="page-title" style={{ fontSize: '1.25rem', marginBottom: '16px' }}>
              {lessonModalMode === 'create' ? 'Nueva Lección' : 'Editar Lección'}
            </h2>

            {lessonError && (
              <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
                {lessonError}
              </div>
            )}

            <form onSubmit={handleSaveLesson}>
              <div className="form-group">
                <label className="form-label" htmlFor="lesson-title-input">
                  Título de la lección
                </label>
                <input
                  id="lesson-title-input"
                  type="text"
                  className="form-input"
                  placeholder="Ej: Conceptos básicos"
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  disabled={lessonSubmitting}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="lesson-description-input">
                  Descripción corta (Opcional)
                </label>
                <input
                  id="lesson-description-input"
                  type="text"
                  className="form-input"
                  placeholder="Descripción resumida..."
                  value={lessonDescription}
                  onChange={(e) => setLessonDescription(e.target.value)}
                  disabled={lessonSubmitting}
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" htmlFor="lesson-content-input" style={{ marginBottom: 0 }}>
                    Contenido de la lección (Markdown + KaTeX)
                  </label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      className={lessonTab === 'edit' ? 'btn-primary' : 'btn-secondary'}
                      style={{ padding: '2px 8px', fontSize: '0.75rem', width: 'auto' }}
                      onClick={() => setLessonTab('edit')}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className={lessonTab === 'preview' ? 'btn-primary' : 'btn-secondary'}
                      style={{ padding: '2px 8px', fontSize: '0.75rem', width: 'auto' }}
                      onClick={() => setLessonTab('preview')}
                    >
                      Vista previa
                    </button>
                  </div>
                </div>

                {lessonTab === 'edit' ? (
                  <textarea
                    id="lesson-content-input"
                    className="form-input"
                    rows={6}
                    placeholder="Escribe el contenido en Markdown. Ej: # Título&#10;&#10;Fórmula: $x + 2 = 5$&#10;&#10;$$&#10;x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}&#10;$$"
                    value={lessonContent}
                    onChange={(e) => setLessonContent(e.target.value)}
                    disabled={lessonSubmitting}
                  />
                ) : (
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: '6px', padding: '12px', minHeight: '140px', maxHeight: '240px', overflowY: 'auto', backgroundColor: '#ffffff' }}>
                    <MarkdownContent content={lessonContent} />
                  </div>
                )}
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  id="lesson-published-checkbox"
                  type="checkbox"
                  checked={lessonIsPublished}
                  onChange={(e) => setLessonIsPublished(e.target.checked)}
                  disabled={lessonSubmitting}
                />
                <label htmlFor="lesson-published-checkbox" style={{ fontSize: '0.9rem', color: 'var(--color-text)', cursor: 'pointer' }}>
                  Publicada (visible para alumnos)
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setIsLessonModalOpen(false)}
                  disabled={lessonSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  id="btn-save-lesson"
                  className="btn-primary"
                  style={{ flex: 1 }}
                  disabled={lessonSubmitting}
                >
                  {lessonSubmitting ? 'Guardando...' : 'Guardar lección'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
