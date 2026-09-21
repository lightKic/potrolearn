export type AssessmentType = 'DIAGNOSTIC' | 'PRACTICE' | 'QUIZ' | 'EXAM' | 'FINAL' | 'CROSSWORD';

export type QuestionType =
  | 'MULTIPLE_CHOICE'
  | 'MULTIPLE_SELECT'
  | 'TRUE_FALSE'
  | 'NUMERIC'
  | 'OPEN_TEXT'
  | 'CROSSWORD_CLUE';

export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED' | 'ABANDONED';

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

export interface CrosswordUnplacedEntry {
  questionId: string;
  answerNormalized: string;
  reason: string;
}

export interface CrosswordGeneratorResultDTO {
  success: boolean;
  layout?: CrosswordLayout;
  placedEntries?: CrosswordLayoutEntry[];
  unplacedEntries?: CrosswordUnplacedEntry[];
  error?: string;
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
  scheduledPublishAt?: string | null;
  publishedAt?: string | null;
  crosswordLayout?: StudentCrosswordLayout | null;
  questions?: StudentAssessmentQuestionDTO[];
  totalPoints?: number;
}

export interface QuestionOptionDTO {
  id: string;
  questionId: string;
  text: string;
  isCorrect: boolean;
  explanation?: string | null;
  order: number;
}

export interface QuestionDTO {
  id: string;
  subjectId?: string | null;
  statement: string;
  type: QuestionType;
  defaultPoints: number;
  explanation?: string | null;
  correctNumericValue?: number | null;
  numericTolerance?: number | null;
  createdAt?: string;
  updatedAt?: string;
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
  passingScore: number | null;
  timeLimitMinutes: number | null;
  maxAttempts: number | null;
  availableFrom: string | null;
  availableUntil: string | null;
  isPublished: boolean;
  scheduledPublishAt?: string | null;
  publishedAt?: string | null;
  crosswordLayout?: CrosswordLayout | null;
  questions?: AssessmentQuestionDTO[];
  totalPoints?: number;
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

export interface CreateAssessmentInput {
  title: string;
  description?: string | null;
  type: AssessmentType;
  weight?: number;
  passingScore?: number | null;
  maxAttempts?: number | null;
  timeLimitMinutes?: number | null;
  availableFrom?: string | null;
  availableUntil?: string | null;
  moduleId?: string | null;
  lessonId?: string | null;
  isPublished?: boolean;
  scheduledPublishAt?: string | null;
  crosswordLayout?: CrosswordLayout | null;
}

export interface UpdateAssessmentInput {
  title?: string;
  description?: string | null;
  type?: AssessmentType;
  weight?: number;
  passingScore?: number | null;
  maxAttempts?: number | null;
  timeLimitMinutes?: number | null;
  availableFrom?: string | null;
  availableUntil?: string | null;
  moduleId?: string | null;
  lessonId?: string | null;
  isPublished?: boolean;
  scheduledPublishAt?: string | null;
  crosswordLayout?: CrosswordLayout | null;
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
  createdAt: string;
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


