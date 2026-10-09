// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, type PublicClient } from 'viem';
import type { MockedObject } from 'vitest';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { DataSourceError } from '@/domain/errors/data-source.error';
import type { IBlockchainApiManager } from '@/domain/interfaces/blockchain-api.manager.interface';
import { SafePolicyGuardApi } from '@/modules/policies/datasources/safe-policy-guard-api.service';
import { SafePolicyGuardAbi } from '@/modules/policies/domain/contracts/decoders/safe-policy-guard-decoder.helper';

const mockPublicClient = {
  readContract: vi.fn(),
} as MockedObject<Pick<PublicClient, 'readContract'>>;

const mockBlockchainApiManager = {
  getApi: vi.fn(),
  destroyApi: vi.fn(),
} as MockedObject<IBlockchainApiManager>;

describe('SafePolicyGuardApi', () => {
  let target: SafePolicyGuardApi;
  let cacheService: FakeCacheService;
  const chainId = faker.string.numeric({ length: { min: 1, max: 6 } });
  const guard = getAddress(faker.finance.ethereumAddress());

  beforeEach(() => {
    vi.resetAllMocks();
    cacheService = new FakeCacheService();
    mockBlockchainApiManager.getApi.mockResolvedValue(
      mockPublicClient as unknown as PublicClient,
    );
    target = new SafePolicyGuardApi(mockBlockchainApiManager, cacheService);
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
        CacheRouter.getSafePolicyGuardExpiryCacheDir({ chainId, guard }),
      ),
    ).resolves.toBe(expiry.toString());
  });

  it('should not cache a failed read', async () => {
    mockPublicClient.readContract.mockRejectedValue(
      new Error('RPC unavailable'),
    );

    await expect(target.getExpiry({ chainId, guard })).rejects.toThrow(
      new DataSourceError(
        'Could not read the EXPIRY of a SafePolicyGuard: RPC unavailable',
        503,
      ),
    );
    expect(cacheService.keyCount()).toBe(0);
  });
});
