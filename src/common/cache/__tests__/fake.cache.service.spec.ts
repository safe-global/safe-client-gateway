import { FakeCacheService } from './fake.cache.service';

describe('FakeCacheService', () => {
  let target: FakeCacheService;

  beforeEach(async () => {
    target = new FakeCacheService();
  });

  it(`sets key`, async () => {
    const key = 'test-key';
    const value = 'some-value';

    await target.set(key, value, 0);

    await expect(target.get(key)).resolves.toBe(value);
    expect(target.keyCount()).toBe(1);
  });

  it(`deletes key`, async () => {
    const key = 'test-key';
    const value = 'some-value';

    await target.set(key, value, 0);
    await target.delete(key);

    await expect(target.get(key)).resolves.toBe(undefined);
    expect(target.keyCount()).toBe(0);
  });

  it(`clears keys`, async () => {
    const actions: Promise<void>[] = [];
    for (let i = 0; i < 5; i++) {
      actions.push(target.set(`key${i}`, `value${i}`, 0));
    }

    await Promise.all(actions);
    target.clear();

    expect(target.keyCount()).toBe(0);
  });
});
