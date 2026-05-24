import fs from 'fs';
import path from 'path';

let wordSet: Set<string> | null = null;

export function loadWords(): Set<string> {
  if (wordSet) return wordSet;
  const candidates = [
    path.join(__dirname, 'words', 'enable1.txt'),
    path.join(__dirname, '..', 'src', 'words', 'enable1.txt'),
  ];
  const filePath = candidates.find((p) => fs.existsSync(p));
  if (!filePath) {
    throw new Error(`Word list not found. Tried: ${candidates.join(', ')}`);
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  wordSet = new Set(
    raw
      .split(/\r?\n/)
      .map((w) => w.trim().toUpperCase())
      .filter((w) => w.length > 0),
  );
  return wordSet;
}

export function isValidWord(word: string): boolean {
  const set = loadWords();
  return set.has(word.toUpperCase());
}
