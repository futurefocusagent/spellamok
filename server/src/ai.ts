import type { BoardCell, Tile, Placement, BlockZone, PlayerIdx, ItemType, GameState } from './types';
import { BOARD_SIZE, CENTER } from './bonuses';
import { validateAndScoreMove } from './move';

export interface AIMove {
  placements: Placement[];
  score: number;
}

function isAnchor(board: BoardCell[][], r: number, c: number): boolean {
  if (board[r][c].tile) return false;
  const neighbors = [
    [r - 1, c],
    [r + 1, c],
    [r, c - 1],
    [r, c + 1],
  ];
  for (const [nr, nc] of neighbors) {
    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc].tile) {
      return true;
    }
  }
  return false;
}

function inBlockZone(zones: BlockZone[], player: PlayerIdx, r: number, c: number): boolean {
  for (const z of zones) {
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

// Generate all candidate moves (placements). Greedy approach with bounded search.
export function findBestMove(
  board: BoardCell[][],
  rack: Tile[],
  isFirstMove: boolean,
  blockZones: BlockZone[],
  player: PlayerIdx,
  wordSet: Set<string>,
): AIMove | null {
  const anchors: { row: number; col: number }[] = [];
  if (isFirstMove) {
    anchors.push({ row: CENTER, col: CENTER });
  } else {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (isAnchor(board, r, c) && !inBlockZone(blockZones, player, r, c)) {
          anchors.push({ row: r, col: c });
        }
      }
    }
  }

  let best: AIMove | null = null;
  const directions: ('H' | 'V')[] = ['H', 'V'];

  // Limit rack usage for tractability: try up to 5 rack tiles per attempt
  const MAX_RACK_USE = Math.min(5, rack.length);

  for (const anchor of anchors) {
    for (const dir of directions) {
      // Try placements starting at various offsets relative to the anchor
      // For each direction, the "line" of cells along that direction passes through anchor
      // We try starting positions such that the anchor is included
      const lineLen = dir === 'H' ? BOARD_SIZE : BOARD_SIZE;
      for (let leftOffset = 0; leftOffset <= 5; leftOffset++) {
        const startR = dir === 'V' ? anchor.row - leftOffset : anchor.row;
        const startC = dir === 'H' ? anchor.col - leftOffset : anchor.col;
        if (startR < 0 || startC < 0) continue;
        // Word can start here only if the cell before is empty or off-board
        if (dir === 'H' && startC > 0 && board[startR][startC - 1].tile) continue;
        if (dir === 'V' && startR > 0 && board[startR - 1][startC].tile) continue;

        // Try various lengths
        for (let totalLen = 2; totalLen <= 10; totalLen++) {
          const endR = dir === 'V' ? startR + totalLen - 1 : startR;
          const endC = dir === 'H' ? startC + totalLen - 1 : startC;
          if (endR >= BOARD_SIZE || endC >= BOARD_SIZE) break;
          // Cell after the word must be empty or off-board
          if (dir === 'H' && endC + 1 < BOARD_SIZE && board[startR][endC + 1].tile) continue;
          if (dir === 'V' && endR + 1 < BOARD_SIZE && board[endR + 1][startC].tile) continue;

          // Enumerate cells in this slot, find empty ones (need rack tiles)
          const slotCells: { row: number; col: number; existing: Tile | null }[] = [];
          for (let i = 0; i < totalLen; i++) {
            const r = dir === 'V' ? startR + i : startR;
            const c = dir === 'H' ? startC + i : startC;
            slotCells.push({ row: r, col: c, existing: board[r][c].tile });
          }
          const emptySlots = slotCells.filter((s) => !s.existing);
          if (emptySlots.length === 0) continue;
          if (emptySlots.length > MAX_RACK_USE) continue;
          // The anchor must be in the slot
          if (!slotCells.some((s) => s.row === anchor.row && s.col === anchor.col)) continue;
          // Check no empty slot is in a block zone
          if (emptySlots.some((s) => inBlockZone(blockZones, player, s.row, s.col))) continue;

          // Try permutations of rack tiles of length = emptySlots.length
          const indices = rack.map((_, i) => i);
          const perms = permutations(indices, emptySlots.length);
          for (const perm of perms) {
            const placements: Placement[] = perm.map((idx, i) => ({
              row: emptySlots[i].row,
              col: emptySlots[i].col,
              tile: rack[idx],
              rackIndex: idx,
            }));
            // Skip if duplicate cells (shouldn't happen with distinct empty slots)
            const result = validateAndScoreMove(board, placements, isFirstMove, blockZones, player, wordSet);
            if (result.valid && (best === null || result.score > best.score)) {
              best = { placements, score: result.score };
            }
          }
        }
      }
    }
  }

  return best;
}

function* permutations<T>(arr: T[], k: number): IterableIterator<T[]> {
  if (k === 0) {
    yield [];
    return;
  }
  if (k > arr.length) return;
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const sub of permutations(rest, k - 1)) {
      yield [arr[i], ...sub];
    }
  }
}

// Decide whether AI should use an item this turn, and which.
export function aiChooseItem(state: GameState): { item: ItemType; target?: any } | null {
  const me = state.currentTurn;
  const ai = state.players[me];
  if (ai.items.length === 0) return null;

  // Use Steal Word if human has a high-value word on board (>= 15 points worth of letter values)
  if (ai.items.includes('STEAL_WORD')) {
    const humanWords = state.words.filter((w) => w.owner !== me);
    let bestWord: typeof state.words[number] | null = null;
    let bestSum = 0;
    for (const w of humanWords) {
      let s = 0;
      for (const p of w.positions) {
        const t = state.board[p.row][p.col].tile;
        if (t) s += t.value;
      }
      if (s > bestSum) {
        bestSum = s;
        bestWord = w;
      }
    }
    if (bestWord && bestSum >= 12) {
      return { item: 'STEAL_WORD', target: { wordId: bestWord.id } };
    }
  }

  // Use Remove Word randomly with 25% chance if AI is behind by 20+
  if (
    ai.items.includes('REMOVE_WORD') &&
    state.players[1 - me].score - ai.score >= 20 &&
    Math.random() < 0.25
  ) {
    const humanWords = state.words.filter((w) => w.owner !== me);
    if (humanWords.length > 0) {
      let bestWord = humanWords[0];
      let bestSum = 0;
      for (const w of humanWords) {
        let s = 0;
        for (const p of w.positions) {
          const t = state.board[p.row][p.col].tile;
          if (t) s += t.value;
        }
        if (s > bestSum) {
          bestSum = s;
          bestWord = w;
        }
      }
      return { item: 'REMOVE_WORD', target: { wordId: bestWord.id } };
    }
  }

  // Use Letter Swap if rack has many low-value/vowel-heavy or no vowels at all
  if (ai.items.includes('LETTER_SWAP')) {
    const vowels = ai.rack.filter((t) => 'AEIOU'.includes(t.letter)).length;
    if (vowels === 0 || vowels >= 5) {
      return { item: 'LETTER_SWAP', target: { indices: ai.rack.map((_, i) => i) } };
    }
  }

  return null;
}
