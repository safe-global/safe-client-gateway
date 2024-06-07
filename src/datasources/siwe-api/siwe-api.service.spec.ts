import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { SiweApi } from '@/datasources/siwe-api/siwe-api.service';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { faker } from '@faker-js/faker';

describe('SiweApiService', () => {
  let service: SiweApi;
  let fakeConfigurationService: FakeConfigurationService;
  let fakeCacheService: FakeCacheService;
  const nonceTtlInSeconds = faker.number.int();

  beforeEach(() => {
    jest.resetAllMocks();
    fakeConfigurationService = new FakeConfigurationService();
    fakeCacheService = new FakeCacheService();
    fakeConfigurationService.set('auth.nonceTtlSeconds', nonceTtlInSeconds);
    service = new SiweApi(fakeConfigurationService, fakeCacheService);
  });

  describe('storeNonce', () => {
    it('should stored the nonce', async () => {
      const nonce = faker.string.alphanumeric();

      await service.storeNonce(nonce);

      await expect(
        fakeCacheService.get(new CacheDir(`auth_nonce_${nonce}`, '')),
      ).resolves.toBe(nonce);
    });
  });

  describe('getNonce', () => {
    it('should return the stored nonce', async () => {
      const nonce = faker.string.alphanumeric();

      await service.storeNonce(nonce);
      const expected = await service.getNonce(nonce);

      expect(expected).toBe(nonce);
    });
  });

  describe('clearNonce', () => {
    it('should clear the stored nonce', async () => {
      const nonce = faker.string.alphanumeric();

      await service.storeNonce(nonce);
      await service.clearNonce(nonce);

      await expect(
        fakeCacheService.get(new CacheDir(`auth_nonce_${nonce}`, '')),
      ).resolves.toBe(undefined);
    });
  });
});
