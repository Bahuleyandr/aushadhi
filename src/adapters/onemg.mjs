import * as cheerio from 'cheerio';
import { parseComposition } from '../lib/composition.mjs';

// Balanced-extracts a JSON object or array starting at text[startIdx] ('{' or '[').
// Needed because 1mg inlines `window.__X__ = {...}; more js...` in one script tag.
export function extractBalancedJson(text, startIdx) {
  const open = text[startIdx];
  if (open !== '{' && open !== '[') return null;
  const close = open === '{' ? '}' : ']';
  const altOpen = open === '{' ? '[' : '{';
  const altClose = open === '{' ? ']' : '}';
  let depth = 0;
  let alt = 0;
  let inStr = false;
  let esc = false;
  for (let i = startIdx; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0 && alt === 0) return text.slice(startIdx, i + 1);
    } else if (c === altOpen) alt++;
    else if (c === altClose) alt--;
  }
  return null;
}

function jsonAtMarker(html, marker, brace) {
  const out = [];
  let from = 0;
  while (true) {
    const idx = html.indexOf(marker, from);
    if (idx === -1) break;
    const start = html.indexOf(brace, idx + marker.length - 1);
    if (start !== -1) {
      const raw = extractBalancedJson(html, start);
      if (raw) {
        try { out.push(JSON.parse(raw)); } catch { /* skip unparseable */ }
      }
    }
    from = idx + marker.length;
  }
  return out;
}

function ldBlocks(html) {
  const $ = cheerio.load(html);
  const blocks = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const j = JSON.parse($(el).text());
      blocks.push(...(Array.isArray(j) ? j : [j]));
    } catch { /* skip bad JSON */ }
  });
  return blocks;
}

const stripTags = (s) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

export function parseDrugPage(html) {
  const ld = ldBlocks(html);
  const drug = ld.find((b) => b && b['@type'] === 'Drug') ?? null;

  let name = drug?.name ?? null;
  if (!name) {
    const og = html.match(/<meta property="og:title" content="([^"]+)"/);
    name = og ? og[1].replace(/\s*-\s*1mg.*$/i, '').trim() : null;
  }
  const manufacturer = drug?.marketer?.legalName ?? drug?.manufacturer?.name ?? null;

  // Composition: salt_composition.display_text (has strengths) > LD activeIngredient (names only)
  let compositionRaw = null;
  for (const sc of jsonAtMarker(html, '"salt_composition"', '{')) {
    if (sc && typeof sc.display_text === 'string' && sc.display_text) {
      compositionRaw = stripTags(sc.display_text);
      break;
    }
  }
  if (!compositionRaw && typeof drug?.activeIngredient === 'string') compositionRaw = drug.activeIngredient;
  const comp = compositionRaw ? parseComposition(compositionRaw) : { ingredients: [], status: 'missing', raw: '' };

  // Substitutes: every "substitutes":[...] array; entries carry entity_name (formulary widget)
  const subs = [];
  for (const arr of jsonAtMarker(html, '"substitutes"', '[')) {
    if (!Array.isArray(arr)) continue;
    for (const s of arr) {
      const n = s?.entity_name ?? s?.name ?? null;
      if (n) subs.push({ name: n, manufacturer: s.manufacturer_name ?? s.manufacturer?.name ?? null });
    }
  }

  const discontinued = /"(?:is_)?discontinued"\s*:\s*true/.test(html) ? true : null;

  return {
    brand_name: name,
    manufacturer,
    form_raw: drug?.dosageForm ?? null,
    ingredients: comp.ingredients,
    composition_raw: comp.raw || compositionRaw || '',
    composition_status: comp.status,
    substitutes_raw: [...new Map(subs.map((s) => [s.name, s])).values()],
    is_discontinued: discontinued,
  };
}

export function parseBrowsePage(html) {
  const $ = cheerio.load(html);
  const out = [];
  $('a[href^="/drugs/"]').each((_, el) => {
    const path = ($(el).attr('href') ?? '').split('?')[0];
    if (!/-\d+$/.test(path)) return;
    const name = $(el).text().replace(/\s+/g, ' ').trim();
    out.push({ name: name || path.split('/').pop(), path });
  });
  return [...new Map(out.map((e) => [e.path, e])).values()];
}
