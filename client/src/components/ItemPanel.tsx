import type { ItemType } from '../types';
import { ITEM_LABELS, ITEM_DESCRIPTIONS } from '../types';

interface Props {
  items: ItemType[];
  activeItem: ItemType | null;
  disabled: boolean;
  onActivate: (item: ItemType, idx: number) => void;
  onCancel: () => void;
}

export function ItemPanel({ items, activeItem, disabled, onActivate, onCancel }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-xs uppercase tracking-widest text-neutral-400">Items ({items.length}/3)</div>
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 && (
          <div className="text-neutral-600 text-xs italic">No items. Score 20+ in a turn to earn one.</div>
        )}
        {items.map((item, i) => {
          const active = activeItem === item;
          return (
            <button
              key={`${item}-${i}`}
              disabled={disabled && !active}
              onClick={() => (active ? onCancel() : onActivate(item, i))}
              className={`px-2 py-1 rounded text-xs border ${
                active
                  ? 'bg-cyan-700 border-cyan-400 text-white'
                  : 'bg-neutral-900 border-neutral-700 text-neutral-200 hover:bg-neutral-800'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title={ITEM_DESCRIPTIONS[item]}
            >
              {ITEM_LABELS[item]}
            </button>
          );
        })}
      </div>
      {activeItem && (
        <div className="text-xs text-cyan-300">
          {ITEM_DESCRIPTIONS[activeItem]} <button className="underline ml-1" onClick={onCancel}>cancel</button>
        </div>
      )}
    </div>
  );
}
