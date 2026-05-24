import type {
  BoardCell,
  Placement,
  Direction,
  BlockZone,
  PlayerIdx,
  PlacedWord,
} from './types';
import { BOARD_SIZE, CENTER } from './bonuses';

export interface FoundWord {
  word: string;
  positions: { row: number; col: number }[];
  direction: Direction;
}

export interface MoveResult {
  valid: boolean;
  error?: string;
  score: number;
  words: FoundWord[];
  newPlacedWords: PlacedWord[];
}

function isInBlockZone(
  blockZones: BlockZone[],
  player: PlayerIdx,
  r: number,
  c: number,
): boolean {
  for (const z of blockZones) {
    if (z.owner === player) continue;
    if (z.turnsLeft <= 0) continue;
    if (
      r >= z.topLeft.row &&
      r < z.topLeft.row + 2 &&
      c >= z.topLeft.col &&
      c < z.topLeft.col + 2
    ) {
      return true;
    }
  }
  return false;
}

function buildVirtualBoard(
  board: BoardCell[][],
  placements: Placement[],
): BoardCell[][] {
  const vb: BoardCell[][] = board.map((row) =>
    row.map((cell) => ({ ...cell, tile: cell.tile ? { ...cell.tile } : null })),
  );
  for (const p of placements) {
    vb[p.row][p.col] = { ...vb[p.row][p.col], tile: { ...p.tile } };
  }
  return vb;
}

function findWordAt(
  vb: BoardCell[][],
  r: number,
  c: number,
  dir: Direction,
): { startR: number; startC: number; positions: { row: number; col: number }[]; word: string } {
  let startR = r;
  let startC = c;
  if (dir === 'H') {
    while (startC > 0 && vb[startR][startC - 1].tile) startC--;
  } else {
    while (startR > 0 && vb[startR - 1][startC].tile) startR--;
  }
  const positions: { row: number; col: number }[] = [];
  let curR = startR;
  let curC = startC;
  let word = '';
  while (curR < BOARD_SIZE && curC < BOARD_SIZE && vb[curR][curC].tile) {
    positions.push({ row: curR, col: curC });
    word += vb[curR][curC].tile!.letter;
    if (dir === 'H') curC++;
    else curR++;
  }
  return { startR, startC, positions, word };
}

export function validateAndScoreMove(
  board: BoardCell[][],
  placements: Placement[],
  isFirstMove: boolean,
  blockZones: BlockZone[],
  player: PlayerIdx,
  wordSet: Set<string>,
): MoveResult {
  if (placements.length === 0) {
    return { valid: false, error: 'No tiles placed', score: 0, words: [], newPlacedWords: [] };
  }

  // Bounds and duplicates
  const seenCells = new Set<string>();
  for (const p of placements) {
    if (p.row < 0 || p.row >= BOARD_SIZE || p.col < 0 || p.col >= BOARD_SIZE) {
      return { valid: false, error: 'Placement out of bounds', score: 0, words: [], newPlacedWords: [] };
    }
    const key = `${p.row},${p.col}`;
    if (seenCells.has(key)) {
      return { valid: false, error: 'Duplicate placement', score: 0, words: [], newPlacedWords: [] };
    }
    seenCells.add(key);
    if (board[p.row][p.col].tile) {
      return { valid: false, error: 'Square already occupied', score: 0, words: [], newPlacedWords: [] };
    }
    if (isInBlockZone(blockZones, player, p.row, p.col)) {
      return { valid: false, error: 'Square is blocked', score: 0, words: [], newPlacedWords: [] };
    }
  }

  // Determine direction
  const rows = new Set(placements.map((p) => p.row));
  const cols = new Set(placements.map((p) => p.col));
  let direction: Direction;
  if (rows.size === 1) direction = 'H';
  else if (cols.size === 1) direction = 'V';
  else
    return { valid: false, error: 'Tiles must be in a single row or column', score: 0, words: [], newPlacedWords: [] };

  const vb = buildVirtualBoard(board, placements);

  // First-move center check
  if (isFirstMove) {
    const coversCenter = placements.some((p) => p.row === CENTER && p.col === CENTER);
    if (!coversCenter) {
      return { valid: false, error: 'First move must cover the center square', score: 0, words: [], newPlacedWords: [] };
    }
  } else {
    // Must connect to an existing tile
    let connected = false;
    for (const p of placements) {
      const neighbors = [
        [p.row - 1, p.col],
        [p.row + 1, p.col],
        [p.row, p.col - 1],
        [p.row, p.col + 1],
      ];
      for (const [nr, nc] of neighbors) {
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc].tile) {
          connected = true;
          break;
        }
      }
      if (connected) break;
    }
    if (!connected) {
      return { valid: false, error: 'Tiles must connect to existing tiles', score: 0, words: [], newPlacedWords: [] };
    }
  }

  // Check contiguity along main direction
  if (direction === 'H') {
    const r = placements[0].row;
    const sortedCols = placements.map((p) => p.col).sort((a, b) => a - b);
    const minC = sortedCols[0];
    const maxC = sortedCols[sortedCols.length - 1];
    for (let c = minC; c <= maxC; c++) {
      if (!vb[r][c].tile) {
        return { valid: false, error: 'Tiles must form a contiguous line', score: 0, words: [], newPlacedWords: [] };
      }
    }
  } else {
    const c = placements[0].col;
    const sortedRows = placements.map((p) => p.row).sort((a, b) => a - b);
    const minR = sortedRows[0];
    const maxR = sortedRows[sortedRows.length - 1];
    for (let r = minR; r <= maxR; r++) {
      if (!vb[r][c].tile) {
        return { valid: false, error: 'Tiles must form a contiguous line', score: 0, words: [], newPlacedWords: [] };
      }
    }
  }

  // Find all formed words
  const wordKeys = new Set<string>();
  const formedWords: { startR: number; startC: number; positions: { row: number; col: number }[]; word: string; direction: Direction }[] = [];
  for (const p of placements) {
    for (const dir of ['H', 'V'] as Direction[]) {
      const w = findWordAt(vb, p.row, p.col, dir);
      if (w.positions.length < 2) continue;
      const key = `${w.startR},${w.startC},${dir}`;
      if (wordKeys.has(key)) continue;
      wordKeys.add(key);
      formedWords.push({ ...w, direction: dir });
    }
  }

  if (formedWords.length === 0) {
    return { valid: false, error: 'Move must form a word of length 2 or more', score: 0, words: [], newPlacedWords: [] };
  }

  // Validate all words
  for (const w of formedWords) {
    if (!wordSet.has(w.word.toUpperCase())) {
      return { valid: false, error: `"${w.word}" is not a valid word`, score: 0, words: [], newPlacedWords: [] };
    }
  }

  // Scoring
  const placedKeys = new Set(placements.map((p) => `${p.row},${p.col}`));
  let totalScore = 0;
  for (const w of formedWords) {
    let wordSum = 0;
    let wordMult = 1;
    for (const pos of w.positions) {
      const cell = vb[pos.row][pos.col];
      const tile = cell.tile!;
      const isNew = placedKeys.has(`${pos.row},${pos.col}`);
      let letterScore = tile.value;
      if (isNew) {
        if (cell.bonus === 'DL') letterScore *= 2;
        else if (cell.bonus === 'TL') letterScore *= 3;
        if (cell.bonus === 'DW') wordMult *= 2;
        else if (cell.bonus === 'TW') wordMult *= 3;
      }
      wordSum += letterScore;
    }
    totalScore += wordSum * wordMult;
  }

  if (placements.length === 7) totalScore += 50; // bingo

  const newPlacedWords: PlacedWord[] = formedWords.map((w) => ({
    id: `${w.startR}-${w.startC}-${w.direction}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    word: w.word,
    positions: w.positions,
    direction: w.direction,
    owner: player,
  }));

  return {
    valid: true,
    score: totalScore,
    words: formedWords.map((w) => ({ word: w.word, positions: w.positions, direction: w.direction })),
    newPlacedWords,
  };
}
