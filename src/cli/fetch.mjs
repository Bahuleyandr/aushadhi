import { ctx } from '../lib/context.mjs';
import { fetchGithubJr } from '../adapters/github-jr.mjs';
import { fetchJanAushadhi } from '../adapters/janaushadhi.mjs';

const c = ctx();
const results = {};

try {
  results['github-jr'] = await fetchGithubJr(c);
} catch (e) {
  results['github-jr'] = { error: e.message };
}
try {
  results.janaushadhi = await fetchJanAushadhi(c);
} catch (e) {
  results.janaushadhi = { error: e.message };
}
try {
  const { fetchKaggle2025 } = await import('../adapters/kaggle-2025.mjs');
  results['kaggle-2025'] = await fetchKaggle2025(c);
} catch (e) {
  results['kaggle-2025'] = { error: e.message };
}

console.log(JSON.stringify(results, null, 2));
if (Object.values(results).every((r) => r.error)) process.exit(1);
