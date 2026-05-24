import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import {
  createGame,
  applyHumanMove,
  applyPass,
  applyUseItem,
  applyItemPhaseSkip,
  runComputerTurn,
  viewForHuman,
} from './game';
import { loadWords, isValidWord } from './words';
import { runMigration, saveGame, loadGame, listMatches } from './db';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Warm up the word list at startup
console.log('Loading word list...');
const startWords = Date.now();
const words = loadWords();
console.log(`Loaded ${words.size} words in ${Date.now() - startWords}ms.`);

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.post('/api/validate', (req: Request, res: Response) => {
  const word = (req.body?.word ?? '').toString();
  res.json({ valid: isValidWord(word), word });
});

app.get('/api/matches', async (_req: Request, res: Response) => {
  try {
    const matches = await listMatches();
    res.json(matches);
  } catch (e) {
    console.error('listMatches failed', e);
    res.status(500).json({ error: 'Failed to list matches' });
  }
});

app.post('/api/game/new', async (_req: Request, res: Response) => {
  try {
    const state = createGame();
    await saveGame(state);
    res.json(viewForHuman(state));
  } catch (e) {
    console.error('createGame failed', e);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

app.get('/api/game/:id', async (req: Request, res: Response) => {
  try {
    const state = await loadGame(req.params.id);
    if (!state) return res.status(404).json({ error: 'Game not found' });
    res.json(viewForHuman(state));
  } catch (e) {
    console.error('getGame failed', e);
    res.status(500).json({ error: 'Failed to load game' });
  }
});

app.post('/api/game/:id/move', async (req: Request, res: Response) => {
  try {
    const state = await loadGame(req.params.id);
    if (!state) return res.status(404).json({ error: 'Game not found' });
    const placements = req.body?.placements;
    if (!Array.isArray(placements)) return res.status(400).json({ error: 'placements array required' });
    const result = applyHumanMove(state, placements);
    if (!result.ok) return res.status(400).json({ error: result.error, state: viewForHuman(state) });
    if (!state.gameOver && state.currentTurn === 1) {
      runComputerTurn(state);
    }
    await saveGame(state);
    res.json(viewForHuman(state));
  } catch (e) {
    console.error('move failed', e);
    res.status(500).json({ error: 'Failed to apply move' });
  }
});

app.post('/api/game/:id/pass', async (req: Request, res: Response) => {
  try {
    const state = await loadGame(req.params.id);
    if (!state) return res.status(404).json({ error: 'Game not found' });
    if (state.currentTurn !== 0) return res.status(400).json({ error: 'Not your turn' });
    const r = applyPass(state);
    if (!r.ok) return res.status(400).json({ error: r.error, state: viewForHuman(state) });
    if (!state.gameOver && (state.currentTurn as number) === 1) {
      runComputerTurn(state);
    }
    await saveGame(state);
    res.json(viewForHuman(state));
  } catch (e) {
    console.error('pass failed', e);
    res.status(500).json({ error: 'Failed to pass' });
  }
});

app.post('/api/game/:id/use-item', async (req: Request, res: Response) => {
  try {
    const state = await loadGame(req.params.id);
    if (!state) return res.status(404).json({ error: 'Game not found' });
    const { item, target } = req.body ?? {};
    if (!item) return res.status(400).json({ error: 'item required' });
    if (state.currentTurn !== 0) return res.status(400).json({ error: 'Not your turn' });
    const r = applyUseItem(state, item, target, 0);
    if (!r.ok) return res.status(400).json({ error: r.error, state: viewForHuman(state) });
    await saveGame(state);
    res.json(viewForHuman(state));
  } catch (e) {
    console.error('use-item failed', e);
    res.status(500).json({ error: 'Failed to use item' });
  }
});

app.post('/api/game/:id/skip-item-phase', async (req: Request, res: Response) => {
  try {
    const state = await loadGame(req.params.id);
    if (!state) return res.status(404).json({ error: 'Game not found' });
    const r = applyItemPhaseSkip(state);
    if (!r.ok) return res.status(400).json({ error: r.error, state: viewForHuman(state) });
    await saveGame(state);
    res.json(viewForHuman(state));
  } catch (e) {
    console.error('skip-item-phase failed', e);
    res.status(500).json({ error: 'Failed to skip item phase' });
  }
});

// Serve client static files in production
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

async function start() {
  try {
    await runMigration();
    console.log('Database migration complete.');
  } catch (e) {
    console.error('Database migration failed:', e);
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log(`Spellamok server listening on http://localhost:${PORT}`);
  });
}

void start();
