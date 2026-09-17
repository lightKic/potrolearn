import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lesson } from '../types/academic.js';
import { CourseServiceAPI } from '../services/course.service.js';
import { useAuth } from '../auth/useAuth.js';
import { ApiError } from '../services/api.js';
import { MarkdownContent } from '../components/MarkdownContent.js';

export const LessonDetailPage: React.FC = () => {
  const { courseId, moduleId, lessonId } = useParams<{ courseId: string; moduleId: string; lessonId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [togglingProgress, setTogglingProgress] = useState(false);

  useEffect(() => {
    const fetchLesson = async () => {
      if (!courseId || !moduleId || !lessonId) return;
      setLoading(true);
      setErrorMessage(null);
      try {
        const data = await CourseServiceAPI.getLessonDetail(courseId, moduleId, lessonId);
        setLesson(data);
      } catch (err) {
        if (err instanceof ApiError) {
          setErrorMessage(err.message);
        } else {
          setErrorMessage('No fue posible cargar el detalle de la lección.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLesson();
  }, [courseId, moduleId, lessonId]);

  const handleToggleProgress = async () => {
    if (!courseId || !moduleId || !lessonId || !lesson) return;
    setTogglingProgress(true);
    const targetState = !lesson.completed;
    try {
      await CourseServiceAPI.toggleLessonProgress(courseId, moduleId, lessonId, targetState);
      setLesson({ ...lesson, completed: targetState });
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      } else {
        alert('Error al actualizar el progreso de la lección.');
      }
    } finally {
      setTogglingProgress(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-content" style={{ padding: '60px 0' }}>
        <div className="loading-spinner" />
        <p className="loading-text">Cargando lección...</p>
      </div>
    );
  }

  if (errorMessage || !lesson) {
    return (
      <div className="error-page-container">
        <div className="alert alert-danger" style={{ maxWidth: '440px', margin: '0 auto 20px' }}>
          {errorMessage || 'Lección no encontrada.'}
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate(`/app/courses/${courseId}`)}
        >
          ← Volver al curso
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate(`/app/courses/${courseId}`)}
        >
          ← Volver a {lesson.courseName || 'Curso'}
        </button>

        {user?.role === 'STUDENT' && (
          <button
            type="button"
            className={lesson.completed ? 'btn-secondary' : 'btn-primary'}
            style={{
              width: 'auto',
              backgroundColor: lesson.completed ? '#ecfdf5' : undefined,
              borderColor: lesson.completed ? '#10b981' : undefined,
              color: lesson.completed ? '#047857' : undefined,
              fontWeight: 600,
            }}
            onClick={handleToggleProgress}
            disabled={togglingProgress}
          >
            {togglingProgress
              ? 'Guardando...'
              : lesson.completed
              ? '✓ Lección completada (Marcar pendiente)'
              : 'Marcar como completada'}
          </button>
        )}
      </div>

      <div className="dashboard-card" style={{ padding: '32px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span className="role-pill teacher" style={{ fontSize: '0.75rem' }}>
            {lesson.moduleTitle || 'Módulo'}
          </span>
          <span className="role-pill student" style={{ fontSize: '0.75rem' }}>
            Lección #{lesson.order}
          </span>
          {lesson.completed && (
            <span className="role-pill student" style={{ backgroundColor: '#ecfdf5', color: '#047857', fontSize: '0.75rem' }}>
              ✓ Completada
            </span>
          )}
        </div>

        <h1 className="page-title" style={{ fontSize: '1.75rem', marginBottom: '12px' }}>
          {lesson.title}
        </h1>

        {lesson.description && (
          <p className="page-description" style={{ marginBottom: '24px', fontSize: '1rem', color: 'var(--color-muted)' }}>
            {lesson.description}
          </p>
        )}

        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '24px', minHeight: '180px' }}>
          <MarkdownContent content={lesson.content} />
        </div>
      </div>
    </div>
  );
};
