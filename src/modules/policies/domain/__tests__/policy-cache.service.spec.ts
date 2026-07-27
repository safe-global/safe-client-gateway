// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { ITransactionApi } from '@/domain/interfaces/transaction-api.interface';
import type { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { PolicyCacheService } from '@/modules/policies/domain/policy-cache.service';

const mockTransactionApi = {
  clearPolicyConfirmations: vi.fn(),
  clearPolicyRootRequests: vi.fn(),
} as MockedObject<ITransactionApi>;

const mockTransactionApiManager = {
  getApi: vi.fn(),
} as MockedObject<ITransactionApiManager>;

describe('PolicyCacheService', () => {
  let service: PolicyCacheService;
  const chainId = faker.string.numeric({ length: 3 });
  const safeAddress = getAddress(faker.finance.ethereumAddress());

  beforeEach(() => {
    vi.resetAllMocks();
    mockTransactionApiManager.getApi.mockResolvedValue(mockTransactionApi);
    service = new PolicyCacheService(mockTransactionApiManager);
  });

  it('should clear both policy caches of the Safe', async () => {
    await service.clearPolicies({ chainId, safeAddress });

    expect(mockTransactionApiManager.getApi).toHaveBeenCalledWith(chainId);
    expect(mockTransactionApi.clearPolicyConfirmations).toHaveBeenCalledWith(
      safeAddress,
    );
    expect(mockTransactionApi.clearPolicyRootRequests).toHaveBeenCalledWith(
      safeAddress,
    );
  });

  it('should propagate a failure to clear', async () => {
    mockTransactionApi.clearPolicyConfirmations.mockRejectedValue(
      new Error('Cache unavailable'),
    );

    await expect(
      service.clearPolicies({ chainId, safeAddress }),
    ).rejects.toThrow('Cache unavailable');
  });
});
