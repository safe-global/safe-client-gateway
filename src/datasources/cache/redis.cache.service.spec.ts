// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { RedisClientType } from '@/datasources/cache/cache.module';
import { RedisCacheService } from '@/datasources/cache/redis.cache.service';
import type { ILoggingService } from '@/logging/logging.interface';

describe('RedisCacheService.setCounter', () => {
  it('reads the latest counter value after repeated writes with a key prefix', async () => {
    const values = new Map<string, string>();
    const client = {
      set: vi.fn((key: string, value: number, options: { NX?: boolean }) => {
        if (options.NX && values.has(key)) return Promise.resolve(null);
        values.set(key, String(value));
        return Promise.resolve('OK');
      }),
      get: vi.fn((key: string) => Promise.resolve(values.get(key) ?? null)),
    } as unknown as MockedObject<RedisClientType>;
    const config = new FakeConfigurationService();
    config.set('expirationTimeInSeconds.default', 60);
    config.set('expirationTimeInSeconds.deviatePercent', 0);
    const service = new RedisCacheService(
      client,
      {} as MockedObject<ILoggingService>,
      config,
      faker.string.alphanumeric(),
    );
    const key = faker.string.alphanumeric();
    const first = faker.number.int({ min: 1, max: 100 });
    await service.setCounter(key, first, 60);
    await service.setCounter(key, first + 1, 60);
    expect(await service.getCounter(key)).toBe(first + 1);
  });
});
