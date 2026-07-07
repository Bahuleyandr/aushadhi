// One-off: second drug-page fixture (common tablet with populated substitutes).
import fsp from 'node:fs/promises';
import { PoliteFetcher } from '../src/lib/politeness.mjs';

const pf = new PoliteFetcher({
  baseUrl: 'https://www.1mg.com',
  cacheDir: 'data/raw/onemg/pages',
  stateFile: 'data/raw/onemg/state.json',
  userAgent: 'aushadhi-dataset-builder/0.1 (contact: safari-oil-shelve@duck.com)',
});

await pf.init();
const html = await pf.get('/drugs/augmentin-625-duo-tablet-138629');
await fsp.writeFile('test/fixtures/onemg/drug_page_tablet.html', html);
console.log('tablet page bytes:', html.length);
const i = html.indexOf('"substitutes"');
console.log('substitutes context:', html.slice(i, i + 500).replace(/\s+/g, ' '));
