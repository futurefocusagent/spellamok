import { useDroppable, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Tile } from '../types';
import { TileView } from './TileView';

interface Props {
  rack: Tile[];
  usedIndices: Set<number>;
  label: string;
  swapMode?: boolean;
  swapSelected?: Set<number>;
  onSwapToggle?: (idx: number) => void;
  displayOrder?: number[] | null;
  onShuffle?: () => void;
  shuffleDisabled?: boolean;
}

function DraggableRackTile({
  tile,
  idx,
  used,
  swapMode,
  swapSelected,
  onSwapToggle,
}: {
  tile: Tile;
  idx: number;
  used: boolean;
  swapMode: boolean;
  swapSelected: boolean;
  onSwapToggle?: (idx: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `rack-${idx}`,
    data: { kind: 'rack', rackIndex: idx, tile },
    disabled: used || swapMode,
  });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    touchAction: 'none',
    opacity: isDragging ? 0.4 : used ? 0.3 : 1,
    cursor: used ? 'default' : swapMode ? 'pointer' : 'grab',
  };
  return (
    <div
      ref={setNodeRef}
      {...(swapMode ? {} : listeners)}
      {...attributes}
      style={style}
      className={`w-11 h-11 sm:w-12 sm:h-12 ${swapSelected ? 'ring-2 ring-cyan-400' : ''}`}
      onClick={() => {
        if (swapMode && onSwapToggle) onSwapToggle(idx);
      }}
    >
      <TileView tile={tile} highlight={used ? 'committed' : 'placed'} />
    </div>
  );
}

export function Rack({
  rack,
  usedIndices,
  label,
  swapMode,
  swapSelected,
  onSwapToggle,
  displayOrder,
  onShuffle,
  shuffleDisabled,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: 'rack' });
  const order =
    displayOrder && displayOrder.length === rack.length
      ? displayOrder
      : rack.map((_, i) => i);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="text-xs uppercase tracking-widest text-neutral-400">{label}</div>
      <div
        ref={setNodeRef}
        className={`flex flex-wrap gap-1.5 justify-center bg-neutral-900/70 rounded-md p-2 border border-neutral-800 ${
          isOver ? 'ring-2 ring-amber-400' : ''
        }`}
      >
        {rack.length === 0 && <div className="text-neutral-600 px-3 py-2 text-sm">empty</div>}
        {order.map((i) => {
          const t = rack[i];
          if (!t) return null;
          return (
            <DraggableRackTile
              key={`rack-tile-${i}`}
              tile={t}
              idx={i}
              used={usedIndices.has(i)}
              swapMode={!!swapMode}
              swapSelected={!!swapSelected?.has(i)}
              onSwapToggle={onSwapToggle}
            />
          );
        })}
      </div>
      {onShuffle && (
        <button
          type="button"
          onClick={onShuffle}
          disabled={shuffleDisabled || rack.length <= 1}
          className="text-xs px-2 py-1 rounded border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          🔀 Shuffle
        </button>
      )}
    </div>
  );
}
