// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { LimitReachedError } from '#/datasources/network/entities/errors/limit-reached.error';
import type { ZerionChainMappingService } from '#/modules/zerion/datasources/zerion-chain-mapping.service';
import type { ZerionRateLimiter } from '#/modules/zerion/datasources/zerion-rate-limiter.service';
import { ZerionRepository } from '#/modules/zerion/domain/zerion.repository';

describe('ZerionRepository', () => {
  const mockChainMappingService = {
    getChainIdToNetworkMapping: vi.fn(),
  } as MockedObject<ZerionChainMappingService>;
  const mockRateLimiter = {
    assertWithinBudget: vi.fn(),
  } as MockedObject<ZerionRateLimiter>;
  const repository = new ZerionRepository(
    mockChainMappingService,
    mockRateLimiter,
  );
  const args = {
    datasource: faker.word.noun(),
    address: getAddress(faker.finance.ethereumAddress()),
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('spends the shared Zerion budget', async () => {
    await repository.assertWithinBudget(args);

    expect(mockRateLimiter.assertWithinBudget).toHaveBeenCalledWith(args);
  });

  it('rejects when the budget is exhausted', async () => {
    const error = new LimitReachedError();
    mockRateLimiter.assertWithinBudget.mockRejectedValue(error);

    await expect(repository.assertWithinBudget(args)).rejects.toBe(error);
  });
});
