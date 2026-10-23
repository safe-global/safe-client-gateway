// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { ForbiddenException } from '@nestjs/common';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '#/config/__tests__/fake.configuration.service';
import { siweAuthPayloadDtoBuilder } from '#/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import type { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';
import type { SpaceTransactionQueue } from '#/modules/transactions/routes/entities/space-transaction-queue.entity';
import { SpaceTransactionsService } from '#/modules/transactions/routes/space-transactions.service';
import type { TransactionsService } from '#/modules/transactions/routes/transactions.service';
import { memberBuilder } from '#/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import type { IMembersRepository } from '#/modules/users/domain/members/members.repository.interface';

const mockMembersRepository = vi.mocked({
  findOne: vi.fn(),
} as MockedObject<IMembersRepository>);

const mockSpaceSafesRepository = vi.mocked({
  findBySpaceId: vi.fn(),
} as MockedObject<ISpaceSafesRepository>);

const mockTransactionsService = {
  getTransactionQueueForSafes: vi.fn(),
} as unknown as MockedObject<TransactionsService>;

describe('SpaceTransactionsService', () => {
  let target: SpaceTransactionsService;
  const spaceId = faker.number.int({ min: 1 });
  const authPayloadDto = siweAuthPayloadDtoBuilder().build();
  const userId = Number(authPayloadDto.sub);
  const authPayload = new AuthPayload(authPayloadDto);
  const routeUrl = new URL(faker.internet.url());
  const pageSize = faker.number.int({ min: 1, max: 20 });
  const spaceSafes = [
    {
      chainId: faker.string.numeric({ length: 3 }),
      address: getAddress(faker.finance.ethereumAddress()),
    },
    {
      chainId: faker.string.numeric({ length: 4 }),
      address: getAddress(faker.finance.ethereumAddress()),
    },
  ];
  const limits = [
    {
      safeAddress: spaceSafes[0].address,
      limit: faker.number.int({ min: 1, max: 99 }),
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    const configurationService = new FakeConfigurationService();
    configurationService.set('spaces.transactionQueue.pageSize', pageSize);
    target = new SpaceTransactionsService(
      mockMembersRepository,
      mockSpaceSafesRepository,
      mockTransactionsService,
      configurationService,
    );
  });

  it('returns the queue of every Safe in the Space, with the requested limits, to an active member', async () => {
    const queue: SpaceTransactionQueue = { results: [], unavailableSafes: [] };
    mockMembersRepository.findOne.mockResolvedValue(
      memberBuilder().with('id', userId).build(),
    );
    mockSpaceSafesRepository.findBySpaceId.mockResolvedValue(spaceSafes);
    mockTransactionsService.getTransactionQueueForSafes.mockResolvedValue(
      queue,
    );

    const actual = await target.getTransactionQueue({
      spaceId,
      authPayload,
      routeUrl,
      limits,
    });

    expect(actual).toBe(queue);
    expect(mockMembersRepository.findOne).toHaveBeenCalledWith({
      user: { id: userId },
      space: { id: spaceId },
      status: 'ACTIVE',
    });
    expect(
      mockTransactionsService.getTransactionQueueForSafes,
    ).toHaveBeenCalledWith({
      spaceId,
      safes: spaceSafes,
      routeUrl,
      pageSize,
      limits,
    });
  });

  it('rejects a caller who is not an active member of the Space', async () => {
    mockMembersRepository.findOne.mockResolvedValue(null);

    await expect(
      target.getTransactionQueue({ spaceId, authPayload, routeUrl, limits }),
    ).rejects.toThrow(
      new ForbiddenException('User is not a member of this workspace'),
    );

    expect(mockSpaceSafesRepository.findBySpaceId).not.toHaveBeenCalled();
    expect(
      mockTransactionsService.getTransactionQueueForSafes,
    ).not.toHaveBeenCalled();
  });
});
