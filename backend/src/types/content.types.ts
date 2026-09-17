export interface CreateModuleInput {
  title: string;
  description?: string;
  isPublished?: boolean;
}

export interface UpdateModuleInput {
  title?: string;
  description?: string | null;
  isPublished?: boolean;
}

export interface CreateLessonInput {
  title: string;
  description?: string;
  content?: string;
  isPublished?: boolean;
}

export interface UpdateLessonInput {
  title?: string;
  description?: string | null;
  content?: string | null;
  isPublished?: boolean;
}

export interface LessonDTO {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  content: string | null;
  order: number;
  isPublished: boolean;
  completed?: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ModuleDTO {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  order: number;
  isPublished: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  lessons?: LessonDTO[];
}

export interface CourseContentDTO {
  courseId: string;
  courseName: string;
  status: string;
  modules: ModuleDTO[];
  progress?: {
    completedLessons: number;
    totalLessons: number;
    percentage: number;
  };
}
