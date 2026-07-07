// One-off fixture grabber: node scripts/grab-fixture.mjs <1mg-path> <fixture-name>
// e.g. node scripts/grab-fixture.mjs "/drugs-all-medicines?label=a" browse_page.html
import fsp from 'node:fs/promises';
import { makeOnemgFetcher } from '../src/lib/onemg-fetcher.mjs';

const [pagePath, name] = process.argv.slice(2);
if (!pagePath || !name) {
  console.error('usage: node scripts/grab-fixture.mjs <path> <fixture-name>');
  process.exit(1);
}
const pf = makeOnemgFetcher();
await pf.init();
const html = await pf.get(pagePath);
await fsp.mkdir('test/fixtures/onemg', { recursive: true });
await fsp.writeFile(`test/fixtures/onemg/${name}`, html);
console.log(`saved test/fixtures/onemg/${name} (${html.length} bytes)`);
