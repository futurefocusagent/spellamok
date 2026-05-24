export type BonusType = 'DL' | 'TL' | 'DW' | 'TW' | null;
export type Direction = 'H' | 'V';
export type PlayerIdx = 0 | 1;

export interface Tile {
  letter: string;
  value: number;
  isBlank?: boolean;
}

export interface BoardCell {
  tile: Tile | null;
  bonus: BonusType;
  centerStar: boolean;
}

export interface Placement {
  row: number;
  col: number;
  tile: Tile;
  rackIndex: number;
}

export type ItemType =
  | 'STEAL_WORD'
  | 'STEAL_LETTERS'
  | 'REMOVE_WORD'
  | 'BLOCK_ZONE'
  | 'LETTER_SWAP'
  | 'PEEK';

export interface PlacedWord {
  id: string;
  word: string;
  positions: { row: number; col: number }[];
  direction: Direction;
  owner: PlayerIdx;
}

export interface BlockZone {
  id: string;
  topLeft: { row: number; col: number };
  turnsLeft: number;
  owner: PlayerIdx;
}

export interface Player {
  rack: Tile[];
  score: number;
  items: ItemType[];
}

export interface LastMove {
  player: PlayerIdx;
  placements: Placement[];
  mainWord: string;
  allWords: string[];
  score: number;
  itemEarned: ItemType | null;
  passed?: boolean;
}

export interface GameState {
  id: string;
  board: BoardCell[][];
  players: [Player, Player];
  bag: Tile[];
  currentTurn: PlayerIdx;
  words: PlacedWord[];
  blockZones: BlockZone[];
  passCount: number;
  gameOver: boolean;
  winner: PlayerIdx | 'tie' | null;
  lastMove: LastMove | null;
  peekActive: boolean;
  log: string[];
}

export interface MatchSummary {
  id: string;
  created_at: string;
  status: 'in_progress' | 'finished' | string;
  human_score: number;
  computer_score: number;
}

export const ITEM_LABELS: Record<ItemType, string> = {
  STEAL_WORD: 'Steal Word',
  STEAL_LETTERS: 'Steal Letters',
  REMOVE_WORD: 'Remove Word',
  BLOCK_ZONE: 'Block Zone',
  LETTER_SWAP: 'Letter Swap',
  PEEK: 'Peek',
};

export const ITEM_DESCRIPTIONS: Record<ItemType, string> = {
  STEAL_WORD: "Click a word on the board to take its tiles to your rack.",
  STEAL_LETTERS: 'Take 2 random tiles from the opponent.',
  REMOVE_WORD: 'Click a word on the board to return it to the bag.',
  BLOCK_ZONE: 'Click a cell to block a 2x2 area for 3 of opponent’s turns.',
  LETTER_SWAP: 'Discard all your rack tiles and draw the same number.',
  PEEK: "See the opponent's rack for this turn.",
};
