import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Course, CourseStatus, CourseStudent, ImportPreviewResult, BulkConfirmResult, Module, Lesson, CourseContent } from '../types/academic.js';
import { CourseServiceAPI, AdminTeacher } from '../services/course.service.js';
import { AssessmentServiceAPI } from '../services/assessment.service.js';
import { StudentAssessmentDTO, AssessmentType } from '../types/assessment.js';
import { useAuth } from '../auth/useAuth.js';
import { ApiError } from '../services/api.js';
import { MarkdownContent } from '../components/MarkdownContent.js';
import { PageLoading, SectionLoading } from '../components/common/loading/index.js';
import { ScheduleModuleModal } from '../components/content/ScheduleModuleModal.js';
import { PublishModuleNowModal } from '../components/content/PublishModuleNowModal.js';

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

  // Estados para Módulos y Lecciones (QA-008-AK.2 & QA-008-AK.3)
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [moduleModalMode, setModuleModalMode] = useState<'create' | 'edit'>('create');
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [moduleTitle, setModuleTitle] = useState('');
  const [moduleDescription, setModuleDescription] = useState('');
  const [modulePublishOption, setModulePublishOption] = useState<'draft' | 'now' | 'scheduled'>('now');
  const [moduleScheduledDate, setModuleScheduledDate] = useState('');
  const [moduleScheduledTime, setModuleScheduledTime] = useState('');
  const [moduleSubmitting, setModuleSubmitting] = useState(false);
  const [moduleError, setModuleError] = useState<string | null>(null);

  // Estados para Programación Batch y Publicación Inmediata de Módulos (QA-008-AK.3)
  const [scheduleBatchModuleTarget, setScheduleBatchModuleTarget] = useState<Module | null>(null);
  const [publishNowModuleTarget, setPublishNowModuleTarget] = useState<Module | null>(null);
  const [cancelScheduleModuleTarget, setCancelScheduleModuleTarget] = useState<Module | null>(null);
  const [cancellingModuleSchedule, setCancellingModuleSchedule] = useState(false);

  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [lessonModalMode, setLessonModalMode] = useState<'create' | 'edit'>('create');
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [lessonTargetModuleId, setLessonTargetModuleId] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDescription, setLessonDescription] = useState('');
  const [lessonContent, setLessonContent] = useState('');
  const [lessonPublishOption, setLessonPublishOption] = useState<'draft' | 'now' | 'scheduled'>('now');
  const [lessonScheduledDate, setLessonScheduledDate] = useState('');
  const [lessonScheduledTime, setLessonScheduledTime] = useState('');
  const [lessonSubmitting, setLessonSubmitting] = useState(false);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const [lessonTab, setLessonTab] = useState<'edit' | 'preview'>('edit');

  // Estado para gestión de Maestros (ADMIN)
  const [availableTeachers, setAvailableTeachers] = useState<AdminTeacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [assigningTeacher, setAssigningTeacher] = useState(false);

  // Modal de confirmación para cambio de estado
  const [pendingTargetStatus, setPendingTargetStatus] = useState<CourseStatus | null>(null);

  // Estados para Alta de Alumnos (UX-002)
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [addStudentTab, setAddStudentTab] = useState<'SELECT' | 'SEARCH' | 'REGISTER' | 'EXCEL'>('SELECT');

  // Estados de Búsqueda de Alumno Existente
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; email: string; studentNumber: string; isAlreadyEnrolled: boolean }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const [enrollingStudentId, setEnrollingStudentId] = useState<string | null>(null);

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

  // Modal de doble confirmación para Quitar Alumno del Curso (QA-007.9)
  const [dropStudentTarget, setDropStudentTarget] = useState<CourseStudent | null>(null);
  const [dropConfirmStep, setDropConfirmStep] = useState<1 | 2>(1);
  const [dropLoading, setDropLoading] = useState<boolean>(false);
  const [dropError, setDropError] = useState<string | null>(null);

  // Estados para creación de Evaluaciones (QA-005 & QA-008-AJ.2 & QA-008-AK.2)
  const [isCreateAssModalOpen, setIsCreateAssModalOpen] = useState(false);
  const [createAssTitle, setCreateAssTitle] = useState('');
  const [createAssDescription, setCreateAssDescription] = useState('');
  const [createAssType, setCreateAssType] = useState<AssessmentType>('EXAM');
  const [createAssWeight, setCreateAssWeight] = useState('0');
  const [createAssPassingScore, setCreateAssPassingScore] = useState('');
  const [createAssTimeLimit, setCreateAssTimeLimit] = useState('');
  const [createAssMaxAttempts, setCreateAssMaxAttempts] = useState('');
  const [createAssAvailableFrom, setCreateAssAvailableFrom] = useState('');
  const [createAssAvailableUntil, setCreateAssAvailableUntil] = useState('');
  const [createAssPublishOption, setCreateAssPublishOption] = useState<'draft' | 'now' | 'scheduled'>('now');
  const [createAssScheduledDate, setCreateAssScheduledDate] = useState('');
  const [createAssScheduledTime, setCreateAssScheduledTime] = useState('');
  const [createAssUnlimitedAttempts, setCreateAssUnlimitedAttempts] = useState(true);
  const [createAssUnlimitedTime, setCreateAssUnlimitedTime] = useState(true);
  const [createAssModuleId, setCreateAssModuleId] = useState<string | null>(null);
  const [createAssSubmitting, setCreateAssSubmitting] = useState(false);
  const [createAssError, setCreateAssError] = useState<string | null>(null);

  const handleOpenCreateAssessmentModal = (targetModuleId?: string | null) => {
    setCreateAssError(null);
    setCreateAssTitle('');
    setCreateAssDescription('');
    setCreateAssType('EXAM');
    setCreateAssWeight('0');
    setCreateAssPassingScore('');
    setCreateAssTimeLimit('');
    setCreateAssMaxAttempts('');
    setCreateAssAvailableFrom('');
    setCreateAssAvailableUntil('');
    setCreateAssPublishOption('now');
    setCreateAssScheduledDate('');
    setCreateAssScheduledTime('');
    setCreateAssUnlimitedAttempts(true);
    setCreateAssUnlimitedTime(true);
    setCreateAssModuleId(targetModuleId || null);
    setIsCreateAssModalOpen(true);
  };

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

  // Helper para formatear fechas de publicación programada
  const formatScheduledDate = (dateStr?: string | null): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  };

  const getScheduledISO = (
    mode: 'draft' | 'now' | 'scheduled',
    dateStr: string,
    timeStr: string
  ): { isPublished: boolean; scheduledPublishAt: string | null } => {
    if (mode === 'now') {
      return { isPublished: true, scheduledPublishAt: null };
    }
    if (mode === 'draft') {
      return { isPublished: false, scheduledPublishAt: null };
    }
    if (!dateStr || !timeStr) {
      return { isPublished: false, scheduledPublishAt: null };
    }
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
    const localDate = new Date(year, month - 1, day, hours, minutes);
    return {
      isPublished: false,
      scheduledPublishAt: isNaN(localDate.getTime()) ? null : localDate.toISOString(),
    };
  };

  const parseScheduledFields = (scheduledPublishAtStr?: string | null, isPublished?: boolean): {
    option: 'draft' | 'now' | 'scheduled';
    date: string;
    time: string;
  } => {
    if (isPublished) {
      return { option: 'now', date: '', time: '' };
    }
    if (scheduledPublishAtStr) {
      const d = new Date(scheduledPublishAtStr);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return {
          option: 'scheduled',
          date: `${year}-${month}-${day}`,
          time: `${hours}:${minutes}`,
        };
      }
    }
    return { option: 'draft', date: '', time: '' };
  };

  // Handlers para Módulos
  const handleOpenCreateModuleModal = () => {
    setModuleModalMode('create');
    setSelectedModule(null);
    setModuleTitle('');
    setModuleDescription('');
    setModulePublishOption('now');
    setModuleScheduledDate('');
    setModuleScheduledTime('');
    setModuleError(null);
    setIsModuleModalOpen(true);
  };

  const handleOpenEditModuleModal = (mod: Module) => {
    setModuleModalMode('edit');
    setSelectedModule(mod);
    setModuleTitle(mod.title);
    setModuleDescription(mod.description || '');

    const parsed = parseScheduledFields(mod.scheduledPublishAt, mod.isPublished);
    setModulePublishOption(parsed.option);
    setModuleScheduledDate(parsed.date);
    setModuleScheduledTime(parsed.time);

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

    if (modulePublishOption === 'scheduled' && (!moduleScheduledDate || !moduleScheduledTime)) {
      setModuleError('Por favor especifica la fecha y hora para la publicación programada.');
      return;
    }

    const { isPublished, scheduledPublishAt } = getScheduledISO(modulePublishOption, moduleScheduledDate, moduleScheduledTime);

    setModuleSubmitting(true);
    try {
      if (moduleModalMode === 'create') {
        await CourseServiceAPI.createModule(courseId, {
          title: moduleTitle.trim(),
          description: moduleDescription.trim() || undefined,
          isPublished,
          scheduledPublishAt,
        });
        setActionSuccess('Módulo guardado exitosamente.');
      } else if (selectedModule) {
        await CourseServiceAPI.updateModule(courseId, selectedModule.id, {
          title: moduleTitle.trim(),
          description: moduleDescription.trim() || undefined,
          isPublished,
          scheduledPublishAt,
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
    setLessonPublishOption('now');
    setLessonScheduledDate('');
    setLessonScheduledTime('');
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

    const parsed = parseScheduledFields(lesson.scheduledPublishAt, lesson.isPublished);
    setLessonPublishOption(parsed.option);
    setLessonScheduledDate(parsed.date);
    setLessonScheduledTime(parsed.time);

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

    if (lessonPublishOption === 'scheduled' && (!lessonScheduledDate || !lessonScheduledTime)) {
      setLessonError('Por favor especifica la fecha y hora para la publicación programada.');
      return;
    }

    const { isPublished, scheduledPublishAt } = getScheduledISO(lessonPublishOption, lessonScheduledDate, lessonScheduledTime);

    setLessonSubmitting(true);
    try {
      if (lessonModalMode === 'create') {
        await CourseServiceAPI.createLesson(courseId, lessonTargetModuleId, {
          title: lessonTitle.trim(),
          description: lessonDescription.trim() || undefined,
          content: lessonContent.trim() || undefined,
          isPublished,
          scheduledPublishAt,
        });
        setActionSuccess('Lección creada exitosamente.');
      } else if (selectedLesson) {
        await CourseServiceAPI.updateLesson(courseId, lessonTargetModuleId, selectedLesson.id, {
          title: lessonTitle.trim(),
          description: lessonDescription.trim() || undefined,
          content: lessonContent.trim() || undefined,
          isPublished,
          scheduledPublishAt,
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

  // Quick actions para publicación inmediata y cancelación de programación
  const handleConfirmCancelModuleSchedule = async () => {
    if (!courseId || !cancelScheduleModuleTarget) return;
    setCancellingModuleSchedule(true);
    setActionError(null);
    try {
      const lessonsPayload = (cancelScheduleModuleTarget.lessons || [])
        .filter((l) => Boolean(l.scheduledPublishAt) && !l.isPublished)
        .map((l) => ({ type: 'LESSON' as const, id: l.id, scheduledPublishAt: null, action: 'UNSCHEDULE' as const }));

      const assessmentsPayload = assessments
        .filter((a) => a.moduleId === cancelScheduleModuleTarget.id && Boolean(a.scheduledPublishAt) && !a.isPublished)
        .map((a) => ({ type: 'ASSESSMENT' as const, id: a.id, scheduledPublishAt: null, action: 'UNSCHEDULE' as const }));

      await CourseServiceAPI.scheduleModuleBatch(courseId, cancelScheduleModuleTarget.id, {
        moduleScheduledPublishAt: null,
        contents: [...lessonsPayload, ...assessmentsPayload],
      });

      setActionSuccess(`Programación del módulo "${cancelScheduleModuleTarget.title}" cancelada. Los contenidos volvieron a estado borrador sin ocultar lo ya publicado.`);
      setCancelScheduleModuleTarget(null);
      await fetchCourseContentData();
      const assessmentsData = await AssessmentServiceAPI.getCourseAssessments(courseId);
      setAssessments(assessmentsData);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError('Error al cancelar la programación del módulo.');
      }
    } finally {
      setCancellingModuleSchedule(false);
    }
  };

  const handlePublishLessonNow = async (moduleId: string, lessonId: string) => {
    if (!courseId) return;
    try {
      setActionError(null);
      await CourseServiceAPI.updateLesson(courseId, moduleId, lessonId, { isPublished: true, scheduledPublishAt: null });
      setActionSuccess('Lección publicada exitosamente.');
      await fetchCourseContentData();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Error al publicar la lección.');
    }
  };

  const handleCancelLessonSchedule = async (moduleId: string, lessonId: string) => {
    if (!courseId) return;
    try {
      setActionError(null);
      await CourseServiceAPI.updateLesson(courseId, moduleId, lessonId, { isPublished: false, scheduledPublishAt: null });
      setActionSuccess('Programación cancelada. La lección ahora es borrador.');
      await fetchCourseContentData();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Error al cancelar la programación de la lección.');
    }
  };

  const handlePublishAssessmentNow = async (assessmentId: string) => {
    if (!courseId) return;
    try {
      setActionError(null);
      await AssessmentServiceAPI.updateAssessment(assessmentId, { isPublished: true, scheduledPublishAt: null });
      setActionSuccess('Evaluación publicada exitosamente.');
      setAssessmentsLoading(true);
      const assessmentsData = await AssessmentServiceAPI.getCourseAssessments(courseId);
      setAssessments(assessmentsData);
      setAssessmentsLoading(false);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Error al publicar la evaluación.');
    }
  };

  const handleCancelAssessmentSchedule = async (assessmentId: string) => {
    if (!courseId) return;
    try {
      setActionError(null);
      await AssessmentServiceAPI.updateAssessment(assessmentId, { isPublished: false, scheduledPublishAt: null });
      setActionSuccess('Programación cancelada. La evaluación ahora es borrador.');
      setAssessmentsLoading(true);
      const assessmentsData = await AssessmentServiceAPI.getCourseAssessments(courseId);
      setAssessments(assessmentsData);
      setAssessmentsLoading(false);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Error al cancelar la programación de la evaluación.');
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

  // Modal Principal de Agregar Alumno (UX-002)
  const handleOpenAddStudentModal = (initialTab: 'SELECT' | 'SEARCH' | 'REGISTER' | 'EXCEL' = 'SELECT') => {
    setAddStudentTab(initialTab);
    setSearchQuery('');
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
    setIsAddStudentModalOpen(true);
  };

  // Buscar Alumno Existente
  const handleSearchStudents = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!courseId || !searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchError(null);
    setSearchSubmitted(true);
    try {
      const results = await CourseServiceAPI.searchStudents(courseId, searchQuery.trim());
      setSearchResults(results);
    } catch (err) {
      if (err instanceof ApiError) {
        setSearchError(err.message);
      } else {
        setSearchError('Error al buscar estudiantes.');
      }
    } finally {
      setSearchLoading(false);
    }
  };

  // Agregar Alumno Existente desde Resultados de Búsqueda
  const handleAddExistingStudent = async (student: { name: string; email: string; studentNumber: string; id: string }) => {
    if (!courseId) return;
    setEnrollingStudentId(student.id);
    setSearchError(null);
    try {
      const res = await CourseServiceAPI.enrollStudent(courseId, {
        name: student.name,
        studentNumber: student.studentNumber,
        email: student.email,
      });

      setIsAddStudentModalOpen(false);
      setActionError(null);

      if (res.isNewStudent) {
        if (res.emailSent) {
          setActionSuccess(`Alumno registrado y agregado correctamente.\nSe envió el correo de activación a: ${student.email}`);
        } else {
          setActionSuccess('Alumno registrado y agregado correctamente.\nNo fue posible enviar el correo de activación.');
        }
      } else {
        if (res.emailSent) {
          setActionSuccess(`Alumno agregado correctamente al curso.\nSe envió un correo de notificación a: ${student.email}`);
        } else {
          setActionSuccess('Alumno agregado correctamente al curso.\nNo fue posible enviar el correo de notificación.');
        }
      }

      await fetchCourseDetail();
      await refreshStudentsList();
    } catch (err) {
      if (err instanceof ApiError) {
        setSearchError(err.message);
      } else {
        setSearchError('Error al agregar el alumno al curso.');
      }
    } finally {
      setEnrollingStudentId(null);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    setManualError(null);

    const name = manualName.trim();
    const studentNumber = manualStudentNumber.trim();
    const email = manualEmail.trim();

    if (!name || !studentNumber || !email) {
      setManualError('Todos los campos son obligatorios.');
      return;
    }

    setManualSubmitting(true);
    try {
      const res = await CourseServiceAPI.enrollStudent(courseId, {
        name,
        studentNumber,
        email,
      });

      setIsAddStudentModalOpen(false);
      setIsManualModalOpen(false);
      setActionError(null);

      if (res.isNewStudent) {
        if (res.emailSent) {
          setActionSuccess(`Alumno registrado y agregado correctamente.\nSe envió el correo de activación a: ${email}`);
        } else {
          setActionSuccess('Alumno registrado y agregado correctamente.\nNo fue posible enviar el correo de activación.');
        }
      } else {
        if (res.emailSent) {
          setActionSuccess(`Alumno agregado correctamente al curso.\nSe envió un correo de notificación a: ${email}`);
        } else {
          setActionSuccess('Alumno agregado correctamente al curso.\nNo fue posible enviar el correo de notificación.');
        }
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

  const handleCreateAssessmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;

    const title = createAssTitle.trim();
    if (!title) {
      setCreateAssError('El título de la evaluación es obligatorio');
      return;
    }

    const weightNum = Number(createAssWeight);
    if (isNaN(weightNum) || weightNum < 0 || weightNum > 100) {
      setCreateAssError('La ponderación debe ser un valor entre 0 y 100%');
      return;
    }

    const passingScoreNum = createAssPassingScore.trim() !== '' ? Number(createAssPassingScore) : null;
    if (passingScoreNum !== null && (isNaN(passingScoreNum) || passingScoreNum < 0 || passingScoreNum > 100)) {
      setCreateAssError('La calificación aprobatoria debe estar entre 0 y 100%');
      return;
    }

    const timeLimitNum = createAssUnlimitedTime ? null : (createAssTimeLimit.trim() !== '' ? Number(createAssTimeLimit) : null);
    if (!createAssUnlimitedTime && (timeLimitNum === null || isNaN(timeLimitNum) || timeLimitNum < 1)) {
      setCreateAssError('Especifica un tiempo límite válido en minutos (mínimo 1 minuto)');
      return;
    }

    const maxAttemptsNum = createAssUnlimitedAttempts ? null : (createAssMaxAttempts.trim() !== '' ? Number(createAssMaxAttempts) : null);
    if (!createAssUnlimitedAttempts && (maxAttemptsNum === null || isNaN(maxAttemptsNum) || maxAttemptsNum < 1)) {
      setCreateAssError('Especifica un número máximo de intentos válido (mínimo 1 intento)');
      return;
    }

    const fromDateObj = createAssAvailableFrom ? new Date(createAssAvailableFrom) : null;
    const untilDateObj = createAssAvailableUntil ? new Date(createAssAvailableUntil) : null;

    if (fromDateObj && isNaN(fromDateObj.getTime())) {
      setCreateAssError('La fecha de apertura proporcionada no es válida');
      return;
    }
    if (untilDateObj && isNaN(untilDateObj.getTime())) {
      setCreateAssError('La fecha de cierre proporcionada no es válida');
      return;
    }
    if (fromDateObj && untilDateObj && fromDateObj > untilDateObj) {
      setCreateAssError('La fecha de apertura no puede ser posterior a la fecha de cierre');
      return;
    }

    if (createAssPublishOption === 'scheduled' && (!createAssScheduledDate || !createAssScheduledTime)) {
      setCreateAssError('Por favor especifica la fecha y hora para la publicación programada.');
      return;
    }

    const { isPublished, scheduledPublishAt } = getScheduledISO(createAssPublishOption, createAssScheduledDate, createAssScheduledTime);

    setCreateAssSubmitting(true);
    setCreateAssError(null);

    try {
      await AssessmentServiceAPI.createAssessment(courseId, {
        title,
        description: createAssDescription.trim() || null,
        type: createAssType,
        weight: weightNum,
        passingScore: passingScoreNum,
        timeLimitMinutes: timeLimitNum,
        maxAttempts: maxAttemptsNum,
        availableFrom: fromDateObj ? fromDateObj.toISOString() : null,
        availableUntil: untilDateObj ? untilDateObj.toISOString() : null,
        moduleId: createAssModuleId || null,
        isPublished,
        scheduledPublishAt,
      });

      setIsCreateAssModalOpen(false);
      setCreateAssTitle('');
      setCreateAssDescription('');
      setCreateAssType('EXAM');
      setCreateAssWeight('0');
      setCreateAssPassingScore('');
      setCreateAssTimeLimit('');
      setCreateAssMaxAttempts('');
      setCreateAssAvailableFrom('');
      setCreateAssAvailableUntil('');
      setCreateAssUnlimitedAttempts(true);
      setCreateAssUnlimitedTime(true);
      setCreateAssModuleId(null);
      setActionError(null);
      setActionSuccess('Evaluación creada exitosamente.');

      setAssessmentsLoading(true);
      const assessmentsData = await AssessmentServiceAPI.getCourseAssessments(courseId);
      setAssessments(assessmentsData);
      setAssessmentsLoading(false);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setCreateAssError(err.message);
      } else {
        setCreateAssError('Error al crear la evaluación');
      }
    } finally {
      setCreateAssSubmitting(false);
    }
  };

  // Importación Excel
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

  // Quitar alumno del curso (Doble confirmación QA-007.9)
  const handleInitiateDropStudent = (student: CourseStudent) => {
    setDropStudentTarget(student);
    setDropConfirmStep(1);
    setDropError(null);
  };

  const handleConfirmDropStudent = async () => {
    if (!courseId || !dropStudentTarget) return;

    setDropLoading(true);
    setDropError(null);

    try {
      await CourseServiceAPI.dropStudent(courseId, dropStudentTarget.id);
      setActionSuccess(`Alumno ${dropStudentTarget.name} retirado del curso exitosamente.`);
      setDropStudentTarget(null);
      await refreshStudentsList();
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
    return <PageLoading title="Cargando detalle del curso..." />;
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
  const blockedTooltip = isEnrollmentBlocked
    ? course.status === 'FINISHED'
      ? 'El curso está finalizado y ya no admite modificaciones.'
      : 'El curso está archivado y es de solo lectura.'
    : undefined;

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

            <div>
              <button
                type="button"
                id="btn-manual-add-student"
                className="btn-primary"
                style={{ width: 'auto' }}
                onClick={() => handleOpenAddStudentModal('SELECT')}
                disabled={isEnrollmentBlocked}
                title={blockedTooltip}
              >
                + Agregar alumno
              </button>
            </div>
          </div>

          {isEnrollmentBlocked && (
            <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
              Este curso ya no acepta nuevas inscripciones ({course.status}).
            </div>
          )}

          {studentsLoading ? (
            <SectionLoading title="Cargando alumnos inscritos..." minHeight="120px" size="small" />
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
                        {st.accountStatus !== 'ACTIVE' && (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ fontSize: '0.775rem', padding: '4px 8px', marginRight: '6px' }}
                            onClick={() => handleResendInvitation(st.id)}
                            disabled={resendingStudentId === st.id}
                          >
                            {resendingStudentId === st.id ? 'Reenviando...' : 'Reenviar invitación'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '0.775rem', padding: '4px 8px', color: '#991b1b', borderColor: '#fca5a5' }}
                          onClick={() => handleInitiateDropStudent(st)}
                          disabled={isEnrollmentBlocked || dropLoading}
                          title={blockedTooltip}
                        >
                          Quitar del curso
                        </button>
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

          {(user?.role === 'ADMIN' || (user?.role === 'TEACHER' && isTeacherAssigned)) && (
            <button
              type="button"
              id="btn-add-module"
              className="btn-primary"
              style={{ width: 'auto' }}
              onClick={handleOpenCreateModuleModal}
              disabled={isEnrollmentBlocked}
              title={blockedTooltip}
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
          <SectionLoading title="Cargando contenido del curso..." minHeight="120px" size="small" />
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
                <div className="module-header-container">
                  {/* Bloque 1: Información Principal del Módulo (Izquierda en Desktop) */}
                  <div className="module-header-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span className="role-pill teacher" style={{ fontSize: '0.75rem' }}>
                        Módulo #{mod.order}
                      </span>
                      {user?.role !== 'STUDENT' && (
                        mod.isPublished ? (
                          <span className="role-pill student" style={{ fontSize: '0.75rem' }}>Publicado</span>
                        ) : mod.scheduledPublishAt ? (
                          <span className="role-pill" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: '0.75rem' }}>
                            Programado: {formatScheduledDate(mod.scheduledPublishAt)} ⏰
                          </span>
                        ) : (
                          <span className="role-pill admin" style={{ backgroundColor: '#fef3c7', color: '#92400e', fontSize: '0.75rem' }}>Borrador</span>
                        )
                      )}
                      {(() => {
                        const schedCount = (mod.lessons?.filter((l) => !l.isPublished && Boolean(l.scheduledPublishAt)).length ?? 0) +
                          assessments.filter((a) => a.moduleId === mod.id && !a.isPublished && Boolean(a.scheduledPublishAt)).length;
                        if (schedCount === 0 || user?.role === 'STUDENT') return null;
                        return (
                          <span className="role-pill" style={{ backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', fontSize: '0.725rem' }}>
                            {schedCount} {schedCount === 1 ? 'contenido programado' : 'contenidos programados'} ⏰
                          </span>
                        );
                      })()}
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

                  {/* Bloque 2: Fila de Acciones del Módulo (Derecha en Desktop, Abajo en Mobile) */}
                  {(user?.role === 'ADMIN' || (user?.role === 'TEACHER' && isTeacherAssigned)) && (
                    <div className="module-header-actions">
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ padding: '4px 10px', fontSize: '0.775rem', width: 'auto', backgroundColor: '#0f4c81', borderColor: '#0f4c81' }}
                        onClick={() => setScheduleBatchModuleTarget(mod)}
                        disabled={isEnrollmentBlocked}
                        title="Configurar programación del módulo y su contenido"
                      >
                        ⏰ {mod.scheduledPublishAt ? 'Editar programación' : 'Programar módulo'}
                      </button>
                      {!mod.isPublished && (
                        <>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.775rem', backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}
                            onClick={() => setPublishNowModuleTarget(mod)}
                            disabled={isEnrollmentBlocked}
                            title="Publicar ahora de forma selectiva"
                          >
                            ⚡ Publicar ahora
                          </button>
                          {mod.scheduledPublishAt && (
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '0.775rem', backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}
                              onClick={() => setCancelScheduleModuleTarget(mod)}
                              disabled={isEnrollmentBlocked}
                              title="Cancelar programación y volver a borrador"
                            >
                              🚫 Cancelar programación
                            </button>
                          )}
                        </>
                      )}
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.775rem' }}
                        aria-label={`Subir módulo ${mod.title}`}
                        onClick={() => handleReorderModule(mod.id, 'up')}
                        disabled={isEnrollmentBlocked || modIdx === 0}
                        title="Subir módulo"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.775rem' }}
                        aria-label={`Bajar módulo ${mod.title}`}
                        onClick={() => handleReorderModule(mod.id, 'down')}
                        disabled={isEnrollmentBlocked || modIdx === (courseContent.modules.length - 1)}
                        title="Bajar módulo"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.775rem' }}
                        onClick={() => handleOpenEditModuleModal(mod)}
                        disabled={isEnrollmentBlocked}
                        title={blockedTooltip}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ padding: '4px 10px', fontSize: '0.775rem', width: 'auto' }}
                        onClick={() => handleOpenCreateLessonModal(mod.id)}
                        disabled={isEnrollmentBlocked}
                        title={blockedTooltip}
                      >
                        + Lección
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ padding: '4px 10px', fontSize: '0.775rem', width: 'auto' }}
                        onClick={() => handleOpenCreateAssessmentModal(mod.id)}
                        disabled={isEnrollmentBlocked}
                        title={blockedTooltip}
                      >
                        + Evaluación
                      </button>
                    </div>
                  )}
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
                                ) : les.scheduledPublishAt ? (
                                  <span className="role-pill" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: '0.675rem', padding: '1px 6px' }}>
                                    Programada: {formatScheduledDate(les.scheduledPublishAt)} ⏰
                                  </span>
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
                            {(user?.role === 'ADMIN' || (user?.role === 'TEACHER' && isTeacherAssigned)) && (
                              <>
                                {!les.isPublished && les.scheduledPublishAt && (
                                  <>
                                    <button
                                      type="button"
                                      className="btn-secondary"
                                      style={{ padding: '3px 6px', fontSize: '0.725rem', backgroundColor: '#ecfdf5', color: '#047857' }}
                                      onClick={() => handlePublishLessonNow(mod.id, les.id)}
                                      disabled={isEnrollmentBlocked}
                                      title="Publicar inmediatamente"
                                    >
                                      Publicar ahora
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-secondary"
                                      style={{ padding: '3px 6px', fontSize: '0.725rem', backgroundColor: '#fef2f2', color: '#991b1b' }}
                                      onClick={() => handleCancelLessonSchedule(mod.id, les.id)}
                                      disabled={isEnrollmentBlocked}
                                      title="Cancelar programación y volver a borrador"
                                    >
                                      Cancelar programación
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ padding: '3px 6px', fontSize: '0.725rem' }}
                                  aria-label={`Subir lección ${les.title}`}
                                  onClick={() => handleReorderLesson(mod.id, les.id, 'up')}
                                  disabled={isEnrollmentBlocked || lesIdx === 0}
                                  title="Subir lección"
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ padding: '3px 6px', fontSize: '0.725rem' }}
                                  aria-label={`Bajar lección ${les.title}`}
                                  onClick={() => handleReorderLesson(mod.id, les.id, 'down')}
                                  disabled={isEnrollmentBlocked || lesIdx === (mod.lessons!.length - 1)}
                                  title="Bajar lección"
                                >
                                  ↓
                                </button>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ padding: '3px 6px', fontSize: '0.725rem' }}
                                  onClick={() => handleOpenEditLessonModal(mod.id, les)}
                                  disabled={isEnrollmentBlocked}
                                  title={blockedTooltip}
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

                {/* Sub-lista de Evaluaciones del Módulo */}
                {(() => {
                  const modAssessments = assessments.filter((a) => a.moduleId === mod.id);
                  if (modAssessments.length === 0) return null;
                  return (
                    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px', marginTop: '12px' }}>
                      <div style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '8px' }}>
                        Evaluaciones ({modAssessments.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {modAssessments.map((ass) => (
                          <div
                            key={ass.id}
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
                                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text)' }}>
                                  {ass.title}
                                </span>
                                <span className={`role-pill ${ass.type === 'EXAM' ? 'admin' : 'student'}`} style={{ fontSize: '0.675rem', padding: '1px 6px' }}>
                                  {ass.type === 'EXAM' ? 'Examen' : ass.type === 'QUIZ' ? 'Cuestionario' : ass.type === 'FINAL' ? 'Evaluación Final' : ass.type}
                                </span>
                                {user?.role !== 'STUDENT' && (
                                  <span
                                    className="role-pill"
                                    style={{
                                      fontSize: '0.675rem',
                                      padding: '1px 6px',
                                      backgroundColor: ass.isPublished ? '#ecfdf5' : ass.scheduledPublishAt ? '#eff6ff' : '#fffbeb',
                                      color: ass.isPublished ? '#047857' : ass.scheduledPublishAt ? '#1d4ed8' : '#b45309',
                                      border: `1px solid ${ass.isPublished ? '#a7f3d0' : ass.scheduledPublishAt ? '#bfdbfe' : '#fde68a'}`,
                                    }}
                                  >
                                    {ass.isPublished
                                      ? 'Publicada 🟢'
                                      : ass.scheduledPublishAt
                                      ? `Programada: ${formatScheduledDate(ass.scheduledPublishAt)} ⏰`
                                      : 'Borrador 🟡'}
                                  </span>
                                )}
                              </div>
                              {ass.description && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '2px' }}>
                                  {ass.description}
                                </div>
                              )}
                            </div>

                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              {(user?.role === 'ADMIN' || (user?.role === 'TEACHER' && isTeacherAssigned)) && !ass.isPublished && ass.scheduledPublishAt && (
                                <>
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    style={{ padding: '3px 6px', fontSize: '0.725rem', backgroundColor: '#ecfdf5', color: '#047857' }}
                                    onClick={() => handlePublishAssessmentNow(ass.id)}
                                    disabled={isEnrollmentBlocked}
                                    title="Publicar inmediatamente"
                                  >
                                    Publicar ahora
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    style={{ padding: '3px 6px', fontSize: '0.725rem', backgroundColor: '#fef2f2', color: '#991b1b' }}
                                    onClick={() => handleCancelAssessmentSchedule(ass.id)}
                                    disabled={isEnrollmentBlocked}
                                    title="Cancelar programación y volver a borrador"
                                  >
                                    Cancelar programación
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ padding: '3px 8px', fontSize: '0.75rem', backgroundColor: 'var(--color-primary-light, #eff6ff)' }}
                                onClick={() => navigate(`/app/courses/${courseId}/assessments/${ass.id}`)}
                              >
                                {user?.role === 'STUDENT' ? 'Ver / Realizar →' : 'Ver / Administrar →'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sección Real de Evaluaciones Globales del Curso */}
      {(() => {
        const globalAssessments = assessments.filter((a) => !a.moduleId);
        return (
          <div className="dashboard-card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <h3 className="dashboard-card-title" id="assessments-section-title" style={{ margin: 0 }}>
                Evaluaciones globales del curso ({globalAssessments.length})
              </h3>
              {(user?.role === 'ADMIN' || (user?.role === 'TEACHER' && isTeacherAssigned)) && (
                <button
                  type="button"
                  className="btn-primary"
                  style={{ width: 'auto', padding: '6px 14px', fontSize: '0.875rem' }}
                  onClick={() => handleOpenCreateAssessmentModal(null)}
                  disabled={isEnrollmentBlocked}
                  title={blockedTooltip}
                >
                  + Nueva Evaluación
                </button>
              )}
            </div>
            {assessmentsLoading ? (
              <SectionLoading title="Cargando evaluaciones..." minHeight="100px" size="small" />
            ) : globalAssessments.length === 0 ? (
              <p className="dashboard-card-desc" style={{ marginBottom: 0 }}>
                No hay evaluaciones globales en este curso.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {globalAssessments.map((ass) => (
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
                          {ass.type === 'EXAM' ? 'Examen' : ass.type === 'QUIZ' ? 'Cuestionario' : ass.type === 'FINAL' ? 'Evaluación Final' : ass.type}
                        </span>
                        {user?.role !== 'STUDENT' && (
                          <span
                            className="role-pill"
                            style={{
                              fontSize: '0.75rem',
                              backgroundColor: ass.isPublished ? '#ecfdf5' : ass.scheduledPublishAt ? '#eff6ff' : '#fffbeb',
                              color: ass.isPublished ? '#047857' : ass.scheduledPublishAt ? '#1d4ed8' : '#b45309',
                              border: `1px solid ${ass.isPublished ? '#a7f3d0' : ass.scheduledPublishAt ? '#bfdbfe' : '#fde68a'}`,
                            }}
                          >
                            {ass.isPublished
                              ? 'Publicada 🟢'
                              : ass.scheduledPublishAt
                              ? `Programada: ${formatScheduledDate(ass.scheduledPublishAt)} ⏰`
                              : 'Borrador 🟡'}
                          </span>
                        )}
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

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {(user?.role === 'ADMIN' || (user?.role === 'TEACHER' && isTeacherAssigned)) && !ass.isPublished && ass.scheduledPublishAt && (
                        <>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: '#ecfdf5', color: '#047857' }}
                            onClick={() => handlePublishAssessmentNow(ass.id)}
                            disabled={isEnrollmentBlocked}
                            title="Publicar inmediatamente"
                          >
                            Publicar ahora
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: '#fef2f2', color: '#991b1b' }}
                            onClick={() => handleCancelAssessmentSchedule(ass.id)}
                            disabled={isEnrollmentBlocked}
                            title="Cancelar programación y volver a borrador"
                          >
                            Cancelar programación
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ width: 'auto', padding: '6px 16px', fontSize: '0.875rem' }}
                        onClick={() => navigate(`/app/courses/${courseId}/assessments/${ass.id}`)}
                      >
                        {user?.role === 'STUDENT' ? 'Ver / Realizar Evaluación →' : 'Ver / Administrar Evaluación →'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Modal Principal de Agregar Alumnos (UX-002 Flow) */}
      {(isAddStudentModalOpen || isManualModalOpen || isImportModalOpen) && (
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
          <div
            className="auth-card"
            style={{
              maxWidth: addStudentTab === 'EXCEL' ? '720px' : '540px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            {/* Header del Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                {addStudentTab !== 'SELECT' && (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '2px 8px', fontSize: '0.775rem', marginBottom: '6px' }}
                    onClick={() => setAddStudentTab('SELECT')}
                  >
                    ← Volver a opciones
                  </button>
                )}
                <h2 className="page-title" style={{ fontSize: '1.25rem', margin: 0 }}>
                  {addStudentTab === 'SELECT' && 'Agregar alumno al curso'}
                  {addStudentTab === 'SEARCH' && 'Buscar alumno existente'}
                  {addStudentTab === 'REGISTER' && 'Registrar alumno nuevo'}
                  {addStudentTab === 'EXCEL' && 'Importar alumnos desde Excel'}
                </h2>
              </div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--color-muted)' }}
                onClick={() => {
                  setIsAddStudentModalOpen(false);
                  setIsManualModalOpen(false);
                  setIsImportModalOpen(false);
                }}
              >
                ✕
              </button>
            </div>

            {/* TAB 1: SELECT (3 OPCIONES) */}
            {addStudentTab === 'SELECT' && (
              <div>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginBottom: '20px' }}>
                  Selecciona la modalidad adecuada para incorporar alumnos a este curso:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                  {/* Opción 1: Buscar existente */}
                  <div
                    style={{
                      padding: '16px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md, 8px)',
                      backgroundColor: 'var(--color-background)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--color-text)' }}>
                      🔎 Buscar alumno existente
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                      Encuentra una cuenta ya registrada en PotroLearn por su nombre, matrícula o correo electrónico.
                    </div>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ width: 'auto', alignSelf: 'flex-start', marginTop: '4px' }}
                      onClick={() => setAddStudentTab('SEARCH')}
                    >
                      Buscar alumno
                    </button>
                  </div>

                  {/* Opción 2: Registrar nuevo */}
                  <div
                    style={{
                      padding: '16px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md, 8px)',
                      backgroundColor: 'var(--color-background)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--color-text)' }}>
                      👤 Registrar alumno nuevo
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                      Crea una cuenta nueva para un alumno que aún no tiene perfil en la plataforma.
                    </div>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ width: 'auto', alignSelf: 'flex-start', marginTop: '4px' }}
                      onClick={() => setAddStudentTab('REGISTER')}
                    >
                      Registrar alumno
                    </button>
                  </div>

                  {/* Opción 3: Importar desde Excel */}
                  <div
                    style={{
                      padding: '16px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md, 8px)',
                      backgroundColor: 'var(--color-background)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--color-text)' }}>
                      📊 Importar desde Excel
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                      Agrega múltiples alumnos de forma masiva utilizando una plantilla de Excel (.xlsx).
                    </div>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ width: 'auto', alignSelf: 'flex-start', marginTop: '4px' }}
                      onClick={() => setAddStudentTab('EXCEL')}
                    >
                      Importar Excel
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setIsAddStudentModalOpen(false);
                      setIsManualModalOpen(false);
                      setIsImportModalOpen(false);
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: SEARCH (BUSCAR ALUMNO EXISTENTE) */}
            {addStudentTab === 'SEARCH' && (
              <div>
                <form onSubmit={handleSearchStudents} style={{ marginBottom: '16px' }}>
                  <div className="form-group" style={{ marginBottom: '8px' }}>
                    <label className="form-label" htmlFor="search-student-input">
                      Criterio de búsqueda (Nombre, Matrícula o Correo)
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        id="search-student-input"
                        type="text"
                        className="form-input"
                        placeholder="Ej. Juan Pérez / 202012345 / juan@example.com"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        disabled={searchLoading}
                      />
                      <button
                        type="submit"
                        className="btn-primary"
                        style={{ width: 'auto', whiteSpace: 'nowrap' }}
                        disabled={searchLoading || !searchQuery.trim()}
                      >
                        {searchLoading ? 'Buscando...' : 'Buscar'}
                      </button>
                    </div>
                  </div>
                </form>

                {searchError && (
                  <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
                    {searchError}
                  </div>
                )}

                {/* Lista de Resultados de Búsqueda */}
                {searchSubmitted && !searchLoading && searchResults.length === 0 && (
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', fontStyle: 'italic', margin: '16px 0' }}>
                    No se encontraron alumnos registrados con el criterio especificado.
                  </p>
                )}

                {searchResults.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto', marginBottom: '16px' }}>
                    {searchResults.map((stu) => (
                      <div
                        key={stu.id}
                        style={{
                          padding: '12px',
                          border: '1px solid var(--color-border)',
                          borderRadius: '6px',
                          backgroundColor: 'var(--color-surface, #ffffff)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.925rem', color: 'var(--color-text)' }}>
                            {stu.name}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
                            Matrícula: {stu.studentNumber || 'N/A'} • {stu.email}
                          </div>
                        </div>

                        {stu.isAlreadyEnrolled ? (
                          <span className="role-pill student" style={{ backgroundColor: '#f3f4f6', color: '#6b7280', fontSize: '0.75rem', padding: '4px 8px' }}>
                            ✓ Ya inscrito
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn-primary"
                            style={{ width: 'auto', padding: '4px 12px', fontSize: '0.825rem' }}
                            onClick={() => handleAddExistingStudent(stu)}
                            disabled={enrollingStudentId === stu.id}
                          >
                            {enrollingStudentId === stu.id ? 'Agregando...' : 'Agregar al curso'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setIsAddStudentModalOpen(false);
                      setIsManualModalOpen(false);
                      setIsImportModalOpen(false);
                    }}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: REGISTER (REGISTRAR ALUMNO NUEVO) */}
            {addStudentTab === 'REGISTER' && (
              <form onSubmit={handleManualSubmit}>
                {manualError && (
                  <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
                    {manualError}
                  </div>
                )}

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
                    onClick={() => {
                      setIsAddStudentModalOpen(false);
                      setIsManualModalOpen(false);
                      setIsImportModalOpen(false);
                    }}
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
            )}

            {/* TAB 4: EXCEL (IMPORTAR DESDE EXCEL) */}
            {addStudentTab === 'EXCEL' && (
              <div>
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
                        onClick={() => {
                          setIsAddStudentModalOpen(false);
                          setIsManualModalOpen(false);
                          setIsImportModalOpen(false);
                        }}
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
                      onClick={() => {
                        setIsAddStudentModalOpen(false);
                        setIsManualModalOpen(false);
                        setIsImportModalOpen(false);
                      }}
                    >
                      Cerrar y ver lista de alumnos
                    </button>
                  </div>
                )}
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

      {/* Modal de Doble Confirmación para Quitar Alumno del Curso (QA-007.9) */}
      {dropStudentTarget && (
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
            {dropConfirmStep === 1 ? (
              <>
                <h2 className="page-title" style={{ fontSize: '1.25rem', marginBottom: '12px' }}>
                  ¿Quitar alumno del curso?
                </h2>
                <p className="page-description" style={{ marginBottom: '20px', fontSize: '0.9rem', color: 'var(--color-muted)' }}>
                  El alumno dejará de formar parte de este curso. Su avance e historial académico se conservarán.
                </p>
                {dropError && <div className="alert alert-danger" style={{ marginBottom: '16px' }}>{dropError}</div>}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setDropStudentTarget(null);
                      setDropError(null);
                    }}
                    disabled={dropLoading}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ width: 'auto' }}
                    onClick={() => setDropConfirmStep(2)}
                    disabled={dropLoading}
                  >
                    Continuar
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="page-title" style={{ fontSize: '1.25rem', marginBottom: '12px', color: 'var(--color-danger)' }}>
                  Confirmación final
                </h2>
                <p className="page-description" style={{ marginBottom: '20px', fontSize: '0.9rem' }}>
                  ¿Estás seguro de que deseas quitar a <strong>{dropStudentTarget.name}</strong> del curso <strong>{course?.name}</strong>?
                  El alumno perderá su acceso activo al curso, pero su historial académico será conservado.
                </p>
                {dropError && <div className="alert alert-danger" style={{ marginBottom: '16px' }}>{dropError}</div>}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setDropStudentTarget(null);
                      setDropError(null);
                    }}
                    disabled={dropLoading}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ width: 'auto', backgroundColor: '#dc2626' }}
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

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>
                  Disponibilidad de Publicación
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input
                      type="radio"
                      name="modulePublishOption"
                      value="draft"
                      checked={modulePublishOption === 'draft'}
                      onChange={() => setModulePublishOption('draft')}
                      disabled={moduleSubmitting}
                    />
                    <span>Guardar como borrador (no visible para alumnos)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input
                      type="radio"
                      name="modulePublishOption"
                      value="now"
                      checked={modulePublishOption === 'now'}
                      onChange={() => setModulePublishOption('now')}
                      disabled={moduleSubmitting}
                    />
                    <span>Publicar inmediatamente</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input
                      type="radio"
                      name="modulePublishOption"
                      value="scheduled"
                      checked={modulePublishOption === 'scheduled'}
                      onChange={() => setModulePublishOption('scheduled')}
                      disabled={moduleSubmitting}
                    />
                    <span>Programar publicación</span>
                  </label>
                </div>

                {modulePublishOption === 'scheduled' && (
                  <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label className="form-label" htmlFor="module-scheduled-date" style={{ fontSize: '0.8rem' }}>
                        Fecha de publicación
                      </label>
                      <input
                        id="module-scheduled-date"
                        type="date"
                        className="form-input"
                        value={moduleScheduledDate}
                        onChange={(e) => setModuleScheduledDate(e.target.value)}
                        disabled={moduleSubmitting}
                        required
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="form-label" htmlFor="module-scheduled-time" style={{ fontSize: '0.8rem' }}>
                        Hora de publicación
                      </label>
                      <input
                        id="module-scheduled-time"
                        type="time"
                        className="form-input"
                        value={moduleScheduledTime}
                        onChange={(e) => setModuleScheduledTime(e.target.value)}
                        disabled={moduleSubmitting}
                        required
                      />
                    </div>
                  </div>
                )}
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

      {/* Modal Premium de Creación / Edición de Lección (QA-008-AJ.4) */}
      {isLessonModalOpen && (
        <div
          className="assessment-edit-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsLessonModalOpen(false);
          }}
        >
          <div className="assessment-edit-modal-card">
            {/* Header del Modal */}
            <div className="assessment-edit-modal-header">
              <div className="assessment-edit-modal-header-left">
                <div className="assessment-edit-modal-header-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                  </svg>
                </div>
                <div>
                  <h3 className="assessment-edit-modal-title">
                    {lessonModalMode === 'create' ? 'Nueva Lección' : 'Editar Lección'}
                  </h3>
                  <p className="assessment-edit-modal-subtitle">
                    {lessonModalMode === 'create'
                      ? 'Crea y configura el contenido de la lección'
                      : 'Actualiza el contenido y disponibilidad de la lección'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="assessment-edit-modal-close"
                onClick={() => setIsLessonModalOpen(false)}
                aria-label="Cerrar modal"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Form & Body */}
            <form onSubmit={handleSaveLesson} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="assessment-edit-modal-body">
                {lessonError && (
                  <div className="alert alert-error" style={{ marginBottom: '0' }}>
                    {lessonError}
                  </div>
                )}

                {/* Sección 1: Información General */}
                <div className="assessment-edit-section">
                  <div className="assessment-edit-section-title-group">
                    <span className="assessment-edit-section-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                      </svg>
                    </span>
                    <div>
                      <h4 className="assessment-edit-section-title">Información General</h4>
                      <div className="assessment-edit-section-subtitle">Datos principales que identifican la lección</div>
                    </div>
                  </div>

                  <div className="assessment-edit-field">
                    <label className="assessment-edit-label" htmlFor="lesson-title-input">
                      <span>Título de la lección <span className="assessment-edit-label-required">*</span></span>
                    </label>
                    <input
                      id="lesson-title-input"
                      type="text"
                      className="assessment-edit-input"
                      placeholder="Ej: Conceptos básicos de álgebra"
                      value={lessonTitle}
                      onChange={(e) => setLessonTitle(e.target.value)}
                      disabled={lessonSubmitting}
                      required
                    />
                  </div>

                  <div className="assessment-edit-field">
                    <label className="assessment-edit-label" htmlFor="lesson-description-input">
                      Descripción corta (Opcional)
                    </label>
                    <input
                      id="lesson-description-input"
                      type="text"
                      className="assessment-edit-input"
                      placeholder="Descripción resumida del tema..."
                      value={lessonDescription}
                      onChange={(e) => setLessonDescription(e.target.value)}
                      disabled={lessonSubmitting}
                    />
                  </div>
                </div>

                {/* Sección 2: Contenido de la Lección (Markdown + KaTeX) */}
                <div className="assessment-edit-section">
                  <div className="assessment-edit-section-title-group" style={{ marginBottom: '12px' }}>
                    <span className="assessment-edit-section-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="16 18 22 12 16 6"></polyline>
                        <polyline points="8 6 2 12 8 18"></polyline>
                      </svg>
                    </span>
                    <div style={{ flex: 1 }}>
                      <h4 className="assessment-edit-section-title">Contenido de la Lección</h4>
                      <div className="assessment-edit-section-subtitle">Markdown + KaTeX para textos y fórmulas matemáticas</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className={lessonTab === 'edit' ? 'btn-primary' : 'btn-secondary'}
                        style={{ padding: '4px 12px', fontSize: '0.8rem', borderRadius: '6px' }}
                        onClick={() => setLessonTab('edit')}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className={lessonTab === 'preview' ? 'btn-primary' : 'btn-secondary'}
                        style={{ padding: '4px 12px', fontSize: '0.8rem', borderRadius: '6px' }}
                        onClick={() => setLessonTab('preview')}
                      >
                        Vista previa
                      </button>
                    </div>
                  </div>

                  {lessonTab === 'edit' ? (
                    <div className="assessment-edit-field">
                      <textarea
                        id="lesson-content-input"
                        className="assessment-edit-textarea"
                        rows={8}
                        placeholder="Escribe el contenido en Markdown. Ej: # Título&#10;&#10;Fórmula: $x + 2 = 5$&#10;&#10;$$&#10;x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}&#10;$$"
                        value={lessonContent}
                        onChange={(e) => setLessonContent(e.target.value)}
                        disabled={lessonSubmitting}
                        style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
                      />
                    </div>
                  ) : (
                    <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px', minHeight: '180px', maxHeight: '300px', overflowY: 'auto', backgroundColor: '#ffffff' }}>
                      <MarkdownContent content={lessonContent} />
                    </div>
                  )}
                </div>

                {/* Sección 3: Disponibilidad */}
                <div className="assessment-edit-section">
                  <div className="assessment-edit-section-title-group">
                    <span className="assessment-edit-section-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    </span>
                    <div>
                      <h4 className="assessment-edit-section-title">Disponibilidad</h4>
                      <div className="assessment-edit-section-subtitle">Visibilidad para los alumnos matriculados</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                      <input
                        type="radio"
                        name="lessonPublishOption"
                        value="draft"
                        checked={lessonPublishOption === 'draft'}
                        onChange={() => setLessonPublishOption('draft')}
                        disabled={lessonSubmitting}
                      />
                      <span>Guardar como borrador (no visible para alumnos)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                      <input
                        type="radio"
                        name="lessonPublishOption"
                        value="now"
                        checked={lessonPublishOption === 'now'}
                        onChange={() => setLessonPublishOption('now')}
                        disabled={lessonSubmitting}
                      />
                      <span>Publicar inmediatamente</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                      <input
                        type="radio"
                        name="lessonPublishOption"
                        value="scheduled"
                        checked={lessonPublishOption === 'scheduled'}
                        onChange={() => setLessonPublishOption('scheduled')}
                        disabled={lessonSubmitting}
                      />
                      <span>Programar publicación</span>
                    </label>
                  </div>

                  {lessonPublishOption === 'scheduled' && (
                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <label className="assessment-edit-label" htmlFor="lesson-scheduled-date" style={{ fontSize: '0.8rem' }}>
                          Fecha de publicación
                        </label>
                        <input
                          id="lesson-scheduled-date"
                          type="date"
                          className="assessment-edit-input"
                          value={lessonScheduledDate}
                          onChange={(e) => setLessonScheduledDate(e.target.value)}
                          disabled={lessonSubmitting}
                          required
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="assessment-edit-label" htmlFor="lesson-scheduled-time" style={{ fontSize: '0.8rem' }}>
                          Hora de publicación
                        </label>
                        <input
                          id="lesson-scheduled-time"
                          type="time"
                          className="assessment-edit-input"
                          value={lessonScheduledTime}
                          onChange={(e) => setLessonScheduledTime(e.target.value)}
                          disabled={lessonSubmitting}
                          required
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Sticky */}
              <div className="assessment-edit-modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsLessonModalOpen(false)}
                  disabled={lessonSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  id="btn-save-lesson"
                  className="btn-primary"
                  disabled={lessonSubmitting}
                >
                  {lessonSubmitting ? 'Guardando...' : 'Guardar lección'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Premium para Crear Nueva Evaluación (QA-008-AJ.3) */}
      {isCreateAssModalOpen && (
        <div
          className="assessment-edit-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCreateAssModalOpen(false);
          }}
        >
          <div className="assessment-edit-modal-card">
            {/* Header del Modal */}
            <div className="assessment-edit-modal-header">
              <div className="assessment-edit-modal-header-left">
                <div className="assessment-edit-modal-header-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                  </svg>
                </div>
                <div>
                  <h3 className="assessment-edit-modal-title">Nueva Evaluación</h3>
                  <p className="assessment-edit-modal-subtitle">Configura la evaluación y asigna su ubicación para tus estudiantes</p>
                </div>
              </div>
              <button
                type="button"
                className="assessment-edit-modal-close"
                onClick={() => setIsCreateAssModalOpen(false)}
                aria-label="Cerrar modal"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Form & Body */}
            <form onSubmit={handleCreateAssessmentSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="assessment-edit-modal-body">
                {createAssError && (
                  <div className="alert alert-error" style={{ marginBottom: '0' }}>
                    {createAssError}
                  </div>
                )}

                {/* Sección 1: Información General */}
                <div className="assessment-edit-section">
                  <div className="assessment-edit-section-title-group">
                    <span className="assessment-edit-section-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                      </svg>
                    </span>
                    <div>
                      <h4 className="assessment-edit-section-title">Información General</h4>
                      <div className="assessment-edit-section-subtitle">Datos principales que identifican la evaluación</div>
                    </div>
                  </div>

                  <div className="assessment-edit-field">
                    <label className="assessment-edit-label">
                      <span>Título de la Evaluación <span className="assessment-edit-label-required">*</span></span>
                    </label>
                    <input
                      type="text"
                      className="assessment-edit-input"
                      placeholder="Ej. Examen Parcial I - Unidad 1"
                      value={createAssTitle}
                      onChange={(e) => setCreateAssTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="assessment-edit-field">
                    <label className="assessment-edit-label">Descripción / Instrucciones</label>
                    <textarea
                      className="assessment-edit-textarea"
                      rows={3}
                      placeholder="Instrucciones para los estudiantes antes de comenzar..."
                      value={createAssDescription}
                      onChange={(e) => setCreateAssDescription(e.target.value)}
                    />
                  </div>

                  <div className="assessment-edit-grid-2">
                    <div className="assessment-edit-field">
                      <label className="assessment-edit-label">
                        <span>Tipo de Evaluación <span className="assessment-edit-label-required">*</span></span>
                      </label>
                      <div className="assessment-edit-select-wrapper">
                        <select
                          className="assessment-edit-select"
                          value={createAssType}
                          onChange={(e) => setCreateAssType(e.target.value as AssessmentType)}
                        >
                          <option value="EXAM">Examen</option>
                          <option value="QUIZ">Cuestionario</option>
                          <option value="DIAGNOSTIC">Diagnóstico</option>
                          <option value="PRACTICE">Práctica</option>
                          <option value="FINAL">Evaluación Final</option>
                          <option value="CROSSWORD">Crucigrama</option>
                        </select>
                        <span className="assessment-edit-select-chevron">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </span>
                      </div>
                    </div>

                    <div className="assessment-edit-field">
                      <label className="assessment-edit-label">Ubicación de la Evaluación</label>
                      <div className="assessment-edit-select-wrapper">
                        <select
                          className="assessment-edit-select"
                          value={createAssModuleId || ''}
                          onChange={(e) => setCreateAssModuleId(e.target.value || null)}
                        >
                          <option value="">Evaluación global del curso</option>
                          {courseContent?.modules?.map((m) => (
                            <option key={m.id} value={m.id}>
                              Módulo: {m.title}
                            </option>
                          ))}
                        </select>
                        <span className="assessment-edit-select-chevron">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </span>
                      </div>
                      <div className="assessment-edit-help-text">Si seleccionas un módulo, la evaluación pertenecerá a ese módulo. Si eliges "global", pertenecerá al curso completo.</div>
                    </div>
                  </div>
                </div>

                {/* Sección 2: Calificación y Ponderación */}
                <div className="assessment-edit-section">
                  <div className="assessment-edit-section-title-group">
                    <span className="assessment-edit-section-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10"></line>
                        <line x1="12" y1="20" x2="12" y2="4"></line>
                        <line x1="6" y1="20" x2="6" y2="14"></line>
                      </svg>
                    </span>
                    <div>
                      <h4 className="assessment-edit-section-title">Calificación y Ponderación</h4>
                      <div className="assessment-edit-section-subtitle">Configuración del impacto en el libro de calificaciones</div>
                    </div>
                  </div>

                  <div className="assessment-edit-grid-2">
                    <div className="assessment-edit-field">
                      <label className="assessment-edit-label">
                        <span>Ponderación (%) <span className="assessment-edit-label-required">*</span></span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        className="assessment-edit-input"
                        value={createAssWeight}
                        onChange={(e) => setCreateAssWeight(e.target.value)}
                        required
                      />
                      <div className="assessment-edit-help-text">Porcentaje de la calificación final del curso.</div>
                    </div>

                    <div className="assessment-edit-field">
                      <label className="assessment-edit-label">Calificación Aprobatoria (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="ej. 60"
                        className="assessment-edit-input"
                        value={createAssPassingScore}
                        onChange={(e) => setCreateAssPassingScore(e.target.value)}
                      />
                      <div className="assessment-edit-help-text">Porcentaje mínimo para aprobar (opcional).</div>
                    </div>
                  </div>
                </div>

                {/* Sección 3: Tiempo e Intentos */}
                <div className="assessment-edit-section">
                  <div className="assessment-edit-section-title-group">
                    <span className="assessment-edit-section-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                    </span>
                    <div>
                      <h4 className="assessment-edit-section-title">Tiempo e Intentos</h4>
                      <div className="assessment-edit-section-subtitle">Reglas de resolución para el estudiante</div>
                    </div>
                  </div>

                  <div className="assessment-edit-grid-2">
                    <div className="assessment-edit-field">
                      <label className="assessment-edit-label">Tiempo Límite (minutos)</label>
                      <div className={`assessment-edit-checkbox-card ${createAssUnlimitedTime ? 'is-checked' : ''}`}>
                        <input
                          type="checkbox"
                          id="createAssUnlimitedTime"
                          className="assessment-edit-checkbox-input"
                          checked={createAssUnlimitedTime}
                          onChange={(e) => setCreateAssUnlimitedTime(e.target.checked)}
                        />
                        <label htmlFor="createAssUnlimitedTime" className="assessment-edit-checkbox-label-text">
                          Sin límite de tiempo
                        </label>
                      </div>
                      {!createAssUnlimitedTime && (
                        <input
                          type="number"
                          min="1"
                          placeholder="Minutos"
                          className="assessment-edit-input"
                          value={createAssTimeLimit}
                          onChange={(e) => setCreateAssTimeLimit(e.target.value)}
                        />
                      )}
                      <div className="assessment-edit-help-text">
                        {createAssUnlimitedTime ? 'El estudiante dispone de tiempo ilimitado para responder.' : 'Se enviará automáticamente al finalizar el tiempo.'}
                      </div>
                    </div>

                    <div className="assessment-edit-field">
                      <label className="assessment-edit-label">Intentos Máximos</label>
                      <div className={`assessment-edit-checkbox-card ${createAssUnlimitedAttempts ? 'is-checked' : ''}`}>
                        <input
                          type="checkbox"
                          id="createAssUnlimitedAttempts"
                          className="assessment-edit-checkbox-input"
                          checked={createAssUnlimitedAttempts}
                          onChange={(e) => setCreateAssUnlimitedAttempts(e.target.checked)}
                        />
                        <label htmlFor="createAssUnlimitedAttempts" className="assessment-edit-checkbox-label-text">
                          Intentos ilimitados
                        </label>
                      </div>
                      {!createAssUnlimitedAttempts && (
                        <input
                          type="number"
                          min="1"
                          placeholder="Cantidad de intentos"
                          className="assessment-edit-input"
                          value={createAssMaxAttempts}
                          onChange={(e) => setCreateAssMaxAttempts(e.target.value)}
                        />
                      )}
                      <div className="assessment-edit-help-text">
                        {createAssUnlimitedAttempts ? 'El estudiante podrá realizar intentos sin límite.' : 'Límite máximo de intentos permitidos por alumno.'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sección 4: Disponibilidad */}
                <div className="assessment-edit-section">
                  <div className="assessment-edit-section-title-group">
                    <span className="assessment-edit-section-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                    </span>
                    <div>
                      <h4 className="assessment-edit-section-title">Disponibilidad (Ventana de Fechas)</h4>
                      <div className="assessment-edit-section-subtitle">Programación de acceso para iniciar intentos</div>
                    </div>
                  </div>

                  <div className="assessment-edit-grid-2">
                    <div className="assessment-edit-field">
                      <label className="assessment-edit-label">Disponible Desde</label>
                      <input
                        type="datetime-local"
                        className="assessment-edit-input"
                        value={createAssAvailableFrom}
                        onChange={(e) => setCreateAssAvailableFrom(e.target.value)}
                      />
                      <div className="assessment-edit-help-text">Apertura para iniciar nuevos intentos.</div>
                    </div>

                    <div className="assessment-edit-field">
                      <label className="assessment-edit-label">Disponible Hasta</label>
                      <input
                        type="datetime-local"
                        className="assessment-edit-input"
                        value={createAssAvailableUntil}
                        onChange={(e) => setCreateAssAvailableUntil(e.target.value)}
                      />
                      <div className="assessment-edit-help-text">Cierre para iniciar nuevos intentos.</div>
                    </div>
                  </div>

                  {!createAssAvailableFrom && !createAssAvailableUntil && (
                    <div className="assessment-edit-info-banner">
                      <span className="assessment-edit-info-banner-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="16" x2="12" y2="12"></line>
                          <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                      </span>
                      <div>
                        <div className="assessment-edit-info-banner-title">Disponible inmediatamente</div>
                        <div className="assessment-edit-info-banner-desc">Los estudiantes pueden acceder en cualquier momento sin restricciones de fecha.</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sección 5: Publicación Programada */}
                <div className="assessment-edit-section">
                  <div className="assessment-edit-section-title-group">
                    <span className="assessment-edit-section-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                    </span>
                    <div>
                      <h4 className="assessment-edit-section-title">Publicación de la Evaluación</h4>
                      <div className="assessment-edit-section-subtitle">Estado inicial y fecha de visibilidad para los alumnos</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                      <input
                        type="radio"
                        name="createAssPublishOption"
                        value="draft"
                        checked={createAssPublishOption === 'draft'}
                        onChange={() => setCreateAssPublishOption('draft')}
                      />
                      <span>Guardar como borrador (no visible para alumnos)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                      <input
                        type="radio"
                        name="createAssPublishOption"
                        value="now"
                        checked={createAssPublishOption === 'now'}
                        onChange={() => setCreateAssPublishOption('now')}
                      />
                      <span>Publicar inmediatamente</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                      <input
                        type="radio"
                        name="createAssPublishOption"
                        value="scheduled"
                        checked={createAssPublishOption === 'scheduled'}
                        onChange={() => setCreateAssPublishOption('scheduled')}
                      />
                      <span>Programar publicación</span>
                    </label>
                  </div>

                  {createAssPublishOption === 'scheduled' && (
                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <label className="assessment-edit-label" htmlFor="create-ass-scheduled-date" style={{ fontSize: '0.8rem' }}>
                          Fecha de publicación
                        </label>
                        <input
                          id="create-ass-scheduled-date"
                          type="date"
                          className="assessment-edit-input"
                          value={createAssScheduledDate}
                          onChange={(e) => setCreateAssScheduledDate(e.target.value)}
                          required
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="assessment-edit-label" htmlFor="create-ass-scheduled-time" style={{ fontSize: '0.8rem' }}>
                          Hora de publicación
                        </label>
                        <input
                          id="create-ass-scheduled-time"
                          type="time"
                          className="assessment-edit-input"
                          value={createAssScheduledTime}
                          onChange={(e) => setCreateAssScheduledTime(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Fijo */}
              <div className="assessment-edit-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsCreateAssModalOpen(false)}
                  disabled={createAssSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createAssSubmitting}
                >
                  {createAssSubmitting ? 'Creando...' : 'Crear Evaluación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Premium: Programación Batch de Módulo (QA-008-AK.3) */}
      {scheduleBatchModuleTarget && courseId && (
        <ScheduleModuleModal
          isOpen={Boolean(scheduleBatchModuleTarget)}
          onClose={() => setScheduleBatchModuleTarget(null)}
          courseId={courseId}
          module={scheduleBatchModuleTarget}
          assessments={assessments}
          onSuccess={async () => {
            await fetchCourseContentData();
            const assessmentsData = await AssessmentServiceAPI.getCourseAssessments(courseId);
            setAssessments(assessmentsData);
          }}
        />
      )}

      {/* Modal Premium: Publicación Inmediata Selectiva (QA-008-AK.3) */}
      {publishNowModuleTarget && courseId && (
        <PublishModuleNowModal
          isOpen={Boolean(publishNowModuleTarget)}
          onClose={() => setPublishNowModuleTarget(null)}
          courseId={courseId}
          module={publishNowModuleTarget}
          assessments={assessments}
          onSuccess={async () => {
            await fetchCourseContentData();
            const assessmentsData = await AssessmentServiceAPI.getCourseAssessments(courseId);
            setAssessments(assessmentsData);
          }}
        />
      )}

      {/* Modal Confirmación: Cancelar Programación del Módulo (QA-008-AK.3) */}
      {cancelScheduleModuleTarget && (
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
          onClick={() => setCancelScheduleModuleTarget(null)}
        >
          <div
            className="modal-card"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 'var(--radius-lg, 16px)',
              boxShadow: 'var(--shadow-lg, 0 20px 25px -5px rgba(0, 0, 0, 0.1))',
              width: '100%',
              maxWidth: '500px',
              padding: '24px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: '#fef2f2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                }}
              >
                🚫
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text, #1e293b)', margin: 0 }}>
                Cancelar programación
              </h3>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--color-muted, #64748b)', lineHeight: '1.5', marginBottom: '20px' }}>
              Esto cancelará las publicaciones futuras pendientes para el módulo <strong>"{cancelScheduleModuleTarget.title}"</strong> y sus contenidos programados. El contenido que ya haya sido publicado no se ocultará ni se despublicará.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setCancelScheduleModuleTarget(null)}
                disabled={cancellingModuleSchedule}
              >
                Volver
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ width: 'auto', backgroundColor: '#dc2626', borderColor: '#dc2626' }}
                onClick={handleConfirmCancelModuleSchedule}
                disabled={cancellingModuleSchedule}
              >
                {cancellingModuleSchedule ? 'Cancelando...' : 'Confirmar cancelación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
