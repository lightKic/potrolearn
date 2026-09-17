export interface GradebookAssessmentItem {
  id: string;
  title: string;
  type: string;
  weight: number;
}

export interface StudentAssessmentGradeItem {
  score: number | null;
  status: 'GRADED' | 'PENDING_GRADING' | 'NO_ATTEMPT';
  attemptNumber?: number;
}

export interface TeacherGradebookStudentItem {
  studentId: string;
  studentName: string;
  studentNumber: string;
  enrollmentStatus: string;
  currentGrade: number | null;
  finalGrade: number | null;
  grades: Record<string, StudentAssessmentGradeItem>;
}

export interface TeacherGradebookDTO {
  courseId: string;
  courseName: string;
  courseStatus: string;
  totalEvaluatedWeight: number;
  assessments: GradebookAssessmentItem[];
  students: TeacherGradebookStudentItem[];
}

export interface StudentAssessmentDetailGrade {
  assessmentId: string;
  title: string;
  type: string;
  weight: number;
  bestScore: number | null;
  weightContribution: number | null;
  status: 'GRADED' | 'PENDING_GRADING' | 'NO_ATTEMPT';
  attemptsUsed: number;
  maxAttempts: number | null;
}

export interface StudentGradesDTO {
  courseId: string;
  courseName: string;
  courseStatus: string;
  currentGrade: number | null;
  finalGrade: number | null;
  enrollmentStatus: string;
  assessments: StudentAssessmentDetailGrade[];
}
