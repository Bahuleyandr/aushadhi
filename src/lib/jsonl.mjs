import fs from 'node:fs';
import readline from 'node:readline';

// Streaming JSONL reader — flat memory for multi-hundred-MB artifacts.
export async function* readJsonl(file) {
  if (!fs.existsSync(file)) return;
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try { yield JSON.parse(line); } catch { /* skip corrupt line */ }
  }
}

// Small-file convenience (indexes, state) — same corrupt-line tolerance.
export function readJsonlSync(file) {
  if (!fs.existsSync(file)) return [];
  const out = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* skip corrupt line */ }
  }
  return out;
}
