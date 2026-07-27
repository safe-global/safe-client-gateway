// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { checkGuardIsApplied } from '@/__tests__/util/check-guard';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { PoliciesController } from '@/modules/policies/routes/policies.controller';
import { PoliciesService } from '@/modules/policies/routes/policies.service';

const mockPoliciesService = {
  getAvailablePolicies: vi.fn(),
  getActivePolicies: vi.fn(),
  getPendingPolicies: vi.fn(),
} as MockedObject<PoliciesService>;

describe('PoliciesController', () => {
  let controller: PoliciesController;
  const spaceId = faker.number.int({ min: 1, max: 100 });
  const safeId = {
    chainId: faker.string.numeric({ length: 3 }),
    address: getAddress(faker.finance.ethereumAddress()),
  };
  const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());

  beforeEach(() => {
    vi.resetAllMocks();
    controller = new PoliciesController(mockPoliciesService);
  });

  it('should require authentication on every endpoint', () => {
    const endpoints = Object.values(PoliciesController.prototype) as Array<
      (...args: Array<unknown>) => unknown
    >;

    for (const endpoint of endpoints) {
      checkGuardIsApplied(AuthGuard, endpoint);
    }
  });

  it.each([
    ['getAvailablePolicies' as const],
    ['getActivePolicies' as const],
    ['getPendingPolicies' as const],
  ])('%s should delegate to the service', async (method) => {
    const response = { items: [] };
    mockPoliciesService[method].mockResolvedValue(response as never);

    const result = await controller[method](spaceId, safeId, authPayload);

    expect(result).toBe(response);
    expect(mockPoliciesService[method]).toHaveBeenCalledWith({
      spaceId,
      safeId,
      authPayload,
    });
  });
});
