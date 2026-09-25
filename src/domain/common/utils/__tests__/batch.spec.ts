// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { batched } from '@/domain/common/utils/batch';

describe('batched', () => {
  it('should return the settled result of fn for every item, in order', async () => {
    const items = [1, 2, 3, 4, 5];

    const results = await batched(items, 2, (item) =>
      Promise.resolve(item * 2),
    );

    expect(results).toStrictEqual([
      { status: 'fulfilled', value: 2 },
      { status: 'fulfilled', value: 4 },
      { status: 'fulfilled', value: 6 },
      { status: 'fulfilled', value: 8 },
      { status: 'fulfilled', value: 10 },
    ]);
  });

  it('should never have more than batchSize items in flight at once', async () => {
    const items = Array.from({ length: 7 }, () => faker.string.uuid());
    const batchSize = 3;
    let inFlight = 0;
    let mostInFlight = 0;

    await batched(items, batchSize, async () => {
      inFlight += 1;
      mostInFlight = Math.max(mostInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
    });

    expect(mostInFlight).toBe(batchSize);
  });

  it('should return an empty array for no items', async () => {
    const fn = vi.fn();

    const results = await batched([], 5, fn);

    expect(results).toStrictEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });

  it('should not fail the whole call, or the rest of the batch, when one item rejects', async () => {
    const items = [1, 2, 3];
    const error = new Error('Service unavailable');

    const results = await batched(items, 2, (item) =>
      item === 2 ? Promise.reject(error) : Promise.resolve(item),
    );

    expect(results).toStrictEqual([
      { status: 'fulfilled', value: 1 },
      { status: 'rejected', reason: error },
      { status: 'fulfilled', value: 3 },
    ]);
  });

  it('should let a caller fail the whole call by rethrowing a rejected slot', async () => {
    // batched() itself never fails the call - a caller that wants Promise.all's
    // fail-the-whole-thing behaviour gets it by rethrowing explicitly.
    const items = [1, 2, 3];

    const results = await batched(items, 2, (item) =>
      item === 2
        ? Promise.reject(new Error('Service unavailable'))
        : Promise.resolve(item),
    );

    expect(() => {
      for (const result of results) {
        if (result.status === 'rejected') {
          throw result.reason;
        }
      }
    }).toThrow('Service unavailable');
  });
});
