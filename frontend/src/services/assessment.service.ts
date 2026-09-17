import { apiFetch } from './api.js';
import {
  StudentAssessmentDTO,
  AttemptDTO,
  SaveAnswerInput,
  AttemptAnswerDTO,
  AssessmentAttemptItemDTO,
  TeacherAttemptDTO,
  GradeAnswerInput,
} from '../types/assessment.js';

export const AssessmentServiceAPI = {
  getCourseAssessments: async (courseId: string): Promise<StudentAssessmentDTO[]> => {
    return apiFetch<StudentAssessmentDTO[]>(`/courses/${courseId}/assessments`, { method: 'GET' });
  },

  getAssessmentDetail: async (assessmentId: string): Promise<StudentAssessmentDTO> => {
    return apiFetch<StudentAssessmentDTO>(`/assessments/${assessmentId}`, { method: 'GET' });
  },

  startOrResumeAttempt: async (assessmentId: string): Promise<AttemptDTO> => {
    return apiFetch<AttemptDTO>(`/assessments/${assessmentId}/attempts`, { method: 'POST' });
  },

  getAttempt: async (attemptId: string): Promise<AttemptDTO> => {
    return apiFetch<AttemptDTO>(`/attempts/${attemptId}`, { method: 'GET' });
  },

  saveAnswer: async (attemptId: string, questionId: string, input: SaveAnswerInput): Promise<AttemptAnswerDTO> => {
    return apiFetch<AttemptAnswerDTO>(`/attempts/${attemptId}/answers/${questionId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  submitAttempt: async (attemptId: string): Promise<AttemptDTO> => {
    return apiFetch<AttemptDTO>(`/attempts/${attemptId}/submit`, { method: 'POST' });
  },

  getAssessmentAttemptsForReview: async (
    assessmentId: string,
    statusFilter?: string
  ): Promise<AssessmentAttemptItemDTO[]> => {
    const query = statusFilter && statusFilter !== 'ALL' ? `?status=${encodeURIComponent(statusFilter)}` : '';
    return apiFetch<AssessmentAttemptItemDTO[]>(`/assessments/${assessmentId}/attempts${query}`, { method: 'GET' });
  },

  getAttemptReviewForTeacher: async (attemptId: string): Promise<TeacherAttemptDTO> => {
    return apiFetch<TeacherAttemptDTO>(`/attempts/${attemptId}/review`, { method: 'GET' });
  },

  gradeAnswer: async (
    attemptId: string,
    questionId: string,
    input: GradeAnswerInput
  ): Promise<TeacherAttemptDTO> => {
    return apiFetch<TeacherAttemptDTO>(`/attempts/${attemptId}/answers/${questionId}/grade`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },
};

