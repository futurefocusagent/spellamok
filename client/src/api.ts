import type { GameState, ItemType, MatchSummary, Placement } from './types';

async function call<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { error: text };
    }
    const err = new Error(parsed.error ?? `Request failed: ${res.status}`);
    (err as any).state = parsed.state;
    throw err;
  }
  return res.json();
}

export const api = {
  listMatches: () => call<MatchSummary[]>('/api/matches'),
  newGame: () => call<GameState>('/api/game/new', 'POST'),
  getGame: (id: string) => call<GameState>(`/api/game/${id}`),
  move: (id: string, placements: Placement[]) =>
    call<GameState>(`/api/game/${id}/move`, 'POST', { placements }),
  pass: (id: string) => call<GameState>(`/api/game/${id}/pass`, 'POST', {}),
  useItem: (id: string, item: ItemType, target?: any) =>
    call<GameState>(`/api/game/${id}/use-item`, 'POST', { item, target }),
};
