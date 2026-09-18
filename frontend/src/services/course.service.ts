import { apiFetch } from './api.js';
import {
  Course,
  CreateCourseInput,
  UpdateCourseInput,
  CourseStatus,
  CourseTeacher,
  CourseStudent,
  EnrollStudentInput,
  EnrollStudentResult,
  ImportPreviewResult,
  BulkConfirmResult,
  Module,
  Lesson,
  CourseContent,
  CreateModuleInput,
  UpdateModuleInput,
  CreateLessonInput,
  UpdateLessonInput,
} from '../types/academic.js';

export interface AdminTeacher {
  id: string;
  name: string;
  email: string;
  role: string;
}

export const CourseServiceAPI = {
  getCourses: async (): Promise<Course[]> => {
    return apiFetch<Course[]>('/courses', { method: 'GET' });
  },

  getCourseDetail: async (courseId: string): Promise<Course> => {
    return apiFetch<Course>(`/courses/${courseId}`, { method: 'GET' });
  },

  createCourse: async (input: CreateCourseInput): Promise<Course> => {
    return apiFetch<Course>('/courses', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateCourse: async (courseId: string, input: UpdateCourseInput): Promise<Course> => {
    return apiFetch<Course>(`/courses/${courseId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  changeCourseStatus: async (courseId: string, status: CourseStatus): Promise<Course> => {
    return apiFetch<Course>(`/courses/${courseId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  getCourseTeachers: async (courseId: string): Promise<CourseTeacher[]> => {
    return apiFetch<CourseTeacher[]>(`/courses/${courseId}/teachers`, { method: 'GET' });
  },

  assignTeacher: async (courseId: string, teacherId: string): Promise<CourseTeacher> => {
    return apiFetch<CourseTeacher>(`/courses/${courseId}/teachers`, {
      method: 'POST',
      body: JSON.stringify({ teacherId }),
    });
  },

  removeTeacher: async (courseId: string, teacherId: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/courses/${courseId}/teachers/${teacherId}`, {
      method: 'DELETE',
    });
  },

  getAvailableTeachers: async (): Promise<AdminTeacher[]> => {
    const res = await apiFetch<{ teachers: AdminTeacher[] }>('/admin/teachers', { method: 'GET' });
    return res.teachers ?? [];
  },

  searchStudents: async (
    courseId: string,
    query: string,
  ): Promise<{ id: string; name: string; email: string; studentNumber: string; isAlreadyEnrolled: boolean }[]> => {
    return apiFetch<{ id: string; name: string; email: string; studentNumber: string; isAlreadyEnrolled: boolean }[]>(
      `/courses/${courseId}/search-students?query=${encodeURIComponent(query)}`,
      { method: 'GET' },
    );
  },

  getCourseStudents: async (courseId: string): Promise<CourseStudent[]> => {
    return apiFetch<CourseStudent[]>(`/courses/${courseId}/students`, { method: 'GET' });
  },

  enrollStudent: async (courseId: string, input: EnrollStudentInput): Promise<EnrollStudentResult> => {
    return apiFetch<EnrollStudentResult>(`/courses/${courseId}/students`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  previewStudentImport: async (courseId: string, file: File): Promise<ImportPreviewResult> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch<ImportPreviewResult>(`/courses/${courseId}/students/import/preview`, {
      method: 'POST',
      body: formData,
    });
  },

  confirmStudentImport: async (courseId: string, rows: { name: string; studentNumber: string; email: string }[]): Promise<BulkConfirmResult> => {
    return apiFetch<BulkConfirmResult>(`/courses/${courseId}/students/import/confirm`, {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
  },

  resendInvitation: async (courseId: string, studentId: string): Promise<{ emailSent: boolean }> => {
    return apiFetch<{ emailSent: boolean }>(`/courses/${courseId}/students/${studentId}/resend-invitation`, {
      method: 'POST',
    });
  },

  resetAccess: async (courseId: string, studentId: string): Promise<{ emailSent: boolean }> => {
    return apiFetch<{ emailSent: boolean }>(`/courses/${courseId}/students/${studentId}/reset-access`, {
      method: 'POST',
    });
  },

  getCourseContent: async (courseId: string): Promise<CourseContent> => {
    return apiFetch<CourseContent>(`/courses/${courseId}/content`, { method: 'GET' });
  },

  createModule: async (courseId: string, input: CreateModuleInput): Promise<Module> => {
    return apiFetch<Module>(`/courses/${courseId}/modules`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateModule: async (courseId: string, moduleId: string, input: UpdateModuleInput): Promise<Module> => {
    return apiFetch<Module>(`/courses/${courseId}/modules/${moduleId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  reorderModules: async (courseId: string, moduleIds: string[]): Promise<Module[]> => {
    return apiFetch<Module[]>(`/courses/${courseId}/modules/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ moduleIds }),
    });
  },

  createLesson: async (courseId: string, moduleId: string, input: CreateLessonInput): Promise<Lesson> => {
    return apiFetch<Lesson>(`/courses/${courseId}/modules/${moduleId}/lessons`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateLesson: async (courseId: string, moduleId: string, lessonId: string, input: UpdateLessonInput): Promise<Lesson> => {
    return apiFetch<Lesson>(`/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  reorderLessons: async (courseId: string, moduleId: string, lessonIds: string[]): Promise<Lesson[]> => {
    return apiFetch<Lesson[]>(`/courses/${courseId}/modules/${moduleId}/lessons/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ lessonIds }),
    });
  },

  getLessonDetail: async (courseId: string, moduleId: string, lessonId: string): Promise<Lesson> => {
    return apiFetch<Lesson>(`/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`, {
      method: 'GET',
    });
  },

  toggleLessonProgress: async (courseId: string, moduleId: string, lessonId: string, completed: boolean): Promise<{ completed: boolean }> => {
    return apiFetch<{ completed: boolean }>(`/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/progress`, {
      method: 'PUT',
      body: JSON.stringify({ completed }),
    });
  },
};
