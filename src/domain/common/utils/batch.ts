// SPDX-License-Identifier: FSL-1.1-MIT
import chunk from 'lodash/chunk';

/**
 * Runs {@link fn} over {@link items} in fixed-size batches: every batch's items
 * are read concurrently, and batches themselves run one after another, so an
 * upstream call never sees more than {@link batchSize} requests from this call
 * in flight at once.
 *
 * One item rejecting never fails the others.
 *
 * Order-preserving: result `i` is `fn`'s settled result for `items[i]`.
 */
export async function batched<T, R>(
  items: ReadonlyArray<T>,
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<Array<PromiseSettledResult<R>>> {
  const results: Array<Array<PromiseSettledResult<R>>> = [];

  for (const batch of chunk(items, batchSize)) {
    results.push(await Promise.allSettled(batch.map(fn)));
  }

  return results.flat();
}
