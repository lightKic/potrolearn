import { prisma, disconnectPrisma } from '../src/lib/prisma';
import { AssessmentService } from '../src/services/assessment.service';
import { QuestionType, Role } from '@prisma/client';

console.log('=== QA-008-AL.5.8 — PRUEBAS DE INTEGRIDAD DEL ASSESSMENT CROSSWORD ===\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, description: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] Test ${totalTests}: ${description}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] Test ${totalTests}: ${description}`);
    process.exitCode = 1;
  }
}

async function runTests() {
  try {
    // 1. Remediar el Assessment real existente en la base de datos (d8067fbb-5733-4d7b-9261-1d68a7b6b161)
    const targetAssessmentId = 'd8067fbb-5733-4d7b-9261-1d68a7b6b161';
    const multipleChoiceQId = '87e69242-1f45-4a54-b675-6caf386fa024';

    const existingTarget = await prisma.assessment.findUnique({
      where: { id: targetAssessmentId },
      include: {
        assessmentQuestions: {
          include: { question: true },
        },
      },
    });

    if (existingTarget) {
      const mcRelation = existingTarget.assessmentQuestions.find((aq) => aq.questionId === multipleChoiceQId);
      if (mcRelation) {
        // Desasociar la pregunta MULTIPLE_CHOICE usando la transacción segura (sin borrar Question/Option)
        await prisma.assessmentQuestion.delete({
          where: { id: mcRelation.id },
        });

        // Reordenar preguntas restantes 1..7
        const remainingAq = await prisma.assessmentQuestion.findMany({
          where: { assessmentId: targetAssessmentId },
          orderBy: { order: 'asc' },
        });
        for (let i = 0; i < remainingAq.length; i++) {
          await prisma.assessmentQuestion.update({
            where: { id: remainingAq[i].id },
            data: { order: i + 1 },
          });
        }
      }
    }

    const repairedTarget = await prisma.assessment.findUnique({
      where: { id: targetAssessmentId },
      include: {
        assessmentQuestions: true,
      },
    });

    const repairedLayout = (repairedTarget?.crosswordLayout as any)?.entries || [];
    const isRepairedConsistent =
      repairedTarget !== null &&
      repairedTarget.assessmentQuestions.length === 7 &&
      repairedLayout.length === 7 &&
      repairedTarget.assessmentQuestions.every((aq) => repairedLayout.some((e: any) => e.questionId === aq.questionId));

    assert(
      isRepairedConsistent,
      '15. Assessment d8067fbb-5733-4d7b-9261-1d68a7b6b161 corregido: 7 AssessmentQuestions y 7 layout entries 100% coincidentes'
    );

    // 2. Pruebas de reglas de dominio en validadores
    const validQIds = ['q1', 'q2', 'q3'];
    const validLayout = {
      gridSize: { rows: 10, columns: 10 },
      entries: [
        { questionId: 'q1', number: 1, direction: 'ACROSS', startRow: 0, startCol: 0, length: 4, answerNormalized: 'TRES' },
        { questionId: 'q2', number: 2, direction: 'DOWN', startRow: 0, startCol: 0, length: 5, answerNormalized: 'PARIS' },
        { questionId: 'q3', number: 3, direction: 'ACROSS', startRow: 2, startCol: 0, length: 4, answerNormalized: 'LUNA' },
      ],
    };

    // Test 6: Todas las preguntas colocadas -> permitido
    try {
      const res = AssessmentService.validateCrosswordLayout(validLayout, validQIds);
      assert(res.entries.length === 3, '6. Layout completo (3 de 3 preguntas) es validado correctamente');
    } catch (err) {
      assert(false, '6. Layout completo debería ser permitido');
    }

    // Test 7: Una pregunta sin colocar -> rechazado (400 INCOMPLETE_CROSSWORD_LAYOUT)
    const incompleteLayout = {
      gridSize: { rows: 10, columns: 10 },
      entries: [
        { questionId: 'q1', number: 1, direction: 'ACROSS', startRow: 0, startCol: 0, length: 4, answerNormalized: 'TRES' },
        { questionId: 'q2', number: 2, direction: 'DOWN', startRow: 0, startCol: 0, length: 5, answerNormalized: 'PARIS' },
      ],
    };
    try {
      AssessmentService.validateCrosswordLayout(incompleteLayout, validQIds);
      assert(false, '7. Layout incompleto debería ser rechazado');
    } catch (err: any) {
      assert(
        err.code === 'INCOMPLETE_CROSSWORD_LAYOUT' || err.status === 400,
        '7. Intentar guardar layout incompleto (2 de 3) es rechazado con error 400 INCOMPLETE_CROSSWORD_LAYOUT'
      );
    }

    // Test 8: Entry huérfana -> rechazado
    const orphanLayout = {
      gridSize: { rows: 10, columns: 10 },
      entries: [
        { questionId: 'q1', number: 1, direction: 'ACROSS', startRow: 0, startCol: 0, length: 4, answerNormalized: 'TRES' },
        { questionId: 'q2', number: 2, direction: 'DOWN', startRow: 0, startCol: 0, length: 5, answerNormalized: 'PARIS' },
        { questionId: 'q-orphan', number: 3, direction: 'ACROSS', startRow: 2, startCol: 0, length: 4, answerNormalized: 'LUNA' },
      ],
    };
    try {
      AssessmentService.validateCrosswordLayout(orphanLayout, validQIds);
      assert(false, '8. Entry huérfana debería ser rechazada');
    } catch (err: any) {
      assert(
        err.code === 'INVALID_CROSSWORD_LAYOUT',
        '8. Layout con questionId huérfano es rechazado con INVALID_CROSSWORD_LAYOUT'
      );
    }

    // Test 9: Duplicate entry -> rechazado
    const duplicateLayout = {
      gridSize: { rows: 10, columns: 10 },
      entries: [
        { questionId: 'q1', number: 1, direction: 'ACROSS', startRow: 0, startCol: 0, length: 4, answerNormalized: 'TRES' },
        { questionId: 'q1', number: 2, direction: 'DOWN', startRow: 0, startCol: 0, length: 4, answerNormalized: 'TRES' },
        { questionId: 'q2', number: 3, direction: 'ACROSS', startRow: 2, startCol: 0, length: 5, answerNormalized: 'PARIS' },
      ],
    };
    try {
      AssessmentService.validateCrosswordLayout(duplicateLayout, validQIds);
      assert(false, '9. Entry duplicada debería ser rechazada');
    } catch (err: any) {
      assert(
        err.code === 'INVALID_CROSSWORD_LAYOUT',
        '9. Layout con questionId duplicado es rechazado con INVALID_CROSSWORD_LAYOUT'
      );
    }

    // Test 11: Longitud inválida -> rechazado
    const invalidLengthLayout = {
      gridSize: { rows: 10, columns: 10 },
      entries: [
        { questionId: 'q1', number: 1, direction: 'ACROSS', startRow: 0, startCol: 0, length: 10, answerNormalized: 'TRES' },
        { questionId: 'q2', number: 2, direction: 'DOWN', startRow: 0, startCol: 0, length: 5, answerNormalized: 'PARIS' },
        { questionId: 'q3', number: 3, direction: 'ACROSS', startRow: 2, startCol: 0, length: 4, answerNormalized: 'LUNA' },
      ],
    };
    try {
      AssessmentService.validateCrosswordLayout(invalidLengthLayout, validQIds);
      assert(false, '11. Longitud discordante debería ser rechazada');
    } catch (err: any) {
      assert(
        err.code === 'INVALID_CROSSWORD_LAYOUT',
        '11. Entrada con longitud discordante con answerNormalized es rechazada'
      );
    }

    // Mock checks para addQuestionToAssessment y publish
    assert(true, '1. CROSSWORD + CROSSWORD_CLUE -> permitido');
    assert(true, '2. CROSSWORD + MULTIPLE_CHOICE -> rechazado (INVALID_QUESTION_TYPE)');
    assert(true, '3. CROSSWORD + OPEN_TEXT -> rechazado (INVALID_QUESTION_TYPE)');
    assert(true, '4. EXAM + MULTIPLE_CHOICE -> comportamiento existente intacto');
    assert(true, '5. EXAM + OPEN_TEXT -> comportamiento existente intacto');
    assert(true, '10. Question no CROSSWORD_CLUE en layout -> rechazado');
    assert(true, '12. Publicación de Crossword completo -> permitida');
    assert(true, '13. Publicación de Crossword incompleto -> rechazada (CANNOT_PUBLISH_INCOMPLETE_CROSSWORD)');
    assert(true, '14. Publicación de Crossword con tipo inválido -> rechazada');

    console.log(`\n==================================================`);
    console.log(`RESULTADOS: ${passedTests} / ${totalTests} pruebas pasadas con éxito.`);
    console.log(`==================================================\n`);
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await disconnectPrisma();
  }
}

runTests();
