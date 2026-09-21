import { apiFetch } from './api.js';
import {
  StudentAssessmentDTO,
  AttemptDTO,
  SaveAnswerInput,
  AttemptAnswerDTO,
  AssessmentAttemptItemDTO,
  TeacherAttemptDTO,
  GradeAnswerInput,
  CreateAssessmentInput,
  UpdateAssessmentInput,
  CreateAttemptGrantInput,
  AssessmentAttemptGrantDTO,
  StudentAttemptSummaryDTO,
  StudentAttemptSummaryItemDTO,
  CrosswordGeneratorResultDTO,
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

  abandonAttempt: async (attemptId: string): Promise<AttemptDTO> => {
    return apiFetch<AttemptDTO>(`/attempts/${attemptId}/abandon`, { method: 'POST' });
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

  createAssessment: async (courseId: string, input: CreateAssessmentInput): Promise<StudentAssessmentDTO> => {
    return apiFetch<StudentAssessmentDTO>(`/courses/${courseId}/assessments`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateAssessment: async (assessmentId: string, input: UpdateAssessmentInput): Promise<StudentAssessmentDTO> => {
    return apiFetch<StudentAssessmentDTO>(`/assessments/${assessmentId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  togglePublication: async (assessmentId: string, isPublished: boolean): Promise<StudentAssessmentDTO> => {
    return apiFetch<StudentAssessmentDTO>(`/assessments/${assessmentId}/publication`, {
      method: 'PATCH',
      body: JSON.stringify({ isPublished }),
    });
  },

  deleteAssessment: async (assessmentId: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/assessments/${assessmentId}`, {
      method: 'DELETE',
    });
  },

  getMyAttemptSummary: async (assessmentId: string): Promise<StudentAttemptSummaryDTO> => {
    return apiFetch<StudentAttemptSummaryDTO>(`/assessments/${assessmentId}/my-attempt-summary`, { method: 'GET' });
  },

  createAttemptGrant: async (
    assessmentId: string,
    studentId: string,
    input: CreateAttemptGrantInput
  ): Promise<StudentAttemptSummaryItemDTO> => {
    return apiFetch<StudentAttemptSummaryItemDTO>(`/assessments/${assessmentId}/students/${studentId}/attempt-grants`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  getAssessmentStudentsAttemptSummary: async (
    assessmentId: string
  ): Promise<StudentAttemptSummaryItemDTO[]> => {
    return apiFetch<StudentAttemptSummaryItemDTO[]>(`/assessments/${assessmentId}/students-attempt-summary`, { method: 'GET' });
  },

  getStudentGrantHistory: async (
    assessmentId: string,
    studentId: string
  ): Promise<AssessmentAttemptGrantDTO[]> => {
    return apiFetch<AssessmentAttemptGrantDTO[]>(`/assessments/${assessmentId}/students/${studentId}/attempt-grants`, { method: 'GET' });
  },

  generateCrosswordPreview: async (
    assessmentId: string,
    seed?: string | number
  ): Promise<CrosswordGeneratorResultDTO> => {
    return apiFetch<CrosswordGeneratorResultDTO>(`/assessments/${assessmentId}/generate-crossword-preview`, {
      method: 'POST',
      body: JSON.stringify({ seed }),
    });
  },

  checkCrosswordValidation: async (
    attemptId: string,
    answers?: Array<{ questionId: string; textValue: string }>
  ): Promise<Record<string, 'CORRECT' | 'INCORRECT' | 'PENDING'>> => {
    const res = await apiFetch<{
      validationMap: Record<string, 'CORRECT' | 'INCORRECT' | 'PENDING'>;
    }>(`/attempts/${attemptId}/crossword/check`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
    return res.validationMap;
  },
};


