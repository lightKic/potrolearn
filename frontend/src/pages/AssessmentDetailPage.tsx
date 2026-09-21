import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AssessmentServiceAPI } from '../services/assessment.service.js';
import { QuestionServiceAPI } from '../services/question.service.js';
import { StudentAssessmentDTO, AssessmentType, AssessmentQuestionDTO, AssessmentDTO, StudentAttemptSummaryDTO, StudentAttemptSummaryItemDTO } from '../types/assessment.js';
import { ApiError } from '../services/api.js';
import { useAuth } from '../auth/useAuth.js';
import { AssessmentQuestionList } from '../components/assessments/AssessmentQuestionList.js';
import { QuestionFormModal } from '../components/assessments/QuestionFormModal.js';
import { QuestionBankDrawer } from '../components/assessments/QuestionBankDrawer.js';
import { GrantAttemptModal } from '../components/assessments/GrantAttemptModal.js';
import { StudentAttemptControlTable } from '../components/assessments/StudentAttemptControlTable.js';
import { PageLoading, ButtonSpinner } from '../components/common/loading/index.js';
import { CrosswordEditor, CrosswordClueItem } from '../components/assessments/CrosswordEditor.js';
import { CrosswordPreview } from '../components/assessments/CrosswordPreview.js';
import { CrosswordLayout, CrosswordUnplacedEntry } from '../types/assessment.js';

function normalizeAnswerPreview(text: string): string {
  if (!text) return '';
  return text
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

export const AssessmentDetailPage: React.FC = () => {
  const { courseId, assessmentId } = useParams<{ courseId: string; assessmentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [assessment, setAssessment] = useState<StudentAssessmentDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [starting, setStarting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Estados para Preguntas y Pestañas
  const [activeTab, setActiveTab] = useState<'QUESTIONS' | 'CONFIG' | 'RESULTS'>('QUESTIONS');
  const [questions, setQuestions] = useState<AssessmentQuestionDTO[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState<boolean>(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);

  // Estados para Modal de Creación/Edición de Preguntas y Drawer de Banco
  const [isQuestionFormOpen, setIsQuestionFormOpen] = useState(false);
  const [selectedQuestionForEdit, setSelectedQuestionForEdit] = useState<AssessmentQuestionDTO | null>(null);
  const [isBankDrawerOpen, setIsBankDrawerOpen] = useState(false);

  // Estados para Edición
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState<AssessmentType>('EXAM');
  const [editWeight, setEditWeight] = useState('0');
  const [editPassingScore, setEditPassingScore] = useState('');
  const [editTimeLimitMinutes, setEditTimeLimitMinutes] = useState('');
  const [editMaxAttempts, setEditMaxAttempts] = useState('');
  const [editAvailableFrom, setEditAvailableFrom] = useState('');
  const [editAvailableUntil, setEditAvailableUntil] = useState('');
  const [editPublishOption, setEditPublishOption] = useState<'draft' | 'now' | 'scheduled'>('now');
  const [editScheduledDate, setEditScheduledDate] = useState('');
  const [editScheduledTime, setEditScheduledTime] = useState('');
  const [editUnlimitedAttempts, setEditUnlimitedAttempts] = useState(true);
  const [editUnlimitedTime, setEditUnlimitedTime] = useState(true);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Estados para Publicación y Eliminación
  const [togglingPublication, setTogglingPublication] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Estados para Control de Intentos (Student & Teacher)
  const [studentSummary, setStudentSummary] = useState<StudentAttemptSummaryDTO | null>(null);
  const [studentSummaries, setStudentSummaries] = useState<StudentAttemptSummaryItemDTO[]>([]);
  const [loadingSummaries, setLoadingSummaries] = useState<boolean>(false);
  const [summariesError, setSummariesError] = useState<string | null>(null);

  // Estados para Modal de Concesión de Intentos
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [selectedStudentForGrant, setSelectedStudentForGrant] = useState<StudentAttemptSummaryItemDTO | null>(null);

  // Estados para Editor y Preview de Crucigrama (Docente)
  const [crosswordItems, setCrosswordItems] = useState<CrosswordClueItem[]>([
    { statement: '', answer: '' },
    { statement: '', answer: '' },
  ]);
  const [crosswordPreviewLayout, setCrosswordPreviewLayout] = useState<CrosswordLayout | null>(null);
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [unplacedEntries, setUnplacedEntries] = useState<CrosswordUnplacedEntry[]>([]);
  const [isStalePreview, setIsStalePreview] = useState(false);
  const [savingCrosswordLayout, setSavingCrosswordLayout] = useState(false);
  const [hasUnsavedCrosswordPreview, setHasUnsavedCrosswordPreview] = useState(false);
  const [hasSubmittedAttempts, setHasSubmittedAttempts] = useState(false);
  const isTeacherOrAdmin = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  // Sync questions with crosswordItems when assessment type is CROSSWORD
  useEffect(() => {
    if (assessment?.type === 'CROSSWORD') {
      if (questions.length > 0) {
        const itemsFromQ: CrosswordClueItem[] = questions.map((aq) => {
          const q = aq.question;
          const targetOpt = q?.options?.find((o) => o.isCorrect) || q?.options?.[0];
          return {
            id: q?.id,
            statement: q?.statement || '',
            answer: targetOpt?.text || '',
          };
        });
        setCrosswordItems(itemsFromQ);
      }
      if (assessment.crosswordLayout && !hasUnsavedCrosswordPreview) {
        setCrosswordPreviewLayout(assessment.crosswordLayout as CrosswordLayout);
        setIsStalePreview(false);
      }
    }
  }, [assessment?.type, assessment?.crosswordLayout, questions, hasUnsavedCrosswordPreview]);

  const handleCrosswordItemsChange = (newItems: CrosswordClueItem[]) => {
    setCrosswordItems(newItems);
    setIsStalePreview(true);
  };

  const handleGenerateCrosswordPreview = async (seed?: string | number) => {
    if (!assessmentId) return;

    if (crosswordItems.length < 1) {
      setPreviewError('El crucigrama debe contener al menos 1 pista.');
      return;
    }
    if (crosswordItems.length > 20) {
      setPreviewError('El crucigrama no puede superar las 20 pistas.');
      return;
    }

    const seenNorms = new Set<string>();
    for (let idx = 0; idx < crosswordItems.length; idx++) {
      const item = crosswordItems[idx];
      if (!item.statement.trim()) {
        setPreviewError(`La pista #${idx + 1} no puede estar vacía.`);
        return;
      }
      if (!item.answer.trim()) {
        setPreviewError(`La respuesta de la pista #${idx + 1} no puede estar vacía.`);
        return;
      }
      const norm = normalizeAnswerPreview(item.answer);
      if (norm.length < 2) {
        setPreviewError(`La respuesta "${item.answer}" debe tener al menos 2 letras.`);
        return;
      }
      if (norm.length > 20) {
        setPreviewError(`La respuesta "${item.answer}" excede los 20 caracteres.`);
        return;
      }
      if (seenNorms.has(norm)) {
        setPreviewError(`Respuesta duplicada detectada: "${norm}". Cada respuesta debe ser única.`);
        return;
      }
      seenNorms.add(norm);
    }

    setGeneratingPreview(true);
    setPreviewError(null);
    setUnplacedEntries([]);

    try {
      // Sync questions attached to assessment in DB
      const currentQuestionIds = new Set(crosswordItems.map((i) => i.id).filter(Boolean));
      for (const q of questions) {
        if (!currentQuestionIds.has(q.questionId)) {
          await QuestionServiceAPI.removeQuestionFromAssessment(assessmentId, q.questionId);
        }
      }

      for (let i = 0; i < crosswordItems.length; i++) {
        const item = crosswordItems[i];
        if (item.id) {
          await QuestionServiceAPI.updateQuestion(item.id, {
            statement: item.statement,
            type: 'CROSSWORD_CLUE',
            options: [{ text: item.answer, isCorrect: true, order: 1 }],
          });
        } else {
          const created = await QuestionServiceAPI.createQuestion({
            statement: item.statement,
            type: 'CROSSWORD_CLUE',
            defaultPoints: 10,
            options: [{ text: item.answer, isCorrect: true, order: 1 }],
          });
          await QuestionServiceAPI.addQuestionToAssessment(assessmentId, {
            questionId: created.id,
            points: 10,
            order: i + 1,
          });
          item.id = created.id;
        }
      }

      await fetchQuestions(assessmentId);

      const currentSeed = seed !== undefined ? seed : Date.now();
      const res = await AssessmentServiceAPI.generateCrosswordPreview(assessmentId, currentSeed);

      if (res.layout) {
        setCrosswordPreviewLayout(res.layout);
        setHasUnsavedCrosswordPreview(true);
        setIsStalePreview(false);
        setPreviewError(res.error || null);
        setUnplacedEntries(res.unplacedEntries || []);
        if (res.success && (!res.unplacedEntries || res.unplacedEntries.length === 0)) {
          setActionSuccess('Vista previa del crucigrama generada correctamente.');
        } else {
          setActionSuccess('Vista previa parcial del crucigrama generada. Revisa las palabras no colocadas.');
        }
      } else {
        setCrosswordPreviewLayout(null);
        setPreviewError(res.error || 'No fue posible construir el crucigrama con estas respuestas.');
        setUnplacedEntries(res.unplacedEntries || []);
      }
    } catch (err: unknown) {
      setCrosswordPreviewLayout(null);
      if (err instanceof ApiError) {
        setPreviewError(err.message);
      } else {
        setPreviewError('Error al generar la vista previa del crucigrama.');
      }
    } finally {
      setGeneratingPreview(false);
    }
  };

  const handleSaveCrosswordLayout = async () => {
    if (!assessmentId || !crosswordPreviewLayout || isStalePreview) return;

    if (unplacedEntries.length > 0 || (questions && crosswordPreviewLayout.entries.length < questions.length)) {
      const placedCount = crosswordPreviewLayout.entries.length;
      const totalCount = questions ? questions.length : placedCount + unplacedEntries.length;
      setActionError(
        `No se puede guardar el crucigrama todavía. Hay ${totalCount} pistas en la evaluación, pero solo ${placedCount} pudieron colocarse en el tablero. Coloca todas las pistas o regenera el crucigrama antes de guardar.`
      );
      return;
    }

    setSavingCrosswordLayout(true);
    setActionError(null);
    try {
      const updated = await AssessmentServiceAPI.updateAssessment(assessmentId, {
        crosswordLayout: crosswordPreviewLayout,
      });
      setAssessment(updated);
      setHasUnsavedCrosswordPreview(false);
      setIsStalePreview(false);
      setActionSuccess('Layout del crucigrama guardado y confirmado exitosamente.');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError('Error al guardar el layout del crucigrama.');
      }
    } finally {
      setSavingCrosswordLayout(false);
    }
  };

  const fetchQuestions = async (id: string): Promise<AssessmentQuestionDTO[]> => {
    setLoadingQuestions(true);
    setQuestionsError(null);
    try {
      const qData = await QuestionServiceAPI.getQuestionsForAssessment(id);
      setQuestions(qData);
      return qData;
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setQuestionsError(err.message);
      } else {
        setQuestionsError('Error al cargar las preguntas de la evaluación');
      }
      return [];
    } finally {
      setLoadingQuestions(false);
    }
  };

  const fetchStudentSummary = (id: string) => {
    AssessmentServiceAPI.getMyAttemptSummary(id)
      .then((data) => setStudentSummary(data))
      .catch(() => {});
  };

  const fetchStudentSummaries = (id: string) => {
    setLoadingSummaries(true);
    setSummariesError(null);
    AssessmentServiceAPI.getAssessmentStudentsAttemptSummary(id)
      .then((data) => {
        setStudentSummaries(data);
        setHasSubmittedAttempts(data.some((s) => s.attemptsUsed > 0));
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError) {
          setSummariesError(err.message);
        } else {
          setSummariesError('Error al cargar el control de intentos de los alumnos');
        }
      })
      .finally(() => setLoadingSummaries(false));
  };

  useEffect(() => {
    if (!assessmentId) return;

    let isMounted = true;
    setLoading(true);
    setHasUnsavedCrosswordPreview(false);
    setCrosswordPreviewLayout(null);
    setIsStalePreview(false);

    AssessmentServiceAPI.getAssessmentDetail(assessmentId)
      .then((data) => {
        if (isMounted) {
          setAssessment(data);
          setError(null);
          if (isTeacherOrAdmin) {
            fetchQuestions(assessmentId);
          } else {
            fetchStudentSummary(assessmentId);
          }
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          if (err instanceof ApiError) {
            setError(err.message);
          } else {
            setError('Error al cargar la información de la evaluación');
          }
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [assessmentId, isTeacherOrAdmin]);

  useEffect(() => {
    if (assessmentId && isTeacherOrAdmin && activeTab === 'RESULTS') {
      fetchStudentSummaries(assessmentId);
    }
  }, [assessmentId, isTeacherOrAdmin, activeTab]);

  const handleStartOrResume = async () => {
    if (!assessmentId) return;

    setStarting(true);
    setError(null);

    try {
      const attempt = await AssessmentServiceAPI.startOrResumeAttempt(assessmentId);
      if (attempt.status === 'IN_PROGRESS') {
        navigate(`/app/attempts/${attempt.id}/take`);
      } else {
        navigate(`/app/attempts/${attempt.id}/result`);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Error al iniciar la evaluación');
      }
    } finally {
      setStarting(false);
    }
  };

  const toDatetimeLocalString = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => (n < 10 ? '0' + n : n);
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
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

  const openEditModal = () => {
    if (!assessment) return;
    setEditTitle(assessment.title);
    setEditDescription(assessment.description || '');
    setEditType(assessment.type);
    setEditWeight(assessment.weight !== undefined && assessment.weight !== null ? String(assessment.weight) : '0');
    setEditPassingScore(assessment.passingScore !== null && assessment.passingScore !== undefined ? String(assessment.passingScore) : '');
    setEditTimeLimitMinutes(assessment.timeLimitMinutes ? String(assessment.timeLimitMinutes) : '');
    setEditMaxAttempts(assessment.maxAttempts ? String(assessment.maxAttempts) : '');
    setEditUnlimitedTime(!assessment.timeLimitMinutes);
    setEditUnlimitedAttempts(!assessment.maxAttempts);
    setEditAvailableFrom(toDatetimeLocalString(assessment.availableFrom));
    setEditAvailableUntil(toDatetimeLocalString(assessment.availableUntil));

    const parsed = parseScheduledFields(assessment.scheduledPublishAt, assessment.isPublished);
    setEditPublishOption(parsed.option);
    setEditScheduledDate(parsed.date);
    setEditScheduledTime(parsed.time);

    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assessmentId) return;

    if (!editTitle.trim()) {
      setEditError('El título es requerido');
      return;
    }

    const weightNum = Number(editWeight);
    if (isNaN(weightNum) || weightNum < 0 || weightNum > 100) {
      setEditError('La ponderación debe ser un valor entre 0 y 100%');
      return;
    }

    const passingScoreNum = editPassingScore.trim() !== '' ? Number(editPassingScore) : null;
    if (passingScoreNum !== null && (isNaN(passingScoreNum) || passingScoreNum < 0 || passingScoreNum > 100)) {
      setEditError('La calificación aprobatoria debe estar entre 0 y 100%');
      return;
    }

    const timeLimitNum = editUnlimitedTime ? null : (editTimeLimitMinutes.trim() !== '' ? Number(editTimeLimitMinutes) : null);
    if (!editUnlimitedTime && (timeLimitNum === null || isNaN(timeLimitNum) || timeLimitNum < 1)) {
      setEditError('Especifica un tiempo límite válido en minutos (mínimo 1 minuto)');
      return;
    }

    const maxAttemptsNum = editUnlimitedAttempts ? null : (editMaxAttempts.trim() !== '' ? Number(editMaxAttempts) : null);
    if (!editUnlimitedAttempts && (maxAttemptsNum === null || isNaN(maxAttemptsNum) || maxAttemptsNum < 1)) {
      setEditError('Especifica un número máximo de intentos válido (mínimo 1 intento)');
      return;
    }

    const fromDateObj = editAvailableFrom ? new Date(editAvailableFrom) : null;
    const untilDateObj = editAvailableUntil ? new Date(editAvailableUntil) : null;

    if (fromDateObj && isNaN(fromDateObj.getTime())) {
      setEditError('La fecha de apertura no es válida');
      return;
    }
    if (untilDateObj && isNaN(untilDateObj.getTime())) {
      setEditError('La fecha de cierre no es válida');
      return;
    }
    if (fromDateObj && untilDateObj && fromDateObj > untilDateObj) {
      setEditError('La fecha de apertura no puede ser posterior a la fecha de cierre');
      return;
    }

    if (editPublishOption === 'scheduled' && (!editScheduledDate || !editScheduledTime)) {
      setEditError('Por favor especifica la fecha y hora para la publicación programada.');
      return;
    }

    const { isPublished, scheduledPublishAt } = getScheduledISO(editPublishOption, editScheduledDate, editScheduledTime);

    setEditSubmitting(true);
    setEditError(null);

    try {
      const updated = await AssessmentServiceAPI.updateAssessment(assessmentId, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        type: editType,
        weight: weightNum,
        passingScore: passingScoreNum,
        timeLimitMinutes: timeLimitNum,
        maxAttempts: maxAttemptsNum,
        availableFrom: fromDateObj ? fromDateObj.toISOString() : null,
        availableUntil: untilDateObj ? untilDateObj.toISOString() : null,
        isPublished,
        scheduledPublishAt,
      });

      setAssessment(updated);
      setIsEditModalOpen(false);
      setActionError(null);
      setActionSuccess('Evaluación actualizada exitosamente.');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setEditError(err.message);
      } else {
        setEditError('Error al actualizar la evaluación');
      }
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleTogglePublication = async () => {
    if (!assessmentId || !assessment) return;

    setTogglingPublication(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const updated = await AssessmentServiceAPI.togglePublication(assessmentId, !assessment.isPublished);
      setAssessment(updated);
      setActionSuccess(updated.isPublished ? 'Evaluación publicada exitosamente.' : 'Evaluación despublicada (guardada como borrador).');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError('Error al cambiar el estado de publicación');
      }
    } finally {
      setTogglingPublication(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!assessmentId) return;

    setDeleting(true);
    setActionError(null);

    try {
      await AssessmentServiceAPI.deleteAssessment(assessmentId);
      setIsDeleteModalOpen(false);
      navigate(courseId ? `/app/courses/${courseId}` : '/app/courses');
    } catch (err: unknown) {
      setIsDeleteModalOpen(false);
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError('Error al eliminar la evaluación');
      }
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <PageLoading title="Cargando evaluación..." />;
  }

  if (error || !assessment) {
    return (
      <div className="error-container">
        <div className="alert alert-error">{error || 'Evaluación no encontrada'}</div>
        <Link to={`/app/courses/${courseId}`} className="btn btn-secondary">
          Volver al Curso
        </Link>
      </div>
    );
  }

  const getTypeLabel = (type: AssessmentType): string => {
    switch (type) {
      case 'EXAM': return 'Examen 📝';
      case 'QUIZ': return 'Cuestionario ❓';
      case 'DIAGNOSTIC': return 'Diagnóstico 🔍';
      case 'PRACTICE': return 'Práctica 🏋️';
      case 'FINAL': return 'Evaluación Final 🎓';
      case 'CROSSWORD': return 'Crucigrama 🧩';
      default: return type;
    }
  };

  const formatDateDisplay = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleOpenCreateQuestion = () => {
    setSelectedQuestionForEdit(null);
    setIsQuestionFormOpen(true);
  };

  const handleOpenEditQuestion = (item: AssessmentQuestionDTO) => {
    setSelectedQuestionForEdit(item);
    setIsQuestionFormOpen(true);
  };

  const handleQuestionSaved = () => {
    if (assessmentId) {
      fetchQuestions(assessmentId);
      setActionSuccess('Pregunta guardada exitosamente.');
    }
  };

  const handleUpdatePoints = async (questionId: string, points: number) => {
    if (!assessmentId) return;
    setActionError(null);
    try {
      await QuestionServiceAPI.updateAssessmentQuestionPoints(assessmentId, questionId, points);
      setQuestions((prev) =>
        prev.map((q) => (q.questionId === questionId ? { ...q, points } : q))
      );
      setActionSuccess('Puntos de la pregunta actualizados exitosamente.');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError('Error al actualizar los puntos de la pregunta');
      }
    }
  };

  const handleRemoveQuestion = async (questionId: string) => {
    if (!assessmentId) return;
    setActionError(null);
    try {
      await QuestionServiceAPI.removeQuestionFromAssessment(assessmentId, questionId);
      setQuestions((prev) => prev.filter((q) => q.questionId !== questionId));
      setActionSuccess('Pregunta desasociada de la evaluación exitosamente.');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError('Error al desasociar la pregunta de la evaluación');
      }
    }
  };

  const handleReorderQuestions = async (items: { questionId: string; order: number }[]) => {
    if (!assessmentId) return;
    setActionError(null);
    const previousQuestions = [...questions];

    const idToOrder = new Map(items.map((it) => [it.questionId, it.order]));
    const reordered = [...questions].sort((a, b) => {
      const orderA = idToOrder.get(a.questionId) ?? a.order;
      const orderB = idToOrder.get(b.questionId) ?? b.order;
      return orderA - orderB;
    });

    setQuestions(reordered);
    try {
      await QuestionServiceAPI.reorderAssessmentQuestions(assessmentId, items);
      setActionSuccess('Orden de las preguntas actualizado exitosamente.');
    } catch (err: unknown) {
      setQuestions(previousQuestions);
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError('Error al reordenar las preguntas');
      }
    }
  };

  const handleQuestionAddedFromBank = (updatedAssessment?: AssessmentDTO) => {
    if (updatedAssessment && updatedAssessment.questions) {
      setQuestions(updatedAssessment.questions);
      setActionSuccess('Pregunta agregada del banco a la evaluación exitosamente.');
    } else if (assessmentId) {
      fetchQuestions(assessmentId);
      setActionSuccess('Pregunta agregada del banco a la evaluación exitosamente.');
    }
  };

  const totalPoints = questions.reduce((sum, item) => sum + (item.points || 0), 0);

  return (
    <div className="assessment-detail-page">
      <div style={{ marginBottom: '16px' }}>
        <Link to={`/app/courses/${courseId}`} className="back-link">
          ← Volver al Curso
        </Link>
      </div>

      {/* ENCABEZADO DE EVALUACIÓN PREMIUM */}
      <div className="assessment-detail-header-card">
        <div className="assessment-header-top">
          <div className="assessment-header-title-group">
            <div className="assessment-header-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <div className="assessment-header-titles">
              <h1 className="assessment-header-title">{assessment.title}</h1>
              {assessment.description && (
                <p className="assessment-header-desc">{assessment.description}</p>
              )}
            </div>
          </div>

          {isTeacherOrAdmin && (
            <div className={`assessment-status-badge ${assessment.isPublished ? 'published' : 'draft'}`}>
              <span className="assessment-status-dot"></span>
              <div className="assessment-status-text">
                <span className="assessment-status-label">{assessment.isPublished ? 'Publicada' : 'Borrador'}</span>
                <span className="assessment-status-subtext">
                  {assessment.isPublished ? 'Visible para estudiantes' : 'No visible para estudiantes'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* METADATOS Y PILLS DESTACADOS */}
        <div className="assessment-header-meta">
          <span className="meta-pill type">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            {getTypeLabel(assessment.type)}
          </span>
          <span className="meta-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            {assessment.timeLimitMinutes ? `${assessment.timeLimitMinutes} minutos` : 'Sin límite de tiempo'}
          </span>
          {isTeacherOrAdmin && (
            <span className="meta-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 11l3 3L22 4"></path>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
              </svg>
              {questions.length} preguntas ({totalPoints} pts)
            </span>
          )}
          <span className="meta-pill weight">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
            {assessment.weight}% del curso
          </span>
        </div>
      </div>

      {actionSuccess && (
        <div className="alert alert-success" style={{ marginBottom: '16px' }}>
          {actionSuccess}
        </div>
      )}

      {actionError && (
        <div className="alert alert-error" style={{ marginBottom: '16px' }}>
          {actionError}
        </div>
      )}

      {/* Pestañas para Admin/Teacher */}
      {isTeacherOrAdmin ? (
        <>
          <div
            className="tab-navigation"
            style={{
              display: 'flex',
              gap: '12px',
              borderBottom: '2px solid #e2e8f0',
              marginBottom: '24px',
              marginTop: '16px',
            }}
          >
            <button
              type="button"
              className={`tab-btn ${activeTab === 'QUESTIONS' ? 'active' : ''}`}
              onClick={() => setActiveTab('QUESTIONS')}
              style={{
                padding: '12px 20px',
                fontWeight: 700,
                fontSize: '0.95rem',
                border: 'none',
                borderBottom: activeTab === 'QUESTIONS' ? '3px solid #0f4c81' : '3px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'QUESTIONS' ? '#0f4c81' : '#64748b',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '-2px',
                transition: 'color 0.15s ease, border-color 0.15s ease',
              }}
            >
              📝 Preguntas ({questions.length})
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'CONFIG' ? 'active' : ''}`}
              onClick={() => setActiveTab('CONFIG')}
              style={{
                padding: '12px 20px',
                fontWeight: 700,
                fontSize: '0.95rem',
                border: 'none',
                borderBottom: activeTab === 'CONFIG' ? '3px solid #0f4c81' : '3px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'CONFIG' ? '#0f4c81' : '#64748b',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '-2px',
                transition: 'color 0.15s ease, border-color 0.15s ease',
              }}
            >
              ⚙️ Configuración General
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'RESULTS' ? 'active' : ''}`}
              onClick={() => setActiveTab('RESULTS')}
              style={{
                padding: '12px 20px',
                fontWeight: 700,
                fontSize: '0.95rem',
                border: 'none',
                borderBottom: activeTab === 'RESULTS' ? '3px solid #0f4c81' : '3px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'RESULTS' ? '#0f4c81' : '#64748b',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '-2px',
                transition: 'color 0.15s ease, border-color 0.15s ease',
              }}
            >
              📊 Calificaciones y Resultados
            </button>
          </div>

          {/* TAB 1: PREGUNTAS */}
          {activeTab === 'QUESTIONS' && (
            <div className="tab-content-questions">
              {/* Barra de métricas rápidas del cuestionario */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: 'var(--color-surface, #ffffff)',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  marginBottom: '24px',
                  flexWrap: 'wrap',
                  gap: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                }}
              >
                <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ fontSize: '0.775rem', color: '#64748b', display: 'block', fontWeight: 600 }}>PREGUNTAS</span>
                    <strong style={{ fontSize: '1.1rem', color: '#0f4c81' }}>{questions.length} reactivos</strong>
                  </div>
                  <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '24px' }}>
                    <span style={{ fontSize: '0.775rem', color: '#64748b', display: 'block', fontWeight: 600 }}>PUNTOS TOTALES</span>
                    <strong style={{ fontSize: '1.1rem', color: '#0f4c81' }}>{totalPoints} pts</strong>
                  </div>
                  <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '24px' }}>
                    <span style={{ fontSize: '0.775rem', color: '#64748b', display: 'block', fontWeight: 600 }}>PONDERACIÓN</span>
                    <strong style={{ fontSize: '1.1rem', color: '#0369a1' }}>{assessment.weight}%</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <Link
                    to={`/app/courses/${courseId}/assessments/${assessmentId}/preview`}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.85rem', padding: '8px 16px', fontWeight: 700, width: 'auto', backgroundColor: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                  >
                    👁️ Vista previa
                  </Link>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleOpenCreateQuestion}
                    style={{ fontSize: '0.85rem', padding: '8px 16px', fontWeight: 700, width: 'auto' }}
                  >
                    ➕ Nueva pregunta
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsBankDrawerOpen(true)}
                    style={{ fontSize: '0.85rem', padding: '8px 16px', fontWeight: 700, width: 'auto', backgroundColor: '#f1f5f9', color: '#0f4c81', borderColor: '#cbd5e1' }}
                  >
                    📚 Agregar del banco
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={openEditModal}
                    style={{ fontSize: '0.85rem', padding: '6px 14px', fontWeight: 600 }}
                  >
                    ✏️ Editar Ajustes
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleTogglePublication}
                    disabled={togglingPublication}
                    style={{ fontSize: '0.85rem', padding: '6px 14px', fontWeight: 600 }}
                  >
                    {togglingPublication
                      ? 'Procesando...'
                      : assessment.isPublished
                      ? '🔴 Despublicar'
                      : '🟢 Publicar'}
                  </button>
                </div>
              </div>

              {/* Content depending on Assessment Type */}
              {assessment.type === 'CROSSWORD' ? (
                <div className="crossword-teacher-panel">
                  <div className="crossword-split-panel">
                    <CrosswordEditor
                      items={crosswordItems}
                      onChange={handleCrosswordItemsChange}
                      disabled={hasSubmittedAttempts}
                    />
                    <CrosswordPreview
                      layout={crosswordPreviewLayout}
                      loading={generatingPreview}
                      error={previewError}
                      unplacedEntries={unplacedEntries}
                      isStale={isStalePreview}
                      onGenerate={() => handleGenerateCrosswordPreview(12345)}
                      onRegenerate={() => handleGenerateCrosswordPreview(Date.now())}
                      onSaveLayout={handleSaveCrosswordLayout}
                      savingLayout={savingCrosswordLayout}
                      hasUnsavedChanges={hasUnsavedCrosswordPreview}
                      canSave={!hasSubmittedAttempts && Boolean(crosswordPreviewLayout)}
                      showAnswers={true}
                      lockedMessage={
                        hasSubmittedAttempts
                          ? 'Esta evaluación tiene intentos registrados y su estructura está bloqueada para preservar el historial.'
                          : null
                      }
                    />
                  </div>
                </div>
              ) : (
                /* Lista Premium de Preguntas Estándar */
                <AssessmentQuestionList
                  questions={questions}
                  loading={loadingQuestions}
                  error={questionsError}
                  onRetry={() => assessmentId && fetchQuestions(assessmentId)}
                  onEditQuestion={handleOpenEditQuestion}
                  onCreateQuestion={handleOpenCreateQuestion}
                  onOpenBankDrawer={() => setIsBankDrawerOpen(true)}
                  onUpdatePoints={handleUpdatePoints}
                  onRemoveQuestion={handleRemoveQuestion}
                  onReorderQuestions={handleReorderQuestions}
                />
              )}
            </div>
          )}

          {/* TAB 2: CONFIGURACIÓN GENERAL */}
          {activeTab === 'CONFIG' && (
            <div className="tab-content-config">
              <div className="assessment-config-grid">
                {/* Columna Izquierda: Información General */}
                <div className="assessment-card">
                  <div className="assessment-card-header">
                    <div className="assessment-card-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                      </svg>
                    </div>
                    <h3>Datos de la Evaluación</h3>
                  </div>

                  <div className="assessment-data-grid">
                    <div className="data-item">
                      <span className="data-item-label">Estado</span>
                      <span className="data-item-value" style={{ color: assessment.isPublished ? '#15803d' : '#b45309' }}>
                        {assessment.isPublished ? 'Publicada 🟢' : 'Borrador 🟡'}
                      </span>
                    </div>

                    <div className="data-item">
                      <span className="data-item-label">Tipo de Evaluación</span>
                      <span className="data-item-value">{getTypeLabel(assessment.type)}</span>
                    </div>

                    <div className="data-item">
                      <span className="data-item-label">Número de Preguntas</span>
                      <span className="data-item-value">{questions.length} preguntas</span>
                      <span className="data-item-sub">{totalPoints} puntos totales</span>
                    </div>

                    <div className="data-item">
                      <span className="data-item-label">Calificación Mínima</span>
                      <span className="data-item-value">
                        {assessment.passingScore !== null ? `${assessment.passingScore}%` : 'N/A'}
                      </span>
                      <span className="data-item-sub">porcentaje de aprobación</span>
                    </div>

                    <div className="data-item">
                      <span className="data-item-label">Tiempo Límite</span>
                      <span className="data-item-value">
                        {assessment.timeLimitMinutes ? `${assessment.timeLimitMinutes} minutos` : 'Sin límite'}
                      </span>
                    </div>

                    <div className="data-item">
                      <span className="data-item-label">Intentos Máximos</span>
                      <span className="data-item-value">
                        {assessment.maxAttempts ? `${assessment.maxAttempts} intentos` : 'Ilimitados'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Columna Derecha: Disponibilidad & Ponderación */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Disponibilidad */}
                  <div className="assessment-card">
                    <div className="assessment-card-header">
                      <div className="assessment-card-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                          <line x1="16" y1="2" x2="16" y2="6"></line>
                          <line x1="8" y1="2" x2="8" y2="6"></line>
                          <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                      </div>
                      <h3>Disponibilidad</h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div className="data-item">
                        <span className="data-item-label">Disponible Desde</span>
                        <span className="data-item-value" style={{ fontSize: '0.95rem' }}>
                          {assessment.availableFrom ? formatDateDisplay(assessment.availableFrom) : 'Disponible inmediatamente'}
                        </span>
                      </div>

                      <div className="data-item" style={{ paddingTop: '10px', borderTop: '1px dashed #e2e8f0' }}>
                        <span className="data-item-label">Disponible Hasta</span>
                        <span className="data-item-value" style={{ fontSize: '0.95rem' }}>
                          {assessment.availableUntil ? formatDateDisplay(assessment.availableUntil) : 'Sin fecha de cierre'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Impacto / Ponderación */}
                  <div className="assessment-card">
                    <div className="assessment-card-header">
                      <div className="assessment-card-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="20" x2="18" y2="10"></line>
                          <line x1="12" y1="20" x2="12" y2="4"></line>
                          <line x1="6" y1="20" x2="6" y2="14"></line>
                        </svg>
                      </div>
                      <h3>Impacto en el curso</h3>
                    </div>

                    <div className="impact-hero-box">
                      <div className="impact-hero-value">{assessment.weight}%</div>
                      <div className="impact-hero-sub">de la calificación final del curso</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botones de acción con jerarquía clara */}
              <div className="assessment-actions-bar">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={openEditModal}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontWeight: 700, width: 'auto' }}
                >
                  ✏️ Editar Evaluación
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleTogglePublication}
                  disabled={togglingPublication}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontWeight: 600, width: 'auto' }}
                >
                  {togglingPublication
                    ? 'Procesando...'
                    : assessment.isPublished
                    ? '🔴 Despublicar'
                    : '🟢 Publicar'}
                </button>

                <button
                  type="button"
                  className="btn btn-danger-outline"
                  onClick={() => setIsDeleteModalOpen(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', marginLeft: 'auto' }}
                >
                  🗑️ Eliminar Evaluación
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: CALIFICACIONES Y RESULTADOS & CONTROL DE INTENTOS */}
          {activeTab === 'RESULTS' && (
            <div className="tab-content-results" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ backgroundColor: 'var(--color-surface, #ffffff)', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '28px 36px', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📊</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>Centro de Calificación de la Evaluación</h3>
                <p style={{ color: 'var(--color-muted, #64748b)', maxWidth: '480px', margin: '0 auto 16px auto', fontSize: '0.9rem' }}>
                  Revisa los intentos completados por los alumnos, califica respuestas abiertas y consulta estadísticas grupales.
                </p>
                <Link
                  to={courseId ? `/app/courses/${courseId}/assessments/${assessmentId}/grading` : `/app/assessments/${assessmentId}/grading`}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontWeight: 700, width: 'auto' }}
                >
                  📋 Ir al Centro de Calificación
                </Link>
              </div>

              {/* TABLA DE CONTROL DE INTENTOS */}
              <div style={{ backgroundColor: 'var(--color-surface, #ffffff)', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px' }}>
                <StudentAttemptControlTable
                  assessmentId={assessmentId!}
                  assessmentTitle={assessment.title}
                  maxAttemptsGlobal={assessment.maxAttempts}
                  summaries={studentSummaries}
                  loading={loadingSummaries}
                  error={summariesError}
                  onRefresh={() => assessmentId && fetchStudentSummaries(assessmentId)}
                  onOpenGrantModal={(st) => {
                    setSelectedStudentForGrant(st);
                    setIsGrantModalOpen(true);
                  }}
                />
              </div>
            </div>
          )}
        </>
      ) : (
        /* VISTA PARA ALUMNO (STUDENT) */
        <>
          <div className="assessment-config-grid" style={{ marginTop: '20px' }}>
            <div className="assessment-card">
              <div className="assessment-card-header">
                <div className="assessment-card-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                </div>
                <h3>Información de la Evaluación</h3>
              </div>

              <div className="assessment-data-grid">
                <div className="data-item">
                  <span className="data-item-label">Tipo de Evaluación</span>
                  <span className="data-item-value">{getTypeLabel(assessment.type)}</span>
                </div>

                <div className="data-item">
                  <span className="data-item-label">Ponderación</span>
                  <span className="data-item-value">{assessment.weight}% del curso</span>
                </div>

                <div className="data-item">
                  <span className="data-item-label">Tiempo Límite</span>
                  <span className="data-item-value">
                    {assessment.timeLimitMinutes ? `${assessment.timeLimitMinutes} minutos` : 'Sin límite de tiempo'}
                  </span>
                </div>

                <div className="data-item">
                  <span className="data-item-label">Intentos Permitidos</span>
                  <span className="data-item-value">
                    {studentSummary?.effectiveMaxAttempts !== null && studentSummary?.effectiveMaxAttempts !== undefined
                      ? `${studentSummary.effectiveMaxAttempts} intentos`
                      : assessment.maxAttempts ? `${assessment.maxAttempts} intentos` : 'Ilimitados'}
                  </span>
                </div>

                <div className="data-item">
                  <span className="data-item-label">Calificación de Aprobación</span>
                  <span className="data-item-value">
                    {assessment.passingScore !== null ? `${assessment.passingScore}%` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <div className="assessment-card">
              <div className="assessment-card-header">
                <div className="assessment-card-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                </div>
                <h3>Periodo de Disponibilidad</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="data-item">
                  <span className="data-item-label">Disponible Desde</span>
                  <span className="data-item-value" style={{ fontSize: '0.95rem' }}>
                    {assessment.availableFrom ? formatDateDisplay(assessment.availableFrom) : 'Inmediatamente'}
                  </span>
                </div>

                <div className="data-item" style={{ paddingTop: '10px', borderTop: '1px dashed #e2e8f0' }}>
                  <span className="data-item-label">Disponible Hasta</span>
                  <span className="data-item-value" style={{ fontSize: '0.95rem' }}>
                    {assessment.availableUntil ? formatDateDisplay(assessment.availableUntil) : 'Sin fecha de cierre'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* TARJETA DE ESTADO DE INTENTOS PARA EL ALUMNO */}
          <div className="assessment-card" style={{ marginTop: '20px' }}>
            <div className="assessment-card-header">
              <div className="assessment-card-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
              <h3>Tus Intentos de Evaluación</h3>
            </div>

            {assessment.maxAttempts === null ? (
              <p style={{ margin: '12px 0 0 0', color: '#166534', fontWeight: 600 }}>
                Esta evaluación permite intentos ilimitados.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                    Intentos: {studentSummary ? studentSummary.attemptsUsed : 0} de {studentSummary?.effectiveMaxAttempts ?? assessment.maxAttempts} utilizados
                  </span>
                  {studentSummary && studentSummary.attemptsAvailable !== null && (
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        backgroundColor: studentSummary.attemptsAvailable === 0 ? '#fef2f2' : '#f0fdf4',
                        color: studentSummary.attemptsAvailable === 0 ? '#dc2626' : '#166534',
                        border: `1px solid ${studentSummary.attemptsAvailable === 0 ? '#fecaca' : '#bbf7d0'}`,
                      }}
                    >
                      {studentSummary.attemptsAvailable} {studentSummary.attemptsAvailable === 1 ? 'disponible' : 'disponibles'}
                    </span>
                  )}
                  {studentSummary && studentSummary.additionalAttemptsGranted > 0 && (
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        backgroundColor: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #bfdbfe',
                      }}
                    >
                      +{studentSummary.additionalAttemptsGranted} extra concedido
                    </span>
                  )}
                </div>

                {studentSummary && studentSummary.attemptsAvailable === 0 && (
                  <div
                    style={{
                      padding: '16px',
                      backgroundColor: '#fffbebfb',
                      border: '1px solid #fef3c7',
                      borderRadius: '8px',
                      color: '#92400e',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      marginTop: '4px',
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                      <line x1="12" y1="9" x2="12" y2="13"></line>
                      <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <div>
                      <strong style={{ display: 'block', marginBottom: '2px' }}>Sin intentos disponibles</strong>
                      Si tuviste una contingencia durante la evaluación, solicita un intento adicional a tu docente.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="assessment-actions" style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-primary btn-large"
              onClick={handleStartOrResume}
              disabled={starting || (studentSummary !== null && studentSummary.attemptsAvailable === 0)}
              style={{ width: 'auto', padding: '14px 32px', fontSize: '1.05rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              {starting && <ButtonSpinner size={18} />}
              {starting ? 'Iniciando...' : studentSummary?.attemptsAvailable === 0 ? 'Sin Intentos Disponibles' : 'Comenzar / Reanudar Evaluación'}
            </button>
          </div>
        </>
      )}

      {/* Modal para Conceder Intento Adicional (Docentes/Admin) */}
      <GrantAttemptModal
        isOpen={isGrantModalOpen}
        onClose={() => {
          setIsGrantModalOpen(false);
          setSelectedStudentForGrant(null);
        }}
        onSuccess={(updatedSummary) => {
          setStudentSummaries((prev) =>
            prev.map((s) => (s.studentId === updatedSummary.studentId ? updatedSummary : s))
          );
          setActionSuccess(`Intento adicional concedido exitosamente a ${updatedSummary.studentName}.`);
        }}
        assessmentId={assessmentId!}
        assessmentTitle={assessment.title}
        student={selectedStudentForGrant}
      />

      {/* Modal de Edición de Evaluación */}
      {isEditModalOpen && (
        <div className="assessment-edit-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setIsEditModalOpen(false); }}>
          <div className="assessment-edit-modal-card">
            {/* Header del Modal */}
            <div className="assessment-edit-modal-header">
              <div className="assessment-edit-modal-header-left">
                <div className="assessment-edit-modal-header-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </div>
                <div>
                  <h3 className="assessment-edit-modal-title">Editar Evaluación</h3>
                  <p className="assessment-edit-modal-subtitle">Actualiza la configuración general, calificación, tiempo y disponibilidad</p>
                </div>
              </div>
              <button
                type="button"
                className="assessment-edit-modal-close"
                onClick={() => setIsEditModalOpen(false)}
                aria-label="Cerrar modal"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Form & Body */}
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="assessment-edit-modal-body">
                {editError && (
                  <div className="alert alert-error" style={{ marginBottom: '0' }}>
                    {editError}
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
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Ej. Evaluación Final del Módulo"
                      required
                    />
                  </div>

                  <div className="assessment-edit-field">
                    <label className="assessment-edit-label">Descripción / Instrucciones</label>
                    <textarea
                      className="assessment-edit-textarea"
                      rows={3}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Indicaciones y alcance de la evaluación..."
                    />
                  </div>

                  <div className="assessment-edit-field">
                    <label className="assessment-edit-label">
                      <span>Tipo de Evaluación <span className="assessment-edit-label-required">*</span></span>
                    </label>
                    <div className="assessment-edit-select-wrapper">
                      <select
                        className="assessment-edit-select"
                        value={editType}
                        onChange={(e) => setEditType(e.target.value as AssessmentType)}
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
                        value={editWeight}
                        onChange={(e) => setEditWeight(e.target.value)}
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
                        placeholder="ej. 70"
                        className="assessment-edit-input"
                        value={editPassingScore}
                        onChange={(e) => setEditPassingScore(e.target.value)}
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
                      <div className={`assessment-edit-checkbox-card ${editUnlimitedTime ? 'is-checked' : ''}`}>
                        <input
                          type="checkbox"
                          id="editUnlimitedTime"
                          className="assessment-edit-checkbox-input"
                          checked={editUnlimitedTime}
                          onChange={(e) => setEditUnlimitedTime(e.target.checked)}
                        />
                        <label htmlFor="editUnlimitedTime" className="assessment-edit-checkbox-label-text">
                          Sin límite de tiempo
                        </label>
                      </div>
                      {!editUnlimitedTime && (
                        <input
                          type="number"
                          min="1"
                          placeholder="Minutos"
                          className="assessment-edit-input"
                          value={editTimeLimitMinutes}
                          onChange={(e) => setEditTimeLimitMinutes(e.target.value)}
                        />
                      )}
                      <div className="assessment-edit-help-text">
                        {editUnlimitedTime ? 'El estudiante dispone de tiempo ilimitado para responder.' : 'Se enviará automáticamente al finalizar el tiempo.'}
                      </div>
                    </div>

                    <div className="assessment-edit-field">
                      <label className="assessment-edit-label">Intentos Máximos</label>
                      <div className={`assessment-edit-checkbox-card ${editUnlimitedAttempts ? 'is-checked' : ''}`}>
                        <input
                          type="checkbox"
                          id="editUnlimitedAttempts"
                          className="assessment-edit-checkbox-input"
                          checked={editUnlimitedAttempts}
                          onChange={(e) => setEditUnlimitedAttempts(e.target.checked)}
                        />
                        <label htmlFor="editUnlimitedAttempts" className="assessment-edit-checkbox-label-text">
                          Intentos ilimitados
                        </label>
                      </div>
                      {!editUnlimitedAttempts && (
                        <input
                          type="number"
                          min="1"
                          placeholder="Cantidad de intentos"
                          className="assessment-edit-input"
                          value={editMaxAttempts}
                          onChange={(e) => setEditMaxAttempts(e.target.value)}
                        />
                      )}
                      <div className="assessment-edit-help-text">
                        {editUnlimitedAttempts ? 'El estudiante podrá realizar intentos sin límite.' : 'Límite máximo de intentos permitidos por alumno.'}
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
                        value={editAvailableFrom}
                        onChange={(e) => setEditAvailableFrom(e.target.value)}
                      />
                      <div className="assessment-edit-help-text">Apertura para iniciar nuevos intentos.</div>
                    </div>

                    <div className="assessment-edit-field">
                      <label className="assessment-edit-label">Disponible Hasta</label>
                      <input
                        type="datetime-local"
                        className="assessment-edit-input"
                        value={editAvailableUntil}
                        onChange={(e) => setEditAvailableUntil(e.target.value)}
                      />
                      <div className="assessment-edit-help-text">Cierre para iniciar nuevos intentos.</div>
                    </div>
                  </div>

                  {!editAvailableFrom && !editAvailableUntil && (
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
                        name="editPublishOption"
                        value="draft"
                        checked={editPublishOption === 'draft'}
                        onChange={() => setEditPublishOption('draft')}
                      />
                      <span>Guardar como borrador (no visible para alumnos)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                      <input
                        type="radio"
                        name="editPublishOption"
                        value="now"
                        checked={editPublishOption === 'now'}
                        onChange={() => setEditPublishOption('now')}
                      />
                      <span>Publicar inmediatamente</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                      <input
                        type="radio"
                        name="editPublishOption"
                        value="scheduled"
                        checked={editPublishOption === 'scheduled'}
                        onChange={() => setEditPublishOption('scheduled')}
                      />
                      <span>Programar publicación</span>
                    </label>
                  </div>

                  {editPublishOption === 'scheduled' && (
                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <label className="assessment-edit-label" htmlFor="edit-ass-scheduled-date" style={{ fontSize: '0.8rem' }}>
                          Fecha de publicación
                        </label>
                        <input
                          id="edit-ass-scheduled-date"
                          type="date"
                          className="assessment-edit-input"
                          value={editScheduledDate}
                          onChange={(e) => setEditScheduledDate(e.target.value)}
                          required
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="assessment-edit-label" htmlFor="edit-ass-scheduled-time" style={{ fontSize: '0.8rem' }}>
                          Hora de publicación
                        </label>
                        <input
                          id="edit-ass-scheduled-time"
                          type="time"
                          className="assessment-edit-input"
                          value={editScheduledTime}
                          onChange={(e) => setEditScheduledTime(e.target.value)}
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
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={editSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={editSubmitting}
                >
                  {editSubmitting ? 'Guardando...' : 'Guardar Cambios →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {isDeleteModalOpen && (
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
            className="dashboard-card"
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: 'var(--color-surface, #ffffff)',
              borderRadius: '8px',
              padding: '24px',
            }}
          >
            <h3 style={{ color: '#dc2626', marginBottom: '12px' }}>🗑️ Eliminar Evaluación</h3>
            <p style={{ marginBottom: '16px', fontSize: '0.9rem', color: 'var(--color-text)' }}>
              ¿Eliminar esta evaluación? Esta acción modificará la estructura del curso. Confirma que deseas continuar.
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ backgroundColor: '#dc2626', borderColor: '#b91c1c' }}
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Creación / Edición de Preguntas */}
      <QuestionFormModal
        isOpen={isQuestionFormOpen}
        onClose={() => setIsQuestionFormOpen(false)}
        assessmentId={assessmentId || ''}
        initialData={selectedQuestionForEdit}
        onSuccess={handleQuestionSaved}
      />

      {/* Drawer de Banco de Preguntas */}
      <QuestionBankDrawer
        isOpen={isBankDrawerOpen}
        onClose={() => setIsBankDrawerOpen(false)}
        assessmentId={assessmentId || ''}
        existingQuestionIds={questions.map((q) => q.questionId)}
        onQuestionAdded={handleQuestionAddedFromBank}
      />
    </div>
  );
};
