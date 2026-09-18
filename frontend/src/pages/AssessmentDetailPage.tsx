import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AssessmentServiceAPI } from '../services/assessment.service.js';
import { StudentAssessmentDTO, AssessmentType } from '../types/assessment.js';
import { ApiError } from '../services/api.js';
import { useAuth } from '../auth/useAuth.js';

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
  const [editUnlimitedAttempts, setEditUnlimitedAttempts] = useState(true);
  const [editUnlimitedTime, setEditUnlimitedTime] = useState(true);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Estados para Publicación y Eliminación
  const [togglingPublication, setTogglingPublication] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isTeacherOrAdmin = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  useEffect(() => {
    if (!assessmentId) return;

    let isMounted = true;
    setLoading(true);

    AssessmentServiceAPI.getAssessmentDetail(assessmentId)
      .then((data) => {
        if (isMounted) {
          setAssessment(data);
          setError(null);
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
  }, [assessmentId]);

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
    return (
      <div className="loading-container" id="assessment-detail-loading">
        <div className="loading-spinner" />
        <p>Cargando evaluación...</p>
      </div>
    );
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

  const questionCount = assessment.questions ? assessment.questions.length : 0;

  const getTypeLabel = (type: AssessmentType): string => {
    switch (type) {
      case 'EXAM': return 'Examen 📝';
      case 'QUIZ': return 'Cuestionario ❓';
      case 'DIAGNOSTIC': return 'Diagnóstico 🔍';
      case 'PRACTICE': return 'Práctica 🏋️';
      case 'FINAL': return 'Evaluación Final 🎓';
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

  return (
    <div className="assessment-detail-page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <Link to={`/app/courses/${courseId}`} className="back-link">
          ← Volver al Curso
        </Link>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="badge" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: 600 }}>
            {getTypeLabel(assessment.type)}
          </span>
          {isTeacherOrAdmin && (
            <span
              className="badge"
              style={{
                backgroundColor: assessment.isPublished ? '#ecfdf5' : '#fffbeb',
                color: assessment.isPublished ? '#047857' : '#b45309',
                border: `1px solid ${assessment.isPublished ? '#a7f3d0' : '#fde68a'}`,
              }}
            >
              {assessment.isPublished ? 'Publicada 🟢' : 'Borrador 🟡'}
            </span>
          )}
        </div>
      </div>

      <h1 className="assessment-title">{assessment.title}</h1>
      {assessment.description && <p className="assessment-description">{assessment.description}</p>}

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

      <div className="assessment-info-card">
        <h3>Información General</h3>
        <ul className="info-grid">
          <li>
            <strong>Estado:</strong> {assessment.isPublished ? 'Publicada 🟢' : 'Borrador 🟡'}
          </li>
          <li>
            <strong>Tipo de Evaluación:</strong> {getTypeLabel(assessment.type)}
          </li>
          <li>
            <strong>Número de Preguntas:</strong> {questionCount}
          </li>
          <li>
            <strong>Ponderación:</strong> {assessment.weight}%
          </li>
          <li>
            <strong>Tiempo Límite:</strong>{' '}
            {assessment.timeLimitMinutes ? `${assessment.timeLimitMinutes} minutos` : 'Sin límite de tiempo'}
          </li>
          <li>
            <strong>Intentos Máximos:</strong>{' '}
            {assessment.maxAttempts ? `${assessment.maxAttempts} intentos` : 'Ilimitados'}
          </li>
          <li>
            <strong>Calificación de Aprobación:</strong>{' '}
            {assessment.passingScore !== null ? `${assessment.passingScore}%` : 'N/A'}
          </li>
          <li>
            <strong>Disponible Desde:</strong>{' '}
            {assessment.availableFrom ? formatDateDisplay(assessment.availableFrom) : 'Sin fecha de apertura (Inmediatamente)'}
          </li>
          <li>
            <strong>Disponible Hasta:</strong>{' '}
            {assessment.availableUntil ? formatDateDisplay(assessment.availableUntil) : 'Sin fecha de cierre'}
          </li>
          {assessment.totalPoints !== undefined && (
            <li>
              <strong>Total de Puntos:</strong> {assessment.totalPoints} pts
            </li>
          )}
        </ul>
      </div>

      <div className="assessment-actions" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '24px' }}>
        {isTeacherOrAdmin && (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={openEditModal}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontWeight: 600 }}
            >
              ✏️ Editar Evaluación
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleTogglePublication}
              disabled={togglingPublication}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontWeight: 600 }}
            >
              {togglingPublication
                ? 'Procesando...'
                : assessment.isPublished
                ? '🔴 Despublicar'
                : '🟢 Publicar'}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsDeleteModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontWeight: 600, color: '#dc2626', borderColor: '#fca5a5' }}
            >
              🗑️ Eliminar Evaluación
            </button>

            <Link
              to={courseId ? `/app/courses/${courseId}/assessments/${assessmentId}/grading` : `/app/assessments/${assessmentId}/grading`}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontWeight: 700 }}
            >
              📋 Centro de Calificación / Revisar Intentos
            </Link>
          </>
        )}

        {user?.role === 'STUDENT' && (
          <button
            type="button"
            className="btn btn-primary btn-large"
            onClick={handleStartOrResume}
            disabled={starting}
            style={{ width: 'auto' }}
          >
            {starting ? 'Iniciando...' : 'Comenzar / Reanudar Evaluación'}
          </button>
        )}
      </div>

      {/* Modal de Edición de Evaluación */}
      {isEditModalOpen && (
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
              maxWidth: '620px',
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: 'var(--color-surface, #ffffff)',
              borderRadius: '12px',
              padding: '28px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }}
          >
            <h3 style={{ marginBottom: '20px', fontSize: '1.25rem', fontWeight: 700, borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
              ✏️ Editar Evaluación
            </h3>

            {editError && (
              <div className="alert alert-error" style={{ marginBottom: '20px' }}>
                {editError}
              </div>
            )}

            <form onSubmit={handleEditSubmit}>
              {/* Sección 1: Información General */}
              <div style={{ marginBottom: '22px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155', marginBottom: '14px' }}>
                  📝 Información General
                </h4>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '0.875rem' }}>
                    Título de la Evaluación *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                  />
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '0.875rem' }}>
                    Descripción / Instrucciones
                  </label>
                  <textarea
                    className="input-field"
                    rows={3}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '0.875rem' }}>
                    Tipo de Evaluación *
                  </label>
                  <select
                    className="input-field"
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as AssessmentType)}
                  >
                    <option value="EXAM">Examen 📝</option>
                    <option value="QUIZ">Cuestionario ❓</option>
                    <option value="DIAGNOSTIC">Diagnóstico 🔍</option>
                    <option value="PRACTICE">Práctica 🏋️</option>
                    <option value="FINAL">Evaluación Final 🎓</option>
                  </select>
                </div>
              </div>

              {/* Sección 2: Calificación y Ponderación */}
              <div style={{ marginBottom: '22px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155', marginBottom: '14px' }}>
                  📊 Calificación y Ponderación
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', fontSize: '0.875rem' }}>
                      Ponderación (%) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      className="input-field"
                      value={editWeight}
                      onChange={(e) => setEditWeight(e.target.value)}
                      required
                    />
                    <small style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginTop: '4px' }}>
                      Porcentaje de la calificación final que representa.
                    </small>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', fontSize: '0.875rem' }}>
                      Calificación Aprobatoria (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="ej. 60"
                      className="input-field"
                      value={editPassingScore}
                      onChange={(e) => setEditPassingScore(e.target.value)}
                    />
                    <small style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginTop: '4px' }}>
                      Porcentaje mínimo para aprobar (opcional).
                    </small>
                  </div>
                </div>
              </div>

              {/* Sección 3: Tiempo e Intentos */}
              <div style={{ marginBottom: '22px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155', marginBottom: '14px' }}>
                  ⏱️ Tiempo e Intentos
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '0.875rem' }}>
                      Tiempo Límite (minutos)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <input
                        type="checkbox"
                        id="editUnlimitedTime"
                        checked={editUnlimitedTime}
                        onChange={(e) => setEditUnlimitedTime(e.target.checked)}
                      />
                      <label htmlFor="editUnlimitedTime" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                        Sin límite de tiempo
                      </label>
                    </div>
                    {!editUnlimitedTime && (
                      <input
                        type="number"
                        min="1"
                        placeholder="Minutos"
                        className="input-field"
                        value={editTimeLimitMinutes}
                        onChange={(e) => setEditTimeLimitMinutes(e.target.value)}
                      />
                    )}
                    <small style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginTop: '4px' }}>
                      {editUnlimitedTime ? 'El estudiante dispone de tiempo ilimitado para responder.' : 'Se enviará automáticamente al terminar el tiempo.'}
                    </small>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '0.875rem' }}>
                      Intentos Máximos
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <input
                        type="checkbox"
                        id="editUnlimitedAttempts"
                        checked={editUnlimitedAttempts}
                        onChange={(e) => setEditUnlimitedAttempts(e.target.checked)}
                      />
                      <label htmlFor="editUnlimitedAttempts" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                        Intentos ilimitados
                      </label>
                    </div>
                    {!editUnlimitedAttempts && (
                      <input
                        type="number"
                        min="1"
                        placeholder="Cantidad de intentos"
                        className="input-field"
                        value={editMaxAttempts}
                        onChange={(e) => setEditMaxAttempts(e.target.value)}
                      />
                    )}
                    <small style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginTop: '4px' }}>
                      {editUnlimitedAttempts ? 'El estudiante podrá realizar intentos sin límite.' : 'Límite máximo de intentos permitidos.'}
                    </small>
                  </div>
                </div>
              </div>

              {/* Sección 4: Disponibilidad */}
              <div style={{ marginBottom: '24px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155', marginBottom: '14px' }}>
                  📅 Disponibilidad (Ventana de Fechas)
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '0.85rem' }}>
                      Disponible Desde
                    </label>
                    <input
                      type="datetime-local"
                      className="input-field"
                      value={editAvailableFrom}
                      onChange={(e) => setEditAvailableFrom(e.target.value)}
                    />
                    <small style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginTop: '4px' }}>
                      Apertura para iniciar nuevos intentos.
                    </small>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '0.85rem' }}>
                      Disponible Hasta
                    </label>
                    <input
                      type="datetime-local"
                      className="input-field"
                      value={editAvailableUntil}
                      onChange={(e) => setEditAvailableUntil(e.target.value)}
                    />
                    <small style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginTop: '4px' }}>
                      Cierre para iniciar nuevos intentos.
                    </small>
                  </div>
                </div>

                {!editAvailableFrom && !editAvailableUntil && (
                  <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#0369a1', backgroundColor: '#e0f2fe', padding: '6px 12px', borderRadius: '6px' }}>
                    ℹ️ Disponible sin ventana de fechas.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
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
                  {editSubmitting ? 'Guardando...' : 'Guardar Cambios'}
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
    </div>
  );
};
