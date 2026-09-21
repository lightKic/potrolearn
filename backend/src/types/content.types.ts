export interface CreateModuleInput {
  title: string;
  description?: string;
  isPublished?: boolean;
  scheduledPublishAt?: string | Date | null;
}

export interface UpdateModuleInput {
  title?: string;
  description?: string | null;
  isPublished?: boolean;
  scheduledPublishAt?: string | Date | null;
}

export interface CreateLessonInput {
  title: string;
  description?: string;
  content?: string;
  isPublished?: boolean;
  scheduledPublishAt?: string | Date | null;
}

export interface UpdateLessonInput {
  title?: string;
  description?: string | null;
  content?: string | null;
  isPublished?: boolean;
  scheduledPublishAt?: string | Date | null;
}

export interface LessonDTO {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  content: string | null;
  order: number;
  isPublished: boolean;
  scheduledPublishAt?: Date | string | null;
  publishedAt?: Date | string | null;
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
  scheduledPublishAt?: Date | string | null;
  publishedAt?: Date | string | null;
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

export type ScheduleContentAction = 'SCHEDULE' | 'UNSCHEDULE';

export interface ScheduleModuleContentItemInput {
  type: 'LESSON' | 'ASSESSMENT';
  id: string;
  action?: ScheduleContentAction;
  scheduledPublishAt?: string | Date | null;
}

export interface ScheduleModuleBatchInput {
  moduleScheduledPublishAt?: string | Date | null;
  contents?: ScheduleModuleContentItemInput[];
}

export interface ScheduleModuleBatchContentResultDTO {
  type: 'LESSON' | 'ASSESSMENT';
  id: string;
  title: string;
  isPublished: boolean;
  scheduledPublishAt: Date | string | null;
  publishedAt: Date | string | null;
}

export interface ScheduleModuleBatchResultDTO {
  module: {
    id: string;
    title: string;
    isPublished: boolean;
    scheduledPublishAt: Date | string | null;
    publishedAt: Date | string | null;
  };
  contents: ScheduleModuleBatchContentResultDTO[];
}

export interface PublishModuleNowInput {
  publishModuleOnly?: boolean;
  publishContentIds?: string[];
}

export interface PublishModuleNowResultDTO {
  module: {
    id: string;
    title: string;
    isPublished: boolean;
    scheduledPublishAt: Date | string | null;
    publishedAt: Date | string | null;
  };
  publishedContentCount: number;
  contents: ScheduleModuleBatchContentResultDTO[];
}
