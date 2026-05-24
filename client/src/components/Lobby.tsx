import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { MatchSummary } from '../types';

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function StatusBadge({ status }: { status: string }) {
  const isFinished = status === 'finished';
  const bg = isFinished ? 'bg-neutral-700 text-neutral-300' : 'bg-emerald-700 text-emerald-100';
  const label = isFinished ? 'finished' : 'in progress';
  return (
    <span className={`text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded ${bg}`}>
      {label}
    </span>
  );
}

export function Lobby() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .listMatches()
      .then((m) => {
        if (!cancelled) setMatches(m);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e?.message ?? e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function startNew() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const game = await api.newGame();
      navigate(`/match/${game.id}`);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen font-mono text-neutral-200 px-3 py-6 max-w-2xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          <span className="text-amber-300">Spell</span>amok
        </h1>
        <button
          onClick={() => void startNew()}
          disabled={busy}
          className="text-xs px-3 py-1.5 rounded border border-emerald-700 bg-emerald-700/30 hover:bg-emerald-700/50 disabled:opacity-50"
        >
          {busy ? 'Creating…' : '+ New Match'}
        </button>
      </header>

      <h2 className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2">Matches</h2>

      {error && (
        <div className="text-sm text-red-400 bg-red-900/30 border border-red-700/50 rounded px-2 py-1 mb-3">
          {error}
        </div>
      )}

      {matches === null && !error && (
        <div className="text-neutral-500 text-sm">Loading…</div>
      )}

      {matches !== null && matches.length === 0 && (
        <div className="text-neutral-500 text-sm">
          No matches yet. Click “New Match” to start.
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {matches?.map((m) => (
          <li key={m.id}>
            <button
              onClick={() => navigate(`/match/${m.id}`)}
              className="w-full text-left bg-neutral-900/70 hover:bg-neutral-800 border border-neutral-800 rounded px-3 py-2 flex items-center justify-between gap-3"
            >
              <div className="flex flex-col">
                <span className="text-xs text-neutral-400">{formatDate(m.created_at)}</span>
                <span className="text-sm text-neutral-200">
                  You: {m.human_score} — Computer: {m.computer_score}
                </span>
              </div>
              <StatusBadge status={m.status} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
