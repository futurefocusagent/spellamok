import type { Tile } from '../types';

interface Props {
  tile: Tile;
  small?: boolean;
  faded?: boolean;
  highlight?: 'placed' | 'pending' | 'committed' | 'last';
}

export function TileView({ tile, small, faded, highlight }: Props) {
  const size = small ? 'w-7 h-7 text-sm' : 'w-full h-full text-lg sm:text-xl';
  const bg = highlight === 'pending' ? 'bg-amber-200' : highlight === 'last' ? 'bg-yellow-200' : 'bg-tile';
  return (
    <div
      className={`relative ${size} ${bg} ${faded ? 'opacity-40' : ''} rounded-sm border border-tileBorder text-neutral-900 flex items-center justify-center font-bold tile-shadow select-none`}
    >
      <span className="leading-none">{tile.letter === '?' ? '·' : tile.letter}</span>
      {!small && (
        <span className="absolute bottom-0.5 right-0.5 text-[0.55rem] font-semibold text-neutral-700">
          {tile.value}
        </span>
      )}
    </div>
  );
}
