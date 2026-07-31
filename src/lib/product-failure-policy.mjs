import { HttpStatusError } from './politeness.mjs';

// Indexed crawler cursors may advance only when the response proves that the
// product is permanently absent. Text in an unrelated error is not evidence.
export function skipIfPermanentlyMissing(error) {
  if (error instanceof HttpStatusError && (error.status === 404 || error.status === 410)) return true;
  throw error;
}

export async function fetchIndexedProduct(fetcher, path) {
  try {
    return { status: 'fetched', html: await fetcher.get(path) };
  } catch (error) {
    skipIfPermanentlyMissing(error);
    return { status: 'permanently_missing', html: null };
  }
}
