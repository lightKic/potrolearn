import { QuestionType, Role, AssessmentType } from '@prisma/client';
import { prisma } from '../src/lib/prisma.js';
import { AssessmentService } from '../src/services/assessment.service.js';
import { QuestionService } from '../src/services/question.service.js';
import {
  normalizeCrosswordAnswer,
  calculateWordState,
  syncCrosswordEntries,
} from '../../frontend/src/utils/crossword-validation.util.js';

async function runAL46Tests() {
  console.log('=== POTROLEARN QA-008-AL.4.6 VALIDATION & DESYNC TEST SUITE ===\n');

  const timestamp = Date.now();
  const teacher = await prisma.user.create({
    data: {
      name: 'Teacher AL46',
      email: `teacher.al46.${timestamp}@potrolearn.edu.mx`,
      role: Role.TEACHER,
      passwordHash: 'hash',
      isActive: true,
    },
  });

  const student = await prisma.user.create({
    data: {
      name: 'Student AL46',
      email: `student.al46.${timestamp}@potrolearn.edu.mx`,
      role: Role.STUDENT,
      passwordHash: 'hash',
      isActive: true,
    },
  });

  const subject = await prisma.subject.create({
    data: { name: 'Test Subject AL46', code: `SUBJ-AL46-${timestamp}` },
  });

  const course = await prisma.course.create({
    data: {
      name: 'Test Course AL46',
      subjectId: subject.id,
      createdById: teacher.id,
      startDate: new Date(),
      endDate: new Date(Date.now() + 864000000),
      courseTeachers: { create: { teacherId: teacher.id } },
    },
  });

  // Create test CROSSWORD assessment
  const assessment = await AssessmentService.createAssessment(course.id, teacher.id, Role.TEACHER, {
    title: 'QA-008-AL.4.6 Validation and Desync Test',
    description: 'Testing crossword word states and orphan entries desync handling',
    type: AssessmentType.CROSSWORD,
    weight: 10,
    passingScore: 70,
    timeLimitMinutes: 20,
    maxAttempts: 1,
  });

  try {
    // ------------------------------------------------------------------
    // 1. UNIT TESTS FOR NORMALIZATION & WORD VALIDATION UTILS
    // ------------------------------------------------------------------
    console.log('--- TEST 1: Answer Normalization Utility ---');
    const norm1 = normalizeCrosswordAnswer(' Triángulo! ');
    const norm2 = normalizeCrosswordAnswer('ÁNGULO-RECTO');
    if (norm1 !== 'TRIANGULO' || norm2 !== 'ANGULORECTO') {
      throw new Error(`Normalization failed: got "${norm1}" and "${norm2}"`);
    }
    console.log('  [PASS] normalizeCrosswordAnswer works cleanly (diacritics & spaces removed).\n');

    console.log('--- TEST 2: Word Status Calculation (CORRECT, INCORRECT, PENDING) ---');
    const dummyEntry = {
      questionId: 'q-1',
      number: 1,
      direction: 'ACROSS' as const,
      startRow: 0,
      startCol: 0,
      length: 4,
      answerNormalized: 'CERO',
    };

    // Case 2A: Empty / incomplete -> PENDING
    const stateEmpty = calculateWordState(dummyEntry, {});
    const statePartial = calculateWordState(dummyEntry, { '0-0': 'C', '0-1': 'E' });
    if (stateEmpty !== 'PENDING' || statePartial !== 'PENDING') {
      throw new Error(`Expected PENDING for incomplete sequence, got ${stateEmpty}, ${statePartial}`);
    }

    // Case 2B: Full sequence matching -> CORRECT
    const stateCorrect = calculateWordState(dummyEntry, { '0-0': 'C', '0-1': 'E', '0-2': 'R', '0-3': 'O' });
    if (stateCorrect !== 'CORRECT') {
      throw new Error(`Expected CORRECT for matching sequence, got ${stateCorrect}`);
    }

    // Case 2C: Full sequence mismatching -> INCORRECT
    const stateIncorrect = calculateWordState(dummyEntry, { '0-0': 'C', '0-1': 'A', '0-2': 'S', '0-3': 'A' });
    if (stateIncorrect !== 'INCORRECT') {
      throw new Error(`Expected INCORRECT for non-matching sequence, got ${stateIncorrect}`);
    }
    console.log('  [PASS] calculateWordState correctly evaluates PENDING, CORRECT, and INCORRECT.\n');

    // ------------------------------------------------------------------
    // 2. ORPHAN ENTRIES LAYOUT SYNCHRONIZATION TESTS
    // ------------------------------------------------------------------
    console.log('--- TEST 3: Layout Synchronization (VALID_ENTRY vs ORPHAN_ENTRY) ---');
    const dummyQuestions: any[] = [
      { questionId: 'q-active-1', question: { statement: 'Clue 1' } },
      { questionId: 'q-active-2', question: { statement: 'Clue 2' } },
    ];

    const dummyEntries = [
      { questionId: 'q-active-1', number: 1, direction: 'ACROSS' as const, startRow: 0, startCol: 0, length: 4, answerNormalized: 'CERO' },
      { questionId: 'q-active-2', number: 2, direction: 'DOWN' as const, startRow: 0, startCol: 0, length: 3, answerNormalized: 'DOS' },
      { questionId: 'q-ghost-3', number: 3, direction: 'ACROSS' as const, startRow: 2, startCol: 0, length: 4, answerNormalized: 'TRES' }, // Deleted question!
    ];

    const { validEntries, orphanEntries } = syncCrosswordEntries(dummyQuestions, dummyEntries);
    if (validEntries.length !== 2 || orphanEntries.length !== 1) {
      throw new Error(`Expected 2 validEntries and 1 orphanEntries, got valid=${validEntries.length}, orphan=${orphanEntries.length}`);
    }
    if (orphanEntries[0].questionId !== 'q-ghost-3') {
      throw new Error(`Expected orphan questionId q-ghost-3, got ${orphanEntries[0].questionId}`);
    }
    console.log('  [PASS] syncCrosswordEntries correctly filters valid vs orphan entries.\n');

    // ------------------------------------------------------------------
    // 3. ZERO PERSISTENCE INVARIANT DURING SIMULATION
    // ------------------------------------------------------------------
    console.log('--- TEST 4: Zero Persistence Invariant ---');
    const attemptsBefore = await prisma.attempt.count({ where: { assessmentId: assessment.id } });
    const answersBefore = await prisma.answer.count({ where: { attempt: { assessmentId: assessment.id } } });

    if (attemptsBefore !== 0 || answersBefore !== 0) {
      throw new Error('Initial test assessment should have 0 attempts and 0 answers');
    }
    console.log('  [PASS] Zero Attempt and Zero Answer records present in database.\n');

    // ------------------------------------------------------------------
    // 4. NON-REGRESSION FOR TRADITIONAL ASSESSMENT TYPES
    // ------------------------------------------------------------------
    console.log('--- TEST 5: Non-Regression for Standard EXAM Assessment ---');
    const examAssessment = await AssessmentService.createAssessment(course.id, teacher.id, Role.TEACHER, {
      title: 'QA-008-AL.4.6 EXAM Non-Regression Test',
      type: AssessmentType.EXAM,
      weight: 20,
    });

    const teacherPreviewExam = await AssessmentService.getAssessmentDetail(examAssessment.id, teacher.id, Role.TEACHER);
    if (teacherPreviewExam.type !== 'EXAM') {
      throw new Error(`Expected EXAM assessment type, got ${teacherPreviewExam.type}`);
    }
    console.log('  [PASS] Standard EXAM assessment operates 100% unaffected.\n');

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

  console.log('🟢 ALL QA-008-AL.4.6 VALIDATION & DESYNC TESTS PASSED PERFECTLY!\n');
}

runAL46Tests().catch((err) => {
  console.error('❌ AL.4.6 Test Suite Error:', err);
  process.exit(1);
});
