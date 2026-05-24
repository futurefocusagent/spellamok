import type {
  GameState,
  Tile,
  Placement,
  Player,
  ItemType,
  PlayerIdx,
  LastMove,
  PlacedWord,
  BlockZone,
} from './types';
import { createTileBag, drawTiles, shuffle, LETTER_VALUES } from './tiles';
import { createBoard, BOARD_SIZE } from './bonuses';
import { validateAndScoreMove, type MoveResult } from './move';
import { loadWords } from './words';
import { findBestMove, aiChooseItem } from './ai';

export const RACK_SIZE = 7;
export const ITEM_THRESHOLD = 20;
export const MAX_ITEMS = 3;
export const ALL_ITEMS: ItemType[] = [
  'STEAL_WORD',
  'STEAL_LETTERS',
  'REMOVE_WORD',
  'BLOCK_ZONE',
  'LETTER_SWAP',
  'PEEK',
];

import { randomUUID } from 'crypto';

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createGame(): GameState {
  const board = createBoard();
  const bag = createTileBag();
  const p0Rack = drawTiles(bag, RACK_SIZE);
  const p1Rack = drawTiles(bag, RACK_SIZE);
  const state: GameState = {
    id: randomUUID(),
    board,
    players: [
      { rack: p0Rack, score: 0, items: [] },
      { rack: p1Rack, score: 0, items: [] },
    ],
    bag,
    currentTurn: 0,
    words: [],
    blockZones: [],
    passCount: 0,
    gameOver: false,
    winner: null,
    lastMove: null,
    peekActive: false,
    log: [`Game started. Human goes first.`],
  };
  return state;
}

function refillRack(state: GameState, playerIdx: PlayerIdx) {
  const p = state.players[playerIdx];
  const needed = RACK_SIZE - p.rack.length;
  if (needed > 0) {
    const drawn = drawTiles(state.bag, needed);
    p.rack.push(...drawn);
  }
}

function checkGameEnd(state: GameState) {
  // Game ends when bag empty AND a player has empty rack
  if (state.bag.length === 0 && state.players.some((p) => p.rack.length === 0)) {
    state.gameOver = true;
  }
  // Or after 4 consecutive passes
  if (state.passCount >= 4) {
    state.gameOver = true;
  }
  if (state.gameOver) {
    const [a, b] = state.players;
    if (a.score > b.score) state.winner = 0;
    else if (b.score > a.score) state.winner = 1;
    else state.winner = 'tie';
    state.log.push(`Game over. Final: Human ${a.score}, Computer ${b.score}.`);
  }
}

function tickBlockZones(state: GameState, currentPlayer: PlayerIdx) {
  for (const z of state.blockZones) {
    if (z.owner !== currentPlayer) {
      z.turnsLeft -= 1;
    }
  }
  state.blockZones = state.blockZones.filter((z) => z.turnsLeft > 0);
}

function maybeAwardItem(player: Player, score: number, log: string[], playerName: string) {
  if (score >= ITEM_THRESHOLD && player.items.length < MAX_ITEMS) {
    const item = ALL_ITEMS[Math.floor(Math.random() * ALL_ITEMS.length)];
    player.items.push(item);
    log.push(`${playerName} earned an item: ${formatItemName(item)}!`);
  }
}

export function formatItemName(item: ItemType): string {
  return item
    .split('_')
    .map((s) => s[0] + s.slice(1).toLowerCase())
    .join(' ');
}

function playerName(idx: PlayerIdx): string {
  return idx === 0 ? 'Human' : 'Computer';
}

function isFirstMoveState(state: GameState): boolean {
  return state.words.length === 0;
}

function commitPlacements(state: GameState, placements: Placement[]) {
  for (const p of placements) {
    state.board[p.row][p.col] = { ...state.board[p.row][p.col], tile: { ...p.tile } };
  }
}

function removeTilesFromRack(player: Player, rackIndices: number[]): Tile[] {
  const removed: Tile[] = [];
  const sorted = [...rackIndices].sort((a, b) => b - a);
  for (const i of sorted) {
    if (i >= 0 && i < player.rack.length) {
      removed.unshift(player.rack[i]);
      player.rack.splice(i, 1);
    }
  }
  return removed;
}

export function applyHumanMove(state: GameState, placements: Placement[]): { ok: boolean; error?: string; result?: MoveResult } {
  if (state.gameOver) return { ok: false, error: 'Game is over' };
  if (state.currentTurn !== 0) return { ok: false, error: 'Not your turn' };

  const wordSet = loadWords();
  const isFirst = isFirstMoveState(state);
  const result = validateAndScoreMove(state.board, placements, isFirst, state.blockZones, 0, wordSet);
  if (!result.valid) return { ok: false, error: result.error };

  // Validate that all placed tiles come from the player's rack
  const rackIndices = placements.map((p) => p.rackIndex);
  const seen = new Set<number>();
  for (const ri of rackIndices) {
    if (ri < 0 || ri >= state.players[0].rack.length) return { ok: false, error: 'Invalid rack index' };
    if (seen.has(ri)) return { ok: false, error: 'Duplicate rack index' };
    seen.add(ri);
    const rackTile = state.players[0].rack[ri];
    const placement = placements.find((p) => p.rackIndex === ri)!;
    if (rackTile.letter !== placement.tile.letter || rackTile.isBlank !== placement.tile.isBlank) {
      // For blanks the displayed letter may differ; allow if rack tile is blank
      if (!rackTile.isBlank) return { ok: false, error: 'Tile mismatch with rack' };
    }
  }

  // Commit
  commitPlacements(state, placements);
  removeTilesFromRack(state.players[0], rackIndices);
  state.players[0].score += result.score;
  state.words.push(...result.newPlacedWords);
  refillRack(state, 0);
  state.passCount = 0;

  const lastMove: LastMove = {
    player: 0,
    placements,
    mainWord: result.words[0]?.word ?? '',
    allWords: result.words.map((w) => w.word),
    score: result.score,
    itemEarned: null,
  };
  state.log.push(`Human played ${lastMove.mainWord} for ${result.score} points.`);

  const itemsBefore = state.players[0].items.length;
  maybeAwardItem(state.players[0], result.score, state.log, 'Human');
  if (state.players[0].items.length > itemsBefore) {
    lastMove.itemEarned = state.players[0].items[state.players[0].items.length - 1];
  }

  state.lastMove = lastMove;
  checkGameEnd(state);

  if (!state.gameOver) {
    state.currentTurn = 1;
    state.peekActive = false;
    tickBlockZones(state, 1);
  }

  return { ok: true, result };
}

export function applyPass(state: GameState): { ok: boolean; error?: string } {
  if (state.gameOver) return { ok: false, error: 'Game is over' };
  const cur = state.currentTurn;
  state.passCount += 1;
  state.lastMove = {
    player: cur,
    placements: [],
    mainWord: '',
    allWords: [],
    score: 0,
    itemEarned: null,
    passed: true,
  };
  state.log.push(`${playerName(cur)} passed.`);
  checkGameEnd(state);
  if (!state.gameOver) {
    state.currentTurn = (1 - cur) as PlayerIdx;
    state.peekActive = false;
    tickBlockZones(state, state.currentTurn);
  }
  return { ok: true };
}

export function applyUseItem(
  state: GameState,
  item: ItemType,
  target: any,
  player: PlayerIdx,
): { ok: boolean; error?: string } {
  if (state.gameOver) return { ok: false, error: 'Game is over' };
  if (state.currentTurn !== player) return { ok: false, error: 'Not your turn' };
  const p = state.players[player];
  const idx = p.items.indexOf(item);
  if (idx === -1) return { ok: false, error: 'Item not held' };

  switch (item) {
    case 'STEAL_WORD': {
      const wordId = target?.wordId;
      const w = state.words.find((x) => x.id === wordId);
      if (!w) return { ok: false, error: 'Word not found' };
      // Take tiles; for each position, if no other word also uses it, remove it
      const tilesTaken: Tile[] = [];
      for (const pos of w.positions) {
        const t = state.board[pos.row][pos.col].tile;
        if (!t) continue;
        const usedByOther = state.words.some(
          (other) =>
            other.id !== w.id &&
            other.positions.some((q) => q.row === pos.row && q.col === pos.col),
        );
        if (!usedByOther) {
          tilesTaken.push({ ...t });
          state.board[pos.row][pos.col].tile = null;
        }
      }
      state.words = state.words.filter((x) => x.id !== w.id);
      // Add to rack, excess to bag
      for (const t of tilesTaken) {
        if (p.rack.length < RACK_SIZE) p.rack.push(t);
        else state.bag.push(t);
      }
      if (tilesTaken.length > 0) state.bag = shuffle(state.bag);
      state.log.push(`${playerName(player)} used Steal Word on "${w.word}".`);
      break;
    }
    case 'REMOVE_WORD': {
      const wordId = target?.wordId;
      const w = state.words.find((x) => x.id === wordId);
      if (!w) return { ok: false, error: 'Word not found' };
      const tilesReturned: Tile[] = [];
      for (const pos of w.positions) {
        const t = state.board[pos.row][pos.col].tile;
        if (!t) continue;
        const usedByOther = state.words.some(
          (other) =>
            other.id !== w.id &&
            other.positions.some((q) => q.row === pos.row && q.col === pos.col),
        );
        if (!usedByOther) {
          tilesReturned.push({ ...t });
          state.board[pos.row][pos.col].tile = null;
        }
      }
      state.words = state.words.filter((x) => x.id !== w.id);
      state.bag.push(...tilesReturned);
      state.bag = shuffle(state.bag);
      state.log.push(`${playerName(player)} used Remove Word on "${w.word}".`);
      break;
    }
    case 'STEAL_LETTERS': {
      const opp = state.players[1 - player];
      const n = Math.min(2, opp.rack.length);
      for (let i = 0; i < n; i++) {
        const j = Math.floor(Math.random() * opp.rack.length);
        const [t] = opp.rack.splice(j, 1);
        p.rack.push(t);
      }
      state.log.push(`${playerName(player)} used Steal Letters (${n} tile${n === 1 ? '' : 's'}).`);
      break;
    }
    case 'BLOCK_ZONE': {
      const tl = target?.topLeft;
      if (
        !tl ||
        typeof tl.row !== 'number' ||
        typeof tl.col !== 'number' ||
        tl.row < 0 ||
        tl.row > BOARD_SIZE - 2 ||
        tl.col < 0 ||
        tl.col > BOARD_SIZE - 2
      ) {
        return { ok: false, error: 'Invalid block zone target' };
      }
      const zone: BlockZone = {
        id: genId('bz'),
        topLeft: { row: tl.row, col: tl.col },
        turnsLeft: 3,
        owner: player,
      };
      state.blockZones.push(zone);
      state.log.push(`${playerName(player)} used Block Zone at (${tl.row}, ${tl.col}).`);
      break;
    }
    case 'LETTER_SWAP': {
      const indices: number[] = Array.isArray(target?.indices) ? target.indices : p.rack.map((_, i) => i);
      const valid = indices.every((i) => i >= 0 && i < p.rack.length);
      if (!valid) return { ok: false, error: 'Invalid indices' };
      const unique = Array.from(new Set(indices));
      const removed = removeTilesFromRack(p, unique);
      state.bag.push(...removed);
      state.bag = shuffle(state.bag);
      const drawn = drawTiles(state.bag, removed.length);
      p.rack.push(...drawn);
      state.log.push(`${playerName(player)} swapped ${removed.length} tile${removed.length === 1 ? '' : 's'}.`);
      break;
    }
    case 'PEEK': {
      state.peekActive = true;
      state.log.push(`${playerName(player)} used Peek.`);
      break;
    }
  }

  p.items.splice(idx, 1);
  return { ok: true };
}

export function runComputerTurn(state: GameState): void {
  if (state.gameOver) return;
  if (state.currentTurn !== 1) return;

  // Optionally use an item
  const itemChoice = aiChooseItem(state);
  if (itemChoice) {
    applyUseItem(state, itemChoice.item, itemChoice.target, 1);
  }

  const wordSet = loadWords();
  const isFirst = isFirstMoveState(state);
  const best = findBestMove(state.board, state.players[1].rack, isFirst, state.blockZones, 1, wordSet);

  if (!best) {
    // Pass
    applyPass(state);
    return;
  }

  const result = validateAndScoreMove(state.board, best.placements, isFirst, state.blockZones, 1, wordSet);
  if (!result.valid) {
    applyPass(state);
    return;
  }

  // Commit move
  commitPlacements(state, best.placements);
  const usedRackIndices = best.placements.map((p) => p.rackIndex);
  removeTilesFromRack(state.players[1], usedRackIndices);
  state.players[1].score += result.score;
  state.words.push(...result.newPlacedWords);
  refillRack(state, 1);
  state.passCount = 0;

  const lastMove: LastMove = {
    player: 1,
    placements: best.placements,
    mainWord: result.words[0]?.word ?? '',
    allWords: result.words.map((w) => w.word),
    score: result.score,
    itemEarned: null,
  };
  state.log.push(`Computer played ${lastMove.mainWord} for ${result.score} points.`);

  const itemsBefore = state.players[1].items.length;
  maybeAwardItem(state.players[1], result.score, state.log, 'Computer');
  if (state.players[1].items.length > itemsBefore) {
    lastMove.itemEarned = state.players[1].items[state.players[1].items.length - 1];
  }

  state.lastMove = lastMove;
  checkGameEnd(state);

  if (!state.gameOver) {
    state.currentTurn = 0;
    tickBlockZones(state, 0);
  }
}

// View state with peek visibility applied
export function viewForHuman(state: GameState): GameState {
  // The "human" perspective: hide computer's rack and items unless peek active or game over
  const cloned: GameState = JSON.parse(JSON.stringify(state));
  if (!state.peekActive && !state.gameOver) {
    cloned.players[1] = {
      ...cloned.players[1],
      rack: cloned.players[1].rack.map(() => ({ letter: '?', value: 0, isBlank: false })),
    };
  }
  return cloned;
}
