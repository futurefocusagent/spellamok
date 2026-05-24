import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import {
  createGame,
  getGame,
  applyHumanMove,
  applyPass,
  applyUseItem,
  runComputerTurn,
  viewForHuman,
} from './game';
import { loadWords, isValidWord } from './words';

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

app.post('/api/game/new', (_req: Request, res: Response) => {
  const state = createGame();
  res.json(viewForHuman(state));
});

app.get('/api/game/:id', (req: Request, res: Response) => {
  const state = getGame(req.params.id);
  if (!state) return res.status(404).json({ error: 'Game not found' });
  res.json(viewForHuman(state));
});

app.post('/api/game/:id/move', (req: Request, res: Response) => {
  const state = getGame(req.params.id);
  if (!state) return res.status(404).json({ error: 'Game not found' });
  const placements = req.body?.placements;
  if (!Array.isArray(placements)) return res.status(400).json({ error: 'placements array required' });
  const result = applyHumanMove(state, placements);
  if (!result.ok) return res.status(400).json({ error: result.error, state: viewForHuman(state) });
  // Run computer turn after a fake delay (handled client-side)
  if (!state.gameOver && state.currentTurn === 1) {
    runComputerTurn(state);
  }
  res.json(viewForHuman(state));
});

app.post('/api/game/:id/pass', (req: Request, res: Response) => {
  const state = getGame(req.params.id);
  if (!state) return res.status(404).json({ error: 'Game not found' });
  if (state.currentTurn !== 0) return res.status(400).json({ error: 'Not your turn' });
  const r = applyPass(state);
  if (!r.ok) return res.status(400).json({ error: r.error, state: viewForHuman(state) });
  if (!state.gameOver && (state.currentTurn as number) === 1) {
    runComputerTurn(state);
  }
  res.json(viewForHuman(state));
});

app.post('/api/game/:id/use-item', (req: Request, res: Response) => {
  const state = getGame(req.params.id);
  if (!state) return res.status(404).json({ error: 'Game not found' });
  const { item, target } = req.body ?? {};
  if (!item) return res.status(400).json({ error: 'item required' });
  if (state.currentTurn !== 0) return res.status(400).json({ error: 'Not your turn' });
  const r = applyUseItem(state, item, target, 0);
  if (!r.ok) return res.status(400).json({ error: r.error, state: viewForHuman(state) });
  res.json(viewForHuman(state));
});

// Serve client static files in production
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Spellamok server listening on http://localhost:${PORT}`);
});
