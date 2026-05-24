import type { GameState } from '../types';

interface Props {
  state: GameState;
  thinking: boolean;
}

export function ScoreBoard({ state, thinking }: Props) {
  const human = state.players[0];
  const computer = state.players[1];
  const turnLabel = state.gameOver
    ? state.winner === 0
      ? 'Human wins!'
      : state.winner === 1
      ? 'Computer wins!'
      : 'Tie game'
    : state.currentTurn === 0
    ? "Your turn"
    : thinking
    ? 'Computer is thinking...'
    : "Computer's turn";
  return (
    <div className="flex items-center justify-between gap-3 w-full max-w-[640px] mx-auto">
      <div
        className={`flex-1 rounded-md px-3 py-2 border ${
          state.currentTurn === 0 && !state.gameOver ? 'border-amber-400 bg-amber-900/20' : 'border-neutral-800 bg-neutral-900/60'
        }`}
      >
        <div className="text-xs uppercase text-neutral-400">Human</div>
        <div className="text-2xl font-bold">{human.score}</div>
      </div>
      <div className="text-center text-xs sm:text-sm text-neutral-300 px-2">
        <div>{turnLabel}</div>
        <div className="text-neutral-500 mt-1">Bag: {state.bag.length}</div>
      </div>
      <div
        className={`flex-1 text-right rounded-md px-3 py-2 border ${
          state.currentTurn === 1 && !state.gameOver ? 'border-amber-400 bg-amber-900/20' : 'border-neutral-800 bg-neutral-900/60'
        }`}
      >
        <div className="text-xs uppercase text-neutral-400">Computer</div>
        <div className="text-2xl font-bold">{computer.score}</div>
      </div>
    </div>
  );
}
