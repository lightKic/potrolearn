import { apiFetch } from './api.js';
import {
  QuestionDTO,
  AssessmentDTO,
  AssessmentQuestionDTO,
  QuestionOptionDTO,
  CreateQuestionInput,
  UpdateQuestionInput,
  CreateQuestionOptionInput,
  UpdateQuestionOptionInput,
} from '../types/assessment.js';

export const QuestionServiceAPI = {
  /**
   * Obtiene todas las preguntas asociadas a una evaluación con su información completa de administración.
   */
  getQuestionsForAssessment: async (assessmentId: string): Promise<AssessmentQuestionDTO[]> => {
    const assessment = await apiFetch<AssessmentDTO>(`/assessments/${assessmentId}`, { method: 'GET' });
    return assessment.questions || [];
  },

  /**
   * Obtiene la lista de preguntas del Banco de Preguntas, opcionalmente filtrada por materia.
   */
  getQuestions: async (subjectId?: string): Promise<QuestionDTO[]> => {
    const query = subjectId ? `?subjectId=${encodeURIComponent(subjectId)}` : '';
    return apiFetch<QuestionDTO[]>(`/questions${query}`, { method: 'GET' });
  },

  /**
   * Obtiene los detalles completos de una pregunta por su ID.
   */
  getQuestionDetail: async (questionId: string): Promise<QuestionDTO> => {
    return apiFetch<QuestionDTO>(`/questions/${questionId}`, { method: 'GET' });
  },

  /**
   * Crea una nueva pregunta en el Banco de Preguntas.
   */
  createQuestion: async (input: CreateQuestionInput): Promise<QuestionDTO> => {
    return apiFetch<QuestionDTO>('/questions', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Actualiza los datos de una pregunta existente.
   */
  updateQuestion: async (questionId: string, input: UpdateQuestionInput): Promise<QuestionDTO> => {
    return apiFetch<QuestionDTO>(`/questions/${questionId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  /**
   * Asocia una pregunta del Banco a una evaluación específica.
   */
  addQuestionToAssessment: async (
    assessmentId: string,
    input: { questionId: string; points?: number; order?: number }
  ): Promise<AssessmentDTO> => {
    return apiFetch<AssessmentDTO>(`/assessments/${assessmentId}/questions`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Actualiza los puntos asignados a una pregunta dentro de una evaluación específica.
   */
  updateAssessmentQuestionPoints: async (
    assessmentId: string,
    questionId: string,
    points: number
  ): Promise<AssessmentDTO> => {
    return apiFetch<AssessmentDTO>(`/assessments/${assessmentId}/questions/${questionId}`, {
      method: 'PUT',
      body: JSON.stringify({ points }),
    });
  },

  /**
   * Crea una nueva opción para una pregunta.
   */
  createOption: async (questionId: string, input: CreateQuestionOptionInput): Promise<QuestionOptionDTO> => {
    return apiFetch<QuestionOptionDTO>(`/questions/${questionId}/options`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Actualiza una opción existente de una pregunta.
   */
  updateOption: async (
    questionId: string,
    optionId: string,
    input: UpdateQuestionOptionInput
  ): Promise<QuestionOptionDTO> => {
    return apiFetch<QuestionOptionDTO>(`/questions/${questionId}/options/${optionId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  /**
   * Elimina una opción de una pregunta.
   */
  deleteOption: async (questionId: string, optionId: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/questions/${questionId}/options/${optionId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Desasocia una pregunta de una evaluación específica.
   */
  removeQuestionFromAssessment: async (assessmentId: string, questionId: string): Promise<AssessmentDTO> => {
    return apiFetch<AssessmentDTO>(`/assessments/${assessmentId}/questions/${questionId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Reordena atómicamente las preguntas de una evaluación enviando la secuencia 1..N.
   */
  reorderAssessmentQuestions: async (
    assessmentId: string,
    items: Array<{ questionId: string; order: number }>
  ): Promise<AssessmentDTO> => {
    return apiFetch<AssessmentDTO>(`/assessments/${assessmentId}/questions/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ items }),
    });
  },
};
