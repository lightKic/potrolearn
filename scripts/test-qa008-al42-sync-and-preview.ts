import { PrismaClient, QuestionType, Role, AssessmentType } from '@prisma/client';
import { QuestionService } from '../backend/src/services/question.service.js';
import { AssessmentService } from '../backend/src/services/assessment.service.js';
import { CrosswordGeneratorUtil } from '../backend/src/utils/crossword-generator.util.js';

const prisma = new PrismaClient();

async function runAL42Tests() {
  console.log('--- RUNNING QA-008-AL.4.2 TEST SUITE ---');

  // Find a test user (teacher)
  const teacher = await prisma.user.findFirst({
    where: { role: Role.TEACHER },
  });

  if (!teacher) {
    throw new Error('No teacher user found in DB for test runner');
  }

  // Find or create test subject & course
  let course = await prisma.course.findFirst({
    where: { teachers: { some: { teacherId: teacher.id } } },
  });

  if (!course) {
    const subject = await prisma.subject.create({
      data: { name: 'Test Subject AL42', code: `TEST-AL42-${Date.now()}` },
    });
    course = await prisma.course.create({
      data: {
        title: 'Test Course AL42',
        code: `CRS-AL42-${Date.now()}`,
        subjectId: subject.id,
        teachers: { create: { teacherId: teacher.id } },
      },
    });
  }

  // Create test Crossword Assessment
  const assessment = await prisma.assessment.create({
    data: {
      title: 'QA-008-AL.4.2 Test Crossword Assessment',
      type: AssessmentType.CROSSWORD,
      courseId: course.id,
      teacherId: teacher.id,
      published: false,
    },
  });

  console.log(`Created test assessment: ${assessment.id}`);

  try {
    // Test A: Create CROSSWORD_CLUE with option
    console.log('\n[Test A] Create CROSSWORD_CLUE with option...');
    const q1 = await QuestionService.createQuestion(teacher.id, Role.TEACHER, {
      statement: 'Figura de tres lados',
      type: QuestionType.CROSSWORD_CLUE,
      defaultPoints: 10,
      options: [{ text: 'TRIANGULO', isCorrect: true, order: 1 }],
    });
    console.log(`✅ Created q1 ID: ${q1.id}, Option: "${q1.options[0]?.text}"`);
    if (q1.options[0]?.text !== 'TRIANGULO') {
      throw new Error('Test A Failed: Option text does not match TRIANGULO');
    }

    // Test B: Edit statement of existing CROSSWORD_CLUE
    console.log('\n[Test B] Edit statement of existing CROSSWORD_CLUE...');
    const q1UpdatedStmt = await QuestionService.updateQuestion(q1.id, teacher.id, Role.TEACHER, {
      statement: 'Polígono de tres lados y tres ángulos',
    });
    console.log(`✅ Updated statement: "${q1UpdatedStmt.statement}"`);
    if (q1UpdatedStmt.statement !== 'Polígono de tres lados y tres ángulos') {
      throw new Error('Test B Failed: Statement not updated');
    }

    // Test C: Edit answer of existing CROSSWORD_CLUE & verify DB update
    console.log('\n[Test C] Edit answer of existing CROSSWORD_CLUE & verify QuestionOption in DB...');
    const q1UpdatedAns = await QuestionService.updateQuestion(q1.id, teacher.id, Role.TEACHER, {
      statement: q1UpdatedStmt.statement,
      options: [{ text: 'TRILATERO', isCorrect: true, order: 1 }],
    });
    console.log(`✅ Updated option text: "${q1UpdatedAns.options[0]?.text}"`);
    if (q1UpdatedAns.options[0]?.text !== 'TRILATERO') {
      throw new Error('Test C Failed: Option text in DB was not updated');
    }

    // Test H: Verify no duplicate QuestionOption created
    console.log('\n[Test H] Verify no duplicate QuestionOption records...');
    const dbOptions = await prisma.questionOption.findMany({ where: { questionId: q1.id } });
    console.log(`✅ Options count in DB for q1: ${dbOptions.length}`);
    if (dbOptions.length !== 1) {
      throw new Error(`Test H Failed: Expected exactly 1 option in DB, found ${dbOptions.length}`);
    }

    // Test D: Attempt protection check
    console.log('\n[Test D] Attempt modification protection check...');
    // Create attempt for q1
    const student = await prisma.user.findFirst({ where: { role: Role.STUDENT } });
    if (student) {
      const attempt = await prisma.assessmentAttempt.create({
        data: {
          assessmentId: assessment.id,
          studentId: student.id,
          attemptNumber: 1,
          status: 'SUBMITTED',
          submittedAt: new Date(),
        },
      });

      await prisma.questionAttempt.create({
        data: {
          attemptId: attempt.id,
          questionId: q1.id,
          score: new Prisma.Decimal(10),
          isCorrect: true,
        },
      });

      let attemptProtected = false;
      try {
        await QuestionService.updateQuestion(q1.id, teacher.id, Role.TEACHER, {
          options: [{ text: 'NUEVO_TEXTO', isCorrect: true, order: 1 }],
        });
      } catch (err: any) {
        if (err.code === 'QUESTION_HAS_ATTEMPTS' || err.status === 409) {
          attemptProtected = true;
          console.log('✅ Correctly blocked answer modification when attempts exist');
        }
      }

      if (!attemptProtected) {
        throw new Error('Test D Failed: Option update was NOT blocked when attempts existed');
      }

      // Cleanup test attempt
      await prisma.questionAttempt.deleteMany({ where: { questionId: q1.id } });
      await prisma.assessmentAttempt.delete({ where: { id: attempt.id } });
    } else {
      console.log('⚠️ Skipping student attempt creation (no student in DB)');
    }

    // Test E & F: Complete Preview Generation (6 entries, 6 placed)
    console.log('\n[Test E & F] Create 6 interconnectable clues and generate COMPLETE preview...');
    // Clear questions from assessment
    await prisma.assessmentQuestion.deleteMany({ where: { assessmentId: assessment.id } });

    const wordsComplete = [
      { s: 'Estrella luminosa', a: 'SOL' },
      { s: 'Satélite natural', a: 'LUNA' },
      { s: 'Planeta habitable', a: 'TIERRA' },
      { s: 'Atmósfera respirable', a: 'AIRE' },
      { s: 'Líquido vital', a: 'AGUA' },
      { s: 'Sentimiento humano', a: 'AMOR' },
    ];

    for (let i = 0; i < wordsComplete.length; i++) {
      const w = wordsComplete[i];
      const q = await QuestionService.createQuestion(teacher.id, Role.TEACHER, {
        statement: w.s,
        type: QuestionType.CROSSWORD_CLUE,
        defaultPoints: 10,
        options: [{ text: w.a, isCorrect: true, order: 1 }],
      });
      await QuestionService.addQuestionToAssessment(assessment.id, teacher.id, Role.TEACHER, {
        questionId: q.id,
        order: i + 1,
      });
    }

    const previewComplete = await AssessmentService.generateCrosswordPreview(assessment.id, teacher.id, Role.TEACHER, 12345);
    console.log(`✅ Complete Preview Success: ${previewComplete.success}`);
    console.log(`   Placed Entries: ${previewComplete.layout?.entries.length}`);
    console.log(`   Unplaced Entries: ${previewComplete.unplacedEntries?.length}`);
    if (!previewComplete.success || previewComplete.layout?.entries.length !== 6 || (previewComplete.unplacedEntries && previewComplete.unplacedEntries.length > 0)) {
      throw new Error('Test F Failed: Expected complete layout with 6 placed entries and 0 unplaced');
    }

    // Test G: Partial Preview Generation (4 placed, 2 unplaced)
    console.log('\n[Test G] Create 4 interconnectable + 2 unplaced clues and generate PARTIAL preview...');
    await prisma.assessmentQuestion.deleteMany({ where: { assessmentId: assessment.id } });

    const wordsPartial = [
      { s: 'Pista 1', a: 'GATO' },
      { s: 'Pista 2', a: 'CASA' },
      { s: 'Pista 3', a: 'TIGRE' },
      { s: 'Pista 4', a: 'ROSA' },
      { s: 'Pista 5 (Huérfana 1)', a: 'ZZZZ' },
      { s: 'Pista 6 (Huérfana 2)', a: 'WWWW' },
    ];

    for (let i = 0; i < wordsPartial.length; i++) {
      const w = wordsPartial[i];
      const q = await QuestionService.createQuestion(teacher.id, Role.TEACHER, {
        statement: w.s,
        type: QuestionType.CROSSWORD_CLUE,
        defaultPoints: 10,
        options: [{ text: w.a, isCorrect: true, order: 1 }],
      });
      await QuestionService.addQuestionToAssessment(assessment.id, teacher.id, Role.TEACHER, {
        questionId: q.id,
        order: i + 1,
      });
    }

    const previewPartial = await AssessmentService.generateCrosswordPreview(assessment.id, teacher.id, Role.TEACHER, 12345);
    console.log(`✅ Partial Preview Success: ${previewPartial.success}`);
    console.log(`   Placed Entries: ${previewPartial.layout?.entries.length}`);
    console.log(`   Unplaced Entries: ${previewPartial.unplacedEntries?.length}`);
    console.log(`   Unplaced Words: ${previewPartial.unplacedEntries?.map(u => u.answerNormalized).join(', ')}`);

    if (previewPartial.layout?.entries.length !== 4 || previewPartial.unplacedEntries?.length !== 2) {
      throw new Error(`Test G Failed: Expected 4 placed entries and 2 unplaced entries, got placed=${previewPartial.layout?.entries.length}, unplaced=${previewPartial.unplacedEntries?.length}`);
    }

    console.log('\n--- ALL AL.4.2 INTEGRATION TESTS PASSED PERFECTLY ---');
  } finally {
    // Clean up test assessment and related records
    await prisma.assessmentQuestion.deleteMany({ where: { assessmentId: assessment.id } });
    await prisma.assessment.delete({ where: { id: assessment.id } });
    await prisma.$disconnect();
  }
}

runAL42Tests().catch((err) => {
  console.error('❌ AL.4.2 Test Suite Error:', err);
  process.exit(1);
});
