import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import { pdfToText } from './pdftotext.mjs';

function isInside(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function sourceName(value) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value ?? '')) {
    throw new TypeError(`invalid derived PDF source name: ${value}`);
  }
  return value;
}

async function regularFileExists(file, label) {
  try {
    const information = await fsp.lstat(file);
    if (!information.isFile() || information.isSymbolicLink()) {
      throw new Error(`${label} is not a regular file: ${file}`);
    }
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function requireDirectory(file, label) {
  const information = await fsp.lstat(file);
  if (!information.isDirectory() || information.isSymbolicLink()) {
    throw new Error(`${label} is not a regular directory: ${file}`);
  }
}

async function prospectiveRealPath(file) {
  let cursor = path.resolve(file);
  const missing = [];
  while (true) {
    try {
      return path.join(await fsp.realpath(cursor), ...missing);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      const parent = path.dirname(cursor);
      if (parent === cursor) throw error;
      missing.unshift(path.basename(cursor));
      cursor = parent;
    }
  }
}

async function updateHashFromFile(hash, file) {
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
}

export function defaultDerivedRoot(rawRoot) {
  return process.env.AUSHADHI_DERIVED_ROOT
    ? path.resolve(process.env.AUSHADHI_DERIVED_ROOT)
    : path.resolve(rawRoot, '..', 'derived');
}

export async function resolvePdfText({
  pdf,
  rawRoot,
  source,
  mode = 'layout',
  derivedRoot = defaultDerivedRoot(rawRoot),
  convert = pdfToText,
}) {
  const absoluteRawRoot = path.resolve(rawRoot);
  const absolutePdf = path.resolve(pdf);
  const absoluteDerivedRoot = path.resolve(derivedRoot);
  if (!isInside(absoluteRawRoot, absolutePdf)) {
    throw new Error(`PDF is outside the raw source root: ${pdf}`);
  }
  if (isInside(absoluteRawRoot, absoluteDerivedRoot)) {
    throw new Error('derived PDF text root must be outside the immutable raw source root');
  }

  if (!await regularFileExists(absolutePdf, 'source PDF')) {
    throw new Error(`source PDF does not exist: ${absolutePdf}`);
  }
  const [realRawRoot, realPdf, prospectiveDerivedRoot] = await Promise.all([
    fsp.realpath(absoluteRawRoot),
    fsp.realpath(absolutePdf),
    prospectiveRealPath(absoluteDerivedRoot),
  ]);
  if (!isInside(realRawRoot, realPdf)) {
    throw new Error(`PDF resolves outside the raw source root: ${pdf}`);
  }
  if (isInside(realRawRoot, prospectiveDerivedRoot)) {
    throw new Error('derived PDF text root resolves inside the immutable raw source root');
  }

  const sibling = absolutePdf.replace(/\.pdf$/iu, '.txt');
  if (await regularFileExists(sibling, 'operator-supplied PDF text')) {
    return { file: sibling, source: 'operator-supplied' };
  }

  const relativePdf = path.relative(absoluteRawRoot, absolutePdf).replaceAll('\\', '/');
  const hash = createHash('sha256')
    .update('aushadhi-derived-pdf-text-v1\0')
    .update(mode)
    .update('\0')
    .update(relativePdf)
    .update('\0');
  await updateHashFromFile(hash, absolutePdf);
  const digest = hash.digest('hex');
  const outputDir = path.join(absoluteDerivedRoot, sourceName(source));
  const output = path.join(outputDir, `${digest}.${mode}.txt`);
  await fsp.mkdir(outputDir, { recursive: true });
  await requireDirectory(absoluteDerivedRoot, 'derived PDF text root');
  await requireDirectory(outputDir, 'derived PDF source directory');
  const [realDerivedRoot, realOutputDir] = await Promise.all([
    fsp.realpath(absoluteDerivedRoot),
    fsp.realpath(outputDir),
  ]);
  if (isInside(realRawRoot, realDerivedRoot)) {
    throw new Error('derived PDF text root resolves inside the immutable raw source root');
  }
  if (!isInside(realDerivedRoot, realOutputDir)) {
    throw new Error(`derived PDF source directory resolves outside its root: ${outputDir}`);
  }
  if (await regularFileExists(output, 'derived PDF text')) {
    return { file: output, source: 'derived-cache' };
  }

  const temporary = path.join(
    outputDir,
    `.${digest}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    const result = await convert(absolutePdf, temporary, { mode });
    if (result?.skipped) return result;
    const information = await fsp.lstat(temporary);
    if (!information.isFile() || information.isSymbolicLink()) {
      throw new Error(`PDF conversion did not create a regular file: ${temporary}`);
    }
    await fsp.rename(temporary, output);
    await regularFileExists(output, 'derived PDF text');
    return { file: output, source: 'derived-cache', mode };
  } finally {
    await fsp.rm(temporary, { force: true }).catch(() => {});
  }
}
