import { AssessmentType, QuestionType } from '@prisma/client';

export interface CrosswordLayoutEntry {
  questionId: string;
  number: number;
  direction: 'ACROSS' | 'DOWN';
  startRow: number;
  startCol: number;
  length: number;
  answerNormalized: string;
}

export interface CrosswordLayout {
  gridSize: {
    rows: number;
    columns: number;
  };
  entries: CrosswordLayoutEntry[];
}

export interface StudentCrosswordLayoutEntry {
  questionId: string;
  number: number;
  direction: 'ACROSS' | 'DOWN';
  startRow: number;
  startCol: number;
  length: number;
}

export interface StudentCrosswordLayout {
  gridSize: {
    rows: number;
    columns: number;
  };
  entries: StudentCrosswordLayoutEntry[];
}

export interface CreateAssessmentInput {
  title: string;
  description?: string | null;
  type: AssessmentType;
  weight?: number;
  moduleId?: string | null;
  lessonId?: string | null;
  availableFrom?: string | Date | null;
  availableUntil?: string | Date | null;
  timeLimitMinutes?: number | null;
  maxAttempts?: number | null;
  passingScore?: number | null;
  isPublished?: boolean;
  scheduledPublishAt?: string | Date | null;
  crosswordLayout?: CrosswordLayout | null;
}

export interface UpdateAssessmentInput {
  title?: string;
  description?: string | null;
  type?: AssessmentType;
  weight?: number;
  moduleId?: string | null;
  lessonId?: string | null;
  availableFrom?: string | Date | null;
  availableUntil?: string | Date | null;
  timeLimitMinutes?: number | null;
  maxAttempts?: number | null;
  passingScore?: number | null;
  isPublished?: boolean;
  scheduledPublishAt?: string | Date | null;
  crosswordLayout?: CrosswordLayout | null;
}

export interface CreateQuestionOptionInput {
  text: string;
  isCorrect: boolean;
  explanation?: string | null;
  order?: number;
}

export interface UpdateQuestionOptionInput {
  text?: string;
  isCorrect?: boolean;
  explanation?: string | null;
  order?: number;
}

export interface CreateQuestionInput {
  subjectId?: string | null;
  statement: string;
  type: QuestionType;
  defaultPoints?: number;
  explanation?: string | null;
  correctNumericValue?: number | string | null;
  numericTolerance?: number | string | null;
  options?: CreateQuestionOptionInput[];
}

export interface UpdateQuestionInput {
  subjectId?: string | null;
  statement?: string;
  type?: QuestionType;
  defaultPoints?: number;
  explanation?: string | null;
  correctNumericValue?: number | string | null;
  numericTolerance?: number | string | null;
  options?: CreateQuestionOptionInput[];
}

export interface AddAssessmentQuestionInput {
  questionId: string;
  points?: number;
  order?: number;
}

export interface UpdateAssessmentQuestionInput {
  points?: number;
}

export interface ReorderItem {
  questionId: string;
  order: number;
}

export interface ReorderQuestionsInput {
  items: ReorderItem[];
}

// DTOs for Admin / Teacher
export interface QuestionOptionDTO {
  id: string;
  questionId: string;
  text: string;
  isCorrect: boolean;
  explanation: string | null;
  order: number;
}

export interface QuestionDTO {
  id: string;
  subjectId: string | null;
  statement: string;
  type: QuestionType;
  defaultPoints: number;
  explanation: string | null;
  correctNumericValue: number | null;
  numericTolerance: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  options?: QuestionOptionDTO[];
}

export interface AssessmentQuestionDTO {
  id: string;
  assessmentId: string;
  questionId: string;
  points: number;
  order: number;
  question?: QuestionDTO;
}

export interface AssessmentDTO {
  id: string;
  courseId: string;
  moduleId: string | null;
  lessonId: string | null;
  title: string;
  description: string | null;
  type: AssessmentType;
  weight: number;
  availableFrom: Date | string | null;
  availableUntil: Date | string | null;
  timeLimitMinutes: number | null;
  maxAttempts: number | null;
  passingScore: number | null;
  isPublished: boolean;
  scheduledPublishAt?: Date | string | null;
  publishedAt?: Date | string | null;
  crosswordLayout?: CrosswordLayout | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  questions?: AssessmentQuestionDTO[];
  totalPoints?: number;
}

// DTOs for Student (sanitized)
export interface StudentQuestionOptionDTO {
  id: string;
  questionId: string;
  text: string;
  order: number;
}

export interface StudentQuestionDTO {
  id: string;
  statement: string;
  type: QuestionType;
  options?: StudentQuestionOptionDTO[];
}

export interface StudentAssessmentQuestionDTO {
  id: string;
  assessmentId: string;
  questionId: string;
  points: number;
  order: number;
  question: StudentQuestionDTO;
}

export interface StudentAssessmentDTO {
  id: string;
  courseId: string;
  moduleId: string | null;
  lessonId: string | null;
  title: string;
  description: string | null;
  type: AssessmentType;
  weight: number;
  availableFrom: Date | string | null;
  availableUntil: Date | string | null;
  timeLimitMinutes: number | null;
  maxAttempts: number | null;
  passingScore: number | null;
  isPublished: boolean;
  scheduledPublishAt?: Date | string | null;
  publishedAt?: Date | string | null;
  crosswordLayout?: StudentCrosswordLayout | null;
  questions?: StudentAssessmentQuestionDTO[];
  totalPoints?: number;
}

export interface SaveAnswerInput {
  optionIds?: string[];
  numericValue?: number | null;
  textValue?: string | null;
}

export interface AttemptAnswerDTO {
  id?: string;
  attemptId?: string;
  questionId: string;
  optionIds: string[];
  numericValue: number | null;
  textValue: string | null;
  pointsEarned?: number | null;
  isCorrect?: boolean | null;
  feedback?: string | null;
  gradedAt?: Date | string | null;
  updatedAt: Date | string;
}

export interface AttemptDTO {
  id: string;
  studentId: string;
  assessmentId: string;
  attemptNumber: number;
  status: string;
  startedAt: Date | string;
  submittedAt?: Date | string | null;
  score?: number | null;
  isPassed?: boolean | null;
  answers?: AttemptAnswerDTO[];
  assessment?: StudentAssessmentDTO | AssessmentDTO;
}

export interface GradeAnswerInput {
  pointsEarned: number;
  feedback?: string | null;
}

export interface AssessmentAttemptItemDTO {
  id: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  attemptNumber: number;
  status: string;
  startedAt: Date | string;
  submittedAt: Date | string | null;
  score: number | null;
  isPassed: boolean | null;
  totalOpenTextCount: number;
  pendingOpenTextCount: number;
  gradedOpenTextCount: number;
}

export interface TeacherAttemptAnswerDTO {
  id: string;
  questionId: string;
  statement: string;
  type: QuestionType;
  maxPoints: number;
  numericValue: number | null;
  textValue: string | null;
  optionIds: string[];
  selectedOptions?: { id: string; text: string }[];
  pointsEarned: number | null;
  isCorrect: boolean | null;
  feedback: string | null;
  gradedAt: Date | string | null;
  isPendingGrading: boolean;
}

export interface TeacherAttemptDTO {
  id: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  assessmentId: string;
  assessmentTitle: string;
  attemptNumber: number;
  status: string;
  startedAt: Date | string;
  submittedAt: Date | string | null;
  score: number | null;
  isPassed: boolean | null;
  totalOpenTextCount: number;
  pendingOpenTextCount: number;
  answers: TeacherAttemptAnswerDTO[];
  assessment?: StudentAssessmentDTO;
}

export interface CreateAttemptGrantInput {
  quantity: number;
  reason?: string | null;
}

export interface AssessmentAttemptGrantDTO {
  id: string;
  assessmentId: string;
  studentId: string;
  grantedById: string;
  grantedByName?: string;
  quantity: number;
  reason: string | null;
  createdAt: Date | string;
}

export interface StudentAttemptSummaryDTO {
  attemptsUsed: number;
  maxAttemptsGlobal: number | null;
  additionalAttemptsGranted: number;
  effectiveMaxAttempts: number | null;
  attemptsAvailable: number | null;
}

export interface StudentAttemptSummaryItemDTO extends StudentAttemptSummaryDTO {
  studentId: string;
  studentName: string;
  studentNumber: string;
  grantsHistory?: AssessmentAttemptGrantDTO[];
}

