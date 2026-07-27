import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const pExecFile = promisify(execFile);

// Shared pdftotext contract: Xpdf flags (-enc UTF-8 -layout), one env override.
// Returns { file } on success, { skipped } when the binary is absent.
//
// mode 'table' selects Xpdf's -table instead of -layout. This matters for real
// ruled tables: on the PMBJP product list, -layout renders many cells into a
// separate block, orphaning 632 of 2111 product names from their drug code, while
// -table keeps every name on its own row. Extraction mode is therefore part of the
// data contract, not a cosmetic flag — callers that parse tabular PDFs must ask for
// 'table' and verify the row count they got (see assertJanAushadhiParseComplete).
export async function pdfToText(pdf, txt, { mode = 'layout' } = {}) {
  if (mode !== 'layout' && mode !== 'table') {
    throw new TypeError(`pdfToText mode must be "layout" or "table", got ${JSON.stringify(mode)}`);
  }
  const bin = process.env.AUSHADHI_PDFTOTEXT ?? 'pdftotext';
  try {
    await pExecFile(bin, ['-enc', 'UTF-8', `-${mode}`, pdf, txt]);
    return { file: txt, mode };
  } catch (e) {
    if (e.code === 'ENOENT') return { skipped: 'pdftotext not found (set AUSHADHI_PDFTOTEXT)' };
    throw e;
  }
}
