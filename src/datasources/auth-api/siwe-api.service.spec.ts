import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { SiweApi } from '@/datasources/auth-api/siwe-api.service';
import { toSignableSiweMessage } from '@/datasources/auth-api/utils/to-signable-siwe-message';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { siweMessageBuilder } from '@/domain/siwe/entities/__tests__/siwe-message.builder';
import { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const mockLoggingService = {
  debug: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('SiweApiService', () => {
  let service: SiweApi;
  let fakeConfigurationService: FakeConfigurationService;
  let fakeCacheService: FakeCacheService;
  const nonceTtlInSeconds = faker.number.int();

  beforeEach(async () => {
    jest.resetAllMocks();
    fakeConfigurationService = new FakeConfigurationService();
    fakeCacheService = new FakeCacheService();
    fakeConfigurationService.set('auth.nonceTtlSeconds', nonceTtlInSeconds);
    service = new SiweApi(
      mockLoggingService,
      fakeConfigurationService,
      fakeCacheService,
    );
  });

  describe('generateNonce', () => {
    it('should return an alphanumeric string of at least 8 characters', () => {
      const nonce = service.generateNonce();
      expect(nonce).toMatch(/^[a-zA-Z0-9]{8,}$/);
    });
  });

  describe('verifyMessage', () => {
    it('should return true if the message is verified', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const message = siweMessageBuilder()
        .with('address', signer.address)
        .build();
      const signature = await signer.signMessage({
        message: toSignableSiweMessage(message),
      });

      await expect(
        service.verifyMessage({
          message,
          signature,
        }),
      ).resolves.toBe(true);
    });

    it('should return false if the message is not verified', async () => {
      const message = siweMessageBuilder().build();
      const signature = faker.string.hexadecimal({
        length: 132,
      }) as `0x${string}`;

      await expect(
        service.verifyMessage({
          message,
          signature,
        }),
      ).resolves.toBe(false);
    });
  });

  describe('cacheNonce', () => {
    it('should cache the nonce', async () => {
      const nonce = faker.string.alphanumeric();

      await service.cacheNonce(nonce);

      await expect(
        fakeCacheService.get(new CacheDir(`auth_nonce_${nonce}`, '')),
      ).resolves.toBe(nonce);
    });
  });

  describe('getCachedNonce', () => {
    it('should return the cached nonce', async () => {
      const nonce = faker.string.alphanumeric();

      await service.cacheNonce(nonce);
      const expected = await service.getCachedNonce(nonce);

      expect(expected).toBe(nonce);
    });
  });

  describe('clearCachedNonce', () => {
    it('should clear the cached nonce', async () => {
      const nonce = faker.string.alphanumeric();

      await service.cacheNonce(nonce);
      await service.clearCachedNonce(nonce);

      await expect(
        fakeCacheService.get(new CacheDir(`auth_nonce_${nonce}`, '')),
      ).resolves.toBe(undefined);
    });
  });
});
