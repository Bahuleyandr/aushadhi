import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

// Download to <dest>.part then rename — a truncated/failed download must never
// be mistaken for a valid cached snapshot by exists() checks.
export async function downloadToFile(url, dest, { headers } = {}) {
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  const part = `${dest}.part`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`download failed (${res.status}): ${url}`);
  try {
    await fsp.writeFile(part, Readable.fromWeb(res.body));
    await fsp.rename(part, dest);
  } catch (e) {
    fs.rmSync(part, { force: true });
    throw e;
  }
  return dest;
}
