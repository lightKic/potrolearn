import { apiFetch } from './api.js';
import { Subject, CreateSubjectInput, UpdateSubjectInput } from '../types/academic.js';

export const SubjectServiceAPI = {
  getSubjects: async (): Promise<Subject[]> => {
    return apiFetch<Subject[]>('/subjects', { method: 'GET' });
  },

  getSubjectById: async (id: string): Promise<Subject> => {
    return apiFetch<Subject>(`/subjects/${id}`, { method: 'GET' });
  },

  createSubject: async (input: CreateSubjectInput): Promise<Subject> => {
    return apiFetch<Subject>('/subjects', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateSubject: async (id: string, input: UpdateSubjectInput): Promise<Subject> => {
    return apiFetch<Subject>(`/subjects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  getSubjectTeachers: async (subjectId: string) => {
    return apiFetch<{ id: string; subjectId: string; teacherId: string; teacher: { id: string; name: string; email: string } }[]>(
      `/subjects/${subjectId}/teachers`,
      { method: 'GET' }
    );
  },

  assignTeacherToSubject: async (subjectId: string, teacherId: string) => {
    return apiFetch<{ id: string; subjectId: string; teacherId: string; teacher: { id: string; name: string; email: string } }>(
      `/subjects/${subjectId}/teachers`,
      {
        method: 'POST',
        body: JSON.stringify({ teacherId }),
      }
    );
  },

  removeTeacherFromSubject: async (subjectId: string, teacherId: string) => {
    return apiFetch<{ message: string }>(`/subjects/${subjectId}/teachers/${teacherId}`, {
      method: 'DELETE',
    });
  },
};
