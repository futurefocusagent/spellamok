import type { BoardCell, BonusType } from './types';

export const BOARD_SIZE = 10;
export const CENTER = 5;

const BONUS_COUNTS: Record<NonNullable<BonusType>, number> = {
  DL: 8,
  TL: 4,
  DW: 5,
  TW: 2,
};

function chebyshev(a: { row: number; col: number }, b: { row: number; col: number }): number {
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
}

export function createBoard(): BoardCell[][] {
  const board: BoardCell[][] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row: BoardCell[] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      row.push({
        tile: null,
        bonus: null,
        centerStar: r === CENTER && c === CENTER,
      });
    }
    board.push(row);
  }

  const available: { row: number; col: number }[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (r === CENTER && c === CENTER) continue;
      available.push({ row: r, col: c });
    }
  }

  // Place TWs with min distance constraint (not adjacent to each other; chebyshev >= 3)
  const placedTW: { row: number; col: number }[] = [];
  for (let i = 0; i < BONUS_COUNTS.TW; i++) {
    const candidates = available.filter((p) => placedTW.every((q) => chebyshev(p, q) >= 3));
    if (candidates.length === 0) break;
    const choice = candidates[Math.floor(Math.random() * candidates.length)];
    board[choice.row][choice.col].bonus = 'TW';
    placedTW.push(choice);
    const idx = available.indexOf(choice);
    available.splice(idx, 1);
  }

  // Place DW with min distance constraint (not adjacent to other DW; chebyshev >= 2)
  const placedDW: { row: number; col: number }[] = [];
  for (let i = 0; i < BONUS_COUNTS.DW; i++) {
    const candidates = available.filter((p) => placedDW.every((q) => chebyshev(p, q) >= 2));
    if (candidates.length === 0) break;
    const choice = candidates[Math.floor(Math.random() * candidates.length)];
    board[choice.row][choice.col].bonus = 'DW';
    placedDW.push(choice);
    const idx = available.indexOf(choice);
    available.splice(idx, 1);
  }

  // Place TL and DL randomly in remaining cells
  for (const type of ['TL', 'DL'] as const) {
    for (let i = 0; i < BONUS_COUNTS[type]; i++) {
      if (available.length === 0) break;
      const idx = Math.floor(Math.random() * available.length);
      const choice = available[idx];
      board[choice.row][choice.col].bonus = type;
      available.splice(idx, 1);
    }
  }

  return board;
}
