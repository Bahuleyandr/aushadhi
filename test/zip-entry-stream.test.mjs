import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import nodeFs from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { strToU8, Zip, ZipDeflate, zipSync } from 'fflate';
import { streamZipTextEntries } from '../src/lib/zip-entry-stream.mjs';

const tempRoots = new Set();

const EOCD_SIGNATURE = 0x06054B50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014B50;

function findEndOfCentralDirectory(bytes) {
  const view = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = bytes.length - 22; offset >= 0; offset -= 1) {
    if (view.readUInt32LE(offset) !== EOCD_SIGNATURE) continue;
    if (offset + 22 + view.readUInt16LE(offset + 20) === bytes.length) return offset;
  }
  throw new Error('fixture has no end-of-central-directory record');
}

function listCentralDirectoryEntries(bytes) {
  const view = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = findEndOfCentralDirectory(bytes);
  const entryCount = view.readUInt16LE(eocdOffset + 10);
  let offset = view.readUInt32LE(eocdOffset + 16);
  const entries = [];
  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(view.readUInt32LE(offset), CENTRAL_DIRECTORY_SIGNATURE);
    const nameLength = view.readUInt16LE(offset + 28);
    const extraLength = view.readUInt16LE(offset + 30);
    const commentLength = view.readUInt16LE(offset + 32);
    entries.push({
      offset,
      nameOffset: offset + 46,
      nameLength,
      localHeaderOffset: view.readUInt32LE(offset + 42),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function localEntryNameRange(bytes, localHeaderOffset) {
  const view = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const nameLength = view.readUInt16LE(localHeaderOffset + 26);
  return { nameOffset: localHeaderOffset + 30, nameLength };
}

function localEntryDataOffset(bytes, localHeaderOffset) {
  const view = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return localHeaderOffset
    + 30
    + view.readUInt16LE(localHeaderOffset + 26)
    + view.readUInt16LE(localHeaderOffset + 28);
}

function replaceAscii(bytes, offset, length, replacement) {
  assert.equal(Buffer.byteLength(replacement), length);
  Buffer.from(bytes.buffer, bytes.byteOffset + offset, length).write(replacement, 'ascii');
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function makeDescriptorArchive(name, data) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const zip = new Zip((error, chunk, final) => {
      if (error !== null) {
        reject(error);
        return;
      }
      chunks.push(Buffer.from(chunk));
      if (final) resolve(Buffer.concat(chunks));
    });
    const entry = new ZipDeflate(name, { level: 6 });
    zip.add(entry);
    entry.push(data, true);
    zip.end();
  });
}

async function writeArchive(bytes) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aushadhi-zip-stream-'));
  tempRoots.add(root);
  const archivePath = path.join(root, 'fixture.zip');
  await fs.writeFile(archivePath, bytes);
  return archivePath;
}

test.after(async () => {
  await Promise.all([...tempRoots].map((root) => fs.rm(root, { recursive: true, force: true })));
});

test('streams only selected UTF-8 entries and preserves physical CRLF line numbers', async () => {
  const archivePath = await writeArchive(zipSync({
    'nested/selected.tsv': strToU8('alpha\r\nβeta\r\n\r\nlast'),
    'nested/skipped.txt': [strToU8('must not be emitted\n'.repeat(4_000)), { level: 0 }],
  }));
  const entries = [];
  const lines = [];

  const summary = await streamZipTextEntries(archivePath, {
    chunkSize: 37,
    selectEntry: (name) => name.endsWith('.tsv'),
    requiredEntries: ['nested/selected.tsv'],
    onEntry: (entry) => entries.push(entry.name),
    onLine: (record) => lines.push(record),
  });

  assert.deepEqual(entries, ['nested/selected.tsv']);
  assert.deepEqual(lines, [
    { entryName: 'nested/selected.tsv', lineNumber: 1, text: 'alpha' },
    { entryName: 'nested/selected.tsv', lineNumber: 2, text: 'βeta' },
    { entryName: 'nested/selected.tsv', lineNumber: 3, text: '' },
    { entryName: 'nested/selected.tsv', lineNumber: 4, text: 'last' },
  ]);
  assert.equal(summary.entryCount, 2);
  assert.equal(summary.selectedEntryCount, 1);
  assert.equal(summary.lineCount, 4);
  assert.deepEqual(summary.selectedEntries, ['nested/selected.tsv']);
  assert.equal(summary.stoppedEarly, false);
  assert.equal(summary.archiveByteCount, (await fs.stat(archivePath)).size);
  assert.match(summary.archiveSha256, /^[a-f0-9]{64}$/u);
});

test('rejects an archive that is missing any required member', async () => {
  const archivePath = await writeArchive(zipSync({
    'present.tsv': strToU8('present\n'),
  }));

  await assert.rejects(
    streamZipTextEntries(archivePath, {
      selectEntry: () => true,
      requiredEntries: ['present.tsv', 'missing.tsv'],
    }),
    (error) => {
      assert.equal(error.code, 'ZIP_REQUIRED_ENTRY_MISSING');
      assert.match(error.message, /fixture\.zip/);
      assert.match(error.message, /missing\.tsv/);
      return true;
    },
  );
});

test('reports the selected entry and exact physical line for malformed UTF-8', async () => {
  const archivePath = await writeArchive(zipSync({
    'bad.tsv': Uint8Array.from([
      ...strToU8('valid\n'),
      0xC3, 0x28,
      ...strToU8('\nafter\n'),
    ]),
  }));

  await assert.rejects(
    streamZipTextEntries(archivePath, {
      selectEntry: (name) => name === 'bad.tsv',
      requiredEntries: ['bad.tsv'],
    }),
    (error) => {
      assert.equal(error.code, 'ZIP_ENTRY_INVALID_UTF8');
      assert.equal(error.entryName, 'bad.tsv');
      assert.equal(error.lineNumber, 2);
      assert.match(error.message, /bad\.tsv/);
      assert.match(error.message, /physical line 2/);
      return true;
    },
  );
});

test('reports entry and physical-line context when compressed entry data is truncated', async () => {
  const archive = zipSync({
    'truncated.tsv': [strToU8('first\nsecond\nthird\n'.repeat(200)), { level: 6 }],
  });
  const nameLength = archive[26] | (archive[27] << 8);
  const extraLength = archive[28] | (archive[29] << 8);
  const compressedSize = (
    archive[18]
    | (archive[19] << 8)
    | (archive[20] << 16)
    | (archive[21] << 24)
  ) >>> 0;
  const dataStart = 30 + nameLength + extraLength;
  const archivePath = await writeArchive(
    archive.subarray(0, dataStart + Math.max(1, Math.floor(compressedSize / 2))),
  );

  await assert.rejects(
    streamZipTextEntries(archivePath, {
      chunkSize: 11,
      selectEntry: () => true,
      requiredEntries: ['truncated.tsv'],
    }),
    (error) => {
      assert.match(error.code, /^ZIP_(ENTRY_DECOMPRESSION_FAILED|INVALID_ARCHIVE)$/u);
      assert.equal(error.entryName, 'truncated.tsv');
      assert.ok(Number.isInteger(error.lineNumber));
      assert.match(error.message, /truncated\.tsv/);
      assert.match(error.message, /physical line/);
      return true;
    },
  );
});

test('stopAfterRequired stops callbacks but reads and authenticates the complete archive', async () => {
  const archive = zipSync({
    'required.tsv': [strToU8('one\ntwo\n'), { level: 0 }],
    'ignored-tail.txt': [strToU8('tail\n'.repeat(1_000)), { level: 0 }],
  });
  const archivePath = await writeArchive(archive);
  const selected = [];
  const entries = [];
  const lines = [];

  const summary = await streamZipTextEntries(archivePath, {
    chunkSize: archive.length,
    expectedSha256: sha256(archive),
    selectEntry: (name) => {
      selected.push(name);
      return name === 'required.tsv';
    },
    requiredEntries: ['required.tsv'],
    stopAfterRequired: true,
    onEntry: ({ name }) => entries.push(name),
    onLine: ({ text }) => lines.push(text),
  });

  assert.deepEqual(selected, ['required.tsv']);
  assert.deepEqual(entries, ['required.tsv']);
  assert.deepEqual(lines, ['one', 'two']);
  assert.deepEqual(summary.selectedEntries, ['required.tsv']);
  assert.equal(summary.entryCount, 2);
  assert.equal(summary.stoppedEarly, true);
  assert.equal(summary.archiveByteCount, archive.length);
  assert.equal(summary.archiveSha256, sha256(archive));
});

test('stopAfterRequired hashes raw chunks after decompression and callbacks stop', async () => {
  const original = zipSync({
    'required.tsv': [strToU8('required\n'), { level: 0 }],
    'late-tail.txt': [strToU8('late-tail-data-'.repeat(100)), { level: 0 }],
  });
  const mutated = Uint8Array.from(original);
  const [, tailEntry] = listCentralDirectoryEntries(mutated);
  mutated[localEntryDataOffset(mutated, tailEntry.localHeaderOffset) + 300] ^= 0x01;
  const archivePath = await writeArchive(mutated);
  const selected = [];
  const lines = [];

  await assert.rejects(
    streamZipTextEntries(archivePath, {
      chunkSize: 13,
      expectedSha256: sha256(original),
      selectEntry: (name) => {
        selected.push(name);
        return name === 'required.tsv';
      },
      requiredEntries: ['required.tsv'],
      stopAfterRequired: true,
      onLine: ({ text }) => lines.push(text),
    }),
    { code: 'ZIP_ARCHIVE_SHA256_MISMATCH' },
  );
  assert.deepEqual(selected, ['required.tsv']);
  assert.deepEqual(lines, ['required']);
});

test('stopAfterRequired still rejects a truncated archive tail', async () => {
  const archive = zipSync({
    'required.tsv': [strToU8('one\ntwo\n'), { level: 0 }],
    'unavailable-tail.txt': [strToU8('tail\n'.repeat(1_000)), { level: 0 }],
  });
  const nameLength = archive[26] | (archive[27] << 8);
  const extraLength = archive[28] | (archive[29] << 8);
  const compressedSize = (
    archive[18]
    | (archive[19] << 8)
    | (archive[20] << 16)
    | (archive[21] << 24)
  ) >>> 0;
  const firstEntryEnd = 30 + nameLength + extraLength + compressedSize;
  const unavailableTail = Uint8Array.from([
    ...archive.subarray(0, firstEntryEnd),
    0x50, 0x4B, 0x03,
  ]);
  const archivePath = await writeArchive(unavailableTail);
  await assert.rejects(
    streamZipTextEntries(archivePath, {
      chunkSize: unavailableTail.length,
      selectEntry: (name) => name === 'required.tsv',
      requiredEntries: ['required.tsv'],
      stopAfterRequired: true,
    }),
    (error) => {
      assert.equal(error.code, 'ZIP_INVALID_ARCHIVE');
      assert.match(error.message, /end-of-central-directory/i);
      return true;
    },
  );
});

test('rejects disagreement between central-directory and local entry names', async () => {
  const archive = Uint8Array.from(zipSync({
    'local.tsv': strToU8('line\n'),
  }));
  const [central] = listCentralDirectoryEntries(archive);
  replaceAscii(archive, central.nameOffset, central.nameLength, 'other.tsv');
  const archivePath = await writeArchive(archive);

  await assert.rejects(
    streamZipTextEntries(archivePath),
    (error) => {
      assert.equal(error.code, 'ZIP_CENTRAL_DIRECTORY_MISMATCH');
      assert.match(error.message, /local\.tsv|other\.tsv/u);
      return true;
    },
  );
});

test('rejects a malformed central-directory header even when EOCD remains intact', async () => {
  const archive = Uint8Array.from(zipSync({
    'member.tsv': strToU8('line\n'),
  }));
  const [central] = listCentralDirectoryEntries(archive);
  archive[central.offset] = 0;
  const archivePath = await writeArchive(archive);

  await assert.rejects(
    streamZipTextEntries(archivePath),
    (error) => {
      assert.equal(error.code, 'ZIP_CENTRAL_DIRECTORY_MISMATCH');
      assert.match(error.message, /central-directory header/i);
      return true;
    },
  );
});

test('validates signed data descriptors against central metadata', async () => {
  const archive = await makeDescriptorArchive('descriptor.tsv', strToU8('one\ntwo\n'));
  const archivePath = await writeArchive(archive);
  const lines = [];

  const summary = await streamZipTextEntries(archivePath, {
    chunkSize: 1,
    onLine: ({ text }) => lines.push(text),
  });

  assert.deepEqual(lines, ['one', 'two']);
  assert.equal(summary.entryCount, 1);

  const [central] = listCentralDirectoryEntries(archive);
  const view = Buffer.from(archive.buffer, archive.byteOffset, archive.byteLength);
  const descriptorOffset = localEntryDataOffset(archive, central.localHeaderOffset)
    + view.readUInt32LE(central.offset + 20);
  assert.equal(view.readUInt32LE(descriptorOffset), 0x08074B50);

  const unsignedDescriptor = Buffer.concat([
    archive.subarray(0, descriptorOffset),
    archive.subarray(descriptorOffset + 4),
  ]);
  const unsignedEocdOffset = findEndOfCentralDirectory(unsignedDescriptor);
  unsignedDescriptor.writeUInt32LE(
    view.readUInt32LE(findEndOfCentralDirectory(archive) + 16) - 4,
    unsignedEocdOffset + 16,
  );
  const unsignedPath = await writeArchive(unsignedDescriptor);
  await assert.rejects(
    streamZipTextEntries(unsignedPath),
    (error) => {
      assert.equal(error.code, 'ZIP_CENTRAL_DIRECTORY_MISMATCH');
      assert.match(error.message, /unsigned data descriptors are not supported/i);
      return true;
    },
  );

  for (const fieldOffset of [4, 8, 12]) {
    const corrupted = Uint8Array.from(archive);
    corrupted[descriptorOffset + fieldOffset] ^= 0x01;
    const corruptedPath = await writeArchive(corrupted);
    await assert.rejects(
      streamZipTextEntries(corruptedPath, { chunkSize: 1 }),
      { code: 'ZIP_CENTRAL_DIRECTORY_MISMATCH' },
    );
  }
});

test('rejects duplicate names independently in central and local headers', async (context) => {
  const makeArchive = () => Uint8Array.from(zipSync({
    'one.tsv': strToU8('one\n'),
    'two.tsv': strToU8('two\n'),
  }));

  await context.test('central directory', async () => {
    const archive = makeArchive();
    const [, second] = listCentralDirectoryEntries(archive);
    replaceAscii(archive, second.nameOffset, second.nameLength, 'one.tsv');
    const archivePath = await writeArchive(archive);
    await assert.rejects(streamZipTextEntries(archivePath), { code: 'ZIP_DUPLICATE_ENTRY' });
  });

  await context.test('local headers', async () => {
    const archive = makeArchive();
    const [, second] = listCentralDirectoryEntries(archive);
    const local = localEntryNameRange(archive, second.localHeaderOffset);
    replaceAscii(archive, local.nameOffset, local.nameLength, 'one.tsv');
    const archivePath = await writeArchive(archive);
    await assert.rejects(streamZipTextEntries(archivePath), { code: 'ZIP_DUPLICATE_ENTRY' });
  });
});

test('rejects decompressed entry data whose CRC does not match the archive metadata', async () => {
  const archive = Uint8Array.from(zipSync({
    'member.tsv': [strToU8('alpha\n'), { level: 0 }],
  }));
  const [central] = listCentralDirectoryEntries(archive);
  archive[localEntryDataOffset(archive, central.localHeaderOffset)] ^= 0x01;
  const archivePath = await writeArchive(archive);

  await assert.rejects(
    streamZipTextEntries(archivePath),
    (error) => {
      assert.equal(error.code, 'ZIP_ENTRY_CRC_MISMATCH');
      assert.equal(error.entryName, 'member.tsv');
      return true;
    },
  );
  await assert.rejects(
    streamZipTextEntries(archivePath, {
      requiredEntries: ['member.tsv'],
      stopAfterRequired: true,
    }),
    { code: 'ZIP_ENTRY_CRC_MISMATCH' },
  );
});

test('keeps incremental CRC state isolated across multi-chunk entries', async () => {
  const deflatedText = Array.from(
    { length: 800 },
    (_, index) => `deflated-${index.toString(36)}-${(index * 7919).toString(36)}\n`,
  ).join('');
  const storedText = Array.from(
    { length: 800 },
    (_, index) => `stored-${index.toString(36)}-${(index * 3571).toString(36)}\n`,
  ).join('');
  const archive = zipSync({
    'deflated.tsv': [strToU8(deflatedText), { level: 6 }],
    'stored.tsv': [strToU8(storedText), { level: 0 }],
  });
  const archivePath = await writeArchive(archive);

  const summary = await streamZipTextEntries(archivePath, { chunkSize: 23 });
  assert.equal(summary.entryCount, 2);
  assert.equal(summary.decompressedByteCount, Buffer.byteLength(deflatedText + storedText));

  const corrupted = Uint8Array.from(archive);
  const [, storedEntry] = listCentralDirectoryEntries(corrupted);
  corrupted[localEntryDataOffset(corrupted, storedEntry.localHeaderOffset) + 100] ^= 0x01;
  const corruptedPath = await writeArchive(corrupted);
  await assert.rejects(
    streamZipTextEntries(corruptedPath, { chunkSize: 23 }),
    (error) => {
      assert.equal(error.code, 'ZIP_ENTRY_CRC_MISMATCH');
      assert.equal(error.entryName, 'stored.tsv');
      return true;
    },
  );
});

test('enforces entry-count, decompressed-byte, and compression-ratio budgets', async (context) => {
  await context.test('entry count', async () => {
    const archivePath = await writeArchive(zipSync({
      'one.tsv': strToU8('one\n'),
      'two.tsv': strToU8('two\n'),
    }));
    await assert.rejects(
      streamZipTextEntries(archivePath, { maxEntries: 1 }),
      { code: 'ZIP_ENTRY_LIMIT_EXCEEDED' },
    );
  });

  await context.test('decompressed bytes', async () => {
    const archivePath = await writeArchive(zipSync({
      'member.tsv': [strToU8('12345'), { level: 0 }],
    }));
    await assert.rejects(
      streamZipTextEntries(archivePath, { maxDecompressedBytes: 4 }),
      { code: 'ZIP_DECOMPRESSED_SIZE_LIMIT_EXCEEDED' },
    );
  });

  await context.test('aggregate bytes and exact-limit acceptance', async () => {
    const archivePath = await writeArchive(zipSync({
      'one.tsv': [strToU8('1234'), { level: 0 }],
      'two.tsv': [strToU8('5678'), { level: 0 }],
    }));
    const summary = await streamZipTextEntries(archivePath, { maxDecompressedBytes: 8 });
    assert.equal(summary.decompressedByteCount, 8);
    await assert.rejects(
      streamZipTextEntries(archivePath, { maxDecompressedBytes: 7 }),
      { code: 'ZIP_DECOMPRESSED_SIZE_LIMIT_EXCEEDED' },
    );
  });

  await context.test('unselected post-stop members remain inside the declared-byte budget', async () => {
    const archivePath = await writeArchive(zipSync({
      'required.tsv': [strToU8('ok'), { level: 0 }],
      'unselected-tail.txt': [strToU8('1234567890'), { level: 0 }],
    }));
    const selected = [];
    await assert.rejects(
      streamZipTextEntries(archivePath, {
        maxDecompressedBytes: 11,
        requiredEntries: ['required.tsv'],
        stopAfterRequired: true,
        selectEntry: (name) => {
          selected.push(name);
          return name === 'required.tsv';
        },
      }),
      { code: 'ZIP_DECOMPRESSED_SIZE_LIMIT_EXCEEDED' },
    );
    assert.deepEqual(selected, []);
  });

  await context.test('runtime bytes reject forged local and central size understatements', async () => {
    const archive = Uint8Array.from(zipSync({
      'forged.tsv': [strToU8('0123456789abcdef'), { level: 0 }],
    }));
    const [central] = listCentralDirectoryEntries(archive);
    const view = Buffer.from(archive.buffer, archive.byteOffset, archive.byteLength);
    view.writeUInt32LE(4, central.localHeaderOffset + 22);
    view.writeUInt32LE(4, central.offset + 24);
    const archivePath = await writeArchive(archive);
    await assert.rejects(
      streamZipTextEntries(archivePath, { maxDecompressedBytes: 5 }),
      { code: 'ZIP_DECOMPRESSED_SIZE_LIMIT_EXCEEDED' },
    );
  });

  await context.test('compression ratio', async () => {
    const archivePath = await writeArchive(zipSync({
      'member.tsv': [strToU8('repeat\n'.repeat(2_000)), { level: 9 }],
    }));
    await assert.rejects(
      streamZipTextEntries(archivePath, { maxCompressionRatio: 2 }),
      { code: 'ZIP_COMPRESSION_RATIO_LIMIT_EXCEEDED' },
    );
  });
});

test('rejects an expected archive SHA-256 mismatch after hashing the parsed stream', async () => {
  const archivePath = await writeArchive(zipSync({
    'member.tsv': strToU8('line\n'),
  }));

  await assert.rejects(
    streamZipTextEntries(archivePath, { expectedSha256: '0'.repeat(64) }),
    (error) => {
      assert.equal(error.code, 'ZIP_ARCHIVE_SHA256_MISMATCH');
      assert.match(error.message, /expected .* got/iu);
      return true;
    },
  );
});

test('preflight, parsing, hashing, and byte counting share one opened file handle', async () => {
  const primary = zipSync({
    'primary.tsv': [strToU8('primary\n'.repeat(20)), { level: 0 }],
  });
  const alternate = zipSync({
    'alternate.tsv': [strToU8('different generation\n'), { level: 0 }],
  });
  const primaryPath = await writeArchive(primary);
  const alternatePath = await writeArchive(alternate);
  const originalOpen = nodeFs.promises.open;
  let openCount = 0;
  nodeFs.promises.open = async (requestedPath, ...args) => {
    openCount += 1;
    return originalOpen(openCount === 1 ? requestedPath : alternatePath, ...args);
  };

  let summary;
  try {
    summary = await streamZipTextEntries(primaryPath, {
      chunkSize: 11,
      expectedSha256: sha256(primary),
    });
  } finally {
    nodeFs.promises.open = originalOpen;
  }

  assert.equal(openCount, 1);
  assert.equal(summary.archiveSha256, sha256(primary));
  assert.equal(summary.archiveByteCount, primary.length);
  assert.deepEqual(summary.selectedEntries, ['primary.tsv']);
});

test('full reads require a valid ZIP end-of-central-directory record', async () => {
  const archive = zipSync({
    'member.tsv': strToU8('complete\n'),
  });
  const archivePath = await writeArchive(archive.subarray(0, archive.length - 22));

  await assert.rejects(
    streamZipTextEntries(archivePath, {
      selectEntry: () => true,
      requiredEntries: ['member.tsv'],
    }),
    (error) => {
      assert.equal(error.code, 'ZIP_INVALID_ARCHIVE');
      assert.match(error.message, /end-of-central-directory/i);
      return true;
    },
  );
});

test('rejects async callbacks so line processing remains bounded and ordered', async () => {
  const archivePath = await writeArchive(zipSync({
    'member.tsv': strToU8('line\n'),
  }));

  await assert.rejects(
    streamZipTextEntries(archivePath, {
      selectEntry: () => true,
      onLine: async () => {},
    }),
    (error) => {
      assert.equal(error.code, 'ZIP_ENTRY_CALLBACK_FAILED');
      assert.match(error.message, /onLine must be synchronous/i);
      return true;
    },
  );
});

test('enforces a configurable per-line byte bound with entry and line context', async () => {
  const archivePath = await writeArchive(zipSync({
    'large-line.tsv': strToU8('ok\n12345\n'),
  }));

  await assert.rejects(
    streamZipTextEntries(archivePath, {
      selectEntry: () => true,
      maxLineBytes: 4,
    }),
    (error) => {
      assert.equal(error.code, 'ZIP_ENTRY_LINE_TOO_LONG');
      assert.equal(error.entryName, 'large-line.tsv');
      assert.equal(error.lineNumber, 2);
      assert.match(error.message, /maxLineBytes/);
      return true;
    },
  );
});

test('enforces maxLineBytes incrementally across chunks without a newline', async () => {
  const archivePath = await writeArchive(zipSync({
    'unterminated.tsv': [strToU8('x'.repeat(4_096)), { level: 0 }],
  }));
  let emittedLines = 0;

  await assert.rejects(
    streamZipTextEntries(archivePath, {
      chunkSize: 17,
      maxLineBytes: 64,
      onLine: () => {
        emittedLines += 1;
      },
    }),
    (error) => {
      assert.equal(error.code, 'ZIP_ENTRY_LINE_TOO_LONG');
      assert.equal(error.entryName, 'unterminated.tsv');
      assert.equal(error.lineNumber, 1);
      return true;
    },
  );
  assert.equal(emittedLines, 0);
});

test('rejects an async entry selector before starting the member', async () => {
  const archivePath = await writeArchive(zipSync({
    'member.tsv': strToU8('line\n'),
  }));

  await assert.rejects(
    streamZipTextEntries(archivePath, {
      selectEntry: async () => true,
    }),
    (error) => {
      assert.equal(error.code, 'ZIP_ENTRY_CALLBACK_FAILED');
      assert.match(error.message, /selectEntry must be synchronous/i);
      return true;
    },
  );
});
