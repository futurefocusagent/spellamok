import { Pool } from 'pg';
import type { GameState } from './types';

const DEFAULT_URL =
  'postgresql://listening_log_db_user:nDkf7l9qOn0xCu6YLR5TKXM1CG5A6m4U@dpg-d78l55fpm1nc73e9ndig-a/listening_log_db';

const connectionString = process.env.DATABASE_URL || DEFAULT_URL;

const needsSsl =
  /render\.com/.test(connectionString) || /sslmode=require/.test(connectionString);

export const pool = new Pool({
  connectionString,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});

export async function runMigration(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      status TEXT DEFAULT 'in_progress',
      human_score INTEGER DEFAULT 0,
      computer_score INTEGER DEFAULT 0,
      state JSONB NOT NULL
    )
  `);
}

export async function saveGame(state: GameState): Promise<void> {
  const status = state.gameOver ? 'finished' : 'in_progress';
  const humanScore = state.players[0].score;
  const computerScore = state.players[1].score;
  await pool.query(
    `INSERT INTO matches (id, status, human_score, computer_score, state)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       status = EXCLUDED.status,
       human_score = EXCLUDED.human_score,
       computer_score = EXCLUDED.computer_score,
       state = EXCLUDED.state,
       updated_at = now()`,
    [state.id, status, humanScore, computerScore, JSON.stringify(state)],
  );
}

export async function loadGame(id: string): Promise<GameState | null> {
  const r = await pool.query<{ state: GameState }>(
    `SELECT state FROM matches WHERE id = $1`,
    [id],
  );
  if (r.rows.length === 0) return null;
  return r.rows[0].state;
}

export interface MatchSummary {
  id: string;
  created_at: string;
  status: string;
  human_score: number;
  computer_score: number;
}

export async function listMatches(): Promise<MatchSummary[]> {
  const r = await pool.query(
    `SELECT id, created_at, status, human_score, computer_score
     FROM matches
     ORDER BY created_at DESC
     LIMIT 20`,
  );
  return r.rows;
}
