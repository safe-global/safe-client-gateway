// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { SafePolicyGuardApi } from '@/modules/policies/datasources/safe-policy-guard-api.service';
import { SafePolicyGuardRepository } from '@/modules/policies/domain/safe-policy-guard.repository';
import { rawify } from '@/validation/entities/raw.entity';

const mockSafePolicyGuardApi = {
  getExpiry: vi.fn(),
} as MockedObject<SafePolicyGuardApi>;

describe('SafePolicyGuardRepository', () => {
  let target: SafePolicyGuardRepository;
  const args = {
    chainId: faker.string.numeric({ length: { min: 1, max: 6 } }),
    guard: getAddress(faker.finance.ethereumAddress()),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    target = new SafePolicyGuardRepository(mockSafePolicyGuardApi);
  });

  it('should return EXPIRY in seconds', async () => {
    const expiry = faker.number.int({ min: 60, max: 31_536_000 });
    mockSafePolicyGuardApi.getExpiry.mockResolvedValue(rawify(String(expiry)));

    await expect(target.getExpiry(args)).resolves.toBe(expiry);
    expect(mockSafePolicyGuardApi.getExpiry).toHaveBeenCalledWith(args);
  });

  it('should reject an EXPIRY beyond the safe integer range', async () => {
    mockSafePolicyGuardApi.getExpiry.mockResolvedValue(
      rawify((2n ** 64n).toString()),
    );

    await expect(target.getExpiry(args)).rejects.toThrow();
  });
});
