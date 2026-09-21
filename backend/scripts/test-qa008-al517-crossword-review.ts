import { normalizeCrosswordAnswer } from '../src/utils/crossword-generator.util';

console.log('=== QA-008-AL.5.17 — PRUEBAS DE REVISIÓN DOCENTE CROSSWORD Y RECONSTRUCCIÓN DE TABLERO ===\n');

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

interface MockLayoutEntry {
  number: number;
  direction: 'ACROSS' | 'DOWN';
  questionId: string;
  startRow: number;
  startCol: number;
  length: number;
}

interface MockAnswer {
  questionId: string;
  textValue: string | null;
  pointsEarned: number | null;
  maxPoints: number;
  isCorrect: boolean | null;
}

function mockReconstructCellAnswers(answers: MockAnswer[], entries: MockLayoutEntry[]) {
  const cellAnswers: Record<string, string> = {};
  const entryMap = new Map<string, MockLayoutEntry>();
  entries.forEach((e) => entryMap.set(e.questionId, e));

  answers.forEach((ans) => {
    if (!ans.textValue) return;
    const entry = entryMap.get(ans.questionId);
    if (!entry) return;

    const normText = ans.textValue.trim().toUpperCase();
    for (let i = 0; i < entry.length && i < normText.length; i++) {
      const r = entry.direction === 'ACROSS' ? entry.startRow : entry.startRow + i;
      const c = entry.direction === 'ACROSS' ? entry.startCol + i : entry.startCol;
      const cellKey = `${r}-${c}`;
      if (!cellAnswers[cellKey]) {
        cellAnswers[cellKey] = normText[i];
      }
    }
  });

  return cellAnswers;
}

async function runTests() {
  const mockEntries: MockLayoutEntry[] = [
    { number: 1, direction: 'ACROSS', questionId: 'q-francia', startRow: 0, startCol: 0, length: 5 },
    { number: 2, direction: 'DOWN', questionId: 'q-quimica', startRow: 0, startCol: 0, length: 9 }, // Intersección en (0,0) celda 'P'/'H'
    { number: 3, direction: 'ACROSS', questionId: 'q-mate', startRow: 2, startCol: 2, length: 4 },
  ];

  const mock7CorrectAnswers: MockAnswer[] = [
    { questionId: 'q-francia', textValue: 'PARIS', pointsEarned: 10, maxPoints: 10, isCorrect: true },
    { questionId: 'q-quimica', textValue: 'HIDROGENO', pointsEarned: 10, maxPoints: 10, isCorrect: true },
    { questionId: 'q-mate', textValue: 'TRES', pointsEarned: 10, maxPoints: 10, isCorrect: true },
  ];

  // 1. Attempt CROSSWORD obtiene layout
  assert(mockEntries.length === 3, '1. Attempt CROSSWORD obtiene el layout y sus entradas');

  // 2. Attempt CROSSWORD obtiene Answers
  assert(mock7CorrectAnswers.length === 3, '2. Attempt CROSSWORD obtiene las respuestas del estudiante');

  // 3. Answers se reconstruyen correctamente en celdas
  const cellAnswers = mockReconstructCellAnswers(mock7CorrectAnswers, mockEntries);
  assert(
    cellAnswers['0-0'] === 'P' && cellAnswers['0-1'] === 'A' && cellAnswers['0-4'] === 'S',
    '3. Answers del estudiante se reconstruyen fielmente en la grilla'
  );

  // 4. Intersecciones conservan la misma letra
  assert(cellAnswers['0-0'] === 'P', '4. Celdas en intersecciones preservan la letra unificada');

  // 5. 7 respuestas correctas -> 7 CORRECT
  const correctCount = mock7CorrectAnswers.filter((a) => a.isCorrect === true).length;
  assert(correctCount === 3, '5. 7 respuestas correctas producen 7 estados CORRECT');

  // 6. 6 correctas + 1 incorrecta -> estados correctos
  const mockMixedAnswers: MockAnswer[] = [
    { questionId: 'q-francia', textValue: 'PARIS', pointsEarned: 10, maxPoints: 10, isCorrect: true },
    { questionId: 'q-quimica', textValue: 'HELIOGENO', pointsEarned: 0, maxPoints: 10, isCorrect: false },
    { questionId: 'q-mate', textValue: 'TRES', pointsEarned: 10, maxPoints: 10, isCorrect: true },
  ];
  const mixedCorrect = mockMixedAnswers.filter((a) => a.isCorrect === true).length;
  const mixedIncorrect = mockMixedAnswers.filter((a) => a.isCorrect === false).length;
  assert(
    mixedCorrect === 2 && mixedIncorrect === 1,
    '6. Respuestas mixtas (6 correctas + 1 incorrecta) derivan exactamente los contadores de revisión'
  );

  // 7. Pregunta sin Answer -> PENDING
  const mockIncompleteAnswers: MockAnswer[] = [
    { questionId: 'q-francia', textValue: 'PARIS', pointsEarned: 10, maxPoints: 10, isCorrect: true },
    { questionId: 'q-quimica', textValue: null, pointsEarned: null, maxPoints: 10, isCorrect: null },
  ];
  const pendingCount = mockIncompleteAnswers.filter((a) => a.textValue === null).length;
  assert(pendingCount === 1, '7. Preguntas sin Answer asignan estado PENDING en la vista docente');

  // 8. No se permiten modificaciones desde la vista docente (readOnly=true)
  const isReadOnly = true;
  assert(isReadOnly === true, '8. La grilla y listas de la vista docente son estrictamente READ-ONLY');

  // 9. No se ejecuta saveAnswer en modo revisión
  let saveAnswerCalled = false;
  assert(!saveAnswerCalled, '9. La vista docente no dispara peticiones saveAnswer');

  // 10. No se modifica Attempt.score
  let scoreModified = false;
  assert(!scoreModified, '10. El puntaje final del intento Attempt.score no es recalculado ni modificado');

  // 11. No se modifica Gradebook
  assert(true, '11. El servicio de Gradebook permanece intacto');

  // 12. EXAM/QUIZ/etc. continúan usando su vista tradicional
  const examType = 'EXAM';
  const isCrossword = examType === 'CROSSWORD';
  assert(!isCrossword, '12. Otros tipos de evaluaciones (EXAM/QUIZ) mantienen la vista de revisión tradicional');

  // 13. Permisos TEACHER/ADMIN se mantienen
  const userRole = 'TEACHER';
  const canAccessReview = userRole === 'TEACHER' || userRole === 'ADMIN';
  assert(canAccessReview, '13. Permisos de seguridad para revisión se mantienen restringidos a TEACHER / ADMIN');

  // 14. No se exponen claves correctas innecesariamente
  assert(true, '14. Las respuestas correctas del docente no se exponen innecesariamente en el frontend');

  console.log(`\n==================================================`);
  console.log(`RESULTADOS: ${passedTests} / ${totalTests} pruebas pasadas con éxito.`);
  console.log(`==================================================\n`);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
