import { useDroppable, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { BoardCell, BlockZone, PlacedWord, Placement, PlayerIdx, Tile } from '../types';
import { TileView } from './TileView';

const BONUS_COLOR: Record<string, string> = {
  DL: 'bg-dl text-white',
  TL: 'bg-tl text-white',
  DW: 'bg-dw text-white',
  TW: 'bg-tw text-white',
};

const BONUS_LABEL: Record<string, string> = {
  DL: 'DL',
  TL: 'TL',
  DW: 'DW',
  TW: 'TW',
};

interface Props {
  board: BoardCell[][];
  pending: Placement[];
  blockZones: BlockZone[];
  words: PlacedWord[];
  lastMovePlacements: Placement[];
  humanPlayer: PlayerIdx;
  targetingMode: { kind: 'cell' | 'word' | null };
  onCellClick: (r: number, c: number) => void;
  onWordClick: (wordId: string) => void;
}

function cellKey(r: number, c: number) {
  return `cell-${r}-${c}`;
}

function DroppableCell({
  r,
  c,
  children,
  onClick,
  isTargetable,
  isBlocked,
  isLast,
}: {
  r: number;
  c: number;
  children: React.ReactNode;
  onClick: () => void;
  isTargetable: boolean;
  isBlocked: boolean;
  isLast: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: cellKey(r, c) });
  const hover = isOver ? 'ring-2 ring-amber-400' : '';
  const target = isTargetable ? 'ring-2 ring-cyan-400 cursor-pointer' : '';
  const blocked = isBlocked ? 'ring-2 ring-red-500/70' : '';
  const last = isLast ? 'ring-2 ring-yellow-400/60' : '';
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`relative aspect-square ${hover} ${target} ${blocked} ${last}`}
    >
      {children}
    </div>
  );
}

function DraggablePendingTile({
  placement,
  children,
}: {
  placement: Placement;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `pending-${placement.rackIndex}`,
    data: { kind: 'pending', placement },
  });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    touchAction: 'none',
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
    position: 'absolute',
    inset: 0,
  };
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={style}>
      {children}
    </div>
  );
}

export function Board({
  board,
  pending,
  blockZones,
  words,
  lastMovePlacements,
  humanPlayer,
  targetingMode,
  onCellClick,
  onWordClick,
}: Props) {
  const pendingByCell = new Map<string, Placement>();
  for (const p of pending) {
    pendingByCell.set(`${p.row}-${p.col}`, p);
  }
  const lastMoveCells = new Set(lastMovePlacements.map((p) => `${p.row}-${p.col}`));

  const blockedSet = new Set<string>();
  for (const z of blockZones) {
    if (z.owner === humanPlayer) continue;
    for (let dr = 0; dr < 2; dr++) {
      for (let dc = 0; dc < 2; dc++) {
        blockedSet.add(`${z.topLeft.row + dr}-${z.topLeft.col + dc}`);
      }
    }
  }

  // Word lookup: map cell -> wordId(s)
  const cellToWords = new Map<string, string[]>();
  for (const w of words) {
    for (const p of w.positions) {
      const k = `${p.row}-${p.col}`;
      if (!cellToWords.has(k)) cellToWords.set(k, []);
      cellToWords.get(k)!.push(w.id);
    }
  }

  return (
    <div className="board-grid grid grid-cols-10 gap-[2px] bg-black/70 p-[2px] rounded-md select-none">
      {board.map((row, r) =>
        row.map((cell, c) => {
          const key = `${r}-${c}`;
          const pendingPlacement = pendingByCell.get(key);
          const tile = cell.tile ?? pendingPlacement?.tile;
          const wordIdsHere = cellToWords.get(key) ?? [];

          const isTargetable =
            (targetingMode.kind === 'cell' && !cell.tile) ||
            (targetingMode.kind === 'word' && wordIdsHere.length > 0);

          const handleClick = () => {
            if (targetingMode.kind === 'word' && wordIdsHere.length > 0) {
              onWordClick(wordIdsHere[0]);
            } else if (targetingMode.kind === 'cell') {
              onCellClick(r, c);
            }
          };

          let cellBg = 'bg-boardCell';
          let label: React.ReactNode = null;
          if (cell.bonus) {
            cellBg = BONUS_COLOR[cell.bonus];
            label = <span className="text-[0.5rem] font-bold opacity-90">{BONUS_LABEL[cell.bonus]}</span>;
          }
          if (cell.centerStar) {
            cellBg = 'bg-emerald-900';
            label = <span className="text-base">★</span>;
          }

          return (
            <DroppableCell
              key={key}
              r={r}
              c={c}
              onClick={handleClick}
              isTargetable={isTargetable}
              isBlocked={blockedSet.has(key)}
              isLast={lastMoveCells.has(key)}
            >
              <div className={`absolute inset-0 ${cellBg} flex items-center justify-center rounded-sm`}>
                {!tile && label}
              </div>
              {tile && !pendingPlacement && (
                <div className="absolute inset-0 p-[1px]">
                  <TileView tile={tile} />
                </div>
              )}
              {tile && pendingPlacement && (
                <DraggablePendingTile placement={pendingPlacement}>
                  <div className="absolute inset-0 p-[1px]">
                    <TileView tile={tile} highlight="pending" />
                  </div>
                </DraggablePendingTile>
              )}
            </DroppableCell>
          );
        }),
      )}
    </div>
  );
}
