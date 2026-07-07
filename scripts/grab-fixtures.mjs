// One-off: grab two fixture pages for parser tests, via the polite fetcher itself.
import fsp from 'node:fs/promises';
import { PoliteFetcher } from '../src/lib/politeness.mjs';

const pf = new PoliteFetcher({
  baseUrl: 'https://www.1mg.com',
  cacheDir: 'data/raw/onemg/pages',
  stateFile: 'data/raw/onemg/state.json',
  userAgent: 'aushadhi-dataset-builder/0.1 (contact: safari-oil-shelve@duck.com)',
});

await pf.init();
console.log('robots disallow rules:', pf.disallow.length);

const browse = await pf.get('/drugs-all-medicines?label=a');
await fsp.mkdir('test/fixtures/onemg', { recursive: true });
await fsp.writeFile('test/fixtures/onemg/browse_page.html', browse);
console.log('browse page bytes:', browse.length);

const links = [...browse.matchAll(/href="(\/drugs\/[^"?]+-\d+)"/g)].map((m) => m[1]);
console.log('drug links found:', links.length, links.slice(0, 3));
if (!links.length) {
  console.error('NO DRUG LINKS — page may be JS-shell or blocked; inspect browse_page.html');
  process.exit(2);
}

const drug = await pf.get(links[0]);
await fsp.writeFile('test/fixtures/onemg/drug_page.html', drug);
console.log('drug page bytes:', drug.length, 'path:', links[0]);
