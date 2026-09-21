import { AssessmentQuestionDTO, CrosswordLayoutEntry } from '../types/assessment.js';

export type WordValidationStatus = 'PENDING' | 'CORRECT' | 'INCORRECT';

/**
 * Normalizes an answer string according to QA-008-AL rules:
 * - Upper case
 * - Diacritics/accents stripped (NFD)
 * - Non-alphanumeric characters stripped
 */
export function normalizeCrosswordAnswer(text: string): string {
  if (!text) return '';
  return text
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Calculates the validation state for a single CrosswordLayoutEntry given local user typed cell answers.
 *
 * PENDING:
 * - No letters typed or incomplete sequence (typedSequence.length < entry.length).
 *
 * CORRECT:
 * - All cells filled (typedSequence.length === entry.length) and normalized string matches entry.answerNormalized.
 *
 * INCORRECT:
 * - All cells filled (typedSequence.length === entry.length) and normalized string does NOT match entry.answerNormalized.
 */
export function calculateWordState(
  entry: CrosswordLayoutEntry,
  cellAnswers: Record<string, string>
): WordValidationStatus {
  let typedSequence = '';
  let filledCount = 0;

  for (let i = 0; i < entry.length; i++) {
    const r = entry.direction === 'ACROSS' ? entry.startRow : entry.startRow + i;
    const c = entry.direction === 'ACROSS' ? entry.startCol + i : entry.startCol;
    const cellKey = `${r}-${c}`;
    const char = cellAnswers[cellKey];

    if (char && char.trim() !== '') {
      typedSequence += char.trim();
      filledCount++;
    }
  }

  if (filledCount < entry.length) {
    return 'PENDING';
  }

  const normalizedTyped = normalizeCrosswordAnswer(typedSequence);
  const targetNormalized = entry.answerNormalized ? entry.answerNormalized.toUpperCase() : '';

  if (normalizedTyped === targetNormalized) {
    return 'CORRECT';
  }

  return 'INCORRECT';
}

export interface SynchronizedCrosswordEntries {
  validEntries: CrosswordLayoutEntry[];
  orphanEntries: CrosswordLayoutEntry[];
}

/**
 * Synchronizes crossword layout entries with current assessment questions.
 * An entry is a VALID_ENTRY if its questionId exists in the assessment's current questions.
 * An entry is an ORPHAN_ENTRY if its questionId no longer exists in current questions.
 */
export function syncCrosswordEntries(
  questions: AssessmentQuestionDTO[],
  entries: CrosswordLayoutEntry[]
): SynchronizedCrosswordEntries {
  if (!entries || entries.length === 0) {
    return { validEntries: [], orphanEntries: [] };
  }

  const validQuestionIds = new Set(questions.map((q) => q.questionId));

  const validEntries: CrosswordLayoutEntry[] = [];
  const orphanEntries: CrosswordLayoutEntry[] = [];

  for (const entry of entries) {
    if (validQuestionIds.has(entry.questionId)) {
      validEntries.push(entry);
    } else {
      orphanEntries.push(entry);
    }
  }

  return { validEntries, orphanEntries };
}
