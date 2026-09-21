export type CourseStatus = 'DRAFT' | 'ACTIVE' | 'FINISHED' | 'ARCHIVED';

export interface SubjectTeacher {
  id: string;
  subjectId: string;
  teacherId: string;
  assignedAt: string;
  teacher?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  subjectTeachers?: SubjectTeacher[];
}

export interface CreateSubjectInput {
  code: string;
  name: string;
  description?: string;
}

export interface UpdateSubjectInput {
  code?: string;
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface CourseTeacher {
  id: string;
  courseId: string;
  teacherId: string;
  assignedAt: string;
  teacher?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface Course {
  id: string;
  subjectId: string;
  createdById: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  status: CourseStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  subject?: Subject;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
  courseTeachers?: CourseTeacher[];
  _count?: {
    enrollments: number;
  };
}

export interface CreateCourseInput {
  subjectId: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
}

export interface UpdateCourseInput {
  subjectId?: string;
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
}

export type EnrollmentStatus = 'ACTIVE' | 'COMPLETED' | 'DROPPED';

export interface CourseStudent {
  id: string;
  name: string;
  email: string;
  studentNumber: string;
  enrollmentStatus: EnrollmentStatus;
  accountStatus: 'ACTIVE' | 'PENDING' | 'EXPIRED';
  invitationStatus: 'ACTIVE' | 'PENDING' | 'EXPIRED';
  activatedAt: string | null;
  enrolledAt: string;
}

export interface EnrollStudentInput {
  name: string;
  email: string;
  studentNumber: string;
}

export interface EnrollStudentResult {
  student: {
    id: string;
    name: string;
    email: string;
    studentNumber: string;
    activatedAt: string | null;
  };
  enrollment: {
    id: string;
    courseId: string;
    status: EnrollmentStatus;
  };
  isNewStudent: boolean;
  emailSent?: boolean;
}

export type ImportRowStatus = 'NEW' | 'EXISTING_TO_ENROLL' | 'ALREADY_ENROLLED' | 'CONFLICT' | 'INVALID';

export interface ImportPreviewRow {
  rowNumber: number;
  name: string;
  studentNumber: string;
  email: string;
  status: ImportRowStatus;
  reasonCode?: string;
  message?: string;
}

export interface ImportPreviewSummary {
  total: number;
  new: number;
  existingToEnroll: number;
  alreadyEnrolled: number;
  conflicts: number;
  invalid: number;
}

export interface ImportPreviewResult {
  summary: ImportPreviewSummary;
  rows: ImportPreviewRow[];
}

export interface BulkConfirmResultRow {
  studentNumber: string;
  email: string;
  name: string;
  status: 'CREATED' | 'ENROLLED' | 'SKIPPED_ALREADY_ENROLLED' | 'SKIPPED_CONFLICT' | 'SKIPPED_INVALID';
  emailSent: boolean;
  message?: string;
}

export interface BulkConfirmResult {
  totalProcessed: number;
  createdCount: number;
  enrolledExistingCount: number;
  skippedCount: number;
  results: BulkConfirmResultRow[];
}

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  content: string | null;
  order: number;
  isPublished: boolean;
  scheduledPublishAt?: string | null;
  publishedAt?: string | null;
  completed?: boolean;
  createdAt: string;
  updatedAt: string;
  moduleTitle?: string;
  courseName?: string;
}

export interface Module {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  order: number;
  isPublished: boolean;
  scheduledPublishAt?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  lessons?: Lesson[];
}

export interface CourseContent {
  courseId: string;
  courseName: string;
  status: CourseStatus;
  modules: Module[];
  progress?: {
    completedLessons: number;
    totalLessons: number;
    percentage: number;
  };
}

export interface CreateModuleInput {
  title: string;
  description?: string;
  isPublished?: boolean;
  scheduledPublishAt?: string | null;
}

export interface UpdateModuleInput {
  title?: string;
  description?: string;
  isPublished?: boolean;
  scheduledPublishAt?: string | null;
}

export interface CreateLessonInput {
  title: string;
  description?: string;
  content?: string;
  isPublished?: boolean;
  scheduledPublishAt?: string | null;
}

export interface UpdateLessonInput {
  title?: string;
  description?: string;
  content?: string;
  isPublished?: boolean;
  scheduledPublishAt?: string | null;
}

export interface ScheduleModuleContentItemInput {
  type: 'LESSON' | 'ASSESSMENT';
  id: string;
  scheduledPublishAt?: string | null;
  action?: 'SCHEDULE' | 'UNSCHEDULE';
}

export interface ScheduleModuleBatchInput {
  moduleScheduledPublishAt?: string | null;
  contents?: ScheduleModuleContentItemInput[];
}

export interface ScheduleModuleBatchResultItem {
  id: string;
  type: 'LESSON' | 'ASSESSMENT';
  scheduledPublishAt: string | null;
  isPublished: boolean;
}

export interface ScheduleModuleBatchResult {
  module: Module;
  contents: ScheduleModuleBatchResultItem[];
}

export interface PublishModuleNowInput {
  publishModuleOnly?: boolean;
  publishContentIds?: string[];
}

export interface PublishModuleNowResultItem {
  id: string;
  type: 'LESSON' | 'ASSESSMENT';
  isPublished: boolean;
}

export interface PublishModuleNowResult {
  module: Module;
  contents: PublishModuleNowResultItem[];
  publishedContentCount: number;
}

