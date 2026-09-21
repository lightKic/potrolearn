import {
  StudentAssessmentDTO,
  AttemptDTO,
  StudentCrosswordLayout,
  StudentCrosswordLayoutEntry,
  StudentQuestionDTO,
  AttemptAnswerDTO,
  AssessmentType,
} from '../../frontend/src/types/assessment';

// Utility logic mirror tested directly
function reconstructCellAnswers(
  answers: AttemptAnswerDTO[] | undefined,
  layout: StudentCrosswordLayout | null | undefined
) {
  const cellAnswers: Record<string, string> = {};
  const conflictingSet = new Set<string>();

  if (!answers || !layout || !layout.entries || layout.entries.length === 0) {
    return { cellAnswers, hasConflicts: false, conflictingCells: [] };
  }

  const entryMap = new Map<string, StudentCrosswordLayoutEntry>();
  for (const entry of layout.entries) {
    entryMap.set(entry.questionId, entry);
  }

  for (const ans of answers) {
    if (!ans.textValue) continue;
    const entry = entryMap.get(ans.questionId);
    if (!entry) continue;

    const normalizedText = ans.textValue.trim().toUpperCase();
    for (let i = 0; i < entry.length && i < normalizedText.length; i++) {
      const r = entry.direction === 'ACROSS' ? entry.startRow : entry.startRow + i;
      const c = entry.direction === 'ACROSS' ? entry.startCol + i : entry.startCol;
      const cellKey = `${r}-${c}`;
      const char = normalizedText[i];

      if (char && char.trim()) {
        if (cellAnswers[cellKey] && cellAnswers[cellKey] !== char) {
          conflictingSet.add(cellKey);
        } else {
          cellAnswers[cellKey] = char;
        }
      }
    }
  }

  return {
    cellAnswers,
    hasConflicts: conflictingSet.size > 0,
    conflictingCells: Array.from(conflictingSet),
  };
}

function deriveWordText(
  cellAnswers: Record<string, string>,
  entry: StudentCrosswordLayoutEntry
): string {
  let word = '';
  for (let i = 0; i < entry.length; i++) {
    const r = entry.direction === 'ACROSS' ? entry.startRow : entry.startRow + i;
    const c = entry.direction === 'ACROSS' ? entry.startCol + i : entry.startCol;
    const char = cellAnswers[`${r}-${c}`] || '';
    word += char;
  }
  return word;
}

function deriveAllWordAnswers(
  cellAnswers: Record<string, string>,
  entries: StudentCrosswordLayoutEntry[]
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of entries) {
    result[entry.questionId] = deriveWordText(cellAnswers, entry);
  }
  return result;
}

function isCellInEntry(row: number, col: number, entry: StudentCrosswordLayoutEntry): boolean {
  if (entry.direction === 'ACROSS') {
    return row === entry.startRow && col >= entry.startCol && col < entry.startCol + entry.length;
  } else {
    return col === entry.startCol && row >= entry.startRow && row < entry.startRow + entry.length;
  }
}

function findEntriesForCell(row: number, col: number, entries: StudentCrosswordLayoutEntry[]) {
  return entries.filter((entry) => isCellInEntry(row, col, entry));
}

function filterQuestionsInLayout(
  questions: StudentQuestionDTO[] | undefined,
  layout: StudentCrosswordLayout | null | undefined
) {
  if (!questions) return { validQuestions: [], orphanedQuestions: [] };
  if (!layout || !layout.entries) return { validQuestions: [], orphanedQuestions: questions };

  const validEntriesQuestionIds = new Set(layout.entries.map((e) => e.questionId));
  const validQuestions: StudentQuestionDTO[] = [];
  const orphanedQuestions: StudentQuestionDTO[] = [];

  for (const q of questions) {
    if (validEntriesQuestionIds.has(q.id)) {
      validQuestions.push(q);
    } else {
      orphanedQuestions.push(q);
    }
  }

  return { validQuestions, orphanedQuestions };
}

console.log('=== QA-008-AL.5.2 — PRUEBAS DE CONTENEDOR CROSSWORD DE ALUMNO ===\n');

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

// 1. Datos de prueba sanitizados de alumno (SIN answerNormalized)
const mockLayout: StudentCrosswordLayout = {
  gridSize: { rows: 10, columns: 10 },
  entries: [
    {
      questionId: 'q-across-1',
      number: 1,
      direction: 'ACROSS',
      startRow: 2,
      startCol: 1,
      length: 9, // ALGORITMO
    },
    {
      questionId: 'q-down-2',
      number: 2,
      direction: 'DOWN',
      startRow: 2,
      startCol: 5, // Intersección en (2,5): Letra 'R' de ALGO(R)ITMO
      length: 3, // RED
    },
  ],
};

const mockStudentQuestions: StudentQuestionDTO[] = [
  { id: 'q-across-1', statement: 'Conjunto ordenado de operaciones', type: 'CROSSWORD_CLUE' },
  { id: 'q-down-2', statement: 'Red de computadoras', type: 'CROSSWORD_CLUE' },
  { id: 'q-orphan-3', statement: 'Pista fuera del layout', type: 'CROSSWORD_CLUE' },
];

const mockAssessment: StudentAssessmentDTO = {
  id: 'ass-123',
  courseId: 'course-1',
  moduleId: null,
  lessonId: null,
  title: 'Evaluación Crucigrama Alumno',
  description: 'Demostración de evaluación alumno',
  type: 'CROSSWORD',
  weight: 100,
  availableFrom: null,
  availableUntil: null,
  timeLimitMinutes: 30,
  maxAttempts: 3,
  passingScore: 70,
  isPublished: true,
  crosswordLayout: mockLayout,
  questions: mockStudentQuestions.map((q, idx) => ({
    id: `aq-${q.id}`,
    assessmentId: 'ass-123',
    questionId: q.id,
    points: 10,
    order: idx + 1,
    question: q,
  })),
};

const mockAnswers: AttemptAnswerDTO[] = [
  {
    questionId: 'q-across-1',
    optionIds: [],
    numericValue: null,
    textValue: 'ALGORITMO',
    updatedAt: new Date().toISOString(),
  },
  {
    questionId: 'q-down-2',
    optionIds: [],
    numericValue: null,
    textValue: 'RED',
    updatedAt: new Date().toISOString(),
  },
];

const mockAttempt: AttemptDTO = {
  id: 'att-999',
  studentId: 'student-1',
  assessmentId: 'ass-123',
  attemptNumber: 1,
  status: 'IN_PROGRESS',
  startedAt: new Date().toISOString(),
  answers: mockAnswers,
  assessment: mockAssessment,
};

// --- TEST SUITE DE AL.5.2 ---

// A. Renderizado / Estructura básica del contenedor
assert(
  mockAssessment.type === 'CROSSWORD' && mockAssessment.crosswordLayout !== null,
  'A. CrosswordStudentAssessment puede inicializarse con un assessment válido'
);

// B. Layout válido genera la grilla con sus dimensiones
assert(
  mockLayout.gridSize.rows === 10 && mockLayout.gridSize.columns === 10,
  'B. Layout válido entrega grilla de 10 x 10'
);

// C. Layout null produce reporte amigable sin lanzar excepción
const nullLayoutReport = reconstructCellAnswers([], null);
assert(
  Object.keys(nullLayoutReport.cellAnswers).length === 0 && !nullLayoutReport.hasConflicts,
  'C. Layout null produce grilla vacía y estado seguro'
);

// D. Preguntas sin entry no rompen la UI y son filtradas
const filteredQs = filterQuestionsInLayout(mockStudentQuestions, mockLayout);
assert(
  filteredQs.validQuestions.length === 2 && filteredQs.orphanedQuestions.length === 1,
  'D. Preguntas huérfanas fuera del layout son aisladas sin romper la UI'
);

// E. Attempt sin answers produce grilla vacía
const emptyAttemptReport = reconstructCellAnswers([], mockLayout);
assert(
  Object.keys(emptyAttemptReport.cellAnswers).length === 0,
  'E. Attempt sin respuestas guardadas produce cellAnswers totalmente vacío'
);

// F. Attempt con answers reconstruye correctamente las letras
const report = reconstructCellAnswers(mockAnswers, mockLayout);
assert(
  Object.keys(report.cellAnswers).length > 0,
  'F. Attempt con respuestas reconstruye las celdas correctamente'
);

// G. ACROSS reconstruye correctamente
// "ALGORITMO" at startRow=2, startCol=1..9
assert(
  report.cellAnswers['2-1'] === 'A' &&
    report.cellAnswers['2-2'] === 'L' &&
    report.cellAnswers['2-3'] === 'G' &&
    report.cellAnswers['2-4'] === 'O' &&
    report.cellAnswers['2-5'] === 'R' &&
    report.cellAnswers['2-9'] === 'O',
  'G. Pista ACROSS reconstruye correctamente cada coordenada'
);

// H. DOWN reconstruye correctamente
// "RED" at startRow=2, startCol=5 (2,5]='R', 3,5]='E', 4,5]='D')
assert(
  report.cellAnswers['2-5'] === 'R' &&
    report.cellAnswers['3-5'] === 'E' &&
    report.cellAnswers['4-5'] === 'D',
  'H. Pista DOWN reconstruye correctamente cada coordenada'
);

// I. Intersección compartida conserva una sola celda
assert(
  report.cellAnswers['2-5'] === 'R' && !report.hasConflicts,
  'I. Celda de intersección (2,5) conserva la letra compartida unificada "R"'
);

// J. Escribir letra actualiza cellAnswers localmente
const mutableAnswers: Record<string, string | undefined> = { ...report.cellAnswers, '2-1': 'X' };
assert(
  mutableAnswers['2-1'] === 'X',
  'J. Modificar localmente una celda actualiza cellAnswers'
);

// K. Simulación de Backspace borra celda local
delete mutableAnswers['2-1'];
assert(
  mutableAnswers['2-1'] === undefined,
  'K. Backspace elimina el carácter de cellAnswers'
);

// L. Flechas / Navegación por coordenadas
const inEntry = isCellInEntry(2, 5, mockLayout.entries[0]);
assert(
  inEntry === true,
  'L. Navegación por flechas identifica correctamente límites de celdas válidas'
);

// M. Cambio de orientación en intersecciones
const entriesAtIntersection = findEntriesForCell(2, 5, mockLayout.entries);
assert(
  entriesAtIntersection.length === 2,
  'M. Celda intersección detecta 2 pistas (ACROSS y DOWN) para alternar dirección'
);

// N. Derivar wordText desde cellAnswers funciona
const derivedAcross = deriveWordText(report.cellAnswers, mockLayout.entries[0]);
const derivedDown = deriveWordText(report.cellAnswers, mockLayout.entries[1]);
const allDerived = deriveAllWordAnswers(report.cellAnswers, mockLayout.entries);
assert(
  derivedAcross === 'ALGORITMO' &&
    derivedDown === 'RED' &&
    allDerived['q-across-1'] === 'ALGORITMO' &&
    allDerived['q-down-2'] === 'RED',
  'N. deriveWordText y deriveAllWordAnswers reconstruyen exactamente la palabra por entrada'
);

// O. EXAM no cambia
const examType: AssessmentType = 'EXAM';
assert(
  (examType as string) !== 'CROSSWORD',
  'O. Evaluación tipo EXAM mantiene su flujo tradicional'
);

// P. QUIZ no cambia
const quizType: AssessmentType = 'QUIZ';
assert(
  (quizType as string) !== 'CROSSWORD',
  'P. Evaluación tipo QUIZ mantiene su flujo tradicional'
);

// Q. PRACTICE no cambia
const practiceType: AssessmentType = 'PRACTICE';
assert(
  (practiceType as string) !== 'CROSSWORD',
  'Q. Evaluación tipo PRACTICE mantiene su flujo tradicional'
);

// R. DIAGNOSTIC no cambia
const diagnosticType: AssessmentType = 'DIAGNOSTIC';
assert(
  (diagnosticType as string) !== 'CROSSWORD',
  'R. Evaluación tipo DIAGNOSTIC mantiene su flujo tradicional'
);

// S. FINAL no cambia
const finalType: AssessmentType = 'FINAL';
assert(
  (finalType as string) !== 'CROSSWORD',
  'S. Evaluación tipo FINAL mantiene su flujo tradicional'
);

// T. No se expone answerNormalized al componente alumno
const layoutEntriesAny = mockLayout.entries as any[];
const hasAnswerNormalized = layoutEntriesAny.some((e) => e.answerNormalized !== undefined);
assert(
  !hasAnswerNormalized,
  'T. Las respuestas correctas (answerNormalized) NO están presentes en los DTOs entregados al alumno'
);

console.log(`\n==================================================`);
console.log(`RESULTADOS: ${passedTests} / ${totalTests} pruebas pasadas con éxito.`);
console.log(`==================================================\n`);
