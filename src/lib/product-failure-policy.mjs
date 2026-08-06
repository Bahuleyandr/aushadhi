import { HttpStatusError } from './politeness.mjs';

// Indexed crawler cursors may advance only when the HTTP response itself proves
// absence. Text in an unrelated error is not evidence. Callers that retain dead
// paths must still distinguish a revalidatable 404 from a terminal 410.
export function skipIfPermanentlyMissing(error) {
  if (error instanceof HttpStatusError && (error.status === 404 || error.status === 410)) return true;
  throw error;
}

export async function fetchIndexedProduct(fetcher, path, {
  now = Date.now,
  responseMetadata = false,
} = {}) {
  try {
    if (!responseMetadata) return { status: 'fetched', html: await fetcher.get(path) };
    if (typeof fetcher.getWithMetadata !== 'function') {
      throw new TypeError('indexed fetcher does not expose response metadata');
    }
    const fetched = await fetcher.getWithMetadata(path, { fresh: true });
    if (!fetched || typeof fetched !== 'object' || typeof fetched.body !== 'string') {
      throw new TypeError(`indexed metadata fetch returned an invalid response for ${path}`);
    }
    return {
      status: 'fetched',
      html: fetched.body,
      responseUrl: typeof fetched.responseUrl === 'string' ? fetched.responseUrl : null,
    };
  } catch (error) {
    skipIfPermanentlyMissing(error);
    return {
      status: error.status === 404 ? 'not_found' : 'gone',
      html: null,
      checkedAt: new Date(now()).toISOString(),
    };
  }
}
