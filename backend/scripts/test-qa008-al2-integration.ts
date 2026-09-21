import { Role, AssessmentType, QuestionType, EnrollmentStatus } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { AssessmentService } from '../src/services/assessment.service';
import { QuestionService } from '../src/services/question.service';
import { AttemptService } from '../src/services/attempt.service';
import { AuthError } from '../src/types/auth.types';

async function runQA008AL2IntegrationTests() {
  console.log('=== POTROLEARN QA-008-AL.2 PHASE 1 INTEGRATION TESTS ===\n');

  // Create isolated seed data
  const timestamp = Date.now();
  const teacherEmail = `teacher.al2.${timestamp}@potrolearn.edu.mx`;
  const studentEmail = `student.al2.${timestamp}@potrolearn.edu.mx`;

  const teacher = await prisma.user.create({
    data: {
      name: 'Teacher AL2',
      email: teacherEmail,
      role: Role.TEACHER,
      passwordHash: 'hash',
      isActive: true,
    },
  });

  const student = await prisma.user.create({
    data: {
      name: 'Student AL2',
      email: studentEmail,
      role: Role.STUDENT,
      passwordHash: 'hash',
      isActive: true,
    },
  });

  const subject = await prisma.subject.create({
    data: {
      code: `SUBJ-AL2-${timestamp}`,
      name: 'Matemáticas Discretas AL2',
      isActive: true,
    },
  });

  const course = await prisma.course.create({
    data: {
      subjectId: subject.id,
      createdById: teacher.id,
      name: 'Curso QA-008-AL.2',
      startDate: new Date(),
      endDate: new Date(Date.now() + 864000000),
      status: 'ACTIVE',
    },
  });

  await prisma.courseTeacher.create({
    data: {
      courseId: course.id,
      teacherId: teacher.id,
    },
  });

  await prisma.enrollment.create({
    data: {
      courseId: course.id,
      studentId: student.id,
      status: EnrollmentStatus.ACTIVE,
    },
  });

  try {
    // 1. Create Question with QuestionType.CROSSWORD_CLUE
    console.log('--- TEST 1: QuestionType.CROSSWORD_CLUE creation ---');
    const q1 = await QuestionService.createQuestion(teacher.id, Role.TEACHER, {
      subjectId: subject.id,
      statement: 'Figura geométrica de 3 lados',
      type: QuestionType.CROSSWORD_CLUE,
      defaultPoints: 10,
    });
    const q2 = await QuestionService.createQuestion(teacher.id, Role.TEACHER, {
      subjectId: subject.id,
      statement: 'Polígono de 4 lados iguales',
      type: QuestionType.CROSSWORD_CLUE,
      defaultPoints: 10,
    });
    console.log('  [PASS] TEST 1: QuestionType.CROSSWORD_CLUE created cleanly.');

    // 2. Create Assessment with AssessmentType.CROSSWORD
    console.log('\n--- TEST 2: AssessmentType.CROSSWORD creation ---');
    const crosswordAssessment = await AssessmentService.createAssessment(course.id, teacher.id, Role.TEACHER, {
      title: 'Crucigrama de Geometría',
      description: 'Demuestra tus conocimientos en geometría',
      type: AssessmentType.CROSSWORD,
      isPublished: true,
    });
    if (crosswordAssessment.type !== 'CROSSWORD') {
      throw new Error('FAIL T2: Assessment type must be CROSSWORD');
    }
    console.log('  [PASS] TEST 2: AssessmentType.CROSSWORD created successfully.');

    // Add questions to crossword assessment
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

    // 3. Valid crosswordLayout update
    console.log('\n--- TEST 3: Valid crosswordLayout save ---');
    const validLayout = {
      gridSize: { rows: 10, columns: 10 },
      entries: [
        {
          questionId: q1.id,
          number: 1,
          direction: 'ACROSS' as const,
          startRow: 2,
          startCol: 1,
          length: 9,
          answerNormalized: 'TRIANGULO',
        },
        {
          questionId: q2.id,
          number: 1,
          direction: 'DOWN' as const,
          startRow: 2,
          startCol: 1,
          length: 8,
          answerNormalized: 'CUADRADO',
        },
      ],
    };

    const updatedAssessment = await AssessmentService.updateAssessment(crosswordAssessment.id, teacher.id, Role.TEACHER, {
      crosswordLayout: validLayout,
    });

    if (!updatedAssessment.crosswordLayout || updatedAssessment.crosswordLayout.entries.length !== 2) {
      throw new Error('FAIL T3: Valid crosswordLayout was not saved correctly');
    }
    console.log('  [PASS] TEST 3: Valid crosswordLayout saved successfully.');

    // 4. Test invalid crosswordLayout (rows > 20)
    console.log('\n--- TEST 4: Reject crosswordLayout with rows > 20 ---');
    try {
      await AssessmentService.updateAssessment(crosswordAssessment.id, teacher.id, Role.TEACHER, {
        crosswordLayout: {
          gridSize: { rows: 25, columns: 10 },
          entries: [],
        },
      });
      throw new Error('FAIL T4: Should have rejected rows > 20');
    } catch (e: any) {
      if (e instanceof AuthError && e.message.includes('20')) {
        console.log(`  Correctly caught 400 error: ${e.message}`);
        console.log('  [PASS] TEST 4: >20 rows rejected.');
      } else {
        throw e;
      }
    }

    // 5. Test invalid crosswordLayout (entries > 20)
    console.log('\n--- TEST 5: Reject crosswordLayout with entries > 20 ---');
    try {
      const dummyEntries = Array.from({ length: 22 }, (_, idx) => ({
        questionId: q1.id,
        number: idx + 1,
        direction: 'ACROSS' as const,
        startRow: 0,
        startCol: 0,
        length: 9,
        answerNormalized: 'TRIANGULO',
      }));
      await AssessmentService.updateAssessment(crosswordAssessment.id, teacher.id, Role.TEACHER, {
        crosswordLayout: {
          gridSize: { rows: 20, columns: 20 },
          entries: dummyEntries,
        },
      });
      throw new Error('FAIL T5: Should have rejected entries > 20');
    } catch (e: any) {
      if (e instanceof AuthError && e.message.includes('20')) {
        console.log(`  Correctly caught 400 error: ${e.message}`);
        console.log('  [PASS] TEST 5: >20 entries rejected.');
      } else {
        throw e;
      }
    }

    // 6. Test consistency validation (questionId from another assessment rejected)
    console.log('\n--- TEST 6: Reject questionId belonging to another assessment ---');
    const qForeign = await QuestionService.createQuestion(teacher.id, Role.TEACHER, {
      subjectId: subject.id,
      statement: 'Pregunta de otra evaluación',
      type: QuestionType.CROSSWORD_CLUE,
      defaultPoints: 10,
    });

    try {
      await AssessmentService.updateAssessment(crosswordAssessment.id, teacher.id, Role.TEACHER, {
        crosswordLayout: {
          gridSize: { rows: 10, columns: 10 },
          entries: [
            {
              questionId: qForeign.id,
              number: 1,
              direction: 'ACROSS' as const,
              startRow: 0,
              startCol: 0,
              length: 9,
              answerNormalized: 'TRIANGULO',
            },
          ],
        },
      });
      throw new Error('FAIL T6: Should have rejected questionId not assigned to assessment');
    } catch (e: any) {
      if (e instanceof AuthError && e.message.includes('no pertenece')) {
        console.log(`  Correctly caught 400 error: ${e.message}`);
        console.log('  [PASS] TEST 6: Foreign questionId rejected.');
      } else {
        throw e;
      }
    }

    // 7. Test Security Rule: STUDENT DTO strips answerNormalized
    console.log('\n--- TEST 7: Security Rule - STUDENT DTO never receives answerNormalized ---');
    const studentDetail = await AssessmentService.getAssessmentDetail(crosswordAssessment.id, student.id, Role.STUDENT);
    const studentLayout = (studentDetail as any).crosswordLayout;

    if (!studentLayout || !studentLayout.entries || studentLayout.entries.length === 0) {
      throw new Error('FAIL T7: studentLayout missing from student DTO');
    }

    for (const entry of studentLayout.entries) {
      if ('answerNormalized' in entry) {
        throw new Error(`FAIL T7: SECURITY VULNERABILITY! Student received answerNormalized: ${entry.answerNormalized}`);
      }
    }
    console.log('  [PASS] TEST 7: STUDENT DTO sanitized cleanly. Zero answerNormalized leaked.');

    // 8. Test Security Rule: TEACHER/ADMIN DTO retains full preview
    console.log('\n--- TEST 8: TEACHER/ADMIN DTO retains full preview with answerNormalized ---');
    const teacherDetail = await AssessmentService.getAssessmentDetail(crosswordAssessment.id, teacher.id, Role.TEACHER);
    const teacherLayout = (teacherDetail as any).crosswordLayout;

    if (!teacherLayout || !teacherLayout.entries || !teacherLayout.entries[0].answerNormalized) {
      throw new Error('FAIL T8: Teacher DTO missing answerNormalized for preview');
    }
    console.log('  [PASS] TEST 8: TEACHER DTO received full preview with answerNormalized.');

    // 9. Historical Inmutability Rule: Submitted attempts block layout modifications
    console.log('\n--- TEST 9: Submitted attempt blocks layout modifications ---');
    const attempt = await AttemptService.startOrResumeAttempt(crosswordAssessment.id, student.id);
    await AttemptService.saveAnswer(attempt.id, q1.id, student.id, { textValue: 'TRIANGULO' });
    await AttemptService.submitAttempt(attempt.id, student.id, Role.STUDENT);

    try {
      await AssessmentService.updateAssessment(crosswordAssessment.id, teacher.id, Role.TEACHER, {
        crosswordLayout: {
          gridSize: { rows: 5, columns: 5 },
          entries: [],
        },
      });
      throw new Error('FAIL T9: Should have blocked layout update on submitted attempt');
    } catch (e: any) {
      if (e instanceof AuthError && (e.statusCode === 409 || e.message.includes('No se puede modificar'))) {
        console.log(`  Correctly caught 409 error: ${e.message}`);
        console.log('  [PASS] TEST 9: Structural layout update blocked on submitted attempt.');
      } else {
        throw e;
      }
    }

    // 10. Test Compatibility: Standard EXAM assessment continues operating 100% unaffected
    console.log('\n--- TEST 10: Standard EXAM assessment compatibility ---');
    const examAssessment = await AssessmentService.createAssessment(course.id, teacher.id, Role.TEACHER, {
      title: 'Examen Estándar Ex-10',
      type: AssessmentType.EXAM,
      isPublished: true,
    });
    const qMc = await QuestionService.createQuestion(teacher.id, Role.TEACHER, {
      subjectId: subject.id,
      statement: '¿Cuánto es 2 + 2?',
      type: QuestionType.MULTIPLE_CHOICE,
      options: [
        { text: '3', isCorrect: false },
        { text: '4', isCorrect: true },
      ],
    });
    await AssessmentService.addQuestionToAssessment(examAssessment.id, teacher.id, Role.TEACHER, {
      questionId: qMc.id,
      points: 10,
    });

    const examAttempt = await AttemptService.startOrResumeAttempt(examAssessment.id, student.id);
    const mcOption = qMc.options![1].id;
    await AttemptService.saveAnswer(examAttempt.id, qMc.id, student.id, { optionIds: [mcOption] });
    const gradedExam = await AttemptService.submitAttempt(examAttempt.id, student.id, Role.STUDENT);

    if (gradedExam.score !== 100) {
      throw new Error(`FAIL T10: Standard EXAM score mismatch (${gradedExam.score} vs 100)`);
    }
    console.log('  [PASS] TEST 10: Standard EXAM assessment operates 100% unaffected.');

    console.log('\nCleaning up test data...');
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
    console.log('Cleanup finished.');

    console.log('\n🟢 ALL QA-008-AL.2 PHASE 1 INTEGRATION TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('\n🔴 QA-008-AL.2 PHASE 1 TEST SUITE FAILED:', err);
    process.exit(1);
  }
}

runQA008AL2IntegrationTests();
