import { createHash } from 'node:crypto';

const FAMILY_KEY_VERSION = 3;
const KNOWN_PATH_PREFIXES = ['/online-medicine-order/', '/prescriptions/', '/product/', '/drugs/'];
const FORM_AND_PACK_TOKENS = new Set([
  'tablet', 'tablets', 'tab', 'tabs', 'capsule', 'capsules', 'cap', 'caps',
  'strip', 'strips', 'pack', 'packs', 'packet', 'packets', 'bottle', 'bottles',
  'vial', 'vials', 'ampoule', 'ampoules', 'injection', 'injections', 'injectable',
  'syrup', 'suspension', 'solution', 'cream', 'gel', 'ointment', 'drops', 'drop',
  'sachet', 'sachets', 'spray', 'powder', 'lotion', 'soap', 'of', 'in', 'with',
  'unit', 'units', 'dose', 'doses', 'oral', 'topical', 'immediate', 'release',
]);
const UNIT_TOKENS = new Set(['mg', 'mcg', 'ug', 'g', 'kg', 'ml', 'l', 'iu', 'unit', 'units', 'percent']);
const PRESERVE_FOLLOWING_BARE_NUMBER = new Set(['akt']);
const WEAK_FAMILY_KEYS = new Set(['plus', 'forte', 'junior', 'kid', 'kids']);
const TERMINAL_OUTCOMES = new Set(['gone', 'excluded']);
const VALID_OUTCOMES = new Set(['not_found', ...TERMINAL_OUTCOMES]);

export const DEFAULT_NOT_FOUND_REVALIDATE_MS = 30 * 24 * 60 * 60 * 1000;

export class ParserAnomalyError extends Error {
  constructor(productPath) {
    super(`parser anomaly for indexed product ${productPath}; refusing to advance`);
    this.name = 'ParserAnomalyError';
    this.code = 'DISCOVERY_ANOMALY';
    this.productPath = productPath;
  }
}

function lexical(input) {
  const raw = String(input ?? '').trim();
  const looksLikePath = raw.includes('/');
  let text = raw;
  if (looksLikePath) {
    let pathname;
    try { pathname = new URL(raw, 'https://index.invalid').pathname; } catch { pathname = raw.split('?')[0]; }
    if (!KNOWN_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return { tokens: [], validPath: false };
    text = pathname.split('/').filter(Boolean).at(-1) ?? '';
  }
  try { text = decodeURIComponent(text); } catch { /* retain source text */ }
  let tokens = text.toLowerCase().replace(/[’']/g, '').match(/[a-z]+\d*[a-z]*|\d+(?:\.\d+)?(?:[a-z%]+)?/g) ?? [];
  if (looksLikePath && /^\d{5,}$/.test(tokens.at(-1) ?? '')) tokens = tokens.slice(0, -1);
  if (looksLikePath && /^[a-z]{3,}\d[a-z0-9]{2,}$/.test(tokens.at(-1) ?? '')) tokens = tokens.slice(0, -1);
  return { tokens, validPath: true };
}

function isExplicitVariantToken(token) {
  return /^\d+(?:\.\d+)?(?:mg|mcg|ug|g|kg|ml|l|iu|units?|%)$/.test(token)
    || /^\d+s$/.test(token);
}

function analyze(input) {
  const { tokens, validPath } = lexical(input);
  if (!validPath) return { key: '', signals: [] };
  const signals = [];
  const family = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const bareNumber = /^\d+(?:\.\d+)?$/.test(token);
    const preserveBare = bareNumber && PRESERVE_FOLLOWING_BARE_NUMBER.has(tokens[index - 1]);
    if (isExplicitVariantToken(token) || (bareNumber && !preserveBare)) {
      signals.push(token);
      continue;
    }
    if (!FORM_AND_PACK_TOKENS.has(token) && !UNIT_TOKENS.has(token)) family.push(token);
  }
  const key = family.join(' ');
  const meaningful = family.some((token) => /[a-z]/.test(token) && token.length >= 2)
    && !WEAK_FAMILY_KEYS.has(key);
  return { key: meaningful ? key : '', signals: [...new Set(signals)].sort() };
}

export function variantFamilyKey(input) {
  return analyze(input).key;
}

function familyIndex(paths) {
  const index = new Map();
  const analyses = new Map();
  for (const productPath of [...new Set(paths)]) {
    const result = analyze(productPath);
    analyses.set(productPath, result);
    if (!result.key || result.signals.length === 0) continue;
    const group = index.get(result.key) ?? [];
    group.push(productPath);
    index.set(result.key, group);
  }
  return { index, analyses };
}

function siblingsFromIndex(currentPath, built, maxFamily) {
  const current = built.analyses.get(currentPath) ?? analyze(currentPath);
  if (!current.key || current.signals.length === 0) return [];
  const group = built.index.get(current.key) ?? [];
  if (group.length < 2 || group.length > maxFamily) return [];
  const currentSignal = current.signals.join('|');
  return group.filter((candidate) => candidate !== currentPath
    && (built.analyses.get(candidate)?.signals ?? []).join('|') !== currentSignal);
}

export function variantSiblings(currentPath, paths, { maxFamily = 12 } = {}) {
  return siblingsFromIndex(currentPath, familyIndex(paths), maxFamily);
}

export function expandIndexedVariants({ indexedPaths, seedNames, doneIds, idFromPath, maxFamily = 12 }) {
  if (!Array.isArray(indexedPaths) || !Array.isArray(seedNames)
    || !(doneIds instanceof Set) || typeof idFromPath !== 'function') {
    throw new TypeError('invalid indexed variant expansion arguments');
  }
  const uniquePaths = [...new Set(indexedPaths)];
  const built = familyIndex(uniquePaths);
  const seedKeys = new Set(seedNames.map((name) => variantFamilyKey(name)).filter(Boolean));
  const eligible = new Set();
  for (const key of seedKeys) {
    const group = built.index.get(key) ?? [];
    if (group.length < 2 || group.length > maxFamily) continue;
    const distinctSignals = new Set(group.map((productPath) => built.analyses.get(productPath).signals.join('|')));
    if (distinctSignals.size < 2) continue;
    for (const productPath of group) eligible.add(productPath);
  }
  return uniquePaths.filter((productPath) => eligible.has(productPath) && !doneIds.has(String(idFromPath(productPath))));
}

function indexFingerprint(paths) {
  return createHash('sha256').update(`${FAMILY_KEY_VERSION}\n${paths.join('\n')}`).digest('hex');
}

function timestamp(value, label) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new TypeError(`invalid product outcome ${label}`);
  return new Date(parsed).toISOString();
}

function clockValue(now) {
  const value = typeof now === 'function' ? now() : now;
  const parsed = value instanceof Date ? value.getTime() : Number(value);
  if (!Number.isFinite(parsed)) throw new TypeError('product outcome clock must return a finite timestamp');
  return parsed;
}

export class ProductOutcomeLedger {
  constructor({
    paths,
    state,
    idFromPath,
    doneIds = null,
    now = Date.now,
    notFoundRevalidateMs = DEFAULT_NOT_FOUND_REVALIDATE_MS,
  }) {
    if (!Array.isArray(paths) || !state || typeof idFromPath !== 'function') {
      throw new TypeError('invalid ProductOutcomeLedger arguments');
    }
    if (doneIds !== null && !(doneIds instanceof Set)) throw new TypeError('doneIds must be a Set');
    if (!Number.isFinite(notFoundRevalidateMs) || notFoundRevalidateMs <= 0) {
      throw new TypeError('notFoundRevalidateMs must be a positive finite number');
    }
    this.paths = [...new Set(paths)];
    this.state = state;
    this.idFromPath = (productPath) => String(idFromPath(productPath));
    this.now = now;
    this.notFoundRevalidateMs = notFoundRevalidateMs;
    this.pathById = new Map(this.paths.map((productPath) => [this.idFromPath(productPath), productPath]));
    this.byId = new Map();

    const raw = state.pathOutcomes === undefined ? [] : state.pathOutcomes;
    if (!Array.isArray(raw)) throw new TypeError('invalid product outcome state');
    const legacy = Array.isArray(state.tombstones) ? state.tombstones : [];
    const values = [...raw];
    const migratedAt = new Date(clockValue(now)).toISOString();
    for (const productPath of legacy) {
      if (typeof productPath !== 'string') continue;
      const productId = this.idFromPath(productPath);
      if (raw.some((entry) => String(entry?.productId ?? '') === productId)) continue;
      values.push({ productId, path: productPath, status: 'gone', checkedAt: migratedAt });
    }

    for (const entry of values) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)
        || !VALID_OUTCOMES.has(entry.status)) {
        throw new TypeError('invalid product outcome entry');
      }
      const productId = String(entry.productId ?? (typeof entry.path === 'string' ? this.idFromPath(entry.path) : ''));
      const productPath = this.pathById.get(productId);
      if (!productId || !productPath) continue;
      if (this.byId.has(productId)) continue;
      const normalized = {
        productId,
        path: productPath,
        status: entry.status,
        checkedAt: timestamp(entry.checkedAt, 'checkedAt'),
      };
      if (entry.status === 'not_found') normalized.retryAt = timestamp(entry.retryAt, 'retryAt');
      if (entry.status === 'excluded' && typeof entry.reason === 'string' && entry.reason.trim()) {
        normalized.reason = entry.reason.trim();
      }
      this.byId.set(productId, normalized);
    }
    this.sync();
    if (doneIds) for (const productId of this.terminalIds()) doneIds.add(productId);
  }

  sync() {
    this.state.pathOutcomes = [...this.byId.values()];
    this.state.tombstones = this.state.pathOutcomes
      .filter((entry) => TERMINAL_OUTCOMES.has(entry.status))
      .map((entry) => entry.path);
  }

  outcomeFor(productPath) {
    return this.byId.get(this.idFromPath(productPath)) ?? null;
  }

  isTerminal(productPath) {
    return TERMINAL_OUTCOMES.has(this.outcomeFor(productPath)?.status);
  }

  shouldFetch(productPath) {
    const outcome = this.outcomeFor(productPath);
    if (!outcome) return true;
    if (TERMINAL_OUTCOMES.has(outcome.status)) return false;
    return clockValue(this.now) >= Date.parse(outcome.retryAt);
  }

  record(productPath, status, { checkedAt, reason } = {}) {
    if (!VALID_OUTCOMES.has(status)) throw new TypeError(`invalid product outcome status: ${status}`);
    const productId = this.idFromPath(productPath);
    const canonicalPath = this.pathById.get(productId);
    if (!canonicalPath) throw new Error(`cannot record outcome for out-of-index product: ${productPath}`);
    const observedAt = checkedAt === undefined
      ? new Date(clockValue(this.now)).toISOString()
      : timestamp(checkedAt, 'checkedAt');
    const entry = { productId, path: canonicalPath, status, checkedAt: observedAt };
    if (status === 'not_found') {
      entry.retryAt = new Date(Date.parse(observedAt) + this.notFoundRevalidateMs).toISOString();
    } else if (status === 'excluded' && typeof reason === 'string' && reason.trim()) {
      entry.reason = reason.trim();
    }
    this.byId.set(productId, entry);
    this.sync();
    return entry;
  }

  clear(productPath) {
    const removed = this.byId.delete(this.idFromPath(productPath));
    if (removed) this.sync();
    return removed;
  }

  terminalIds() {
    return new Set([...this.byId.values()]
      .filter((entry) => TERMINAL_OUTCOMES.has(entry.status))
      .map((entry) => entry.productId));
  }

  unavailableIds() {
    return new Set([...this.byId.values()]
      .filter((entry) => TERMINAL_OUTCOMES.has(entry.status)
        || (entry.status === 'not_found' && clockValue(this.now) < Date.parse(entry.retryAt)))
      .map((entry) => entry.productId));
  }

  dueNotFoundPaths() {
    return [...this.byId.values()]
      .filter((entry) => entry.status === 'not_found' && clockValue(this.now) >= Date.parse(entry.retryAt))
      .map((entry) => entry.path);
  }

  counts() {
    const counts = { notFound: 0, gone: 0, excluded: 0 };
    for (const entry of this.byId.values()) {
      if (entry.status === 'not_found') counts.notFound++;
      else if (entry.status === 'gone') counts.gone++;
      else if (entry.status === 'excluded') counts.excluded++;
    }
    return counts;
  }
}

export class VariantPriorityScheduler {
  constructor({
    paths,
    state,
    doneIds,
    idFromPath,
    maxFamily = 12,
    now = Date.now,
    notFoundRevalidateMs = DEFAULT_NOT_FOUND_REVALIDATE_MS,
    parserFingerprint,
  }) {
    if (!Array.isArray(paths) || !state || !(doneIds instanceof Set) || typeof idFromPath !== 'function') {
      throw new TypeError('invalid VariantPriorityScheduler arguments');
    }
    this.paths = [...new Set(paths)];
    this.pathSet = new Set(this.paths);
    this.state = state;
    this.doneIds = doneIds;
    this.idFromPath = (productPath) => String(idFromPath(productPath));
    this.maxFamily = maxFamily;
    this.built = familyIndex(this.paths);
    this.outcomes = new ProductOutcomeLedger({
      paths: this.paths,
      state,
      idFromPath: this.idFromPath,
      doneIds,
      now,
      notFoundRevalidateMs,
    });

    const fingerprint = indexFingerprint(this.paths);
    if (state.indexFingerprint && state.indexFingerprint !== fingerprint) {
      // A cursor is only an intra-snapshot checkpoint. Any index mutation resets
      // the scan so completion is decided by stable product IDs, not old offsets.
      state.cursor = 0;
    }
    if (!Number.isInteger(state.cursor) || state.cursor < 0) state.cursor = 0;
    if (state.cursor > this.paths.length) state.cursor = this.paths.length;
    const earliestIncomplete = this.paths.findIndex(
      (productPath) => !doneIds.has(this.idFromPath(productPath)),
    );
    if (earliestIncomplete === -1) state.cursor = this.paths.length;
    else if (earliestIncomplete < state.cursor) state.cursor = earliestIncomplete;
    state.cursorPath = this.paths[state.cursor] ?? null;
    state.indexFingerprint = fingerprint;
    state.familyKeyVersion = FAMILY_KEY_VERSION;

    const prioritySeen = new Set();
    state.priority = (Array.isArray(state.priority) ? state.priority : []).filter((productPath) => {
      if (!this.pathSet.has(productPath) || prioritySeen.has(productPath)
        || doneIds.has(this.idFromPath(productPath))) return false;
      prioritySeen.add(productPath);
      return true;
    });
    for (const productPath of this.outcomes.dueNotFoundPaths()) {
      if (!prioritySeen.has(productPath) && !doneIds.has(this.idFromPath(productPath))) {
        state.priority.push(productPath);
        prioritySeen.add(productPath);
      }
    }

    const quarantineSeen = new Set();
    state.quarantine = (Array.isArray(state.quarantine) ? state.quarantine : []).flatMap((entry) => {
      if (!entry || typeof entry !== 'object' || typeof entry.path !== 'string'
        || typeof entry.parser !== 'string' || !entry.parser.trim()) return [];
      const productId = String(entry.productId ?? this.idFromPath(entry.path));
      const productPath = this.paths.find((candidate) => this.idFromPath(candidate) === productId);
      if (!productPath || doneIds.has(productId) || quarantineSeen.has(productId)) return [];
      quarantineSeen.add(productId);
      return [{ productId, path: productPath, parser: entry.parser }];
    });
    if (typeof parserFingerprint === 'string' && parserFingerprint.trim()) {
      for (const entry of state.quarantine) {
        if (entry.parser === parserFingerprint || prioritySeen.has(entry.path)) continue;
        state.priority.push(entry.path);
        prioritySeen.add(entry.path);
      }
    }
  }

  peek() {
    if (this.state.priority.length) return { path: this.state.priority[0], priority: true };
    if (this.state.cursor >= this.paths.length) return null;
    return { path: this.paths[this.state.cursor], priority: false };
  }

  complete(productPath) {
    const current = this.peek();
    if (!current || current.path !== productPath) throw new Error(`cannot complete non-current product: ${productPath}`);
    if (current.priority) this.state.priority.shift();
    else {
      this.state.cursor++;
      this.state.cursorPath = this.paths[this.state.cursor] ?? null;
    }
  }

  recordTombstone(productPath) {
    this.outcomes.record(productPath, 'gone');
    this.doneIds.add(this.idFromPath(productPath));
  }

  enqueueSiblings(productPath) {
    const queued = new Set(this.state.priority);
    const added = [];
    for (const sibling of siblingsFromIndex(productPath, this.built, this.maxFamily)) {
      if (!this.pathSet.has(sibling) || queued.has(sibling)
        || this.doneIds.has(this.idFromPath(sibling)) || !this.outcomes.shouldFetch(sibling)) continue;
      this.state.priority.push(sibling);
      queued.add(sibling);
      added.push(sibling);
    }
    return added;
  }
}

export async function runVariantAwareIndex({
  products,
  state,
  doneIds,
  idFromPath,
  fetchProduct,
  parseProduct,
  writeProduct,
  persist,
  onPermanentMissing = () => {},
  onNotFound = () => {},
  onGone = () => {},
  onExcluded = () => {},
  onProgress = () => {},
  onParserAnomaly = async () => {},
  onQuarantined = () => {},
  isExcluded = () => false,
  isParsed = (parsed) => Boolean(parsed),
  maxFamily = 12,
  parserFingerprint,
  now = Date.now,
  notFoundRevalidateMs = DEFAULT_NOT_FOUND_REVALIDATE_MS,
  maxConsecutiveParserAnomalies = 3,
}) {
  const callbacks = [
    fetchProduct, parseProduct, writeProduct, persist, onPermanentMissing, onNotFound, onGone,
    onExcluded, onProgress, onParserAnomaly, onQuarantined, isExcluded, isParsed,
  ];
  if (callbacks.some((callback) => typeof callback !== 'function')) {
    throw new TypeError('variant-aware index callbacks must be functions');
  }
  if (typeof parserFingerprint !== 'string' || !parserFingerprint.trim()) {
    throw new TypeError('runVariantAwareIndex requires a parserFingerprint so quarantined anomalies are retried after parser upgrades');
  }
  if (!Number.isSafeInteger(maxConsecutiveParserAnomalies) || maxConsecutiveParserAnomalies <= 0) {
    throw new TypeError('maxConsecutiveParserAnomalies must be a positive safe integer');
  }
  const scheduler = new VariantPriorityScheduler({
    paths: products,
    state,
    doneIds,
    idFromPath,
    maxFamily,
    now,
    notFoundRevalidateMs,
    parserFingerprint,
  });
  const quarantineById = new Map(state.quarantine.map((entry) => [entry.productId, entry]));
  const releaseQuarantine = (productPath) => {
    const productId = String(idFromPath(productPath));
    if (!quarantineById.delete(productId)) return;
    state.quarantine = state.quarantine.filter((entry) => entry.productId !== productId);
  };
  let added = 0;
  let attempted = 0;
  let consecutiveParserAnomalies = 0;
  const checkpoint = async (item, queued) => {
    if (item.priority || queued.length || state.cursor % 100 === 0) await persist();
    if (!item.priority && state.cursor % 100 === 0) {
      onProgress({ cursor: state.cursor, total: products.length, added, attempted, priority: state.priority.length });
    }
  };

  while (true) {
    const item = scheduler.peek();
    if (!item) break;
    const productId = String(idFromPath(item.path));
    if (doneIds.has(productId)) {
      scheduler.complete(item.path);
      const queued = scheduler.enqueueSiblings(item.path);
      await checkpoint(item, queued);
      continue;
    }
    if (!scheduler.outcomes.shouldFetch(item.path)) {
      scheduler.complete(item.path);
      await checkpoint(item, []);
      continue;
    }

    const held = quarantineById.get(productId);
    if (held && held.parser === parserFingerprint) {
      consecutiveParserAnomalies++;
      if (consecutiveParserAnomalies >= maxConsecutiveParserAnomalies) {
        await persist();
        throw new ParserAnomalyError(item.path);
      }
      scheduler.complete(item.path);
      await checkpoint(item, []);
      continue;
    }

    attempted++;
    const fetched = await fetchProduct(item.path);
    if (!fetched || typeof fetched !== 'object') {
      throw new TypeError(`indexed fetch returned no outcome for ${item.path}`);
    }
    if (fetched.status === 'not_found' || fetched.status === 'gone') {
      scheduler.outcomes.record(item.path, fetched.status, { checkedAt: fetched.checkedAt });
      if (fetched.status === 'gone') doneIds.add(productId);
      scheduler.complete(item.path);
      await persist();
      if (fetched.status === 'not_found') onNotFound(item.path, fetched);
      else onGone(item.path, fetched);
      onPermanentMissing(item.path, fetched.status);
      continue;
    }
    if (fetched.status !== 'fetched') {
      throw new TypeError(`indexed fetch returned invalid status for ${item.path}: ${fetched.status}`);
    }

    const parsed = await parseProduct(fetched.html, item.path);
    if (isExcluded(parsed)) {
      consecutiveParserAnomalies = 0;
      releaseQuarantine(item.path);
      scheduler.outcomes.record(item.path, 'excluded', { reason: parsed?.reason });
      doneIds.add(productId);
      scheduler.complete(item.path);
      await persist();
      onExcluded(item.path, parsed);
      continue;
    }
    if (!isParsed(parsed)) {
      await onParserAnomaly(item.path);
      consecutiveParserAnomalies++;
      if (consecutiveParserAnomalies >= maxConsecutiveParserAnomalies) {
        await persist();
        throw new ParserAnomalyError(item.path);
      }
      const existing = quarantineById.get(productId);
      if (existing) {
        existing.path = item.path;
        existing.parser = parserFingerprint;
      } else {
        const recorded = { productId, path: item.path, parser: parserFingerprint };
        state.quarantine.push(recorded);
        quarantineById.set(productId, recorded);
      }
      scheduler.complete(item.path);
      await persist();
      onQuarantined(item.path);
      continue;
    }

    consecutiveParserAnomalies = 0;
    await writeProduct({ parsed, productId, productPath: item.path });
    releaseQuarantine(item.path);
    scheduler.outcomes.clear(item.path);
    doneIds.add(productId);
    scheduler.complete(item.path);
    const queued = scheduler.enqueueSiblings(item.path);
    added++;
    await checkpoint(item, queued);
  }
  await persist();
  const counts = scheduler.outcomes.counts();
  return {
    status: attempted === 0 ? 'no_work' : 'completed',
    added,
    attempted,
    cursor: state.cursor,
    priority: state.priority.length,
    tombstones: counts.gone + counts.excluded,
    notFound: counts.notFound,
    gone: counts.gone,
    excluded: counts.excluded,
    quarantined: state.quarantine.length,
    indexFingerprint: state.indexFingerprint,
  };
}
