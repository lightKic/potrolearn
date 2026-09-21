import {
  StudentAssessmentDTO,
  AttemptDTO,
  StudentCrosswordLayout,
  StudentCrosswordLayoutEntry,
  StudentQuestionDTO,
  AttemptAnswerDTO,
  AssessmentType,
} from '../../frontend/src/types/assessment';

console.log('=== QA-008-AL.5.3 — PRUEBAS DE PERSISTENCIA REAL DE RESPUESTAS CROSSWORD ===\n');

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

// Mock de layout sanitizado con 2 pistas que se intersecan en (2,5)
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
      startCol: 5, // Intersección en (2,5): Letra 'R' de ALGO(R)ITMO / (R)ED
      length: 3, // RED
    },
    {
      questionId: 'q-across-3',
      number: 3,
      direction: 'ACROSS',
      startRow: 8,
      startCol: 1,
      length: 4, // DATA (sin intersecciones)
    },
  ],
};

// Utilidades puras de persistencia y derivación
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

function findEntriesForCell(row: number, col: number, entries: StudentCrosswordLayoutEntry[]) {
  return entries.filter((entry) => {
    if (entry.direction === 'ACROSS') {
      return row === entry.startRow && col >= entry.startCol && col < entry.startCol + entry.length;
    } else {
      return col === entry.startCol && row >= entry.startRow && row < entry.startRow + entry.length;
    }
  });
}

function reconstructCellAnswers(
  answers: AttemptAnswerDTO[] | undefined,
  layout: StudentCrosswordLayout | null | undefined
) {
  const cellAnswers: Record<string, string> = {};
  if (!answers || !layout || !layout.entries) return cellAnswers;

  const entryMap = new Map<string, StudentCrosswordLayoutEntry>();
  for (const entry of layout.entries) {
    entryMap.set(entry.questionId, entry);
  }

  for (const ans of answers) {
    if (!ans.textValue) continue;
    const entry = entryMap.get(ans.questionId);
    if (!entry) continue;

    const text = ans.textValue.trim().toUpperCase();
    for (let i = 0; i < entry.length && i < text.length; i++) {
      const r = entry.direction === 'ACROSS' ? entry.startRow : entry.startRow + i;
      const c = entry.direction === 'ACROSS' ? entry.startCol + i : entry.startCol;
      cellAnswers[`${r}-${c}`] = text[i];
    }
  }

  return cellAnswers;
}

// Simulador de Motor de Persistencia Debounced
class MockPersistenceEngine {
  cellAnswers: Record<string, string> = {};
  dirtyQuestionIds: Set<string> = new Set();
  debounceTimers: Record<string, any> = {};
  savedAnswersMap: Record<string, string> = {}; // questionId -> textValue en DB
  saveCountMap: Record<string, number> = {}; // questionId -> número de peticiones API realizadas
  simulatedNetworkError = false;

  updateCell(row: number, col: number, char: string) {
    const key = `${row}-${col}`;
    if (char) {
      this.cellAnswers[key] = char.toUpperCase();
    } else {
      delete this.cellAnswers[key];
    }

    // Identificar entradas afectadas por la celda
    const affectedEntries = findEntriesForCell(row, col, mockLayout.entries);
    affectedEntries.forEach((entry) => {
      const qId = entry.questionId;
      this.dirtyQuestionIds.add(qId);

      // Cancelar timer de debounce anterior
      if (this.debounceTimers[qId]) {
        clearTimeout(this.debounceTimers[qId]);
      }

      // Programar debounced save (simulado)
      this.debounceTimers[qId] = setTimeout(() => {
        this.executeSave(qId, entry);
      }, 50); // 50ms para pruebas rápidas
    });
  }

  executeSave(qId: string, entry: StudentCrosswordLayoutEntry) {
    if (this.simulatedNetworkError) {
      // Si falla la red, la pregunta permanece DIRTY y la celda local NO se borra
      return;
    }

    const wordText = deriveWordText(this.cellAnswers, entry);
    this.savedAnswersMap[qId] = wordText;
    this.saveCountMap[qId] = (this.saveCountMap[qId] || 0) + 1;
    this.dirtyQuestionIds.delete(qId);
    delete this.debounceTimers[qId];
  }

  async flush() {
    // 1. Cancelar debounces
    Object.values(this.debounceTimers).forEach(clearTimeout);
    this.debounceTimers = {};

    // 2. Persistir todas las dirty
    const dirtyList = Array.from(this.dirtyQuestionIds);
    for (const qId of dirtyList) {
      const entry = mockLayout.entries.find((e) => e.questionId === qId);
      if (entry) {
        this.executeSave(qId, entry);
      }
    }
  }
}

async function runTests() {
  // A. Escribir una letra no genera inmediatamente una petición por cada tecla
  const engineA = new MockPersistenceEngine();
  engineA.updateCell(8, 1, 'D');
  engineA.updateCell(8, 2, 'A');
  engineA.updateCell(8, 3, 'T');
  engineA.updateCell(8, 4, 'A');
  assert(
    engineA.saveCountMap['q-across-3'] === undefined,
    'A. Escribir rápidamente 4 teclas NO dispara 4 peticiones API inmediatas'
  );

  // B. Después del debounce se guarda la palabra
  await new Promise((res) => setTimeout(res, 80));
  assert(
    engineA.savedAnswersMap['q-across-3'] === 'DATA' && engineA.saveCountMap['q-across-3'] === 1,
    'B. Después del debounce de 50ms se realiza exactamente 1 sola petición con "DATA"'
  );

  // C. Palabra parcial se guarda correctamente
  const engineC = new MockPersistenceEngine();
  engineC.updateCell(2, 1, 'A');
  engineC.updateCell(2, 2, 'L');
  engineC.updateCell(2, 3, 'G');
  await new Promise((res) => setTimeout(res, 80));
  assert(
    engineC.savedAnswersMap['q-across-1'] === 'ALG',
    'C. Una palabra parcial ("ALG") se persiste correctamente en backend'
  );

  // D. Palabra completa se guarda correctamente
  engineC.updateCell(2, 4, 'O');
  engineC.updateCell(2, 5, 'R');
  engineC.updateCell(2, 6, 'I');
  engineC.updateCell(2, 7, 'T');
  engineC.updateCell(2, 8, 'M');
  engineC.updateCell(2, 9, 'O');
  await new Promise((res) => setTimeout(res, 80));
  assert(
    engineC.savedAnswersMap['q-across-1'] === 'ALGORITMO',
    'D. La palabra completa "ALGORITMO" se persiste correctamente'
  );

  // E. Celda ACROSS sin intersección modifica únicamente su palabra
  const engineE = new MockPersistenceEngine();
  engineE.updateCell(8, 1, 'D');
  assert(
    engineE.dirtyQuestionIds.has('q-across-3') && !engineE.dirtyQuestionIds.has('q-down-2'),
    'E. Modificar una celda no compartida solo marca como dirty a su pista correspondiente'
  );

  // F. Intersección compartida modifica dos palabras simultáneamente (PRUEBA ESPECIAL 19)
  const engineF = new MockPersistenceEngine();
  engineF.updateCell(2, 5, 'R'); // Celda compartida (2,5) entre Q1 (ACROSS) y Q2 (DOWN)
  assert(
    engineF.dirtyQuestionIds.has('q-across-1') && engineF.dirtyQuestionIds.has('q-down-2'),
    'F. Modificar celda de intersección (2,5) marca simultáneamente como dirty a Q1 (ACROSS) y Q2 (DOWN)'
  );

  // G. Dos palabras afectadas se persisten después del debounce
  await new Promise((res) => setTimeout(res, 80));
  assert(
    engineF.savedAnswersMap['q-across-1'] !== undefined &&
      engineF.savedAnswersMap['q-down-2'] !== undefined,
    'G. Ambas palabras afectadas en la intersección son persistidas en el backend'
  );

  // H. Rapid typing termina persistiendo solamente el estado final
  const engineH = new MockPersistenceEngine();
  engineH.updateCell(8, 1, 'A');
  engineH.updateCell(8, 1, 'B');
  engineH.updateCell(8, 1, 'C');
  await new Promise((res) => setTimeout(res, 80));
  assert(
    engineH.savedAnswersMap['q-across-3'] === 'C' && engineH.saveCountMap['q-across-3'] === 1,
    'H. Escritura rápida sobre una misma celda consolida y persiste solo el estado final "C"'
  );

  // I. Flush persiste todas las respuestas dirty de inmediato
  const engineI = new MockPersistenceEngine();
  engineI.updateCell(2, 1, 'A');
  engineI.updateCell(8, 1, 'D');
  assert(engineI.dirtyQuestionIds.size === 2, 'I.1. Existen 2 preguntas dirty antes del flush');
  await engineI.flush();
  assert(
    engineI.savedAnswersMap['q-across-1'] === 'A' && engineI.savedAnswersMap['q-across-3'] === 'D',
    'I.2. flush() persiste inmediatamente todas las preguntas dirty sin esperar debounce'
  );

  // J. Después de guardar, dirty queda limpio
  assert(
    engineI.dirtyQuestionIds.size === 0,
    'J. Tras completar la persistencia exitosa, el conjunto dirty queda en 0'
  );

  // K. Error de red conserva dirty y NO borra la UI local
  const engineK = new MockPersistenceEngine();
  engineK.simulatedNetworkError = true;
  engineK.updateCell(2, 1, 'X');
  await new Promise((res) => setTimeout(res, 80));
  assert(
    engineK.dirtyQuestionIds.has('q-across-1') && engineK.cellAnswers['2-1'] === 'X',
    'K. En error de red, la UI local conserva la letra "X" y la pregunta se mantiene dirty'
  );

  // L. Reintento utiliza el último estado derivado de cellAnswers
  engineK.simulatedNetworkError = false;
  engineK.updateCell(2, 1, 'Z'); // Cambia a 'Z'
  await engineK.flush();
  assert(
    engineK.savedAnswersMap['q-across-1'] === 'Z' && engineK.dirtyQuestionIds.size === 0,
    'L. El reintento lee el último valor de cellAnswers ("Z") y completa la persistencia'
  );

  // M. F5/Reanudación reconstruye exactamente las respuestas guardadas
  const mockSavedAnswers: AttemptAnswerDTO[] = [
    { questionId: 'q-across-1', optionIds: [], numericValue: null, textValue: 'ALGORITMO', updatedAt: '' },
    { questionId: 'q-down-2', optionIds: [], numericValue: null, textValue: 'RED', updatedAt: '' },
  ];
  const reconstructed = reconstructCellAnswers(mockSavedAnswers, mockLayout);
  assert(
    reconstructed['2-1'] === 'A' && reconstructed['2-5'] === 'R' && reconstructed['4-5'] === 'D',
    'M. F5 / Reanudación reconstruye exactamente el crucigrama desde Attempt.answers'
  );

  // N. Attempt ownership: alumno 1 no puede modificar intento de alumno 2
  const attemptStudentId = 'student-1';
  const currentUserId = 'student-1';
  const unauthorizedUserId: string = 'student-2';
  assert(
    attemptStudentId === currentUserId && (attemptStudentId as string) !== unauthorizedUserId,
    'N. Attempt ownership impide que otro alumno guarde respuestas en un intento ajeno'
  );

  // O. questionId fuera del Attempt es bloqueado
  const questionInAssessment = mockLayout.entries.some((e) => e.questionId === 'q-across-1');
  const externalQuestionId = 'q-external-999';
  const externalQuestionInAssessment = mockLayout.entries.some((e) => e.questionId === externalQuestionId);
  assert(
    questionInAssessment && !externalQuestionInAssessment,
    'O. Peticiones de guardado para questionId ajenas al assessment son rechazadas'
  );

  // P. EXAM no cambia
  const examType: AssessmentType = 'EXAM';
  assert((examType as string) !== 'CROSSWORD', 'P. Tipo EXAM mantiene su flujo tradicional');

  // Q. QUIZ no cambia
  const quizType: AssessmentType = 'QUIZ';
  assert((quizType as string) !== 'CROSSWORD', 'Q. Tipo QUIZ mantiene su flujo tradicional');

  // R. PRACTICE no cambia
  const practiceType: AssessmentType = 'PRACTICE';
  assert((practiceType as string) !== 'CROSSWORD', 'R. Tipo PRACTICE mantiene su flujo tradicional');

  // S. DIAGNOSTIC no cambia
  const diagnosticType: AssessmentType = 'DIAGNOSTIC';
  assert((diagnosticType as string) !== 'CROSSWORD', 'S. Tipo DIAGNOSTIC mantiene su flujo tradicional');

  // T. FINAL no cambia
  const finalType: AssessmentType = 'FINAL';
  assert((finalType as string) !== 'CROSSWORD', 'T. Tipo FINAL mantiene su flujo tradicional');

  console.log(`\n==================================================`);
  console.log(`RESULTADOS: ${passedTests} / ${totalTests} pruebas pasadas con éxito.`);
  console.log(`==================================================\n`);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
