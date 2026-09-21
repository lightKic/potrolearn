import { CrosswordLayout, CrosswordLayoutEntry } from '../types/assessment.types';

export interface CrosswordInputEntry {
  questionId: string;
  answer: string;
}

export interface CrosswordUnplacedEntry {
  questionId: string;
  answerNormalized: string;
  reason: string;
}

export interface CrosswordGeneratorResult {
  success: boolean;
  layout?: CrosswordLayout;
  placedEntries?: CrosswordLayoutEntry[];
  unplacedEntries?: CrosswordUnplacedEntry[];
  error?: string;
}

/**
 * Seeded Pseudo-Random Number Generator (Mulberry32).
 * Ensures layout generation reproducibility when a seed is specified.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: string | number = 12345) {
    this.state = typeof seed === 'number' ? seed : SeededRandom.hashString(seed);
  }

  private static hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

/**
 * Normalizes an answer string according to QA-008-AL rules:
 * - Uppercase
 * - Remove diacritics / accents (e.g. Á -> A, É -> E)
 * - Remove spaces, hyphens, and non-alphanumeric punctuation
 * Note: Clue statement is untouched; only the target answer is normalized.
 */
export function normalizeCrosswordAnswer(text: string): string {
  if (!text) return '';
  return text
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

interface WorkingCell {
  char: string | null;
  acrossIndex: number | null;
  downIndex: number | null;
}

interface PlacedWordInternal {
  questionId: string;
  answerNormalized: string;
  direction: 'ACROSS' | 'DOWN';
  startRow: number;
  startCol: number;
  length: number;
}

interface CandidatePlacement {
  direction: 'ACROSS' | 'DOWN';
  startRow: number;
  startCol: number;
  score: number;
  intersections: number;
}

const MAX_GRID_SIZE = 20;

export class CrosswordGeneratorUtil {
  /**
   * Generates a valid CrosswordLayout from a set of question answers.
   *
   * @param inputEntries List of { questionId, answer }
   * @param seed Optional seed string/number for deterministic generation
   */
  public static generate(
    inputEntries: CrosswordInputEntry[],
    seed?: string | number
  ): CrosswordGeneratorResult {
    // 1. Basic Validations
    if (!inputEntries || inputEntries.length === 0) {
      return {
        success: false,
        error: 'El crucigrama debe contener al menos 1 pregunta con respuesta.',
      };
    }

    if (inputEntries.length > 20) {
      return {
        success: false,
        error: 'El crucigrama no puede tener más de 20 palabras.',
      };
    }

    // 2. Normalize and validate each entry
    const normalizedEntries: { questionId: string; answerNormalized: string }[] = [];
    const seenAnswers = new Set<string>();

    for (const item of inputEntries) {
      const norm = normalizeCrosswordAnswer(item.answer);

      if (!norm || norm.length === 0) {
        return {
          success: false,
          error: `La respuesta de la pregunta con ID "${item.questionId}" está vacía o no contiene caracteres válidos.`,
        };
      }

      if (norm.length < 2) {
        return {
          success: false,
          error: `La respuesta "${norm}" debe tener al menos 2 letras.`,
        };
      }

      if (norm.length > MAX_GRID_SIZE) {
        return {
          success: false,
          error: `La respuesta "${norm}" excede la longitud máxima permitida de 20 caracteres.`,
        };
      }

      if (seenAnswers.has(norm)) {
        return {
          success: false,
          error: `Respuestas duplicadas detectadas: "${norm}". Cada pista debe tener una respuesta única.`,
        };
      }

      seenAnswers.add(norm);
      normalizedEntries.push({
        questionId: item.questionId,
        answerNormalized: norm,
      });
    }

    const rng = new SeededRandom(seed !== undefined ? seed : 12345);

    // 3. Try layout strategies with seed permutations if needed
    // Primary order: longest answers first, then higher count of unique letters
    const baseSorted = [...normalizedEntries].sort((a, b) => {
      if (b.answerNormalized.length !== a.answerNormalized.length) {
        return b.answerNormalized.length - a.answerNormalized.length;
      }
      const uniqueA = new Set(a.answerNormalized.split('')).size;
      const uniqueB = new Set(b.answerNormalized.split('')).size;
      return uniqueB - uniqueA;
    });

    const permutationAttempts = 8;
    let bestResult: { placed: PlacedWordInternal[]; unplaced: { questionId: string; answerNormalized: string }[] } | null = null;

    for (let attempt = 0; attempt < permutationAttempts; attempt++) {
      let currentOrder: { questionId: string; answerNormalized: string }[];
      if (attempt === 0) {
        currentOrder = [...baseSorted];
      } else {
        // Perturb order slightly using rng
        currentOrder = [...baseSorted].sort(() => rng.next() - 0.5);
      }

      const outcome = CrosswordGeneratorUtil.attemptPlacement(currentOrder, rng);
      if (outcome.unplaced.length === 0) {
        // 100% placed!
        bestResult = outcome;
        break;
      }

      if (!bestResult || outcome.placed.length > bestResult.placed.length) {
        bestResult = outcome;
      }
    }

    if (!bestResult || bestResult.unplaced.length > 0) {
      // Failed to place all words cleanly -> Rule of Success: success MUST be false if any orphan words exist
      const unplacedEntries: CrosswordUnplacedEntry[] = (bestResult ? bestResult.unplaced : normalizedEntries).map((item) => ({
        questionId: item.questionId,
        answerNormalized: item.answerNormalized,
        reason: 'NO_VALID_INTERSECTION',
      }));

      const placedEntries: CrosswordLayoutEntry[] = bestResult
        ? bestResult.placed.map((p, idx) => ({
            questionId: p.questionId,
            number: idx + 1,
            direction: p.direction,
            startRow: p.startRow,
            startCol: p.startCol,
            length: p.length,
            answerNormalized: p.answerNormalized,
          }))
        : [];

      return {
        success: false,
        placedEntries,
        unplacedEntries,
        error: `No se pudieron colocar todas las palabras sin conflictos (${unplacedEntries.length} palabras huérfanas).`,
      };
    }

    // 4. Crop Grid & Calculate Final Dimensions
    const finalLayout = CrosswordGeneratorUtil.cropAndNumberLayout(bestResult.placed);
    if (!finalLayout) {
      return {
        success: false,
        error: 'El layout generado excedió los límites máximos del tablero de 20x20.',
      };
    }

    return {
      success: true,
      layout: finalLayout,
      placedEntries: finalLayout.entries,
      unplacedEntries: [],
    };
  }

  /**
   * Internal greedy placement + backtracking algorithm over a 20x20 working grid.
   */
  private static attemptPlacement(
    words: { questionId: string; answerNormalized: string }[],
    rng: SeededRandom
  ): { placed: PlacedWordInternal[]; unplaced: { questionId: string; answerNormalized: string }[] } {
    const grid: WorkingCell[][] = Array.from({ length: MAX_GRID_SIZE }, () =>
      Array.from({ length: MAX_GRID_SIZE }, () => ({
        char: null,
        acrossIndex: null,
        downIndex: null,
      }))
    );

    const placed: PlacedWordInternal[] = [];
    const unplaced: { questionId: string; answerNormalized: string }[] = [];
    const maxSteps = 1500;
    const stepCounter = { count: 0 };

    const solve = (wordIdx: number): boolean => {
      stepCounter.count++;
      if (stepCounter.count > maxSteps) return false;
      if (wordIdx >= words.length) return true;

      const word = words[wordIdx];
      const candidates = CrosswordGeneratorUtil.getValidCandidates(grid, word.answerNormalized, placed.length, rng);

      for (const cand of candidates) {
        CrosswordGeneratorUtil.applyWordToGrid(grid, word, cand, placed.length);
        const placedRecord: PlacedWordInternal = {
          questionId: word.questionId,
          answerNormalized: word.answerNormalized,
          direction: cand.direction,
          startRow: cand.startRow,
          startCol: cand.startCol,
          length: word.answerNormalized.length,
        };
        placed.push(placedRecord);

        if (solve(wordIdx + 1)) {
          return true;
        }

        // Backtrack
        placed.pop();
        CrosswordGeneratorUtil.removeWordFromGrid(grid, placedRecord);
      }

      return false;
    };

    const success = solve(0);

    if (!success && placed.length < words.length) {
      for (let i = placed.length; i < words.length; i++) {
        unplaced.push(words[i]);
      }
    }

    return { placed, unplaced };
  }

  /**
   * Generates and scores valid candidate placements for a word on the 20x20 grid.
   */
  private static getValidCandidates(
    grid: WorkingCell[][],
    wordStr: string,
    placedCount: number,
    rng: SeededRandom
  ): CandidatePlacement[] {
    const L = wordStr.length;
    const candidates: CandidatePlacement[] = [];

    if (placedCount === 0) {
      // First seed word: place near center horizontally or vertically
      const centerR = Math.floor((MAX_GRID_SIZE - 1) / 2);
      const centerC = Math.floor((MAX_GRID_SIZE - L) / 2);

      const candidateAcross: CandidatePlacement = {
        direction: 'ACROSS',
        startRow: centerR,
        startCol: centerC,
        intersections: 0,
        score: 100,
      };

      if (CrosswordGeneratorUtil.isValidPlacement(grid, wordStr, centerR, centerC, 'ACROSS', 0)) {
        candidates.push(candidateAcross);
      }

      const candidateDown: CandidatePlacement = {
        direction: 'DOWN',
        startRow: centerC,
        startCol: centerR,
        intersections: 0,
        score: 95,
      };

      if (CrosswordGeneratorUtil.isValidPlacement(grid, wordStr, centerC, centerR, 'DOWN', 0)) {
        candidates.push(candidateDown);
      }

      return candidates;
    }

    // Subsequent words: must intersect at least one already placed perpendicular word
    for (let r = 0; r < MAX_GRID_SIZE; r++) {
      for (let c = 0; c < MAX_GRID_SIZE; c++) {
        const cell = grid[r][c];
        if (!cell.char) continue;

        // Matching character found on grid
        for (let i = 0; i < L; i++) {
          if (wordStr[i] !== cell.char) continue;

          // If cell has a DOWN word, test ACROSS candidate
          if (cell.downIndex !== null && cell.acrossIndex === null) {
            const startR = r;
            const startC = c - i;
            if (CrosswordGeneratorUtil.isValidPlacement(grid, wordStr, startR, startC, 'ACROSS', placedCount)) {
              const { score, intersections } = CrosswordGeneratorUtil.evaluateCandidate(
                grid,
                wordStr,
                startR,
                startC,
                'ACROSS',
                rng
              );
              candidates.push({ direction: 'ACROSS', startRow: startR, startCol: startC, score, intersections });
            }
          }

          // If cell has an ACROSS word, test DOWN candidate
          if (cell.acrossIndex !== null && cell.downIndex === null) {
            const startR = r - i;
            const startC = c;
            if (CrosswordGeneratorUtil.isValidPlacement(grid, wordStr, startR, startC, 'DOWN', placedCount)) {
              const { score, intersections } = CrosswordGeneratorUtil.evaluateCandidate(
                grid,
                wordStr,
                startR,
                startC,
                'DOWN',
                rng
              );
              candidates.push({ direction: 'DOWN', startRow: startR, startCol: startC, score, intersections });
            }
          }
        }
      }
    }

    // Sort candidates by score descending
    candidates.sort((a, b) => b.score - a.score);

    // Deduplicate candidates with identical position & direction
    const uniqueCandidates: CandidatePlacement[] = [];
    const seenKeys = new Set<string>();

    for (const cand of candidates) {
      const key = `${cand.direction}:${cand.startRow}:${cand.startCol}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueCandidates.push(cand);
      }
    }

    return uniqueCandidates;
  }

  /**
   * Validates placement of a word on grid according to strict crossword rules:
   * 1. Grid boundary check (0..19)
   * 2. Perpendicular intersection only with matching letter
   * 3. Zero parallel overlap
   * 4. Zero lateral touching on non-intersection cells
   * 5. Empty boundary cell immediately before start and after end
   * 6. Must have at least 1 intersection if placedCount > 0
   */
  private static isValidPlacement(
    grid: WorkingCell[][],
    wordStr: string,
    startR: number,
    startC: number,
    direction: 'ACROSS' | 'DOWN',
    placedCount: number
  ): boolean {
    const L = wordStr.length;

    // 1. Boundary check
    if (startR < 0 || startC < 0) return false;
    if (direction === 'ACROSS') {
      if (startR >= MAX_GRID_SIZE || startC + L > MAX_GRID_SIZE) return false;
    } else {
      if (startR + L > MAX_GRID_SIZE || startC >= MAX_GRID_SIZE) return false;
    }

    // 2. Boundary cell check before start & after end
    if (direction === 'ACROSS') {
      if (startC > 0 && grid[startR][startC - 1].char !== null) return false;
      if (startC + L < MAX_GRID_SIZE && grid[startR][startC + L].char !== null) return false;
    } else {
      if (startR > 0 && grid[startR - 1][startC].char !== null) return false;
      if (startR + L < MAX_GRID_SIZE && grid[startR + L][startC].char !== null) return false;
    }

    let intersectionsCount = 0;

    // 3. Cell-by-cell inspection
    for (let i = 0; i < L; i++) {
      const r = direction === 'ACROSS' ? startR : startR + i;
      const c = direction === 'ACROSS' ? startC + i : startC;
      const cell = grid[r][c];

      if (cell.char !== null) {
        // Intersection cell
        if (cell.char !== wordStr[i]) return false; // Letter mismatch!

        if (direction === 'ACROSS') {
          if (cell.acrossIndex !== null) return false; // Parallel overlap!
        } else {
          if (cell.downIndex !== null) return false; // Parallel overlap!
        }

        intersectionsCount++;
      } else {
        // Non-intersection empty cell: verify lateral touch
        if (direction === 'ACROSS') {
          if (r > 0 && grid[r - 1][c].char !== null) return false;
          if (r < MAX_GRID_SIZE - 1 && grid[r + 1][c].char !== null) return false;
        } else {
          if (c > 0 && grid[r][c - 1].char !== null) return false;
          if (c < MAX_GRID_SIZE - 1 && grid[r][c + 1].char !== null) return false;
        }
      }
    }

    if (placedCount > 0 && intersectionsCount === 0) {
      return false; // Orphan word without intersection!
    }

    return true;
  }

  /**
   * Evaluates quality score for candidate placement.
   */
  private static evaluateCandidate(
    grid: WorkingCell[][],
    wordStr: string,
    startR: number,
    startC: number,
    direction: 'ACROSS' | 'DOWN',
    rng: SeededRandom
  ): { score: number; intersections: number } {
    const L = wordStr.length;
    let intersections = 0;

    // Compute bounding box including candidate
    let minR = startR;
    let maxR = direction === 'DOWN' ? startR + L - 1 : startR;
    let minC = startC;
    let maxC = direction === 'ACROSS' ? startC + L - 1 : startC;

    for (let r = 0; r < MAX_GRID_SIZE; r++) {
      for (let c = 0; c < MAX_GRID_SIZE; c++) {
        if (grid[r][c].char !== null) {
          minR = Math.min(minR, r);
          maxR = Math.max(maxR, r);
          minC = Math.min(minC, c);
          maxC = Math.max(maxC, c);
        }
      }
    }

    for (let i = 0; i < L; i++) {
      const r = direction === 'ACROSS' ? startR : startR + i;
      const c = direction === 'ACROSS' ? startC + i : startC;
      if (grid[r][c].char !== null) {
        intersections++;
      }
    }

    const width = maxC - minC + 1;
    const height = maxR - minR + 1;
    const area = width * height;
    const jitter = rng.next() * 3;

    // Score formula prioritizing intersections and compact grid area
    const score = intersections * 50 - area * 2 - (width + height) * 4 + jitter;
    return { score, intersections };
  }

  private static applyWordToGrid(
    grid: WorkingCell[][],
    word: { questionId: string; answerNormalized: string },
    cand: CandidatePlacement,
    placedIndex: number
  ): void {
    const L = word.answerNormalized.length;
    for (let i = 0; i < L; i++) {
      const r = cand.direction === 'ACROSS' ? cand.startRow : cand.startRow + i;
      const c = cand.direction === 'ACROSS' ? cand.startCol + i : cand.startCol;
      grid[r][c].char = word.answerNormalized[i];
      if (cand.direction === 'ACROSS') {
        grid[r][c].acrossIndex = placedIndex;
      } else {
        grid[r][c].downIndex = placedIndex;
      }
    }
  }

  private static removeWordFromGrid(
    grid: WorkingCell[][],
    record: PlacedWordInternal
  ): void {
    const L = record.length;
    for (let i = 0; i < L; i++) {
      const r = record.direction === 'ACROSS' ? record.startRow : record.startRow + i;
      const c = record.direction === 'ACROSS' ? record.startCol + i : record.startCol;

      if (record.direction === 'ACROSS') {
        grid[r][c].acrossIndex = null;
      } else {
        grid[r][c].downIndex = null;
      }

      if (grid[r][c].acrossIndex === null && grid[r][c].downIndex === null) {
        grid[r][c].char = null;
      }
    }
  }

  /**
   * Crops grid bounding box, shifts coordinates to (0,0), and assigns standard crossword numbers.
   */
  private static cropAndNumberLayout(placedWords: PlacedWordInternal[]): CrosswordLayout | null {
    if (placedWords.length === 0) return null;

    let minRow = MAX_GRID_SIZE;
    let maxRow = -1;
    let minCol = MAX_GRID_SIZE;
    let maxCol = -1;

    for (const item of placedWords) {
      const endR = item.direction === 'DOWN' ? item.startRow + item.length - 1 : item.startRow;
      const endC = item.direction === 'ACROSS' ? item.startCol + item.length - 1 : item.startCol;

      minRow = Math.min(minRow, item.startRow);
      maxRow = Math.max(maxRow, endR);
      minCol = Math.min(minCol, item.startCol);
      maxCol = Math.max(maxCol, endC);
    }

    const rows = maxRow - minRow + 1;
    const columns = maxCol - minCol + 1;

    if (rows > MAX_GRID_SIZE || columns > MAX_GRID_SIZE) {
      return null;
    }

    // Shift entries to minRow, minCol origin
    const shiftedEntries = placedWords.map((item) => ({
      questionId: item.questionId,
      number: 0,
      direction: item.direction,
      startRow: item.startRow - minRow,
      startCol: item.startCol - minCol,
      length: item.length,
      answerNormalized: item.answerNormalized,
    }));

    // Standard Crossword Numbering:
    // Scan cell by cell top-to-bottom, left-to-right.
    // If a cell initiates an ACROSS and/or DOWN entry, assign sequential number.
    let currentNumber = 1;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const startsAcross = shiftedEntries.filter(
          (e) => e.startRow === r && e.startCol === c && e.direction === 'ACROSS'
        );
        const startsDown = shiftedEntries.filter(
          (e) => e.startRow === r && e.startCol === c && e.direction === 'DOWN'
        );

        if (startsAcross.length > 0 || startsDown.length > 0) {
          const num = currentNumber++;
          startsAcross.forEach((e) => (e.number = num));
          startsDown.forEach((e) => (e.number = num));
        }
      }
    }

    return {
      gridSize: {
        rows,
        columns,
      },
      entries: shiftedEntries,
    };
  }
}
