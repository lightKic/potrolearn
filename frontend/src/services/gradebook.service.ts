import { apiFetch } from './api.js';
import { TeacherGradebookDTO, StudentGradesDTO } from '../types/gradebook.js';

export const GradebookServiceAPI = {
  getTeacherGradebook: async (
    courseId: string,
    params?: { status?: string; search?: string }
  ): Promise<TeacherGradebookDTO> => {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'ALL') {
      query.append('status', params.status);
    }
    if (params?.search && params.search.trim()) {
      query.append('search', params.search.trim());
    }
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return apiFetch<TeacherGradebookDTO>(`/courses/${courseId}/gradebook${queryString}`, {
      method: 'GET',
    });
  },

  getStudentGrades: async (courseId: string): Promise<StudentGradesDTO> => {
    return apiFetch<StudentGradesDTO>(`/courses/${courseId}/my-grades`, {
      method: 'GET',
    });
  },
};
