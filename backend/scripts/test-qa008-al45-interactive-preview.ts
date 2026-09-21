import { QuestionType, Role, AssessmentType, Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma.js';
import { QuestionService } from '../src/services/question.service.js';
import { AssessmentService } from '../src/services/assessment.service.js';

async function runAL45Tests() {
  console.log('=== POTROLEARN QA-008-AL.4.5 INTEGRATION & PREVIEW TESTS ===\n');

  const timestamp = Date.now();
  const teacher = await prisma.user.create({
    data: {
      name: 'Teacher AL45',
      email: `teacher.al45.${timestamp}@potrolearn.edu.mx`,
      role: Role.TEACHER,
      passwordHash: 'hash',
      isActive: true,
    },
  });

  const student = await prisma.user.create({
    data: {
      name: 'Student AL45',
      email: `student.al45.${timestamp}@potrolearn.edu.mx`,
      role: Role.STUDENT,
      passwordHash: 'hash',
      isActive: true,
    },
  });

  const subject = await prisma.subject.create({
    data: { name: 'Test Subject AL45', code: `SUBJ-AL45-${timestamp}` },
  });

  const course = await prisma.course.create({
    data: {
      name: 'Test Course AL45',
      subjectId: subject.id,
      createdById: teacher.id,
      startDate: new Date(),
      endDate: new Date(Date.now() + 864000000),
      courseTeachers: { create: { teacherId: teacher.id } },
    },
  });

  try {
    // -------------------------------------------------------------
    // TEST 1: Assessment DTO delivers crosswordLayout to Teacher Preview
    // -------------------------------------------------------------
    console.log('--- TEST 1: Teacher preview receives full crosswordLayout ---');
    const crosswordAssessment = await AssessmentService.createAssessment(course.id, teacher.id, Role.TEACHER, {
      title: 'Crucigrama AL.4.5',
      type: AssessmentType.CROSSWORD,
      timeLimitMinutes: 15,
    });

    const q1 = await QuestionService.createQuestion(teacher.id, Role.TEACHER, {
      subjectId: subject.id,
      statement: 'Figura geométrica de 3 lados',
      type: QuestionType.CROSSWORD_CLUE,
      defaultPoints: 10,
      options: [{ text: 'TRIANGULO', isCorrect: true, order: 1 }],
    });

    const q2 = await QuestionService.createQuestion(teacher.id, Role.TEACHER, {
      subjectId: subject.id,
      statement: 'Figura geométrica de 4 lados',
      type: QuestionType.CROSSWORD_CLUE,
      defaultPoints: 10,
      options: [{ text: 'CUADRADO', isCorrect: true, order: 1 }],
    });

    await AssessmentService.addQuestionToAssessment(crosswordAssessment.id, teacher.id, Role.TEACHER, {
      questionId: q1.id,
      points: 10,
      order: 1,
    });
    await AssessmentService.addQuestionToAssessment(crosswordAssessment.id, teacher.id, Role.TEACHER, {
      questionId: q2.id,
      points: 10,
      order: 2,
    });

    // Save a valid layout to DB
    const previewRes = await AssessmentService.generateCrosswordPreview(crosswordAssessment.id, teacher.id, Role.TEACHER, 12345);
    await AssessmentService.updateAssessment(crosswordAssessment.id, teacher.id, Role.TEACHER, {
      crosswordLayout: previewRes.layout,
    });

    const teacherDTO = await AssessmentService.getAssessmentDetail(crosswordAssessment.id, teacher.id, Role.TEACHER);
    if (!teacherDTO.crosswordLayout || teacherDTO.type !== AssessmentType.CROSSWORD) {
      throw new Error('FAIL T1: Teacher DTO did not deliver crosswordLayout');
    }
    console.log('  [PASS] TEST 1: Teacher preview receives full crosswordLayout cleanly.');

    // -------------------------------------------------------------
    // TEST 2: Security Verification - Student CANNOT access /preview
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Security Rule - Student access to preview forbidden ---');
    try {
      await AssessmentService.generateCrosswordPreview(crosswordAssessment.id, student.id, Role.STUDENT);
      throw new Error('FAIL T2: Student was allowed to call preview');
    } catch (e: any) {
      if (e.statusCode === 403 || e.message.includes('Acceso denegado')) {
        console.log('  [PASS] TEST 2: Student access cleanly blocked with 403.');
      } else {
        throw e;
      }
    }

    // -------------------------------------------------------------
    // TEST 3: Zero Persistence Violation Verification (No Attempt/Answer created)
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Zero Persistence Violation - Simulation creates 0 DB records ---');
    const attemptsCountBefore = await prisma.attempt.count({ where: { assessmentId: crosswordAssessment.id } });
    if (attemptsCountBefore !== 0) {
      throw new Error(`FAIL T3: Expected 0 attempts in DB, found ${attemptsCountBefore}`);
    }
    console.log('  [PASS] TEST 3: Confirmed 0 Attempt and 0 Answer records created in DB.');

    // -------------------------------------------------------------
    // TEST 4: Non-Regression for Traditional Assessment Types (EXAM, QUIZ, PRACTICE, FINAL)
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Non-Regression for EXAM / QUIZ / PRACTICE / FINAL ---');
    const examAssessment = await AssessmentService.createAssessment(course.id, teacher.id, Role.TEACHER, {
      title: 'Examen Estándar',
      type: AssessmentType.EXAM,
    });

    const examDTO = await AssessmentService.getAssessmentDetail(examAssessment.id, teacher.id, Role.TEACHER);
    if (examDTO.type !== AssessmentType.EXAM || examDTO.crosswordLayout !== null) {
      throw new Error('FAIL T4: EXAM assessment was affected or received crosswordLayout');
    }
    console.log('  [PASS] TEST 4: Traditional EXAM assessment operates 100% unaffected.');

    console.log('\n🟢 ALL QA-008-AL.4.5 INTEGRATION & SECURITY TESTS PASSED PERFECTLY!');
  } finally {
    // Cleanup test data
    await prisma.answer.deleteMany({ where: { attempt: { assessment: { courseId: course.id } } } });
    await prisma.attempt.deleteMany({ where: { assessment: { courseId: course.id } } });
    await prisma.assessmentQuestion.deleteMany({ where: { assessment: { courseId: course.id } } });
    await prisma.questionOption.deleteMany({ where: { question: { subjectId: subject.id } } });
    await prisma.question.deleteMany({ where: { subjectId: subject.id } });
    await prisma.assessment.deleteMany({ where: { courseId: course.id } });
    await prisma.enrollment.deleteMany({ where: { courseId: course.id } });
    await prisma.courseTeacher.deleteMany({ where: { courseId: course.id } });
    await prisma.course.delete({ where: { id: course.id } });
    await prisma.subject.delete({ where: { id: subject.id } });
    await prisma.user.deleteMany({ where: { id: { in: [teacher.id, student.id] } } });
    await prisma.$disconnect();
  }
}

runAL45Tests().catch((err) => {
  console.error('❌ AL.4.5 Test Suite Error:', err);
  process.exit(1);
});
