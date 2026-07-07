import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const pExecFile = promisify(execFile);

// Shared pdftotext contract: Xpdf flags (-enc UTF-8 -layout), one env override.
// Returns { file } on success, { skipped } when the binary is absent.
export async function pdfToText(pdf, txt) {
  const bin = process.env.AUSHADHI_PDFTOTEXT ?? 'pdftotext';
  try {
    await pExecFile(bin, ['-enc', 'UTF-8', '-layout', pdf, txt]);
    return { file: txt };
  } catch (e) {
    if (e.code === 'ENOENT') return { skipped: 'pdftotext not found (set AUSHADHI_PDFTOTEXT)' };
    throw e;
  }
}
