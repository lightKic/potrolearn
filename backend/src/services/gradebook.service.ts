import { Role, CourseStatus, EnrollmentStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AuthError } from '../types/auth.types';

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
  enrollmentStatus: EnrollmentStatus;
  currentGrade: number | null;
  finalGrade: number | null;
  grades: Record<string, StudentAssessmentGradeItem>;
}

export interface TeacherGradebookDTO {
  courseId: string;
  courseName: string;
  courseStatus: CourseStatus;
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
  courseStatus: CourseStatus;
  currentGrade: number | null;
  finalGrade: number | null;
  enrollmentStatus: EnrollmentStatus;
  assessments: StudentAssessmentDetailGrade[];
}

export class GradebookService {
  /**
   * Helper: Check teacher / admin access for course gradebook.
   */
  public static async checkManagementPermission(courseId: string, userId: string, role: Role): Promise<any> {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      throw new AuthError('Curso no encontrado', 404, 'COURSE_NOT_FOUND');
    }

    if (role === Role.STUDENT) {
      throw new AuthError('Acceso denegado: los estudiantes no pueden consultar el Gradebook global', 403, 'FORBIDDEN');
    }

    if (role === Role.TEACHER) {
      const assignment = await prisma.courseTeacher.findUnique({
        where: {
          courseId_teacherId: {
            courseId,
            teacherId: userId,
          },
        },
      });
      if (!assignment) {
        throw new AuthError('Acceso denegado: no estás asignado a este curso', 403, 'FORBIDDEN');
      }
    }

    return course;
  }

  /**
   * Validates that total published assessment weights for a course do not exceed 100.00%.
   */
  public static async validateCourseWeights(
    courseId: string,
    excludeAssessmentId?: string,
    additionalWeight = 0
  ): Promise<void> {
    const publishedAssessments = await prisma.assessment.findMany({
      where: {
        courseId,
        isPublished: true,
        ...(excludeAssessmentId ? { id: { not: excludeAssessmentId } } : {}),
      },
      select: { weight: true },
    });

    const currentSum = publishedAssessments.reduce(
      (sum, a) => sum + (a.weight ? a.weight.toNumber() : 0),
      0
    );

    const totalSum = currentSum + additionalWeight;
    // Allow slight float precision up to 100.005
    if (totalSum > 100.005) {
      throw new AuthError(
        `La suma total de pesos de las evaluaciones publicadas (${totalSum.toFixed(2)}%) no puede exceder el 100%`,
        400,
        'TOTAL_WEIGHT_EXCEEDED'
      );
    }
  }

  /**
   * Builds Teacher/Admin Gradebook DTO.
   */
  public static async getTeacherGradebook(
    courseId: string,
    userId: string,
    role: Role,
    statusFilter?: string,
    search?: string
  ): Promise<TeacherGradebookDTO> {
    const course = await this.checkManagementPermission(courseId, userId, role);

    const publishedAssessments = await prisma.assessment.findMany({
      where: {
        courseId,
        isPublished: true,
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    const assessmentsMapped: GradebookAssessmentItem[] = publishedAssessments.map((a) => ({
      id: a.id,
      title: a.title,
      type: a.type,
      weight: a.weight ? a.weight.toNumber() : 0,
    }));

    const totalEvaluatedWeight = assessmentsMapped.reduce((sum, a) => sum + a.weight, 0);

    const whereEnrollment: any = { courseId };
    if (statusFilter && statusFilter !== 'ALL') {
      whereEnrollment.status = statusFilter;
    }

    let enrollments = await prisma.enrollment.findMany({
      where: whereEnrollment,
      include: {
        student: {
          include: {
            studentProfile: true,
          },
        },
      },
      orderBy: { student: { name: 'asc' } },
    });

    if (search && search.trim().length > 0) {
      const q = search.trim().toLowerCase();
      enrollments = enrollments.filter(
        (e) =>
          e.student.name.toLowerCase().includes(q) ||
          (e.student.studentProfile?.studentNumber &&
            e.student.studentProfile.studentNumber.toLowerCase().includes(q))
      );
    }

    const publishedAssessmentIds = publishedAssessments.map((a) => a.id);

    const attempts = publishedAssessmentIds.length > 0
      ? await prisma.attempt.findMany({
          where: {
            assessmentId: { in: publishedAssessmentIds },
            status: { in: ['GRADED', 'SUBMITTED'] },
          },
          select: {
            id: true,
            studentId: true,
            assessmentId: true,
            attemptNumber: true,
            score: true,
            status: true,
          },
        })
      : [];

    // Group attempts by studentId -> assessmentId -> attempts[]
    const attemptsMap = new Map<string, Map<string, typeof attempts>>();
    for (const att of attempts) {
      if (!attemptsMap.has(att.studentId)) {
        attemptsMap.set(att.studentId, new Map());
      }
      const studentAttempts = attemptsMap.get(att.studentId)!;
      if (!studentAttempts.has(att.assessmentId)) {
        studentAttempts.set(att.assessmentId, []);
      }
      studentAttempts.get(att.assessmentId)!.push(att);
    }

    const studentItems: TeacherGradebookStudentItem[] = enrollments.map((enr) => {
      const sId = enr.studentId;
      const sAttemptsMap = attemptsMap.get(sId);
      const grades: Record<string, StudentAssessmentGradeItem> = {};

      let sumGradedPoints = 0;
      let sumGradedWeight = 0;

      let sumFinalPoints = 0;
      let sumFinalWeight = 0;

      for (const a of assessmentsMapped) {
        const aWeight = a.weight;
        const attList = sAttemptsMap?.get(a.id) || [];

        const gradedAttempts = attList.filter((att) => att.status === 'GRADED' && att.score !== null);
        const submittedAttempts = attList.filter((att) => att.status === 'SUBMITTED');

        if (gradedAttempts.length > 0) {
          const maxScoreNum = Math.max(
            ...gradedAttempts.map((att) =>
              typeof att.score === 'object' && att.score !== null && 'toNumber' in att.score
                ? att.score.toNumber()
                : Number(att.score)
            )
          );
          const bestAttempt = gradedAttempts.find((att) => {
            const sc = typeof att.score === 'object' && att.score !== null && 'toNumber' in att.score ? att.score.toNumber() : Number(att.score);
            return sc === maxScoreNum;
          });

          grades[a.id] = {
            score: maxScoreNum,
            status: 'GRADED',
            attemptNumber: bestAttempt?.attemptNumber,
          };

          if (aWeight > 0) {
            sumGradedPoints += (maxScoreNum * aWeight) / 100;
            sumGradedWeight += aWeight;

            sumFinalPoints += (maxScoreNum * aWeight) / 100;
            sumFinalWeight += aWeight;
          }
        } else if (submittedAttempts.length > 0) {
          grades[a.id] = {
            score: null,
            status: 'PENDING_GRADING',
            attemptNumber: submittedAttempts[0].attemptNumber,
          };
          if (aWeight > 0) {
            sumFinalWeight += aWeight;
          }
        } else {
          grades[a.id] = {
            score: null,
            status: 'NO_ATTEMPT',
          };
          if (aWeight > 0) {
            sumFinalWeight += aWeight;
          }
        }
      }

      let currentGrade: number | null = null;
      if (sumGradedWeight > 0) {
        const rawCurrent = (sumGradedPoints / sumGradedWeight) * 100;
        currentGrade = Math.round(rawCurrent * 100) / 100;
      }

      let finalGrade: number | null = null;
      if (enr.finalGrade !== null && enr.finalGrade !== undefined) {
        finalGrade = typeof enr.finalGrade === 'object' && 'toNumber' in enr.finalGrade ? enr.finalGrade.toNumber() : Number(enr.finalGrade);
      } else if (course.status === CourseStatus.FINISHED) {
        if (sumFinalWeight > 0) {
          const denominator = Math.max(100, sumFinalWeight);
          const rawFinal = (sumFinalPoints / (denominator / 100));
          finalGrade = Math.round(rawFinal * 100) / 100;
        } else {
          finalGrade = null;
        }
      }

      return {
        studentId: sId,
        studentName: enr.student.name,
        studentNumber: enr.student.studentProfile?.studentNumber || '',
        enrollmentStatus: enr.status,
        currentGrade,
        finalGrade,
        grades,
      };
    });

    return {
      courseId: course.id,
      courseName: course.name,
      courseStatus: course.status,
      totalEvaluatedWeight,
      assessments: assessmentsMapped,
      students: studentItems,
    };
  }

  /**
   * Builds Student Grades DTO (Boleta individual).
   */
  public static async getStudentGrades(
    courseId: string,
    studentId: string
  ): Promise<StudentGradesDTO> {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        courseId_studentId: {
          courseId,
          studentId,
        },
      },
      include: {
        course: true,
      },
    });

    if (!enrollment) {
      throw new AuthError('No estás inscrito en este curso', 403, 'FORBIDDEN');
    }

    const course = enrollment.course;

    const publishedAssessments = await prisma.assessment.findMany({
      where: {
        courseId,
        isPublished: true,
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    const publishedIds = publishedAssessments.map((a) => a.id);

    const attempts = publishedIds.length > 0
      ? await prisma.attempt.findMany({
          where: {
            assessmentId: { in: publishedIds },
            studentId,
          },
        })
      : [];

    const attemptsByAssessment = new Map<string, typeof attempts>();
    for (const att of attempts) {
      if (!attemptsByAssessment.has(att.assessmentId)) {
        attemptsByAssessment.set(att.assessmentId, []);
      }
      attemptsByAssessment.get(att.assessmentId)!.push(att);
    }

    let sumGradedPoints = 0;
    let sumGradedWeight = 0;
    let sumFinalPoints = 0;
    let sumFinalWeight = 0;

    const detailItems: StudentAssessmentDetailGrade[] = publishedAssessments.map((a) => {
      const aWeight = a.weight ? a.weight.toNumber() : 0;
      const attList = attemptsByAssessment.get(a.id) || [];
      const attemptsUsed = attList.length;

      const gradedAttempts = attList.filter((att) => att.status === 'GRADED' && att.score !== null);
      const submittedAttempts = attList.filter((att) => att.status === 'SUBMITTED');

      let status: 'GRADED' | 'PENDING_GRADING' | 'NO_ATTEMPT' = 'NO_ATTEMPT';
      let bestScore: number | null = null;
      let weightContribution: number | null = null;

      if (gradedAttempts.length > 0) {
        status = 'GRADED';
        bestScore = Math.max(
          ...gradedAttempts.map((att) =>
            typeof att.score === 'object' && att.score !== null && 'toNumber' in att.score
              ? att.score.toNumber()
              : Number(att.score)
          )
        );

        weightContribution = Math.round(((bestScore * aWeight) / 100) * 100) / 100;
        if (aWeight > 0) {
          sumGradedPoints += (bestScore * aWeight) / 100;
          sumGradedWeight += aWeight;

          sumFinalPoints += (bestScore * aWeight) / 100;
          sumFinalWeight += aWeight;
        }
      } else if (submittedAttempts.length > 0) {
        status = 'PENDING_GRADING';
        if (aWeight > 0) {
          sumFinalWeight += aWeight;
        }
      } else {
        status = 'NO_ATTEMPT';
        if (aWeight > 0) {
          sumFinalWeight += aWeight;
        }
      }

      return {
        assessmentId: a.id,
        title: a.title,
        type: a.type,
        weight: aWeight,
        bestScore,
        weightContribution,
        status,
        attemptsUsed,
        maxAttempts: a.maxAttempts,
      };
    });

    let currentGrade: number | null = null;
    if (sumGradedWeight > 0) {
      const rawCurrent = (sumGradedPoints / sumGradedWeight) * 100;
      currentGrade = Math.round(rawCurrent * 100) / 100;
    }

    let finalGrade: number | null = null;
    if (enrollment.finalGrade !== null && enrollment.finalGrade !== undefined) {
      finalGrade = typeof enrollment.finalGrade === 'object' && 'toNumber' in enrollment.finalGrade
        ? enrollment.finalGrade.toNumber()
        : Number(enrollment.finalGrade);
    } else if (course.status === CourseStatus.FINISHED) {
      if (sumFinalWeight > 0) {
        const denominator = Math.max(100, sumFinalWeight);
        const rawFinal = (sumFinalPoints / (denominator / 100));
        finalGrade = Math.round(rawFinal * 100) / 100;
      } else {
        finalGrade = null;
      }
    }

    return {
      courseId: course.id,
      courseName: course.name,
      courseStatus: course.status,
      currentGrade,
      finalGrade,
      enrollmentStatus: enrollment.status,
      assessments: detailItems,
    };
  }

  /**
   * Recalculates and persists finalGrade and sets enrollment status to COMPLETED
   * for all active enrollments when course transitions to FINISHED.
   */
  public static async recalculateAndPersistCourseFinalGrades(
    courseId: string,
    txClient?: Prisma.TransactionClient
  ): Promise<void> {
    const db = txClient || prisma;

    const publishedAssessments = await db.assessment.findMany({
      where: {
        courseId,
        isPublished: true,
      },
      select: { id: true, weight: true },
    });

    const publishedIds = publishedAssessments.map((a) => a.id);

    const enrollments = await db.enrollment.findMany({
      where: { courseId },
      select: { id: true, studentId: true },
    });

    if (enrollments.length === 0) return;

    const attempts = publishedIds.length > 0
      ? await db.attempt.findMany({
          where: {
            assessmentId: { in: publishedIds },
            status: 'GRADED',
          },
          select: {
            studentId: true,
            assessmentId: true,
            score: true,
          },
        })
      : [];

    const attemptsMap = new Map<string, Map<string, number[]>>();
    for (const att of attempts) {
      if (att.score === null || att.score === undefined) continue;
      const scoreNum = typeof att.score === 'object' && 'toNumber' in att.score ? att.score.toNumber() : Number(att.score);

      if (!attemptsMap.has(att.studentId)) {
        attemptsMap.set(att.studentId, new Map());
      }
      const sMap = attemptsMap.get(att.studentId)!;
      if (!sMap.has(att.assessmentId)) {
        sMap.set(att.assessmentId, []);
      }
      sMap.get(att.assessmentId)!.push(scoreNum);
    }

    let totalWeightSum = 0;
    for (const a of publishedAssessments) {
      totalWeightSum += a.weight ? a.weight.toNumber() : 0;
    }

    const denominator = Math.max(100, totalWeightSum);

    for (const enr of enrollments) {
      const sMap = attemptsMap.get(enr.studentId);
      let sumPoints = 0;

      for (const a of publishedAssessments) {
        const aWeight = a.weight ? a.weight.toNumber() : 0;
        if (aWeight <= 0) continue;

        const scores = sMap?.get(a.id) || [];
        if (scores.length > 0) {
          const maxScore = Math.max(...scores);
          sumPoints += (maxScore * aWeight) / 100;
        }
      }

      let calculatedFinalGrade: number | null = null;
      if (totalWeightSum > 0) {
        const rawFinal = (sumPoints / (denominator / 100));
        calculatedFinalGrade = Math.round(rawFinal * 100) / 100;
      }

      await db.enrollment.update({
        where: { id: enr.id },
        data: {
          finalGrade: calculatedFinalGrade !== null ? new Prisma.Decimal(calculatedFinalGrade) : null,
          status: EnrollmentStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
    }
  }
}
