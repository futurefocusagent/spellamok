import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { api } from '../api';
import type { GameState, ItemType, Placement, Tile } from '../types';
import { ITEM_LABELS } from '../types';
import { Board } from './Board';
import { Rack } from './Rack';
import { ItemPanel } from './ItemPanel';
import { ScoreBoard } from './ScoreBoard';

type ActiveItem =
  | { type: 'STEAL_WORD' | 'REMOVE_WORD' }
  | { type: 'BLOCK_ZONE' }
  | { type: 'LETTER_SWAP'; selected: Set<number> }
  | null;

export function GameView() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<GameState | null>(null);
  const [pending, setPending] = useState<Placement[]>([]);
  const [activeItem, setActiveItem] = useState<ActiveItem>(null);
  const [thinking, setThinking] = useState(false);
  const [hiddenCells, setHiddenCells] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rackOrder, setRackOrder] = useState<number[] | null>(null);
  const animationTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 80, tolerance: 6 } }),
  );

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setState(null);
    setPending([]);
    setActiveItem(null);
    setHiddenCells(new Set());
    setError(null);
    setRackOrder(null);
    api
      .getGame(id)
      .then((s) => {
        if (cancelled) return;
        setState(s);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message ?? String(e));
      });
    return () => {
      cancelled = true;
      for (const t of animationTimers.current) clearTimeout(t);
      animationTimers.current = [];
    };
  }, [id]);

  function clearAnimationTimers() {
    for (const t of animationTimers.current) clearTimeout(t);
    animationTimers.current = [];
  }

  function shuffleRack() {
    if (!state) return;
    const len = state.players[0].rack.length;
    if (len <= 1) return;
    const base = rackOrder && rackOrder.length === len ? [...rackOrder] : Array.from({ length: len }, (_, i) => i);
    for (let i = base.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [base[i], base[j]] = [base[j], base[i]];
    }
    setRackOrder(base);
  }

  function applyNewState(s: GameState) {
    setRackOrder(null);
    if (s.lastMove && s.lastMove.player === 1 && s.lastMove.placements.length > 0) {
      const placements = s.lastMove.placements;
      const hidden = new Set(placements.map((p) => `${p.row}-${p.col}`));
      setHiddenCells(hidden);
      setThinking(true);
      setState(s);

      const t1 = setTimeout(() => {
        setThinking(false);
        placements.forEach((p, i) => {
          const t = setTimeout(() => {
            setHiddenCells((prev) => {
              const next = new Set(prev);
              next.delete(`${p.row}-${p.col}`);
              return next;
            });
          }, 300 * (i + 1));
          animationTimers.current.push(t);
        });
        const tEnd = setTimeout(() => {
          setHiddenCells(new Set());
        }, 300 * (placements.length + 1));
        animationTimers.current.push(tEnd);
      }, 900);
      animationTimers.current.push(t1);
    } else {
      setState(s);
      setHiddenCells(new Set());
      setThinking(false);
    }
  }

  function pendingByCell() {
    const m = new Map<string, Placement>();
    for (const p of pending) m.set(`${p.row}-${p.col}`, p);
    return m;
  }

  function placeOnCell(rackIndex: number, tile: Tile, r: number, c: number) {
    if (!state) return;
    if (state.currentTurn !== 0) return;
    if (state.board[r][c].tile) return;
    const m = pendingByCell();
    if (m.has(`${r}-${c}`)) return;
    for (const z of state.blockZones) {
      if (z.owner === 0) continue;
      if (z.turnsLeft <= 0) continue;
      if (
        r >= z.topLeft.row &&
        r < z.topLeft.row + 2 &&
        c >= z.topLeft.col &&
        c < z.topLeft.col + 2
      ) {
        setError('That square is blocked.');
        return;
      }
    }
    const newPending = pending.filter((p) => p.rackIndex !== rackIndex);
    let placedTile = tile;
    if (tile.isBlank) {
      const choice = window.prompt('Enter a letter for the blank tile (A–Z):', '');
      if (!choice) return;
      const letter = choice.trim().toUpperCase().slice(0, 1);
      if (!/^[A-Z]$/.test(letter)) {
        setError('Invalid blank letter.');
        return;
      }
      placedTile = { letter, value: 0, isBlank: true };
    }
    newPending.push({ row: r, col: c, tile: placedTile, rackIndex });
    setPending(newPending);
    setError(null);
  }

  function removePending(rackIndex: number) {
    setPending((p) => p.filter((x) => x.rackIndex !== rackIndex));
  }

  function recallAll() {
    setPending([]);
    setError(null);
  }

  const usedRackIndices = useMemo(() => new Set(pending.map((p) => p.rackIndex)), [pending]);

  function handleDragEnd(e: DragEndEvent) {
    if (!state || state.currentTurn !== 0 || activeItem) return;
    const { active, over } = e;
    if (!over) return;
    const overId = over.id as string;
    const data = active.data.current as any;

    if (data?.kind === 'rack') {
      if (overId.startsWith('cell-')) {
        const [, rs, cs] = overId.split('-');
        placeOnCell(data.rackIndex, data.tile, Number(rs), Number(cs));
      } else if (overId.startsWith('rack-slot-')) {
        // Reorder within rack
        const targetRackIndex = Number(overId.replace('rack-slot-', ''));
        const fromRackIndex = data.rackIndex;
        if (fromRackIndex === targetRackIndex) return;
        if (usedRackIndices.has(fromRackIndex)) return; // can't move placed tile
        const rackLen = state.players[0].rack.length;
        const base = rackOrder && rackOrder.length === rackLen
          ? [...rackOrder]
          : Array.from({ length: rackLen }, (_, i) => i);
        // Find positions in display order
        const fromPos = base.indexOf(fromRackIndex);
        const toPos = base.indexOf(targetRackIndex);
        if (fromPos === -1 || toPos === -1) return;
        // Move fromPos to toPos
        base.splice(fromPos, 1);
        base.splice(toPos, 0, fromRackIndex);
        setRackOrder(base);
      }
    } else if (data?.kind === 'pending') {
      const placement: Placement = data.placement;
      if (overId === 'rack') {
        removePending(placement.rackIndex);
      } else if (overId.startsWith('cell-')) {
        const [, rs, cs] = overId.split('-');
        const r = Number(rs);
        const c = Number(cs);
        if (state.board[r][c].tile) return;
        const m = pendingByCell();
        const target = m.get(`${r}-${c}`);
        if (target && target.rackIndex !== placement.rackIndex) return;
        setPending((prev) =>
          prev.map((p) =>
            p.rackIndex === placement.rackIndex ? { ...p, row: r, col: c } : p,
          ),
        );
      }
    }
  }

  async function submitMove() {
    if (!state || pending.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const payload = pending.map((p) => ({
        row: p.row,
        col: p.col,
        tile: p.tile,
        rackIndex: p.rackIndex,
      }));
      const s = await api.move(state.id, payload);
      setPending([]);
      applyNewState(s);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      if (e?.state) setState(e.state);
    } finally {
      setBusy(false);
    }
  }

  async function skipItemPhase() {
    if (!state || busy) return;
    setBusy(true);
    setError(null);
    try {
      const s = await api.skipItemPhase(state.id);
      applyNewState(s);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function passTurn() {
    if (!state || busy) return;
    setBusy(true);
    setError(null);
    try {
      const s = await api.pass(state.id);
      setPending([]);
      applyNewState(s);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function useItemSimple(item: ItemType, target?: any) {
    if (!state || busy) return;
    setBusy(true);
    setError(null);
    try {
      const s = await api.useItem(state.id, item, target);
      setState(s);
      setRackOrder(null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      if (e?.state) setState(e.state);
    } finally {
      setBusy(false);
      setActiveItem(null);
    }
  }

  function activateItem(item: ItemType) {
    if (!state || state.currentTurn !== 0 || busy) return;
    if (state.gameOver) return;
    setError(null);
    if (item === 'STEAL_LETTERS' || item === 'PEEK') {
      void useItemSimple(item);
      return;
    }
    if (item === 'STEAL_WORD' || item === 'REMOVE_WORD') {
      setActiveItem({ type: item });
      return;
    }
    if (item === 'BLOCK_ZONE') {
      setActiveItem({ type: 'BLOCK_ZONE' });
      return;
    }
    if (item === 'LETTER_SWAP') {
      setActiveItem({ type: 'LETTER_SWAP', selected: new Set() });
      return;
    }
  }

  function handleWordClick(wordId: string) {
    if (!activeItem) return;
    if (activeItem.type === 'STEAL_WORD' || activeItem.type === 'REMOVE_WORD') {
      void useItemSimple(activeItem.type, { wordId });
    }
  }

  function handleCellClick(r: number, c: number) {
    if (!activeItem) return;
    if (activeItem.type === 'BLOCK_ZONE') {
      const row = Math.min(r, 8);
      const col = Math.min(c, 8);
      void useItemSimple('BLOCK_ZONE', { topLeft: { row, col } });
    }
  }

  function toggleSwap(idx: number) {
    if (!activeItem || activeItem.type !== 'LETTER_SWAP') return;
    const next = new Set(activeItem.selected);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setActiveItem({ type: 'LETTER_SWAP', selected: next });
  }

  function confirmSwap() {
    if (!activeItem || activeItem.type !== 'LETTER_SWAP') return;
    const indices = Array.from(activeItem.selected);
    void useItemSimple('LETTER_SWAP', { indices });
  }

  const viewBoard = useMemo(() => {
    if (!state) return null;
    if (hiddenCells.size === 0 && !thinking) return state.board;
    return state.board.map((row, r) =>
      row.map((cell, c) => {
        if (hiddenCells.has(`${r}-${c}`)) return { ...cell, tile: null };
        return cell;
      }),
    );
  }, [state, hiddenCells, thinking]);

  // Reset rackOrder if rack length changes (after move/swap/etc.)
  useEffect(() => {
    if (!state) return;
    if (rackOrder && rackOrder.length !== state.players[0].rack.length) {
      setRackOrder(null);
    }
  }, [state, rackOrder]);

  if (error && !state) {
    return (
      <div className="app-viewport font-sans text-neutral-200 px-3 py-6 max-w-3xl mx-auto">
        <Link to="/" className="text-xs text-neutral-400 hover:text-neutral-200">
          ← Matches
        </Link>
        <div className="mt-4 text-sm text-red-400 bg-red-900/30 border border-red-700/50 rounded px-2 py-1">
          {error}
        </div>
      </div>
    );
  }

  if (!state || !viewBoard) {
    return (
      <div className="app-viewport flex items-center justify-center text-neutral-400">
        Loading…
      </div>
    );
  }

  const human = state.players[0];
  const computer = state.players[1];
  const humansTurn = state.currentTurn === 0 && !state.gameOver;
  const inItemPhase = humansTurn && state.phase === 'item';
  const canPlay = humansTurn && !inItemPhase && pending.length > 0 && !busy && !thinking && !activeItem;
  const itemDisabled = !humansTurn || inItemPhase || busy || thinking || pending.length > 0;

  const lastMovePlacements =
    state.lastMove && hiddenCells.size === 0 && !thinking
      ? state.lastMove.placements
      : [];

  const targetingMode: { kind: 'cell' | 'word' | null } = activeItem
    ? activeItem.type === 'STEAL_WORD' || activeItem.type === 'REMOVE_WORD'
      ? { kind: 'word' }
      : activeItem.type === 'BLOCK_ZONE'
      ? { kind: 'cell' }
      : { kind: null }
    : { kind: null };

  const swapMode = activeItem?.type === 'LETTER_SWAP';
  const swapSelected = activeItem?.type === 'LETTER_SWAP' ? activeItem.selected : new Set<number>();
  const computerRackDisplay = computer.rack;

  const shuffleDisabled = !humansTurn || busy || thinking || !!activeItem;

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="game-viewport flex flex-col gap-3 px-3 py-3 sm:py-4 max-w-3xl mx-auto">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="text-xs text-neutral-400 hover:text-neutral-200"
            >
              ← Matches
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              <span className="text-amber-300">Spell</span>amok
            </h1>
          </div>
        </header>

        <ScoreBoard state={state} thinking={thinking} />

        {/* Item Phase: must use or skip before playing */}
        {inItemPhase && (
          <div className="rounded-lg border border-amber-500/60 bg-amber-950/40 p-4 flex flex-col gap-3">
            <div className="text-sm font-semibold text-amber-300 tracking-wide">⚔️ Item Phase</div>
            <p className="text-xs text-neutral-300">
              Use one item before playing your word, or skip.
            </p>
            <div className="flex flex-wrap gap-2">
              {state.players[0].items.length === 0 ? (
                <span className="text-xs text-neutral-500 italic">No items held — skip to continue.</span>
              ) : (
                state.players[0].items.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => activateItem(item)}
                    disabled={busy || !!activeItem}
                    className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-sm font-medium text-white"
                  >
                    {ITEM_LABELS[item]}
                  </button>
                ))
              )}
            </div>
            <button
              onClick={() => void skipItemPhase()}
              disabled={busy || !!activeItem}
              className="self-start px-3 py-1 rounded border border-neutral-600 bg-neutral-800 hover:bg-neutral-700 text-sm text-neutral-300 disabled:opacity-50"
            >
              Skip →
            </button>
          </div>
        )}

        <div className="flex flex-col items-center">
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">
            Computer rack {state.peekActive ? '(Peek active)' : '(hidden)'}
          </div>
          <div className={`flex gap-1 mt-1 ${state.peekActive ? 'opacity-100' : 'opacity-40'}`}>
            {computerRackDisplay.map((t, i) => (
              <div
                key={i}
                className={`w-7 h-7 rounded-sm border ${
                  state.peekActive ? 'bg-tile border-tileBorder' : 'bg-neutral-800 border-neutral-700'
                } flex items-center justify-center text-xs font-bold text-neutral-900`}
              >
                <span>{state.peekActive ? (t.letter === '?' ? '·' : t.letter) : ''}</span>
              </div>
            ))}
          </div>
        </div>

        <Board
          board={viewBoard}
          pending={pending}
          blockZones={state.blockZones}
          words={state.words}
          lastMovePlacements={lastMovePlacements}
          humanPlayer={0}
          targetingMode={targetingMode}
          onCellClick={handleCellClick}
          onWordClick={handleWordClick}
        />

        {error && (
          <div className="text-sm text-red-400 bg-red-900/30 border border-red-700/50 rounded px-2 py-1">
            {error}
          </div>
        )}

        <Rack
          rack={human.rack}
          usedIndices={usedRackIndices}
          label="Your rack"
          swapMode={swapMode}
          swapSelected={swapSelected}
          onSwapToggle={toggleSwap}
          displayOrder={rackOrder}
          onShuffle={shuffleRack}
          shuffleDisabled={shuffleDisabled}
        />

        <div className="flex flex-wrap items-center gap-2 justify-center">
          <button
            onClick={() => void submitMove()}
            disabled={!canPlay}
            className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-sm font-semibold"
          >
            Play Word
          </button>
          <button
            onClick={recallAll}
            disabled={pending.length === 0 || !humansTurn || busy}
            className="px-3 py-1.5 rounded bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-900 disabled:text-neutral-600 text-sm"
          >
            Recall
          </button>
          <button
            onClick={() => void passTurn()}
            disabled={!humansTurn || inItemPhase || busy || thinking || pending.length > 0 || !!activeItem}
            className="px-3 py-1.5 rounded bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-900 disabled:text-neutral-600 text-sm"
          >
            Pass
          </button>
          {swapMode && (
            <button
              onClick={confirmSwap}
              className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-sm font-semibold"
            >
              Confirm Swap ({swapSelected.size})
            </button>
          )}
        </div>

        <ItemPanel
          items={human.items}
          activeItem={activeItem?.type ?? null}
          disabled={itemDisabled}
          onActivate={(item) => activateItem(item)}
          onCancel={() => setActiveItem(null)}
        />

        {state.lastMove && !thinking && (
          <div className="text-xs text-neutral-400 text-center">
            Last:{' '}
            {state.lastMove.passed
              ? `${state.lastMove.player === 0 ? 'Human' : 'Computer'} passed`
              : `${state.lastMove.player === 0 ? 'Human' : 'Computer'} played ${state.lastMove.allWords.join(', ')} for ${state.lastMove.score}`}
            {state.lastMove.itemEarned && ` (+${state.lastMove.itemEarned.replace('_', ' ').toLowerCase()})`}
          </div>
        )}

        <details className="text-xs text-neutral-500 mt-1">
          <summary className="cursor-pointer hover:text-neutral-300">Game log</summary>
          <div className="mt-1 max-h-32 overflow-y-auto bg-neutral-900/50 rounded p-2 space-y-0.5">
            {state.log.slice(-30).map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </details>
      </div>
    </DndContext>
  );
}
