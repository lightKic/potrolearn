import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AssessmentServiceAPI } from '../services/assessment.service.js';
import { StudentAssessmentDTO } from '../types/assessment.js';
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
  const isExam = assessment.type === 'EXAM';

  return (
    <div className="assessment-detail-page">
      <div className="page-header">
        <Link to={`/app/courses/${courseId}`} className="back-link">
          ← Volver al Curso
        </Link>
        <span className={`badge ${isExam ? 'badge-exam' : 'badge-quiz'}`}>
          {isExam ? 'Examen' : 'Cuestionario'}
        </span>
      </div>

      <h1 className="assessment-title">{assessment.title}</h1>
      {assessment.description && <p className="assessment-description">{assessment.description}</p>}

      <div className="assessment-info-card">
        <h3>Información General</h3>
        <ul className="info-grid">
          <li>
            <strong>Número de Preguntas:</strong> {questionCount}
          </li>
          <li>
            <strong>Tiempo Límite:</strong>{' '}
            {assessment.timeLimitMinutes ? `${assessment.timeLimitMinutes} minutos` : 'Sin límite'}
          </li>
          <li>
            <strong>Intentos Máximos:</strong>{' '}
            {assessment.maxAttempts ? assessment.maxAttempts : 'Ilimitados'}
          </li>
          <li>
            <strong>Calificación de Aprobación:</strong>{' '}
            {assessment.passingScore !== null ? `${assessment.passingScore} / 100` : 'N/A'}
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
          <Link
            to={courseId ? `/app/courses/${courseId}/assessments/${assessmentId}/grading` : `/app/assessments/${assessmentId}/grading`}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 18px', fontWeight: 700 }}
          >
            📋 Centro de Calificación / Revisar Intentos
          </Link>
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
    </div>
  );
};

