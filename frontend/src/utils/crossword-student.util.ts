import {
  AttemptAnswerDTO,
  StudentCrosswordLayout,
  StudentCrosswordLayoutEntry,
  StudentQuestionDTO,
} from '../types/assessment.js';

export interface ReconstructionReport {
  cellAnswers: Record<string, string>;
  hasConflicts: boolean;
  conflictingCells: string[];
}

/**
 * Reconstruye las respuestas por celda (cellAnswers) a partir de las respuestas
 * persistidas en el Attempt (AttemptAnswerDTO[]) y el layout sanitizado del crucigrama.
 *
 * Cada respuesta de tipo CROSSWORD_CLUE contiene un textValue (ej. "ALGORITMO").
 * Esta función asigna cada carácter a sus coordenadas (row-col) en la grilla.
 * Si dos palabras comparten una celda en una intersección, se mantiene la letra unificada.
 */
export function reconstructCellAnswers(
  answers: AttemptAnswerDTO[] | undefined,
  layout: StudentCrosswordLayout | null | undefined
): ReconstructionReport {
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

/**
 * Dada la matriz local de respuestas por celda (cellAnswers) y una entrada de crucigrama (entry),
 * deriva la palabra completa ingresada por el alumno para esa pista.
 */
export function deriveWordText(
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

/**
 * Deriva todas las respuestas por palabra para todas las pistas que forman parte del layout.
 * Retorna una relación questionId -> wordText.
 */
export function deriveAllWordAnswers(
  cellAnswers: Record<string, string>,
  entries: StudentCrosswordLayoutEntry[]
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of entries) {
    result[entry.questionId] = deriveWordText(cellAnswers, entry);
  }
  return result;
}

/**
 * Verifica si las coordenadas (row, col) pertenecen a una entrada dada.
 */
export function isCellInEntry(
  row: number,
  col: number,
  entry: StudentCrosswordLayoutEntry
): boolean {
  if (entry.direction === 'ACROSS') {
    return row === entry.startRow && col >= entry.startCol && col < entry.startCol + entry.length;
  } else {
    return col === entry.startCol && row >= entry.startRow && row < entry.startRow + entry.length;
  }
}

/**
 * Retorna todas las entradas del layout que atraviesan la celda (row, col).
 */
export function findEntriesForCell(
  row: number,
  col: number,
  entries: StudentCrosswordLayoutEntry[]
): StudentCrosswordLayoutEntry[] {
  return entries.filter((entry) => isCellInEntry(row, col, entry));
}

/**
 * Filtra preguntas que no tienen una entrada correspondiente en el layout del crucigrama.
 */
export function filterQuestionsInLayout(
  questions: StudentQuestionDTO[] | undefined,
  layout: StudentCrosswordLayout | null | undefined
): { validQuestions: StudentQuestionDTO[]; orphanedQuestions: StudentQuestionDTO[] } {
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
