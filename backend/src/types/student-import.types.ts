import { EnrollmentStatus } from '@prisma/client';

export type ImportRowStatus =
  | 'NEW'
  | 'EXISTING_TO_ENROLL'
  | 'ALREADY_ENROLLED'
  | 'CONFLICT'
  | 'INVALID';

export interface PreviewRowDTO {
  rowNumber: number;
  name: string;
  studentNumber: string;
  email: string;
  status: ImportRowStatus;
  reasonCode?: string;
  message?: string;
}

export interface PreviewSummaryDTO {
  total: number;
  new: number;
  existingToEnroll: number;
  alreadyEnrolled: number;
  conflicts: number;
  invalid: number;
}

export interface ImportPreviewResultDTO {
  summary: PreviewSummaryDTO;
  rows: PreviewRowDTO[];
}

export interface ConfirmRowInput {
  name: string;
  studentNumber: string;
  email: string;
}

export interface BulkConfirmResultRow {
  studentNumber: string;
  email: string;
  name: string;
  status: 'CREATED' | 'ENROLLED' | 'SKIPPED_ALREADY_ENROLLED' | 'SKIPPED_CONFLICT' | 'SKIPPED_INVALID';
  emailSent: boolean;
  message?: string;
}

export interface BulkConfirmResultDTO {
  totalProcessed: number;
  createdCount: number;
  enrolledExistingCount: number;
  skippedCount: number;
  results: BulkConfirmResultRow[];
}

export interface CourseStudentDTO {
  id: string; // User id
  name: string;
  email: string;
  studentNumber: string;
  enrollmentStatus: EnrollmentStatus;
  accountStatus: 'ACTIVE' | 'PENDING' | 'EXPIRED';
  invitationStatus: 'ACTIVE' | 'PENDING' | 'EXPIRED';
  activatedAt: Date | string | null;
  enrolledAt: Date | string;
}
