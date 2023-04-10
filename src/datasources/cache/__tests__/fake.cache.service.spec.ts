import { faker } from '@faker-js/faker';
import { range } from 'lodash';
import { CacheDir } from '../entities/cache-dir.entity';
import { FakeCacheService } from './fake.cache.service';

describe('FakeCacheService', () => {
  let target: FakeCacheService;

  beforeEach(async () => {
    target = new FakeCacheService();
  });

  it('sets key', async () => {
    const cacheDir = new CacheDir(
      faker.random.alphaNumeric(),
      faker.random.alphaNumeric(),
    );
    const value = faker.random.alphaNumeric();

    await target.set(cacheDir, value, 0);

    await expect(target.get(cacheDir)).resolves.toBe(value);
    expect(target.keyCount()).toBe(1);
  });

  it('deletes key', async () => {
    const cacheDir = new CacheDir(
      faker.random.alphaNumeric(),
      faker.random.alphaNumeric(),
    );
    const value = faker.random.alphaNumeric();

    await target.set(cacheDir, value, 0);
    await target.delete(cacheDir);

    await expect(target.get(cacheDir)).resolves.toBe(undefined);
    expect(target.keyCount()).toBe(0);
  });

  it('clears keys', async () => {
    const actions: Promise<void>[] = [];
    for (let i = 0; i < 5; i++) {
      actions.push(
        target.set(new CacheDir(`key${i}`, `field${i}`), `value${i}`, 0),
      );
    }

    await Promise.all(actions);
    target.clear();

    expect(target.keyCount()).toBe(0);
  });

  it('deletes keys by pattern', async () => {
    const prefix = faker.random.word();
    // insert 5 items matching the pattern
    await Promise.all(
      range(5).map(() =>
        target.set(new CacheDir(`${prefix}${faker.datatype.uuid()}`, ''), ''),
      ),
    );
    // insert 4 items not matching the pattern
    await Promise.all(
      range(4).map(() =>
        target.set(new CacheDir(`${faker.datatype.uuid()}`, ''), ''),
      ),
    );

    await target.deleteByPattern(`${prefix}*`);

    expect(target.keyCount()).toBe(4);
  });

  it('deletes keys by pattern (2)', async () => {
    const prefix = faker.random.word();
    const suffix = faker.random.word();
    // insert 5 items matching the pattern
    await Promise.all(
      range(5).map(() =>
        target.set(
          new CacheDir(`${prefix}_${faker.datatype.uuid()}_${suffix}`, ''),
          '',
        ),
      ),
    );
    // insert 4 items not matching the pattern
    await Promise.all(
      range(4).map(() =>
        target.set(new CacheDir(`${faker.datatype.uuid()}`, ''), ''),
      ),
    );

    await target.deleteByPattern(`${prefix}_*_${suffix}`);

    expect(target.keyCount()).toBe(4);
  });
});
