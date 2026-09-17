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
};
