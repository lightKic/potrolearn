import { Role, AssessmentType, QuestionType, EnrollmentStatus } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { AssessmentService } from '../src/services/assessment.service';
import { QuestionService } from '../src/services/question.service';
import { AttemptService } from '../src/services/attempt.service';
import { AuthError } from '../src/types/auth.types';

async function runQA008AL4TeacherEditorTests() {
  console.log('=== POTROLEARN QA-008-AL.4 TEACHER CROSSWORD EDITOR & PREVIEW TESTS ===\n');

  const timestamp = Date.now();
  const teacher = await prisma.user.create({
    data: {
      name: 'Teacher AL4',
      email: `teacher.al4.${timestamp}@potrolearn.edu.mx`,
      role: Role.TEACHER,
      passwordHash: 'hash',
      isActive: true,
    },
  });

  const student = await prisma.user.create({
    data: {
      name: 'Student AL4',
      email: `student.al4.${timestamp}@potrolearn.edu.mx`,
      role: Role.STUDENT,
      passwordHash: 'hash',
      isActive: true,
    },
  });

  const subject = await prisma.subject.create({
    data: {
      code: `SUBJ-AL4-${timestamp}`,
      name: 'Geometría AL4',
      isActive: true,
    },
  });

  const course = await prisma.course.create({
    data: {
      subjectId: subject.id,
      createdById: teacher.id,
      name: 'Curso QA-008-AL.4',
      startDate: new Date(),
      endDate: new Date(Date.now() + 864000000),
      status: 'ACTIVE',
    },
  });

  await prisma.courseTeacher.create({
    data: { courseId: course.id, teacherId: teacher.id },
  });

  await prisma.enrollment.create({
    data: { courseId: course.id, studentId: student.id, status: EnrollmentStatus.ACTIVE },
  });

  try {
    // TEST 1: Create Assessment with AssessmentType.CROSSWORD
    console.log('--- TEST 1: AssessmentType.CROSSWORD creation ---');
    const crosswordAssessment = await AssessmentService.createAssessment(course.id, teacher.id, Role.TEACHER, {
      title: 'Crucigrama Geométrico AL.4',
      description: 'Evaluación tipo crucigrama para maestros',
      type: AssessmentType.CROSSWORD,
      isPublished: true,
    });
    if (crosswordAssessment.type !== 'CROSSWORD') {
      throw new Error('FAIL T1: Assessment type must be CROSSWORD');
    }
    console.log('  [PASS] TEST 1: AssessmentType.CROSSWORD created successfully.');

    // TEST 2: Add CROSSWORD_CLUE questions
    console.log('\n--- TEST 2: Add CROSSWORD_CLUE questions ---');
    const q1 = await QuestionService.createQuestion(teacher.id, Role.TEACHER, {
      subjectId: subject.id,
      statement: 'Figura geométrica de 3 lados',
      type: QuestionType.CROSSWORD_CLUE,
      defaultPoints: 10,
      options: [{ text: 'Triángulo', isCorrect: true }],
    });
    const q2 = await QuestionService.createQuestion(teacher.id, Role.TEACHER, {
      subjectId: subject.id,
      statement: 'Abertura entre dos líneas',
      type: QuestionType.CROSSWORD_CLUE,
      defaultPoints: 10,
      options: [{ text: 'Ángulo', isCorrect: true }],
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
    console.log('  [PASS] TEST 2: CROSSWORD_CLUE questions attached cleanly.');

    // TEST 3: Generate Preview without auto-saving to DB
    console.log('\n--- TEST 3: Teacher generates layout preview (no auto-save) ---');
    const previewRes = await AssessmentService.generateCrosswordPreview(crosswordAssessment.id, teacher.id, Role.TEACHER, 12345);
    if (!previewRes.success || !previewRes.layout) {
      throw new Error(`FAIL T3: Preview generation failed: ${previewRes.error}`);
    }
    if (previewRes.layout.entries.length !== 2) {
      throw new Error(`FAIL T3: Expected 2 entries, got ${previewRes.layout.entries.length}`);
    }

    // Verify DB layout remains null
    const dbAssBeforeSave = await prisma.assessment.findUnique({ where: { id: crosswordAssessment.id } });
    if (dbAssBeforeSave?.crosswordLayout !== null) {
      throw new Error('FAIL T3: DB crosswordLayout must NOT be persisted automatically during preview!');
    }
    console.log('  [PASS] TEST 3: Preview generated cleanly without auto-persisting to DB.');

    // TEST 4: Teacher explicitly saves layout
    console.log('\n--- TEST 4: Teacher explicitly confirms and saves confirmed layout ---');
    const savedAssessment = await AssessmentService.updateAssessment(crosswordAssessment.id, teacher.id, Role.TEACHER, {
      crosswordLayout: previewRes.layout,
    });
    if (!savedAssessment.crosswordLayout || (savedAssessment.crosswordLayout as any).entries.length !== 2) {
      throw new Error('FAIL T4: Saved layout missing or invalid');
    }
    console.log('  [PASS] TEST 4: Confirmed layout saved to DB successfully.');

    // TEST 5: Student security check (no answerNormalized leaked in student DTO)
    console.log('\n--- TEST 5: Student DTO sanitization check ---');
    const studentDTO = await AssessmentService.getAssessmentDetail(crosswordAssessment.id, student.id, Role.STUDENT);
    const studentLayout = (studentDTO as any).crosswordLayout;
    if (!studentLayout || !studentLayout.entries) {
      throw new Error('FAIL T5: Student crosswordLayout missing');
    }
    for (const e of studentLayout.entries) {
      if ('answerNormalized' in e) {
        throw new Error(`FAIL T5: SECURITY VULNERABILITY! Student received answerNormalized: ${e.answerNormalized}`);
      }
    }
    console.log('  [PASS] TEST 5: Zero answerNormalized leaked to student.');

    // TEST 6: Student cannot call generateCrosswordPreview
    console.log('\n--- TEST 6: Student blocked from calling preview API ---');
    try {
      await AssessmentService.generateCrosswordPreview(crosswordAssessment.id, student.id, Role.STUDENT);
      throw new Error('FAIL T6: Student should be blocked with 403');
    } catch (e: any) {
      if (e instanceof AuthError && e.statusCode === 403) {
        console.log('  [PASS] TEST 6: Student correctly blocked with 403 FORBIDDEN.');
      } else {
        throw e;
      }
    }

    // TEST 7: Attempt submission blocks structural layout modifications
    console.log('\n--- TEST 7: Submitted attempt locks structural layout modification ---');
    const attempt = await AttemptService.startOrResumeAttempt(crosswordAssessment.id, student.id);
    await AttemptService.saveAnswer(attempt.id, q1.id, student.id, { textValue: 'TRIANGULO' });
    await AttemptService.submitAttempt(attempt.id, student.id, Role.STUDENT);

    try {
      await AssessmentService.updateAssessment(crosswordAssessment.id, teacher.id, Role.TEACHER, {
        crosswordLayout: { gridSize: { rows: 5, columns: 5 }, entries: [] },
      });
      throw new Error('FAIL T7: Should have blocked layout update on submitted attempt');
    } catch (e: any) {
      if (e instanceof AuthError && e.statusCode === 409) {
        console.log(`  Correctly caught 409 error: ${e.message}`);
        console.log('  [PASS] TEST 7: Submitted attempt blocked layout update cleanly.');
      } else {
        throw e;
      }
    }

    // Cleanup test data
    await prisma.answerOption.deleteMany({ where: { answer: { attempt: { assessment: { courseId: course.id } } } } });
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
    console.log('Cleanup completed.');

    console.log('\n🟢 ALL QA-008-AL.4 TEACHER EDITOR INTEGRATION TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('\n🔴 QA-008-AL.4 TEST SUITE FAILED:', err);
    process.exit(1);
  }
}

runQA008AL4TeacherEditorTests();
