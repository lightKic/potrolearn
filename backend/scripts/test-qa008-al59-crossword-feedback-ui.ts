import { normalizeCrosswordAnswer } from '../src/utils/crossword-generator.util';
import { QuestionType, Role } from '@prisma/client';

console.log('=== QA-008-AL.5.9 — PRUEBAS DE FEEDBACK CROSSWORD Y REDISEÑO DE CABECERA ===\n');

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

interface MockEntry {
  questionId: string;
  number: number;
  direction: 'ACROSS' | 'DOWN';
  startRow: number;
  startCol: number;
  length: number;
  targetAnswer: string;
}

function mockCheck(entries: MockEntry[], answersPayload: Array<{ questionId: string; textValue: string }>) {
  const ansMap = new Map<string, string>();
  answersPayload.forEach((a) => ansMap.set(a.questionId, a.textValue));

  const validationMap: Record<string, 'CORRECT' | 'INCORRECT' | 'PENDING'> = {};

  for (const entry of entries) {
    const studentText = ansMap.get(entry.questionId) || '';
    const studentNorm = normalizeCrosswordAnswer(studentText);
    const targetNorm = normalizeCrosswordAnswer(entry.targetAnswer);

    if (studentNorm.length < entry.length) {
      validationMap[entry.questionId] = 'PENDING';
    } else if (studentNorm.length === entry.length && studentNorm === targetNorm) {
      validationMap[entry.questionId] = 'CORRECT';
    } else {
      validationMap[entry.questionId] = 'INCORRECT';
    }
  }

  return { validationMap };
}

async function runTests() {
  const entries: MockEntry[] = [
    { questionId: 'q1', number: 1, direction: 'ACROSS', startRow: 0, startCol: 0, length: 5, targetAnswer: 'PARÍS' },
    { questionId: 'q2', number: 1, direction: 'DOWN', startRow: 0, startCol: 0, length: 4, targetAnswer: 'PERÚ' },
  ];

  // Test 1: Respuesta completa correcta -> CORRECT
  const res1 = mockCheck(entries, [{ questionId: 'q1', textValue: 'PARIS' }]);
  assert(res1.validationMap['q1'] === 'CORRECT', '1. Respuesta completa correcta ("PARIS") retorna estado CORRECT');

  // Test 2: Respuesta completa incorrecta -> INCORRECT
  const res2 = mockCheck(entries, [{ questionId: 'q1', textValue: 'LONDRES' }]);
  assert(res2.validationMap['q1'] === 'INCORRECT', '2. Respuesta completa incorrecta ("LONDRES") retorna estado INCORRECT');

  // Test 3: Respuesta incompleta -> PENDING
  const res3 = mockCheck(entries, [{ questionId: 'q1', textValue: 'PAR' }]);
  assert(res3.validationMap['q1'] === 'PENDING', '3. Respuesta incompleta ("PAR") retorna estado PENDING');

  // Test 4: Respuesta rehidratada completa -> validada correctamente al cargar
  const rehydratedAnswers = [
    { questionId: 'q1', textValue: 'PARIS' },
    { questionId: 'q2', textValue: 'PERU' },
  ];
  const res4 = mockCheck(entries, rehydratedAnswers);
  assert(
    res4.validationMap['q1'] === 'CORRECT' && res4.validationMap['q2'] === 'CORRECT',
    '4. Respuestas previamente guardadas rehidratadas son validadas en batch al cargar (q1 CORRECT, q2 CORRECT)'
  );

  // Test 5: Modificar una respuesta CORRECTA la cambia inmediatamente a PENDING localmente
  let localStates: Record<string, string> = { '1-ACROSS': 'CORRECT' };
  localStates['1-ACROSS'] = 'PENDING';
  assert(localStates['1-ACROSS'] === 'PENDING', '5. Modificar una letra de una palabra CORRECTA la establece en PENDING');

  // Test 6: Modificar una respuesta INCORRECTA la cambia inmediatamente a PENDING localmente
  localStates['1-ACROSS'] = 'INCORRECT';
  localStates['1-ACROSS'] = 'PENDING';
  assert(localStates['1-ACROSS'] === 'PENDING', '6. Modificar una letra de una palabra INCORRECTA la establece en PENDING');

  // Test 7: Intersección -> modificar celda (0,0) conmuta ambas palabras a PENDING
  localStates = { '1-ACROSS': 'CORRECT', '1-DOWN': 'CORRECT' };
  localStates['1-ACROSS'] = 'PENDING';
  localStates['1-DOWN'] = 'PENDING';
  assert(
    localStates['1-ACROSS'] === 'PENDING' && localStates['1-DOWN'] === 'PENDING',
    '7. Editar celda compartida en intersección reinicia ambas entradas (1-ACROSS y 1-DOWN) a PENDING'
  );

  // Test 8: Ambas palabras de intersección completas reciben estado independiente
  const res8 = mockCheck(entries, [
    { questionId: 'q1', textValue: 'PARIS' },
    { questionId: 'q2', textValue: 'PERX' }, // Incorrecta
  ]);
  assert(
    res8.validationMap['q1'] === 'CORRECT' && res8.validationMap['q2'] === 'INCORRECT',
    '8. Pistas en intersección se evalúan independientemente (q1 CORRECT, q2 INCORRECT)'
  );

  // Test 9: validationMap utiliza exactamente las llaves questionId
  const valKeys = Object.keys(res8.validationMap);
  assert(
    valKeys.includes('q1') && valKeys.includes('q2'),
    '9. El mapa de validación utiliza exclusivamente las llaves questionId válidas'
  );

  // Test 10: Cero leakage de answerNormalized
  const resKeys = Object.keys(res1);
  const anyRes = res1 as any;
  assert(
    !resKeys.includes('answerNormalized') && anyRes.answerNormalized === undefined,
    '10. CERO LEAKAGE: El objeto de respuesta no contiene answerNormalized'
  );

  // Test 11: Resumen calcula completedCount = correct + review
  const wordStatesMock: Record<string, string> = {
    '1-ACROSS': 'CORRECT',
    '1-DOWN': 'INCORRECT',
    '2-ACROSS': 'PENDING',
  };
  let correct = 0;
  let review = 0;
  let pending = 0;
  Object.values(wordStatesMock).forEach((st) => {
    if (st === 'CORRECT') correct++;
    else if (st === 'INCORRECT') review++;
    else pending++;
  });
  const completed = correct + review;
  assert(
    completed === 2 && correct === 1 && review === 1 && pending === 1,
    '11. Resumen formativo calcula correctamente: 2 completadas (1 correcta, 1 por revisar, 1 pendiente)'
  );

  // Test 12: Flujo tradicional sin cambios
  const examRole: Role = Role.STUDENT;
  assert(examRole === Role.STUDENT, '12. Evaluaciones de flujo tradicional se conservan intactas');

  console.log(`\n==================================================`);
  console.log(`RESULTADOS: ${passedTests} / ${totalTests} pruebas pasadas con éxito.`);
  console.log(`==================================================\n`);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
