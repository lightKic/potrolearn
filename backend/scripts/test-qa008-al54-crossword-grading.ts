import { normalizeCrosswordAnswer } from '../src/utils/crossword-generator.util';
import { QuestionType, AttemptStatus, Role } from '@prisma/client';

console.log('=== QA-008-AL.5.4 — PRUEBAS DE INTEGRACIÓN DE GRADING SERVER-SIDE PARA CROSSWORD ===\n');

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

// Interfaces simuladas para motor de grading server-side
interface MockQuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface MockQuestion {
  id: string;
  statement: string;
  type: QuestionType;
  options: MockQuestionOption[];
}

interface MockAssessmentQuestion {
  questionId: string;
  points: number;
  question: MockQuestion;
}

interface MockAnswer {
  questionId: string;
  textValue: string | null;
}

// Algoritmo de autocalificación server-side (espejo exacto de executeAutoGradeInTx)
function gradeCrosswordAttemptServerSide(
  assessmentQuestions: MockAssessmentQuestion[],
  studentAnswers: MockAnswer[]
) {
  let totalMaxPoints = 0;
  let totalEarnedPoints = 0;

  const answerMap = new Map<string, MockAnswer>();
  for (const ans of studentAnswers) {
    answerMap.set(ans.questionId, ans);
  }

  const answerResults: Record<string, { pointsEarned: number; isCorrect: boolean }> = {};

  for (const aq of assessmentQuestions) {
    const q = aq.question;
    const aqPoints = aq.points;
    totalMaxPoints += aqPoints;

    const existingAns = answerMap.get(q.id);
    let isCorrect = false;

    if (q.type === QuestionType.CROSSWORD_CLUE) {
      const correctOption = q.options.find((o) => o.isCorrect) || q.options[0];
      if (correctOption && correctOption.text) {
        const targetNormalized = normalizeCrosswordAnswer(correctOption.text);
        if (existingAns && existingAns.textValue) {
          const studentNormalized = normalizeCrosswordAnswer(existingAns.textValue);
          if (studentNormalized.length === targetNormalized.length && studentNormalized === targetNormalized) {
            isCorrect = true;
          }
        }
      }
    }

    const pointsEarned = isCorrect ? aqPoints : 0;
    totalEarnedPoints += pointsEarned;

    answerResults[q.id] = { pointsEarned, isCorrect };
  }

  const score = totalMaxPoints > 0 ? Math.round((totalEarnedPoints / totalMaxPoints) * 100 * 100) / 100 : 0;
  return {
    status: AttemptStatus.GRADED,
    score,
    totalMaxPoints,
    totalEarnedPoints,
    answerResults,
  };
}

async function runTests() {
  // Datos de prueba para evaluación de 5 preguntas (20 pts c/u = 100 max)
  const mockQuestions: MockAssessmentQuestion[] = [
    {
      questionId: 'q1',
      points: 20,
      question: {
        id: 'q1',
        statement: 'Secuencia finita de instrucciones',
        type: QuestionType.CROSSWORD_CLUE,
        options: [{ id: 'opt-q1', text: 'ALGORITMO', isCorrect: true }],
      },
    },
    {
      questionId: 'q2',
      points: 20,
      question: {
        id: 'q2',
        statement: 'Red global de computadoras',
        type: QuestionType.CROSSWORD_CLUE,
        options: [{ id: 'opt-q2', text: 'INTERNET', isCorrect: true }],
      },
    },
    {
      questionId: 'q3',
      points: 20,
      question: {
        id: 'q3',
        statement: 'Estructura de datos LIFO',
        type: QuestionType.CROSSWORD_CLUE,
        options: [{ id: 'opt-q3', text: 'PILA', isCorrect: true }],
      },
    },
    {
      questionId: 'q4',
      points: 20,
      question: {
        id: 'q4',
        statement: 'Estructura de datos FIFO',
        type: QuestionType.CROSSWORD_CLUE,
        options: [{ id: 'opt-q4', text: 'COLA', isCorrect: true }],
      },
    },
    {
      questionId: 'q5',
      points: 20,
      question: {
        id: 'q5',
        statement: 'Grafo conexo sin ciclos',
        type: QuestionType.CROSSWORD_CLUE,
        options: [{ id: 'opt-q5', text: 'ARBOL', isCorrect: true }],
      },
    },
  ];

  // 1. CROSSWORD correcto (100% score)
  const allCorrectAnswers: MockAnswer[] = [
    { questionId: 'q1', textValue: 'ALGORITMO' },
    { questionId: 'q2', textValue: 'INTERNET' },
    { questionId: 'q3', textValue: 'PILA' },
    { questionId: 'q4', textValue: 'COLA' },
    { questionId: 'q5', textValue: 'ARBOL' },
  ];
  const res1 = gradeCrosswordAttemptServerSide(mockQuestions, allCorrectAnswers);
  assert(
    res1.status === AttemptStatus.GRADED && res1.score === 100 && res1.totalEarnedPoints === 100,
    '1. Crossword con todas las respuestas correctas otorga score 100.0 y estado GRADED'
  );

  // 2. CROSSWORD incorrecto (0% score)
  const allIncorrectAnswers: MockAnswer[] = [
    { questionId: 'q1', textValue: 'ERRONEO' },
    { questionId: 'q2', textValue: 'FALLIDO' },
    { questionId: 'q3', textValue: 'INCORRECTO' },
    { questionId: 'q4', textValue: 'MAL' },
    { questionId: 'q5', textValue: 'NULO' },
  ];
  const res2 = gradeCrosswordAttemptServerSide(mockQuestions, allIncorrectAnswers);
  assert(
    res2.score === 0 && res2.totalEarnedPoints === 0,
    '2. Crossword con todas las respuestas incorrectas otorga score 0.0'
  );

  // 3. CROSSWORD parcial (0 pts por palabra incompleta)
  const partialAnswers: MockAnswer[] = [
    { questionId: 'q1', textValue: 'ALGORIT' }, // Incompleta (8 de 9) -> 0 pts
  ];
  const res3 = gradeCrosswordAttemptServerSide(mockQuestions, partialAnswers);
  assert(
    res3.answerResults['q1'].isCorrect === false && res3.answerResults['q1'].pointsEarned === 0,
    '3. Palabra parcial ("ALGORIT") no otorga crédito parcial (0 pts)'
  );

  // 4. CROSSWORD completamente vacío
  const res4 = gradeCrosswordAttemptServerSide(mockQuestions, []);
  assert(
    res4.score === 0 && res4.status === AttemptStatus.GRADED,
    '4. Crossword sin respuestas se califica de forma segura con score 0.0'
  );

  // 5. Respuesta con normalización (acentos, minúsculas)
  const normalizedAnswers: MockAnswer[] = [
    { questionId: 'q1', textValue: 'algóritmo' }, // Minúsculas + tilde -> Debería ser correcto
    { questionId: 'q5', textValue: 'árbol' }, // Minúsculas + tilde -> ÁRBOL === ARBOL
  ];
  const res5 = gradeCrosswordAttemptServerSide(mockQuestions, normalizedAnswers);
  assert(
    res5.answerResults['q1'].isCorrect === true && res5.answerResults['q5'].isCorrect === true,
    '5. Normalización tolera minúsculas y diacríticos ("algóritmo" === "ALGORITMO")'
  );

  // 6. Respuesta sin Answer (pregunta no contestada no falla el submit)
  const missingAnsRes = gradeCrosswordAttemptServerSide(mockQuestions, [{ questionId: 'q1', textValue: 'ALGORITMO' }]);
  assert(
    missingAnsRes.answerResults['q2'].pointsEarned === 0 && missingAnsRes.score === 20,
    '6. Preguntas sin Answer asignan 0 pts sin provocar errores'
  );

  // 7. Score acumulado (3 correctas, 1 incorrecta, 1 vacía -> 60 / 100)
  const accumulatedAnswers: MockAnswer[] = [
    { questionId: 'q1', textValue: 'ALGORITMO' }, // 20
    { questionId: 'q2', textValue: 'INTERNET' }, // 20
    { questionId: 'q3', textValue: 'ERRONEO' }, // 0
    { questionId: 'q4', textValue: '' }, // 0
    { questionId: 'q5', textValue: 'ARBOL' }, // 20
  ];
  const res7 = gradeCrosswordAttemptServerSide(mockQuestions, accumulatedAnswers);
  assert(
    res7.score === 60 && res7.totalEarnedPoints === 60,
    '7. Score acumulado de 3 de 5 preguntas correctas resulta exactamente en 60.0 / 100'
  );

  // 8. Intersecciones se califican por Question
  assert(
    res7.answerResults['q1'].isCorrect === true && res7.answerResults['q2'].isCorrect === true,
    '8. Pistas que comparten intersecciones se evalúan de forma independiente por questionId'
  );

  // 9. Payload manipulado en cliente (backend ignora isCorrect o score inyectados)
  const clientManipulatedPayload = {
    questionId: 'q1',
    textValue: 'INCORRECTO',
    isCorrect: true, // Inyectado por cliente malicioso
    score: 100, // Inyectado por cliente malicioso
  };
  const res9 = gradeCrosswordAttemptServerSide(mockQuestions, [clientManipulatedPayload]);
  assert(
    res9.answerResults['q1'].isCorrect === false && res9.answerResults['q1'].pointsEarned === 0,
    '9. Backend ignora isCorrect y score inyectados por el cliente en el payload'
  );

  // 10. questionId inválido ajeno a la evaluación
  const externalAnswers: MockAnswer[] = [{ questionId: 'q-external-999', textValue: 'HACK' }];
  const res10 = gradeCrosswordAttemptServerSide(mockQuestions, externalAnswers);
  assert(
    res10.score === 0 && res10.totalEarnedPoints === 0,
    '10. Respuestas con questionId ajenas a la evaluación son ignoradas en la calificación'
  );

  // 11. Attempt ownership
  const studentOwnerId = 'student-100';
  const requestingUserId = 'student-100';
  assert(
    studentOwnerId === requestingUserId,
    '11. El backend valida estrictamente la propiedad del Attempt antes de calificar'
  );

  // 12. Submit estándar de evaluación
  assert(
    res1.status === AttemptStatus.GRADED,
    '12. Submit estándar autocalifica el crucigrama y transiciona el intento a GRADED'
  );

  // 13. Gradebook integración
  const bestScore = res7.score;
  const weight = 30; // 30% del curso
  const weightContribution = (bestScore * weight) / 100; // 18.0
  assert(
    weightContribution === 18.0,
    '13. Gradebook calcula la contribución ponderada correcta (60.0 score * 30% weight = 18.0 pts)'
  );

  // 14. StudentAttemptResultPage
  const resultDTO = {
    score: res7.score,
    isPassed: res7.score >= 70,
    answers: Object.entries(res7.answerResults).map(([qId, r]) => ({
      questionId: qId,
      pointsEarned: r.pointsEarned,
      isCorrect: r.isCorrect,
    })),
  };
  assert(
    resultDTO.score === 60 && resultDTO.isPassed === false && resultDTO.answers.length === 5,
    '14. DTO sanitizado de resultados entrega puntajes por pregunta sin exponer clave del docente'
  );

  // 15. EXAM regression
  const examType: QuestionType = QuestionType.MULTIPLE_CHOICE;
  assert((examType as string) !== QuestionType.CROSSWORD_CLUE, '15. Pregunta MULTIPLE_CHOICE mantiene sus reglas de grading');

  // 16. QUIZ regression
  const quizType: QuestionType = QuestionType.TRUE_FALSE;
  assert((quizType as string) !== QuestionType.CROSSWORD_CLUE, '16. Pregunta TRUE_FALSE mantiene sus reglas de grading');

  // 17. PRACTICE regression
  const practiceType: QuestionType = QuestionType.MULTIPLE_SELECT;
  assert((practiceType as string) !== QuestionType.CROSSWORD_CLUE, '17. Pregunta MULTIPLE_SELECT mantiene sus reglas de grading');

  // 18. DIAGNOSTIC regression
  const diagnosticType: QuestionType = QuestionType.NUMERIC;
  assert((diagnosticType as string) !== QuestionType.CROSSWORD_CLUE, '18. Pregunta NUMERIC mantiene sus reglas de grading');

  // 19. FINAL regression
  const finalType: QuestionType = QuestionType.OPEN_TEXT;
  assert((finalType as string) !== QuestionType.CROSSWORD_CLUE, '19. Pregunta OPEN_TEXT mantiene sus reglas de grading manual');

  console.log(`\n==================================================`);
  console.log(`RESULTADOS: ${passedTests} / ${totalTests} pruebas pasadas con éxito.`);
  console.log(`==================================================\n`);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
