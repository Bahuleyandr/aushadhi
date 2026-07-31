import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { strFromU8, Unzip, UnzipInflate } from 'fflate';

const EMPTY_BYTES = new Uint8Array(0);
const DEFAULT_CHUNK_SIZE = 64 * 1024;
const DEFAULT_MAX_LINE_BYTES = 16 * 1024 * 1024;
const DEFAULT_MAX_ENTRIES = 512;
const DEFAULT_MAX_DECOMPRESSED_BYTES = 8 * 1024 * 1024 * 1024;
const DEFAULT_MAX_COMPRESSION_RATIO = 100;
const DEFAULT_MAX_CENTRAL_DIRECTORY_BYTES = 16 * 1024 * 1024;
const MAX_EOCD_SIZE = 65_557;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034B50;
const DATA_DESCRIPTOR_SIGNATURE = 0x08074B50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014B50;
const EOCD_SIGNATURE = 0x06054B50;
const ZIP64_UINT16_SENTINEL = 0xFFFF;
const ZIP64_UINT32_SENTINEL = 0xFFFF_FFFF;
const ZIP64_EXTRA_FIELD_ID = 0x0001;
const STOP_AFTER_REQUIRED = Symbol('stop-after-required');

const CRC32_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 0 ? value >>> 1 : (value >>> 1) ^ 0xEDB8_8320;
  }
  return value >>> 0;
});

function updateCrc32(previous, data) {
  let value = (previous ^ 0xFFFF_FFFF) >>> 0;
  for (const byte of data) value = CRC32_TABLE[(value ^ byte) & 0xFF] ^ (value >>> 8);
  return (value ^ 0xFFFF_FFFF) >>> 0;
}

export class ZipEntryStreamError extends Error {
  constructor(message, {
    code,
    archivePath,
    entryName = null,
    lineNumber = null,
    cause,
  }) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'ZipEntryStreamError';
    this.code = code;
    this.archivePath = archivePath;
    this.entryName = entryName;
    this.lineNumber = lineNumber;
  }
}

function assertPositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive integer.`);
  }
}

function assertPositiveNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive finite number.`);
  }
}

function normalizeExpectedSha256(expectedSha256) {
  if (expectedSha256 === null || expectedSha256 === undefined) return null;
  if (typeof expectedSha256 !== 'string' || !/^[a-f0-9]{64}$/iu.test(expectedSha256)) {
    throw new TypeError('expectedSha256 must be a 64-character hexadecimal SHA-256 digest.');
  }
  return expectedSha256.toLowerCase();
}

function normalizeRequiredEntries(requiredEntries) {
  if (!Array.isArray(requiredEntries)) {
    throw new TypeError('requiredEntries must be an array of exact ZIP entry names.');
  }
  const result = [];
  const seen = new Set();
  for (const name of requiredEntries) {
    if (typeof name !== 'string' || name.length === 0) {
      throw new TypeError('requiredEntries must contain only non-empty strings.');
    }
    if (seen.has(name)) {
      throw new TypeError(`requiredEntries contains duplicate entry ${JSON.stringify(name)}.`);
    }
    seen.add(name);
    result.push(name);
  }
  return result;
}

class ArchiveTail {
  constructor(capacity) {
    this.capacity = capacity;
    this.chunks = [];
    this.length = 0;
  }

  push(chunk) {
    if (chunk.length >= this.capacity) {
      this.chunks = [chunk.subarray(chunk.length - this.capacity)];
      this.length = this.capacity;
      return;
    }
    this.chunks.push(chunk);
    this.length += chunk.length;
    while (this.length > this.capacity) {
      const overflow = this.length - this.capacity;
      const first = this.chunks[0];
      if (first.length <= overflow) {
        this.chunks.shift();
        this.length -= first.length;
      } else {
        this.chunks[0] = first.subarray(overflow);
        this.length -= overflow;
      }
    }
  }

  bytes() {
    if (this.chunks.length === 1) return this.chunks[0];
    return Buffer.concat(this.chunks, this.length);
  }
}

function archiveError(archivePath, message, {
  code = 'ZIP_INVALID_ARCHIVE',
  entryName = null,
  lineNumber = null,
  cause,
} = {}) {
  return new ZipEntryStreamError(
    `Invalid ZIP archive ${JSON.stringify(archivePath)}: ${message}`,
    { code, archivePath, entryName, lineNumber, cause },
  );
}

function centralDirectoryMismatch(archivePath, message, entryName = null) {
  return archiveError(archivePath, message, {
    code: 'ZIP_CENTRAL_DIRECTORY_MISMATCH',
    entryName,
  });
}

function duplicateEntryError(archivePath, entryName, location) {
  return new ZipEntryStreamError(
    `ZIP archive ${JSON.stringify(archivePath)} contains duplicate ${location} entry ${JSON.stringify(entryName)}.`,
    {
      code: 'ZIP_DUPLICATE_ENTRY',
      archivePath,
      entryName,
      lineNumber: 1,
    },
  );
}

function readSafeUInt64LE(bytes, offset, archivePath, description) {
  const value = bytes.readBigUInt64LE(offset);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw archiveError(archivePath, `${description} exceeds JavaScript's safe integer range.`);
  }
  return Number(value);
}

function findZip64Extra(extra, archivePath, entryName, location) {
  let zip64 = null;
  for (let offset = 0; offset < extra.length;) {
    if (offset + 4 > extra.length) {
      throw centralDirectoryMismatch(
        archivePath,
        `malformed ${location} extra fields for entry ${JSON.stringify(entryName)}.`,
        entryName,
      );
    }
    const fieldId = extra.readUInt16LE(offset);
    const fieldLength = extra.readUInt16LE(offset + 2);
    const valueStart = offset + 4;
    const valueEnd = valueStart + fieldLength;
    if (valueEnd > extra.length) {
      throw centralDirectoryMismatch(
        archivePath,
        `truncated ${location} extra field for entry ${JSON.stringify(entryName)}.`,
        entryName,
      );
    }
    if (fieldId === ZIP64_EXTRA_FIELD_ID) {
      if (zip64 !== null) {
        throw centralDirectoryMismatch(
          archivePath,
          `duplicate ZIP64 ${location} extra fields for entry ${JSON.stringify(entryName)}.`,
          entryName,
        );
      }
      zip64 = extra.subarray(valueStart, valueEnd);
    }
    offset = valueEnd;
  }
  return zip64;
}

function resolveZip64Metadata(raw, extra, archivePath, entryName, location) {
  const needsUncompressed = raw.uncompressedSize === ZIP64_UINT32_SENTINEL;
  const needsCompressed = raw.compressedSize === ZIP64_UINT32_SENTINEL;
  const needsOffset = raw.localHeaderOffset === ZIP64_UINT32_SENTINEL;
  const needsDisk = raw.diskStart === ZIP64_UINT16_SENTINEL;
  const zip64 = findZip64Extra(extra, archivePath, entryName, location);
  if (!needsUncompressed && !needsCompressed && !needsOffset && !needsDisk) {
    return { ...raw, usesZip64Sizes: false };
  }
  if (zip64 === null) {
    throw centralDirectoryMismatch(
      archivePath,
      `missing ZIP64 ${location} metadata for entry ${JSON.stringify(entryName)}.`,
      entryName,
    );
  }

  let cursor = 0;
  const takeUInt64 = (description) => {
    if (cursor + 8 > zip64.length) {
      throw centralDirectoryMismatch(
        archivePath,
        `truncated ZIP64 ${description} for entry ${JSON.stringify(entryName)}.`,
        entryName,
      );
    }
    const value = readSafeUInt64LE(zip64, cursor, archivePath, `ZIP64 ${description}`);
    cursor += 8;
    return value;
  };

  const result = { ...raw, usesZip64Sizes: needsUncompressed || needsCompressed };
  if (needsUncompressed) result.uncompressedSize = takeUInt64('uncompressed size');
  if (needsCompressed) result.compressedSize = takeUInt64('compressed size');
  if (needsOffset) result.localHeaderOffset = takeUInt64('local-header offset');
  if (needsDisk) {
    if (cursor + 4 > zip64.length) {
      throw centralDirectoryMismatch(
        archivePath,
        `truncated ZIP64 disk number for entry ${JSON.stringify(entryName)}.`,
        entryName,
      );
    }
    result.diskStart = zip64.readUInt32LE(cursor);
  }
  return result;
}

function decodeEntryName(nameBytes, flags, archivePath, location) {
  try {
    return strFromU8(nameBytes, (flags & 0x0800) === 0);
  } catch (cause) {
    throw archiveError(archivePath, `invalid ${location} entry-name encoding: ${cause.message}`, {
      cause,
    });
  }
}

function assertCompressionRatio({
  archivePath,
  entryName,
  compressedSize,
  uncompressedSize,
  maxCompressionRatio,
}) {
  if (uncompressedSize === 0) return;
  const ratio = compressedSize === 0 ? Number.POSITIVE_INFINITY : uncompressedSize / compressedSize;
  if (ratio <= maxCompressionRatio) return;
  throw new ZipEntryStreamError(
    `ZIP archive ${JSON.stringify(archivePath)}, entry ${JSON.stringify(entryName)} has compression ratio ${ratio.toFixed(2)}, exceeding maxCompressionRatio (${maxCompressionRatio}).`,
    {
      code: 'ZIP_COMPRESSION_RATIO_LIMIT_EXCEEDED',
      archivePath,
      entryName,
      lineNumber: 1,
    },
  );
}

function parseEndOfCentralDirectory(
  tailInput,
  archiveByteCount,
  archivePath,
  maxEntries,
  maxCentralDirectoryBytes,
) {
  const tail = Buffer.isBuffer(tailInput)
    ? tailInput
    : Buffer.from(tailInput.buffer, tailInput.byteOffset, tailInput.byteLength);
  let eocdOffset = -1;
  for (let offset = tail.length - 22; offset >= 0; offset -= 1) {
    if (tail.readUInt32LE(offset) !== EOCD_SIGNATURE) continue;
    const commentLength = tail.readUInt16LE(offset + 20);
    if (offset + 22 + commentLength !== tail.length) continue;
    eocdOffset = offset;
    break;
  }
  if (eocdOffset < 0) {
    throw archiveError(archivePath, 'missing or invalid end-of-central-directory record.');
  }

  const diskNumber = tail.readUInt16LE(eocdOffset + 4);
  const centralDirectoryDisk = tail.readUInt16LE(eocdOffset + 6);
  const entriesOnDisk = tail.readUInt16LE(eocdOffset + 8);
  const entryCount = tail.readUInt16LE(eocdOffset + 10);
  const centralDirectorySize = tail.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = tail.readUInt32LE(eocdOffset + 16);
  if (diskNumber !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk !== entryCount) {
    throw archiveError(archivePath, 'multi-disk ZIP archives are not supported.');
  }
  if (
    entryCount === ZIP64_UINT16_SENTINEL
    || centralDirectorySize === ZIP64_UINT32_SENTINEL
    || centralDirectoryOffset === ZIP64_UINT32_SENTINEL
  ) {
    throw archiveError(archivePath, 'ZIP64 end-of-central-directory records are not supported.');
  }
  if (entryCount > maxEntries) {
    throw new ZipEntryStreamError(
      `ZIP archive ${JSON.stringify(archivePath)} contains ${entryCount} entries, exceeding maxEntries (${maxEntries}).`,
      { code: 'ZIP_ENTRY_LIMIT_EXCEEDED', archivePath },
    );
  }
  if (centralDirectorySize > maxCentralDirectoryBytes) {
    throw archiveError(
      archivePath,
      `central directory size ${centralDirectorySize} exceeds maxCentralDirectoryBytes (${maxCentralDirectoryBytes}).`,
      { code: 'ZIP_CENTRAL_DIRECTORY_TOO_LARGE' },
    );
  }

  const absoluteEocdOffset = archiveByteCount - tail.length + eocdOffset;
  if (
    !Number.isSafeInteger(centralDirectoryOffset + centralDirectorySize)
    || centralDirectoryOffset + centralDirectorySize !== absoluteEocdOffset
  ) {
    throw centralDirectoryMismatch(
      archivePath,
      'end-of-central-directory offset/size does not identify the complete central directory.',
    );
  }
  const centralOffsetInTail = centralDirectoryOffset - (archiveByteCount - tail.length);
  if (
    centralOffsetInTail < 0
    || centralOffsetInTail + centralDirectorySize > eocdOffset
  ) {
    throw archiveError(
      archivePath,
      `central directory exceeds the retained maxCentralDirectoryBytes (${maxCentralDirectoryBytes}) budget.`,
      { code: 'ZIP_CENTRAL_DIRECTORY_TOO_LARGE' },
    );
  }

  return {
    bytes: tail.subarray(
      centralOffsetInTail,
      centralOffsetInTail + centralDirectorySize,
    ),
    entryCount,
    centralDirectoryOffset,
  };
}

function parseCentralDirectory({
  archivePath,
  bytes,
  entryCount,
  centralDirectoryOffset,
  maxDecompressedBytes,
  maxCompressionRatio,
}) {
  const entries = [];
  const seenNames = new Set();
  const seenOffsets = new Set();
  let totalUncompressedBytes = 0;
  let offset = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw centralDirectoryMismatch(
        archivePath,
        `central entry ${index + 1} is missing a valid central-directory header.`,
      );
    }
    const versionNeeded = bytes.readUInt16LE(offset + 6);
    const flags = bytes.readUInt16LE(offset + 8);
    const compression = bytes.readUInt16LE(offset + 10);
    const crc = bytes.readUInt32LE(offset + 16);
    const rawCompressedSize = bytes.readUInt32LE(offset + 20);
    const rawUncompressedSize = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const rawDiskStart = bytes.readUInt16LE(offset + 34);
    const rawLocalHeaderOffset = bytes.readUInt32LE(offset + 42);
    const recordEnd = offset + 46 + nameLength + extraLength + commentLength;
    if (recordEnd > bytes.length) {
      throw centralDirectoryMismatch(archivePath, `central entry ${index + 1} is truncated.`);
    }
    const nameBytes = bytes.subarray(offset + 46, offset + 46 + nameLength);
    const name = decodeEntryName(nameBytes, flags, archivePath, 'central-directory');
    if (seenNames.has(name)) throw duplicateEntryError(archivePath, name, 'central-directory');
    seenNames.add(name);
    const extra = bytes.subarray(
      offset + 46 + nameLength,
      offset + 46 + nameLength + extraLength,
    );
    const metadata = resolveZip64Metadata({
      compressedSize: rawCompressedSize,
      uncompressedSize: rawUncompressedSize,
      localHeaderOffset: rawLocalHeaderOffset,
      diskStart: rawDiskStart,
    }, extra, archivePath, name, 'central-directory');
    if (metadata.diskStart !== 0) {
      throw archiveError(archivePath, `entry ${JSON.stringify(name)} is stored on another disk.`);
    }
    if (metadata.localHeaderOffset >= centralDirectoryOffset) {
      throw centralDirectoryMismatch(
        archivePath,
        `entry ${JSON.stringify(name)} points outside the local-file area.`,
        name,
      );
    }
    if (seenOffsets.has(metadata.localHeaderOffset)) {
      throw centralDirectoryMismatch(
        archivePath,
        `multiple central entries point to local-header offset ${metadata.localHeaderOffset}.`,
        name,
      );
    }
    seenOffsets.add(metadata.localHeaderOffset);
    if (metadata.uncompressedSize > maxDecompressedBytes - totalUncompressedBytes) {
      throw new ZipEntryStreamError(
        `ZIP archive ${JSON.stringify(archivePath)} declares more than maxDecompressedBytes (${maxDecompressedBytes}) across its entries.`,
        {
          code: 'ZIP_DECOMPRESSED_SIZE_LIMIT_EXCEEDED',
          archivePath,
          entryName: name,
          lineNumber: 1,
        },
      );
    }
    totalUncompressedBytes += metadata.uncompressedSize;
    assertCompressionRatio({
      archivePath,
      entryName: name,
      compressedSize: metadata.compressedSize,
      uncompressedSize: metadata.uncompressedSize,
      maxCompressionRatio,
    });
    entries.push({
      name,
      nameBytes: Buffer.from(nameBytes),
      versionNeeded,
      flags,
      compression,
      crc,
      compressedSize: metadata.compressedSize,
      uncompressedSize: metadata.uncompressedSize,
      localHeaderOffset: metadata.localHeaderOffset,
      usesZip64Sizes: metadata.usesZip64Sizes,
    });
    offset = recordEnd;
  }
  if (offset !== bytes.length) {
    throw centralDirectoryMismatch(
      archivePath,
      `central directory has ${bytes.length - offset} unaccounted byte(s).`,
    );
  }
  return { entries, totalUncompressedBytes };
}

async function readExactly(fileHandle, position, length, archivePath, description) {
  const result = Buffer.allocUnsafe(length);
  let bytesRead = 0;
  while (bytesRead < length) {
    const read = await fileHandle.read(
      result,
      bytesRead,
      length - bytesRead,
      position + bytesRead,
    );
    if (read.bytesRead === 0) {
      throw archiveError(archivePath, `truncated ${description}.`);
    }
    bytesRead += read.bytesRead;
  }
  return result;
}

async function tryReadFirstLocalEntryName(fileHandle, archiveSize, archivePath) {
  if (archiveSize < 30) return null;
  const fixed = Buffer.allocUnsafe(30);
  const fixedRead = await fileHandle.read(fixed, 0, fixed.length, 0);
  if (fixedRead.bytesRead !== fixed.length || fixed.readUInt32LE(0) !== LOCAL_FILE_HEADER_SIGNATURE) {
    return null;
  }
  const flags = fixed.readUInt16LE(6);
  const nameLength = fixed.readUInt16LE(26);
  if (nameLength === 0 || 30 + nameLength > archiveSize) return null;
  const nameBytes = Buffer.allocUnsafe(nameLength);
  const nameRead = await fileHandle.read(nameBytes, 0, nameLength, 30);
  if (nameRead.bytesRead !== nameLength) return null;
  return decodeEntryName(nameBytes, flags, archivePath, 'local-header');
}

async function readDataDescriptor(fileHandle, position, entry, archivePath, centralDirectoryOffset) {
  const sizeWidth = entry.usesZip64Sizes ? 8 : 4;
  const totalLength = 8 + (2 * sizeWidth);
  if (position + 4 <= centralDirectoryOffset) {
    const signature = await readExactly(
      fileHandle,
      position,
      4,
      archivePath,
      `data descriptor for entry ${JSON.stringify(entry.name)}`,
    );
    if (signature.readUInt32LE(0) !== DATA_DESCRIPTOR_SIGNATURE) {
      throw centralDirectoryMismatch(
        archivePath,
        `unsigned data descriptors are not supported for entry ${JSON.stringify(entry.name)}.`,
        entry.name,
      );
    }
  }
  if (position + totalLength > centralDirectoryOffset) {
    throw centralDirectoryMismatch(
      archivePath,
      `data descriptor is truncated for entry ${JSON.stringify(entry.name)}.`,
      entry.name,
    );
  }
  const bytes = await readExactly(
    fileHandle,
    position,
    totalLength,
    archivePath,
    `data descriptor for entry ${JSON.stringify(entry.name)}`,
  );
  const crc = bytes.readUInt32LE(4);
  const compressedSize = sizeWidth === 8
    ? readSafeUInt64LE(bytes, 8, archivePath, 'data-descriptor compressed size')
    : bytes.readUInt32LE(8);
  const uncompressedOffset = 8 + sizeWidth;
  const uncompressedSize = sizeWidth === 8
    ? readSafeUInt64LE(bytes, uncompressedOffset, archivePath, 'data-descriptor uncompressed size')
    : bytes.readUInt32LE(uncompressedOffset);
  if (
    crc !== entry.crc
    || compressedSize !== entry.compressedSize
    || uncompressedSize !== entry.uncompressedSize
  ) {
    throw centralDirectoryMismatch(
      archivePath,
      `data descriptor disagrees with central metadata for entry ${JSON.stringify(entry.name)}.`,
      entry.name,
    );
  }
  return position + totalLength;
}

async function assertNoLocalHeaderInGap(fileHandle, start, end, archivePath) {
  if (start >= end) return;
  const signature = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
  let carry = Buffer.alloc(0);
  for (let position = start; position < end;) {
    const length = Math.min(DEFAULT_CHUNK_SIZE, end - position);
    const chunk = await readExactly(
      fileHandle,
      position,
      length,
      archivePath,
      'local-file area',
    );
    const searchable = carry.length === 0 ? chunk : Buffer.concat([carry, chunk]);
    if (searchable.indexOf(signature) >= 0) {
      throw centralDirectoryMismatch(
        archivePath,
        'local-file area contains a local header not referenced by the central directory.',
      );
    }
    carry = searchable.subarray(Math.max(0, searchable.length - 3));
    position += length;
  }
}

async function validateLocalHeaders(fileHandle, central, archivePath, centralDirectoryOffset) {
  const localEntries = [];
  const seenNames = new Set();
  for (const entry of central) {
    const fixed = await readExactly(
      fileHandle,
      entry.localHeaderOffset,
      30,
      archivePath,
      `local header for entry ${JSON.stringify(entry.name)}`,
    );
    if (fixed.readUInt32LE(0) !== LOCAL_FILE_HEADER_SIGNATURE) {
      throw centralDirectoryMismatch(
        archivePath,
        `entry ${JSON.stringify(entry.name)} does not point to a valid local header.`,
        entry.name,
      );
    }
    const versionNeeded = fixed.readUInt16LE(4);
    const flags = fixed.readUInt16LE(6);
    const compression = fixed.readUInt16LE(8);
    const localCrc = fixed.readUInt32LE(14);
    const rawCompressedSize = fixed.readUInt32LE(18);
    const rawUncompressedSize = fixed.readUInt32LE(22);
    const nameLength = fixed.readUInt16LE(26);
    const extraLength = fixed.readUInt16LE(28);
    const variableEnd = entry.localHeaderOffset + 30 + nameLength + extraLength;
    if (variableEnd > centralDirectoryOffset) {
      throw centralDirectoryMismatch(
        archivePath,
        `local header for entry ${JSON.stringify(entry.name)} overlaps the central directory.`,
        entry.name,
      );
    }
    const variable = await readExactly(
      fileHandle,
      entry.localHeaderOffset + 30,
      nameLength + extraLength,
      archivePath,
      `local name/extra fields for entry ${JSON.stringify(entry.name)}`,
    );
    const nameBytes = variable.subarray(0, nameLength);
    const name = decodeEntryName(nameBytes, flags, archivePath, 'local-header');
    if (seenNames.has(name)) throw duplicateEntryError(archivePath, name, 'local-header');
    seenNames.add(name);
    const extra = variable.subarray(nameLength);
    const metadata = resolveZip64Metadata({
      compressedSize: rawCompressedSize,
      uncompressedSize: rawUncompressedSize,
      localHeaderOffset: undefined,
      diskStart: undefined,
    }, extra, archivePath, name, 'local-header');

    if (versionNeeded !== entry.versionNeeded || flags !== entry.flags || compression !== entry.compression) {
      throw centralDirectoryMismatch(
        archivePath,
        `local header flags/method/version disagree for entry ${JSON.stringify(entry.name)}.`,
        entry.name,
      );
    }
    if (!Buffer.from(nameBytes).equals(entry.nameBytes) || name !== entry.name) {
      throw centralDirectoryMismatch(
        archivePath,
        `local name ${JSON.stringify(name)} disagrees with central name ${JSON.stringify(entry.name)}.`,
        entry.name,
      );
    }

    const usesDataDescriptor = (flags & 0x0008) !== 0;
    if (!usesDataDescriptor) {
      if (
        localCrc !== entry.crc
        || metadata.compressedSize !== entry.compressedSize
        || metadata.uncompressedSize !== entry.uncompressedSize
      ) {
        throw centralDirectoryMismatch(
          archivePath,
          `local CRC/size metadata disagrees for entry ${JSON.stringify(entry.name)}.`,
          entry.name,
        );
      }
    } else if (
      (localCrc !== 0 && localCrc !== entry.crc)
      || (
        rawCompressedSize !== 0
        && metadata.compressedSize !== entry.compressedSize
      )
      || (
        rawUncompressedSize !== 0
        && metadata.uncompressedSize !== entry.uncompressedSize
      )
    ) {
      throw centralDirectoryMismatch(
        archivePath,
        `local data-descriptor placeholders disagree for entry ${JSON.stringify(entry.name)}.`,
        entry.name,
      );
    }

    const dataStart = variableEnd;
    const dataEnd = dataStart + entry.compressedSize;
    if (!Number.isSafeInteger(dataEnd) || dataEnd > centralDirectoryOffset) {
      throw centralDirectoryMismatch(
        archivePath,
        `compressed data range is invalid for entry ${JSON.stringify(entry.name)}.`,
        entry.name,
      );
    }
    const recordEnd = usesDataDescriptor
      ? await readDataDescriptor(
        fileHandle,
        dataEnd,
        entry,
        archivePath,
        centralDirectoryOffset,
      )
      : dataEnd;
    localEntries.push({
      ...entry,
      localName: name,
      dataStart,
      dataEnd,
      recordEnd,
    });
  }

  localEntries.sort((left, right) => left.localHeaderOffset - right.localHeaderOffset);
  let gapStart = 0;
  for (const entry of localEntries) {
    await assertNoLocalHeaderInGap(
      fileHandle,
      gapStart,
      entry.localHeaderOffset,
      archivePath,
    );
    gapStart = entry.recordEnd;
  }
  await assertNoLocalHeaderInGap(
    fileHandle,
    gapStart,
    centralDirectoryOffset,
    archivePath,
  );
  for (let index = 1; index < localEntries.length; index += 1) {
    const previous = localEntries[index - 1];
    const current = localEntries[index];
    if (previous.recordEnd > current.localHeaderOffset) {
      throw centralDirectoryMismatch(
        archivePath,
        `local entries ${JSON.stringify(previous.name)} and ${JSON.stringify(current.name)} overlap.`,
      );
    }
  }
  return localEntries;
}

function isPromiseLike(value) {
  return value !== null
    && (typeof value === 'object' || typeof value === 'function')
    && typeof value.then === 'function';
}

function callSynchronous(callback, callbackName, argument) {
  const result = callback(argument);
  if (isPromiseLike(result)) {
    throw new TypeError(`${callbackName} must be synchronous.`);
  }
}

function joinByteChunks(chunks, byteLength, finalChunk) {
  if (chunks.length === 0) return finalChunk;
  const result = new Uint8Array(byteLength + finalChunk.length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  result.set(finalChunk, offset);
  return result;
}

function makeEntryContext(archivePath, entryName, lineNumber, cause, code, description) {
  return new ZipEntryStreamError(
    `${description} in ZIP archive ${JSON.stringify(archivePath)}, entry ${JSON.stringify(entryName)}, physical line ${lineNumber}: ${cause.message}`,
    { code, archivePath, entryName, lineNumber, cause },
  );
}

class EntryLineDecoder {
  constructor({ archivePath, entryName, maxLineBytes, onLine }) {
    this.archivePath = archivePath;
    this.entryName = entryName;
    this.maxLineBytes = maxLineBytes;
    this.onLine = onLine;
    this.decoder = new TextDecoder('utf-8', { fatal: true });
    this.pending = [];
    this.pendingBytes = 0;
    this.lineNumber = 1;
    this.lineCount = 0;
    this.byteCount = 0;
  }

  #assertLineLength(additionalBytes) {
    if (this.pendingBytes + additionalBytes <= this.maxLineBytes) return;
    const cause = new RangeError(`line exceeds maxLineBytes (${this.maxLineBytes}).`);
    throw makeEntryContext(
      this.archivePath,
      this.entryName,
      this.lineNumber,
      cause,
      'ZIP_ENTRY_LINE_TOO_LONG',
      'Oversized text line',
    );
  }

  #emit(segment) {
    this.#assertLineLength(segment.length);
    let bytes = joinByteChunks(this.pending, this.pendingBytes, segment);
    this.pending = [];
    this.pendingBytes = 0;
    if (bytes.length > 0 && bytes[bytes.length - 1] === 0x0D) {
      bytes = bytes.subarray(0, bytes.length - 1);
    }

    let text;
    try {
      text = this.decoder.decode(bytes);
    } catch (cause) {
      throw makeEntryContext(
        this.archivePath,
        this.entryName,
        this.lineNumber,
        cause,
        'ZIP_ENTRY_INVALID_UTF8',
        'Invalid UTF-8',
      );
    }

    if (this.onLine !== null) {
      try {
        callSynchronous(this.onLine, 'onLine', {
          entryName: this.entryName,
          lineNumber: this.lineNumber,
          text,
        });
      } catch (cause) {
        if (cause instanceof ZipEntryStreamError) throw cause;
        throw makeEntryContext(
          this.archivePath,
          this.entryName,
          this.lineNumber,
          cause,
          'ZIP_ENTRY_CALLBACK_FAILED',
          'Line callback failed',
        );
      }
    }
    this.lineNumber += 1;
    this.lineCount += 1;
  }

  push(data, final) {
    this.byteCount += data.length;
    let segmentStart = 0;
    for (let index = 0; index < data.length; index += 1) {
      if (data[index] !== 0x0A) continue;
      this.#emit(data.subarray(segmentStart, index));
      segmentStart = index + 1;
    }

    const remainder = data.subarray(segmentStart);
    this.#assertLineLength(remainder.length);
    if (remainder.length > 0) {
      const copy = new Uint8Array(remainder.length);
      copy.set(remainder);
      this.pending.push(copy);
      this.pendingBytes += copy.length;
    }
    if (final && this.pendingBytes > 0) this.#emit(EMPTY_BYTES);
  }
}

function countPhysicalLines(data, state) {
  state.byteCount += data.length;
  for (const byte of data) {
    if (byte === 0x0A) state.lineNumber += 1;
  }
}

function assertEntrySize(file, state, archivePath, expectedSize = file.originalSize) {
  if (expectedSize === undefined || state.byteCount === expectedSize) return;
  const cause = new Error(
    `decompressed size ${state.byteCount} does not match declared size ${expectedSize}.`,
  );
  throw makeEntryContext(
    archivePath,
    file.name,
    state.lineNumber,
    cause,
    'ZIP_ENTRY_DECOMPRESSION_FAILED',
    'Decompression failed',
  );
}

/**
 * Streams selected ZIP members as strict UTF-8 text without materializing the
 * archive or an entire member. Callbacks must be synchronous so input remains
 * ordered and memory-bounded. Central/local metadata is preflighted through the
 * same open file before callbacks. After stopAfterRequired, raw reading, hashing,
 * and structural validation continue without starting later members.
 */
export async function streamZipTextEntries(zipPath, {
  selectEntry = () => true,
  onEntry = null,
  onLine = null,
  requiredEntries = [],
  stopAfterRequired = false,
  chunkSize = DEFAULT_CHUNK_SIZE,
  maxLineBytes = DEFAULT_MAX_LINE_BYTES,
  maxEntries = DEFAULT_MAX_ENTRIES,
  maxDecompressedBytes = DEFAULT_MAX_DECOMPRESSED_BYTES,
  maxCompressionRatio = DEFAULT_MAX_COMPRESSION_RATIO,
  maxCentralDirectoryBytes = DEFAULT_MAX_CENTRAL_DIRECTORY_BYTES,
  expectedSha256 = null,
} = {}) {
  if (typeof zipPath !== 'string' || zipPath.length === 0) {
    throw new TypeError('zipPath must be a non-empty string.');
  }
  if (typeof selectEntry !== 'function') throw new TypeError('selectEntry must be a function.');
  if (onEntry !== null && typeof onEntry !== 'function') throw new TypeError('onEntry must be a function or null.');
  if (onLine !== null && typeof onLine !== 'function') throw new TypeError('onLine must be a function or null.');
  if (typeof stopAfterRequired !== 'boolean') throw new TypeError('stopAfterRequired must be a boolean.');
  assertPositiveInteger(chunkSize, 'chunkSize');
  assertPositiveInteger(maxLineBytes, 'maxLineBytes');
  assertPositiveInteger(maxEntries, 'maxEntries');
  assertPositiveInteger(maxDecompressedBytes, 'maxDecompressedBytes');
  assertPositiveNumber(maxCompressionRatio, 'maxCompressionRatio');
  assertPositiveInteger(maxCentralDirectoryBytes, 'maxCentralDirectoryBytes');
  if (!Number.isSafeInteger(maxCentralDirectoryBytes + MAX_EOCD_SIZE)) {
    throw new TypeError('maxCentralDirectoryBytes is too large.');
  }
  const normalizedExpectedSha256 = normalizeExpectedSha256(expectedSha256);

  const required = normalizeRequiredEntries(requiredEntries);
  if (stopAfterRequired && required.length === 0) {
    throw new TypeError('stopAfterRequired requires at least one requiredEntries member.');
  }

  const archivePath = path.resolve(zipPath);
  const requiredSet = new Set(required);
  const completedRequired = new Set();
  const seenEntries = new Set();
  const streamedEntries = [];
  const selectedEntries = [];
  let selectedEntryCount = 0;
  let lineCount = 0;
  let decompressedByteCount = 0;
  let centralByName = new Map();
  let fatalError = null;
  let activeEntry = null;
  let stoppedEarly = false;
  let decompressionStopped = false;

  const unzip = new Unzip((file) => {
    if (fatalError !== null) return;
    if (seenEntries.has(file.name)) {
      fatalError = duplicateEntryError(archivePath, file.name, 'local-header');
      return;
    }
    if (seenEntries.size >= maxEntries) {
      fatalError = new ZipEntryStreamError(
        `ZIP archive ${JSON.stringify(archivePath)} exceeds maxEntries (${maxEntries}).`,
        { code: 'ZIP_ENTRY_LIMIT_EXCEEDED', archivePath, entryName: file.name, lineNumber: 1 },
      );
      return;
    }
    seenEntries.add(file.name);
    const declaredEntry = centralByName.get(file.name);
    if (declaredEntry === undefined) {
      fatalError = centralDirectoryMismatch(
        archivePath,
        `streamed local entry ${JSON.stringify(file.name)} is absent from the central directory.`,
        file.name,
      );
      return;
    }

    let selected;
    try {
      const selection = selectEntry(file.name, Object.freeze({
        name: file.name,
        compression: file.compression,
        compressedSize: file.size,
        originalSize: file.originalSize,
      }));
      if (isPromiseLike(selection)) throw new TypeError('selectEntry must be synchronous.');
      selected = Boolean(selection);
    } catch (cause) {
      fatalError = makeEntryContext(
        archivePath,
        file.name,
        1,
        cause,
        'ZIP_ENTRY_CALLBACK_FAILED',
        'Entry selector failed',
      );
      return;
    }

    let state;
    if (selected) {
      selectedEntryCount += 1;
      selectedEntries.push(file.name);
      state = new EntryLineDecoder({
        archivePath,
        entryName: file.name,
        maxLineBytes,
        onLine,
      });
      if (onEntry !== null) {
        try {
          callSynchronous(onEntry, 'onEntry', Object.freeze({
            name: file.name,
            compression: file.compression,
            compressedSize: file.size,
            originalSize: file.originalSize,
          }));
        } catch (cause) {
          fatalError = makeEntryContext(
            archivePath,
            file.name,
            1,
            cause,
            'ZIP_ENTRY_CALLBACK_FAILED',
            'Entry callback failed',
          );
          return;
        }
      }
    } else {
      state = { byteCount: 0, lineNumber: 1 };
    }
    state.crc32 = 0;
    state.completed = false;

    const streamedEntry = { file, state, selected, declaredEntry };
    streamedEntries.push(streamedEntry);
    activeEntry = streamedEntry;
    file.ondata = (error, data, final) => {
      if (error === STOP_AFTER_REQUIRED) throw STOP_AFTER_REQUIRED;
      if (fatalError !== null) return;
      if (error !== null) {
        fatalError = makeEntryContext(
          archivePath,
          file.name,
          state.lineNumber,
          error,
          'ZIP_ENTRY_DECOMPRESSION_FAILED',
          'Decompression failed',
        );
        return;
      }
      let stopNow = false;
      try {
        if (data.length > maxDecompressedBytes - decompressedByteCount) {
          throw new ZipEntryStreamError(
            `ZIP archive ${JSON.stringify(archivePath)} exceeds maxDecompressedBytes (${maxDecompressedBytes}) while decompressing entry ${JSON.stringify(file.name)}.`,
            {
              code: 'ZIP_DECOMPRESSED_SIZE_LIMIT_EXCEEDED',
              archivePath,
              entryName: file.name,
              lineNumber: state.lineNumber,
            },
          );
        }
        decompressedByteCount += data.length;
        state.crc32 = updateCrc32(state.crc32, data);
        if (selected) {
          const before = state.lineCount;
          state.push(data, final);
          lineCount += state.lineCount - before;
        } else {
          countPhysicalLines(data, state);
        }
        if (final) {
          assertEntrySize(file, state, archivePath, declaredEntry.uncompressedSize);
          state.completed = true;
          if (requiredSet.has(file.name)) completedRequired.add(file.name);
          if (activeEntry?.file === file) activeEntry = null;
          stopNow = stopAfterRequired && completedRequired.size === requiredSet.size;
        }
      } catch (cause) {
        fatalError = cause instanceof ZipEntryStreamError
          ? cause
          : makeEntryContext(
            archivePath,
            file.name,
            state.lineNumber,
            cause,
            'ZIP_ENTRY_DECOMPRESSION_FAILED',
            'Entry processing failed',
          );
      }
      if (stopNow) throw STOP_AFTER_REQUIRED;
    };
    try {
      file.start();
    } catch (cause) {
      if (cause === STOP_AFTER_REQUIRED) throw STOP_AFTER_REQUIRED;
      fatalError = makeEntryContext(
        archivePath,
        file.name,
        state.lineNumber,
        cause,
        'ZIP_ENTRY_DECOMPRESSION_FAILED',
        'Decompression failed',
      );
    }
  });
  unzip.register(UnzipInflate);

  const tailCapacity = maxCentralDirectoryBytes + MAX_EOCD_SIZE;
  const archiveTail = new ArchiveTail(tailCapacity);
  const archiveHash = createHash('sha256');
  let archiveByteCount = 0;
  let archiveSha256 = null;
  let fileHandle = null;
  let input = null;
  let directory;
  let central;
  let localEntries;
  let initialStat;
  try {
    fileHandle = await fs.promises.open(archivePath, 'r');
    initialStat = await fileHandle.stat();
    if (!Number.isSafeInteger(initialStat.size)) {
      throw archiveError(archivePath, 'archive size exceeds JavaScript\'s safe integer range.');
    }
    const preflightTailStart = Math.max(0, initialStat.size - tailCapacity);
    const preflightTail = await readExactly(
      fileHandle,
      preflightTailStart,
      initialStat.size - preflightTailStart,
      archivePath,
      'archive tail',
    );
    try {
      directory = parseEndOfCentralDirectory(
        preflightTail,
        initialStat.size,
        archivePath,
        maxEntries,
        maxCentralDirectoryBytes,
      );
    } catch (cause) {
      const firstEntryName = cause instanceof ZipEntryStreamError && cause.entryName === null
        ? await tryReadFirstLocalEntryName(fileHandle, initialStat.size, archivePath)
        : null;
      if (firstEntryName === null) throw cause;
      throw makeEntryContext(
        archivePath,
        firstEntryName,
        1,
        cause,
        cause.code,
        'Invalid ZIP structure',
      );
    }
    central = parseCentralDirectory({
      archivePath,
      ...directory,
      maxDecompressedBytes,
      maxCompressionRatio,
    });
    localEntries = await validateLocalHeaders(
      fileHandle,
      central.entries,
      archivePath,
      directory.centralDirectoryOffset,
    );
    centralByName = new Map(central.entries.map((entry) => [entry.name, entry]));
    const missingFromDirectory = required.filter((name) => !centralByName.has(name));
    if (missingFromDirectory.length > 0) {
      throw new ZipEntryStreamError(
        `ZIP archive ${JSON.stringify(archivePath)} is missing required entries: ${missingFromDirectory.map((name) => JSON.stringify(name)).join(', ')}.`,
        { code: 'ZIP_REQUIRED_ENTRY_MISSING', archivePath },
      );
    }

    input = fileHandle.createReadStream({
      autoClose: false,
      highWaterMark: chunkSize,
      start: 0,
    });
    for await (const chunk of input) {
      archiveByteCount += chunk.length;
      if (!Number.isSafeInteger(archiveByteCount)) {
        throw archiveError(archivePath, 'archive byte count exceeds JavaScript\'s safe integer range.');
      }
      archiveHash.update(chunk);
      archiveTail.push(chunk);
      if (decompressionStopped) continue;
      try {
        unzip.push(chunk, false);
      } catch (cause) {
        if (cause === STOP_AFTER_REQUIRED) {
          stoppedEarly = true;
          decompressionStopped = true;
          activeEntry = null;
          continue;
        }
        const context = activeEntry;
        throw context === null
          ? new ZipEntryStreamError(
            `Invalid ZIP archive ${JSON.stringify(archivePath)}: ${cause.message}`,
            { code: 'ZIP_INVALID_ARCHIVE', archivePath, cause },
          )
          : makeEntryContext(
            archivePath,
            context.file.name,
            context.state.lineNumber,
            cause,
            'ZIP_ENTRY_DECOMPRESSION_FAILED',
            'Decompression failed',
          );
      }
      if (fatalError !== null) throw fatalError;
      if (
        stopAfterRequired
        && completedRequired.size === requiredSet.size
      ) {
        stoppedEarly = true;
        decompressionStopped = true;
        activeEntry = null;
      }
    }

    if (!decompressionStopped) {
      try {
        unzip.push(EMPTY_BYTES, true);
      } catch (cause) {
        if (cause === STOP_AFTER_REQUIRED) {
          stoppedEarly = true;
          decompressionStopped = true;
        } else {
          const context = activeEntry;
          throw context === null
            ? new ZipEntryStreamError(
              `Invalid ZIP archive ${JSON.stringify(archivePath)}: ${cause.message}`,
              { code: 'ZIP_INVALID_ARCHIVE', archivePath, cause },
            )
            : makeEntryContext(
              archivePath,
              context.file.name,
              context.state.lineNumber,
              cause,
              'ZIP_ENTRY_DECOMPRESSION_FAILED',
              'Decompression failed',
            );
        }
      }
      if (fatalError !== null) throw fatalError;
    }

    archiveSha256 = archiveHash.digest('hex');
    if (normalizedExpectedSha256 !== null && archiveSha256 !== normalizedExpectedSha256) {
      throw new ZipEntryStreamError(
        `ZIP archive ${JSON.stringify(archivePath)} SHA-256 mismatch: expected ${normalizedExpectedSha256}, got ${archiveSha256}.`,
        { code: 'ZIP_ARCHIVE_SHA256_MISMATCH', archivePath },
      );
    }
    const finalStat = await fileHandle.stat();
    if (
      archiveByteCount !== initialStat.size
      || finalStat.size !== initialStat.size
      || finalStat.mtimeMs !== initialStat.mtimeMs
      || finalStat.ctimeMs !== initialStat.ctimeMs
    ) {
      throw archiveError(archivePath, 'archive changed while it was being streamed.');
    }

    const streamedDirectory = parseEndOfCentralDirectory(
      archiveTail.bytes(),
      archiveByteCount,
      archivePath,
      maxEntries,
      maxCentralDirectoryBytes,
    );
    if (
      streamedDirectory.entryCount !== directory.entryCount
      || streamedDirectory.centralDirectoryOffset !== directory.centralDirectoryOffset
      || !Buffer.from(streamedDirectory.bytes).equals(Buffer.from(directory.bytes))
    ) {
      throw centralDirectoryMismatch(
        archivePath,
        'central directory changed between preflight and the streamed archive.',
      );
    }

    if (!stoppedEarly && streamedEntries.length !== localEntries.length) {
      throw centralDirectoryMismatch(
        archivePath,
        `streamed ${streamedEntries.length} local entries but the central directory declares ${localEntries.length}.`,
      );
    }
    if (streamedEntries.length > localEntries.length) {
      throw centralDirectoryMismatch(archivePath, 'streamed more local entries than declared.');
    }
    for (let index = 0; index < streamedEntries.length; index += 1) {
      const streamedEntry = streamedEntries[index];
      const localEntry = localEntries[index];
      if (streamedEntry.file.name !== localEntry.name) {
        throw centralDirectoryMismatch(
          archivePath,
          `streamed local entry ${JSON.stringify(streamedEntry.file.name)} disagrees with local-header order ${JSON.stringify(localEntry.name)}.`,
          streamedEntry.file.name,
        );
      }
      if (!streamedEntry.state.completed) {
        throw archiveError(
          archivePath,
          `decompression did not complete for entry ${JSON.stringify(streamedEntry.file.name)}.`,
          { code: 'ZIP_ENTRY_DECOMPRESSION_FAILED', entryName: streamedEntry.file.name },
        );
      }
      if (streamedEntry.state.crc32 !== localEntry.crc) {
        throw new ZipEntryStreamError(
          `CRC mismatch in ZIP archive ${JSON.stringify(archivePath)}, entry ${JSON.stringify(streamedEntry.file.name)}: expected ${localEntry.crc.toString(16).padStart(8, '0')}, got ${streamedEntry.state.crc32.toString(16).padStart(8, '0')}.`,
          {
            code: 'ZIP_ENTRY_CRC_MISMATCH',
            archivePath,
            entryName: streamedEntry.file.name,
            lineNumber: streamedEntry.state.lineNumber,
          },
        );
      }
    }
  } catch (cause) {
    if (cause instanceof ZipEntryStreamError) throw cause;
    throw new ZipEntryStreamError(
      `Unable to stream ZIP archive ${JSON.stringify(archivePath)}: ${cause.message}`,
      { code: 'ZIP_STREAM_FAILED', archivePath, cause },
    );
  } finally {
    if (input !== null && !input.destroyed) input.destroy();
    if (fileHandle !== null) {
      try {
        await fileHandle.close();
      } catch {
        // The primary stream/validation result is more useful than a cleanup error.
      }
    }
  }

  const missing = required.filter((name) => !completedRequired.has(name));
  if (missing.length > 0) {
    throw new ZipEntryStreamError(
      `ZIP archive ${JSON.stringify(archivePath)} is missing required entries: ${missing.map((name) => JSON.stringify(name)).join(', ')}.`,
      { code: 'ZIP_REQUIRED_ENTRY_MISSING', archivePath },
    );
  }

  return Object.freeze({
    archivePath,
    archiveSha256,
    archiveByteCount,
    entryCount: central.entries.length,
    selectedEntryCount,
    selectedEntries: Object.freeze([...selectedEntries]),
    lineCount,
    decompressedByteCount,
    stoppedEarly,
  });
}
