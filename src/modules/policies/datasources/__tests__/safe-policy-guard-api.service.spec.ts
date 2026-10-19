// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, type PublicClient } from 'viem';
import type { MockedObject } from 'vitest';
import { FakeCacheService } from '#/datasources/cache/__tests__/fake.cache.service';
import { CacheRouter } from '#/datasources/cache/cache.router';
import { HttpErrorFactory } from '#/datasources/errors/http-error-factory';
import { DataSourceError } from '#/domain/errors/data-source.error';
import type { IBlockchainApiManager } from '#/domain/interfaces/blockchain-api.manager.interface';
import type { ILoggingService } from '#/logging/logging.interface';
import { SafePolicyGuardApi } from '#/modules/policies/datasources/safe-policy-guard-api.service';
import { SafePolicyGuardAbi } from '#/modules/policies/domain/contracts/decoders/safe-policy-guard-decoder.helper';

const mockPublicClient = {
  readContract: vi.fn(),
} as MockedObject<PublicClient>;

const mockBlockchainApiManager = {
  getApi: vi.fn(),
  destroyApi: vi.fn(),
} as MockedObject<IBlockchainApiManager>;

const mockLoggingService = {
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

describe('SafePolicyGuardApi', () => {
  let target: SafePolicyGuardApi;
  let cacheService: FakeCacheService;
  const chainId = faker.string.numeric({ length: { min: 1, max: 6 } });
  const guard = getAddress(faker.finance.ethereumAddress());

  beforeEach(() => {
    vi.resetAllMocks();
    cacheService = new FakeCacheService();
    mockBlockchainApiManager.getApi.mockResolvedValue(mockPublicClient);
    target = new SafePolicyGuardApi(
      mockBlockchainApiManager,
      cacheService,
      mockLoggingService,
      new HttpErrorFactory(),
    );
  });

  it('should read EXPIRY from the guard on its chain', async () => {
    const expiry = faker.number.bigInt({ min: 60n, max: 31_536_000n });
    mockPublicClient.readContract.mockResolvedValue(expiry);

    await expect(target.getExpiry({ chainId, guard })).resolves.toBe(
      expiry.toString(),
    );
    expect(mockBlockchainApiManager.getApi).toHaveBeenCalledWith(chainId);
    expect(mockPublicClient.readContract).toHaveBeenCalledWith({
      address: guard,
      abi: SafePolicyGuardAbi,
      functionName: 'EXPIRY',
    });
  });

  it('should cache EXPIRY and not read it again', async () => {
    const expiry = faker.number.bigInt({ min: 60n, max: 31_536_000n });
    mockPublicClient.readContract.mockResolvedValue(expiry);

    await target.getExpiry({ chainId, guard });
    await expect(target.getExpiry({ chainId, guard })).resolves.toBe(
      expiry.toString(),
    );

    expect(mockPublicClient.readContract).toHaveBeenCalledTimes(1);
    await expect(
      cacheService.hGet(
        CacheRouter.getSafePolicyGuardCacheDir({
          chainId,
          guard,
          name: 'EXPIRY',
        }),
      ),
    ).resolves.toBe(expiry.toString());
  });

  it('should read DELAY from the guard and cache it apart from EXPIRY', async () => {
    const delay = faker.number.bigInt({ min: 60n, max: 86_400n });
    const expiry = delay + faker.number.bigInt({ min: 1n, max: 86_400n });
    mockPublicClient.readContract.mockImplementation(({ functionName }) =>
      Promise.resolve(functionName === 'DELAY' ? delay : expiry),
    );

    await expect(target.getDelay({ chainId, guard })).resolves.toBe(
      delay.toString(),
    );
    await expect(target.getExpiry({ chainId, guard })).resolves.toBe(
      expiry.toString(),
    );
    await expect(target.getDelay({ chainId, guard })).resolves.toBe(
      delay.toString(),
    );

    expect(mockPublicClient.readContract).toHaveBeenCalledTimes(2);
    expect(mockPublicClient.readContract).toHaveBeenCalledWith({
      address: guard,
      abi: SafePolicyGuardAbi,
      functionName: 'DELAY',
    });
  });

  it('should cache the immutables of two guards apart', async () => {
    const other = getAddress(faker.finance.ethereumAddress());
    const expiry = faker.number.bigInt({ min: 60n, max: 86_400n });
    const otherExpiry = expiry + faker.number.bigInt({ min: 1n, max: 86_400n });
    mockPublicClient.readContract.mockImplementation(({ address }) =>
      Promise.resolve(address === guard ? expiry : otherExpiry),
    );

    await target.getExpiry({ chainId, guard });
    await target.getExpiry({ chainId, guard: other });

    await expect(target.getExpiry({ chainId, guard })).resolves.toBe(
      expiry.toString(),
    );
    await expect(target.getExpiry({ chainId, guard: other })).resolves.toBe(
      otherExpiry.toString(),
    );
    expect(mockPublicClient.readContract).toHaveBeenCalledTimes(2);
  });

  it('should log a failed read and not cache it', async () => {
    const error = new Error(faker.lorem.sentence());
    mockPublicClient.readContract.mockRejectedValue(error);

    await expect(target.getExpiry({ chainId, guard })).rejects.toThrow(
      new DataSourceError('Service unavailable', 503),
    );
    expect(mockLoggingService.warn).toHaveBeenCalledWith({
      message: 'Could not read the EXPIRY of a SafePolicyGuard',
      chainId,
      guard,
      error: error.message,
    });
    expect(cacheService.keyCount()).toBe(0);
  });
});
