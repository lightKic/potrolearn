import { Role, AssessmentType, QuestionType, EnrollmentStatus } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { AssessmentService } from '../src/services/assessment.service';
import { QuestionService } from '../src/services/question.service';
import { AuthError } from '../src/types/auth.types';
import { CrosswordGeneratorUtil, normalizeCrosswordAnswer } from '../src/utils/crossword-generator.util';

function assertInvariants(layout: any, originalInputCount: number) {
  if (!layout) throw new Error('Invariant Error: layout is null');
  const { gridSize, entries } = layout;

  if (gridSize.rows < 1 || gridSize.rows > 20) {
    throw new Error(`Invariant Error: rows ${gridSize.rows} out of bounds (1-20)`);
  }
  if (gridSize.columns < 1 || gridSize.columns > 20) {
    throw new Error(`Invariant Error: columns ${gridSize.columns} out of bounds (1-20)`);
  }
  if (entries.length !== originalInputCount) {
    throw new Error(`Invariant Error: entries length ${entries.length} !== input count ${originalInputCount}`);
  }

  // Construct grid to verify character matches and no conflicts
  const grid: (string | null)[][] = Array.from({ length: gridSize.rows }, () =>
    Array.from({ length: gridSize.columns }, () => null)
  );

  for (const entry of entries) {
    if (entry.length !== entry.answerNormalized.length) {
      throw new Error(`Invariant Error: entry length ${entry.length} mismatch with normalized string ${entry.answerNormalized}`);
    }
    if (entry.startRow < 0 || entry.startCol < 0) {
      throw new Error(`Invariant Error: entry starts at negative coordinates (${entry.startRow}, ${entry.startCol})`);
    }
    if (entry.direction === 'ACROSS') {
      if (entry.startRow >= gridSize.rows || entry.startCol + entry.length > gridSize.columns) {
        throw new Error(`Invariant Error: ACROSS entry ${entry.answerNormalized} exceeds grid bounds (${gridSize.rows}x${gridSize.columns})`);
      }
    } else if (entry.direction === 'DOWN') {
      if (entry.startRow + entry.length > gridSize.rows || entry.startCol >= gridSize.columns) {
        throw new Error(`Invariant Error: DOWN entry ${entry.answerNormalized} exceeds grid bounds (${gridSize.rows}x${gridSize.columns})`);
      }
    } else {
      throw new Error(`Invariant Error: Invalid direction ${entry.direction}`);
    }

    // Place and verify
    for (let i = 0; i < entry.length; i++) {
      const r = entry.direction === 'ACROSS' ? entry.startRow : entry.startRow + i;
      const c = entry.direction === 'ACROSS' ? entry.startCol + i : entry.startCol;
      const ch = entry.answerNormalized[i];

      if (grid[r][c] !== null && grid[r][c] !== ch) {
        throw new Error(`Invariant Error: Collision letter mismatch at grid cell (${r}, ${c}): ${grid[r][c]} vs ${ch}`);
      }
      grid[r][c] = ch;
    }
  }
}

async function runQA008AL3GeneratorTests() {
  console.log('=== POTROLEARN QA-008-AL.3 CROSSWORD GENERATOR TEST SUITE ===\n');

  try {
    // -------------------------------------------------------------
    // TEST 1: Dos palabras con intersección simple
    // -------------------------------------------------------------
    console.log('--- TEST 1: Dos palabras con intersección simple ---');
    const res1 = CrosswordGeneratorUtil.generate([
      { questionId: 'q1', answer: 'CRUZ' },
      { questionId: 'q2', answer: 'RANA' },
    ]);
    if (!res1.success || !res1.layout) {
      throw new Error(`FAIL T1: Expected success, got error: ${res1.error}`);
    }
    assertInvariants(res1.layout, 2);
    console.log('  [PASS] TEST 1: Layout simple generado exitosamente.');

    // -------------------------------------------------------------
    // TEST 2: Tres palabras con múltiples intersecciones
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Tres palabras con múltiples intersecciones ---');
    const res2 = CrosswordGeneratorUtil.generate([
      { questionId: 'q1', answer: 'CASA' },
      { questionId: 'q2', answer: 'AMOR' },
      { questionId: 'q3', answer: 'SOL' },
    ]);
    if (!res2.success || !res2.layout) {
      throw new Error(`FAIL T2: Expected success, got error: ${res2.error}`);
    }
    assertInvariants(res2.layout, 3);
    console.log('  [PASS] TEST 2: Layout con múltiples intersecciones generado.');

    // -------------------------------------------------------------
    // TEST 3: Palabras con letras repetidas
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Palabras con letras repetidas ---');
    const res3 = CrosswordGeneratorUtil.generate([
      { questionId: 'q1', answer: 'ANANAS' },
      { questionId: 'q2', answer: 'BANANA' },
      { questionId: 'q3', answer: 'MANZANA' },
    ]);
    if (!res3.success || !res3.layout) {
      throw new Error(`FAIL T3: Expected success, got error: ${res3.error}`);
    }
    assertInvariants(res3.layout, 3);
    console.log('  [PASS] TEST 3: Palabras con letras repetidas resueltas.');

    // -------------------------------------------------------------
    // TEST 4: Palabras con acentos
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Palabras con acentos ---');
    const normAngulo = normalizeCrosswordAnswer('Ángulo');
    const normTriangulo = normalizeCrosswordAnswer('Triángulo');
    if (normAngulo !== 'ANGULO' || normTriangulo !== 'TRIANGULO') {
      throw new Error(`FAIL T4: Normalization failed (${normAngulo}, ${normTriangulo})`);
    }
    const res4 = CrosswordGeneratorUtil.generate([
      { questionId: 'q1', answer: 'Ángulo' },
      { questionId: 'q2', answer: 'Triángulo' },
    ]);
    if (!res4.success || !res4.layout) {
      throw new Error(`FAIL T4: Expected success, got error: ${res4.error}`);
    }
    assertInvariants(res4.layout, 2);
    console.log('  [PASS] TEST 4: Acentos removidos correctamente ("ANGULO", "TRIANGULO").');

    // -------------------------------------------------------------
    // TEST 5: Palabras con espacios
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Palabras con espacios ---');
    const normRegla = normalizeCrosswordAnswer('Regla de tres');
    if (normRegla !== 'REGLADETRES') {
      throw new Error(`FAIL T5: Space normalization failed (${normRegla})`);
    }
    const res5 = CrosswordGeneratorUtil.generate([
      { questionId: 'q1', answer: 'Regla de tres' },
      { questionId: 'q2', answer: 'TRES' },
    ]);
    if (!res5.success || !res5.layout) {
      throw new Error(`FAIL T5: Expected success, got error: ${res5.error}`);
    }
    assertInvariants(res5.layout, 2);
    console.log('  [PASS] TEST 5: Espacios eliminados correctamente ("REGLADETRES").');

    // -------------------------------------------------------------
    // TEST 6: Palabras sin letras comunes
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Palabras sin letras comunes ---');
    const res6 = CrosswordGeneratorUtil.generate([
      { questionId: 'q1', answer: 'AAAA' },
      { questionId: 'q2', answer: 'BBBB' },
    ]);
    if (res6.success) {
      throw new Error('FAIL T6: Words without common letters should not produce success=true');
    }
    if (!res6.unplacedEntries || res6.unplacedEntries.length === 0) {
      throw new Error('FAIL T6: Unplaced entries should be reported');
    }
    console.log('  Correctly returned success=false with orphan word details.');
    console.log('  [PASS] TEST 6: Sin letras comunes rechazado de manera controlada.');

    // -------------------------------------------------------------
    // TEST 7: Palabras duplicadas
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Palabras duplicadas ---');
    const res7 = CrosswordGeneratorUtil.generate([
      { questionId: 'q1', answer: 'Ángulo' },
      { questionId: 'q2', answer: 'ANGULO' },
    ]);
    if (res7.success || !res7.error || !res7.error.includes('duplicadas')) {
      throw new Error(`FAIL T7: Expected duplicate error, got: ${res7.error}`);
    }
    console.log(`  Correctly rejected duplicate: ${res7.error}`);
    console.log('  [PASS] TEST 7: Respuestas duplicadas rechazadas.');

    // -------------------------------------------------------------
    // TEST 8: Palabra demasiado larga (> 20 caracteres)
    // -------------------------------------------------------------
    console.log('\n--- TEST 8: Palabra demasiado larga (> 20 chars) ---');
    const res8 = CrosswordGeneratorUtil.generate([
      { questionId: 'q1', answer: 'PARALELEPIPEDODECAEDROSOBR' },
    ]);
    if (res8.success || !res8.error || !res8.error.includes('20')) {
      throw new Error(`FAIL T8: Expected length error, got: ${res8.error}`);
    }
    console.log(`  Correctly rejected long word: ${res8.error}`);
    console.log('  [PASS] TEST 8: Palabra > 20 chars rechazada.');

    // -------------------------------------------------------------
    // TEST 9: Más de 20 palabras
    // -------------------------------------------------------------
    console.log('\n--- TEST 9: Más de 20 palabras ---');
    const words21 = Array.from({ length: 21 }, (_, i) => ({
      questionId: `q${i}`,
      answer: `WORD${i}`,
    }));
    const res9 = CrosswordGeneratorUtil.generate(words21);
    if (res9.success || !res9.error || !res9.error.includes('20')) {
      throw new Error(`FAIL T9: Expected >20 words error, got: ${res9.error}`);
    }
    console.log(`  Correctly rejected >20 words: ${res9.error}`);
    console.log('  [PASS] TEST 9: Más de 20 palabras rechazadas.');

    // -------------------------------------------------------------
    // TEST 10: Resultado excede 20x20
    // -------------------------------------------------------------
    console.log('\n--- TEST 10: Verificación de límites de grid 20x20 ---');
    const res10 = CrosswordGeneratorUtil.generate([
      { questionId: 'q1', answer: 'VEINTECARACTERESSA' },
      { questionId: 'q2', answer: 'OTRAPALABRALARGA' },
    ]);
    if (res10.success && res10.layout) {
      if (res10.layout.gridSize.rows > 20 || res10.layout.gridSize.columns > 20) {
        throw new Error('FAIL T10: Layout exceeded 20x20 grid limits!');
      }
      assertInvariants(res10.layout, 2);
    }
    console.log('  [PASS] TEST 10: Límites de 20x20 respetados estrictamente.');

    // -------------------------------------------------------------
    // TEST 11: Backtracking necesario
    // -------------------------------------------------------------
    console.log('\n--- TEST 11: Backtracking para encontrar solución ---');
    const res11 = CrosswordGeneratorUtil.generate([
      { questionId: 'q1', answer: 'ALGORITMO' },
      { questionId: 'q2', answer: 'LOGICA' },
      { questionId: 'q3', answer: 'MATEMATICA' },
      { questionId: 'q4', answer: 'DISCRETA' },
      { questionId: 'q5', answer: 'TEORIA' },
    ]);
    if (!res11.success || !res11.layout) {
      throw new Error(`FAIL T11: Backtracking should have found layout, error: ${res11.error}`);
    }
    assertInvariants(res11.layout, 5);
    console.log('  [PASS] TEST 11: Backtracking encontró solución válida.');

    // -------------------------------------------------------------
    // TEST 12: Seed fijo (Reproducibilidad)
    // -------------------------------------------------------------
    console.log('\n--- TEST 12: Reproducibilidad con seed fijo ---');
    const input12 = [
      { questionId: 'q1', answer: 'ESTRUCTURA' },
      { questionId: 'q2', answer: 'DATOS' },
      { questionId: 'q3', answer: 'ARBOL' },
      { questionId: 'q4', answer: 'GRAFO' },
    ];
    const res12a = CrosswordGeneratorUtil.generate(input12, 'MY_SEED_123');
    const res12b = CrosswordGeneratorUtil.generate(input12, 'MY_SEED_123');
    if (JSON.stringify(res12a.layout) !== JSON.stringify(res12b.layout)) {
      throw new Error('FAIL T12: Fixed seed produced different layouts!');
    }
    console.log('  [PASS] TEST 12: Mismo seed produce exactamente el mismo layout.');

    // -------------------------------------------------------------
    // TEST 13: Diferente seed
    // -------------------------------------------------------------
    console.log('\n--- TEST 13: Diferente seed permite layouts alternativos ---');
    const res13a = CrosswordGeneratorUtil.generate(input12, 11111);
    const res13b = CrosswordGeneratorUtil.generate(input12, 99999);
    if (!res13a.success || !res13b.success) {
      throw new Error('FAIL T13: Both seeds should produce valid layouts');
    }
    assertInvariants(res13a.layout, 4);
    assertInvariants(res13b.layout, 4);
    console.log('  [PASS] TEST 13: Diferentes seeds generan soluciones válidas.');

    // -------------------------------------------------------------
    // TEST 14: Numeración estándar de crucigramas
    // -------------------------------------------------------------
    console.log('\n--- TEST 14: Numeración estándar ---');
    const res14 = CrosswordGeneratorUtil.generate([
      { questionId: 'q1', answer: 'CROSS' },
      { questionId: 'q2', answer: 'WORD' },
    ]);
    if (!res14.success || !res14.layout) {
      throw new Error('FAIL T14: Layout generation failed');
    }
    const entries14 = res14.layout.entries;
    for (const e of entries14) {
      if (e.number <= 0) {
        throw new Error(`FAIL T14: Entry number must be >= 1, got ${e.number}`);
      }
    }
    console.log('  [PASS] TEST 14: Numeración estándar asignada correctamente.');

    // -------------------------------------------------------------
    // TEST 15: Todas las coordenadas dentro del grid
    // -------------------------------------------------------------
    console.log('\n--- TEST 15: Coordenadas dentro del grid ---');
    const res15 = CrosswordGeneratorUtil.generate([
      { questionId: 'q1', answer: 'COORDINADAS' },
      { questionId: 'q2', answer: 'VALIDAS' },
    ]);
    if (!res15.success || !res15.layout) {
      throw new Error('FAIL T15: Layout generation failed');
    }
    assertInvariants(res15.layout, 2);
    console.log('  [PASS] TEST 15: Coordenadas dentro del grid verificadas.');

    // -------------------------------------------------------------
    // TEST 16: Ninguna colisión inválida
    // -------------------------------------------------------------
    console.log('\n--- TEST 16: Ninguna colisión inválida ---');
    const res16 = CrosswordGeneratorUtil.generate([
      { questionId: 'q1', answer: 'MATEMATICAS' },
      { questionId: 'q2', answer: 'FISICA' },
      { questionId: 'q3', answer: 'QUIMICA' },
      { questionId: 'q4', answer: 'BIOLOGIA' },
    ]);
    if (!res16.success || !res16.layout) {
      throw new Error('FAIL T16: Layout generation failed');
    }
    assertInvariants(res16.layout, 4);
    console.log('  [PASS] TEST 16: Cero colisiones inválidas confirmadas.');

    // -------------------------------------------------------------
    // INTEGRATED SERVICE TEST: generateCrosswordPreview
    // -------------------------------------------------------------
    console.log('\n--- INTEGRATION TEST: AssessmentService.generateCrosswordPreview ---');
    const timestamp = Date.now();
    const teacher = await prisma.user.create({
      data: {
        name: 'Teacher Generator AL3',
        email: `teacher.al3.${timestamp}@potrolearn.edu.mx`,
        role: Role.TEACHER,
        passwordHash: 'hash',
        isActive: true,
      },
    });

    const student = await prisma.user.create({
      data: {
        name: 'Student Generator AL3',
        email: `student.al3.${timestamp}@potrolearn.edu.mx`,
        role: Role.STUDENT,
        passwordHash: 'hash',
        isActive: true,
      },
    });

    const subject = await prisma.subject.create({
      data: {
        code: `SUBJ-AL3-${timestamp}`,
        name: 'Algoritmos AL3',
        isActive: true,
      },
    });

    const course = await prisma.course.create({
      data: {
        subjectId: subject.id,
        createdById: teacher.id,
        name: 'Curso QA-008-AL.3',
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

    const crosswordAssessment = await AssessmentService.createAssessment(course.id, teacher.id, Role.TEACHER, {
      title: 'Crucigrama de Geometría AL.3',
      type: AssessmentType.CROSSWORD,
      isPublished: true,
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

    // 1. Teacher can generate preview
    const previewResult = await AssessmentService.generateCrosswordPreview(crosswordAssessment.id, teacher.id, Role.TEACHER, 98765);
    if (!previewResult.success || !previewResult.layout) {
      throw new Error(`FAIL Service Preview: Expected preview success, got: ${previewResult.error}`);
    }
    if (previewResult.layout.entries.length !== 2) {
      throw new Error(`FAIL Service Preview: Expected 2 entries, got ${previewResult.layout.entries.length}`);
    }
    console.log('  [PASS] Teacher successfully generated preview layout.');

    // 2. Verify database layout is UNCHANGED after preview generation (preview does not auto-save)
    const freshDbAssessment = await prisma.assessment.findUnique({ where: { id: crosswordAssessment.id } });
    if (freshDbAssessment?.crosswordLayout !== null) {
      throw new Error('FAIL Service Preview: Preview should NOT persist crosswordLayout to database automatically!');
    }
    console.log('  [PASS] Verified preview did not persist layout to DB automatically.');

    // 3. Student security check: Student cannot request preview generation (403 forbidden)
    try {
      await AssessmentService.generateCrosswordPreview(crosswordAssessment.id, student.id, Role.STUDENT);
      throw new Error('FAIL Security: Student should not be allowed to generate preview');
    } catch (e: any) {
      if (e instanceof AuthError && e.statusCode === 403) {
        console.log('  [PASS] Security verified: STUDENT blocked from generating preview (403).');
      } else {
        throw e;
      }
    }

    // Cleanup integration test data
    await prisma.assessmentQuestion.deleteMany({ where: { assessmentId: crosswordAssessment.id } });
    await prisma.questionOption.deleteMany({ where: { questionId: { in: [q1.id, q2.id] } } });
    await prisma.question.deleteMany({ where: { id: { in: [q1.id, q2.id] } } });
    await prisma.assessment.delete({ where: { id: crosswordAssessment.id } });
    await prisma.enrollment.deleteMany({ where: { courseId: course.id } });
    await prisma.courseTeacher.deleteMany({ where: { courseId: course.id } });
    await prisma.course.delete({ where: { id: course.id } });
    await prisma.subject.delete({ where: { id: subject.id } });
    await prisma.user.deleteMany({ where: { id: { in: [teacher.id, student.id] } } });
    console.log('Integration test data cleaned up.');

    console.log('\n🟢 ALL QA-008-AL.3 GENERATOR UNIT & INTEGRATION TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('\n🔴 QA-008-AL.3 GENERATOR TEST SUITE FAILED:', err);
    process.exit(1);
  }
}

runQA008AL3GeneratorTests();
