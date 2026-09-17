export type AssessmentType = 'QUIZ' | 'EXAM';

export type QuestionType =
  | 'MULTIPLE_CHOICE'
  | 'MULTIPLE_SELECT'
  | 'TRUE_FALSE'
  | 'NUMERIC'
  | 'OPEN_TEXT';

export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED' | 'ABANDONED';

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
  availableFrom: string | null;
  availableUntil: string | null;
  timeLimitMinutes: number | null;
  maxAttempts: number | null;
  passingScore: number | null;
  isPublished: boolean;
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
  gradedAt?: string | null;
  updatedAt: string;
}

export interface AttemptDTO {
  id: string;
  studentId: string;
  assessmentId: string;
  attemptNumber: number;
  status: AttemptStatus;
  startedAt: string;
  submittedAt?: string | null;
  score?: number | null;
  isPassed?: boolean | null;
  answers?: AttemptAnswerDTO[];
  assessment?: StudentAssessmentDTO;
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
  status: AttemptStatus;
  startedAt: string;
  submittedAt: string | null;
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
  gradedAt: string | null;
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
  status: AttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  isPassed: boolean | null;
  totalOpenTextCount: number;
  pendingOpenTextCount: number;
  answers: TeacherAttemptAnswerDTO[];
}

