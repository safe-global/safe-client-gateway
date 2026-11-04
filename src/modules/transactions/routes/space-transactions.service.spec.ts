// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { ForbiddenException } from '@nestjs/common';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { siweAuthPayloadDtoBuilder } from '#/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import type { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';
import { transferTransactionInfoBuilder } from '#/modules/transactions/routes/entities/__tests__/transfer-transaction-info.builder';
import { ConflictType } from '#/modules/transactions/routes/entities/conflict-type.entity';
import { MultisigExecutionInfo } from '#/modules/transactions/routes/entities/multisig-execution-info.entity';
import {
  LabelItem,
  LabelQueuedItem,
} from '#/modules/transactions/routes/entities/queued-items/label-queued-item.entity';
import { TransactionQueuedItem } from '#/modules/transactions/routes/entities/queued-items/transaction-queued-item.entity';
import type { SpaceQueue } from '#/modules/transactions/routes/entities/space-queued-item-page.entity';
import { Transaction } from '#/modules/transactions/routes/entities/transaction.entity';
import { TransactionStatus } from '#/modules/transactions/routes/entities/transaction-status.entity';
import { SpaceTransactionsService } from '#/modules/transactions/routes/space-transactions.service';
import type { TransactionsService } from '#/modules/transactions/routes/transactions.service';
import { memberBuilder } from '#/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import type { IMembersRepository } from '#/modules/users/domain/members/members.repository.interface';
import { walletBuilder } from '#/modules/wallets/datasources/entities/__tests__/wallets.entity.db.builder';
import type { IWalletsRepository } from '#/modules/wallets/domain/wallets.repository.interface';
import { AddressInfo } from '#/routes/common/entities/address-info.entity';

const mockMembersRepository = vi.mocked({
  findOne: vi.fn(),
} as MockedObject<IMembersRepository>);

const mockSpaceSafesRepository = vi.mocked({
  findBySpaceId: vi.fn(),
} as MockedObject<ISpaceSafesRepository>);

const mockWalletsRepository = vi.mocked({
  findByUser: vi.fn(),
} as MockedObject<IWalletsRepository>);

const awaitingSignatureFrom = (signer: string): TransactionQueuedItem =>
  new TransactionQueuedItem(
    new Transaction(
      faker.string.uuid(),
      Date.now(),
      TransactionStatus.AwaitingConfirmations,
      transferTransactionInfoBuilder().build(),
      new MultisigExecutionInfo(
        faker.number.int({ min: 0, max: 1_000 }),
        2,
        1,
        [new AddressInfo(signer)],
      ),
    ),
    ConflictType.None,
  );

const mockTransactionsService = {
  getTransactionQueueForSafes: vi.fn(),
} as unknown as MockedObject<TransactionsService>;

describe('SpaceTransactionsService', () => {
  let target: SpaceTransactionsService;
  const spaceId = faker.number.int({ min: 1 });
  const authPayloadDto = siweAuthPayloadDtoBuilder().build();
  const userId = Number(authPayloadDto.sub);
  const authPayload = new AuthPayload(authPayloadDto);

  beforeEach(() => {
    vi.resetAllMocks();
    target = new SpaceTransactionsService(
      mockMembersRepository,
      mockSpaceSafesRepository,
      mockWalletsRepository,
      mockTransactionsService,
    );
    mockWalletsRepository.findByUser.mockResolvedValue([]);
  });

  it('returns the queue of every Safe in the Space to an active member', async () => {
    const safes = [
      {
        chainId: faker.string.numeric({ length: 3 }),
        address: getAddress(faker.finance.ethereumAddress()),
      },
      {
        chainId: faker.string.numeric({ length: 4 }),
        address: getAddress(faker.finance.ethereumAddress()),
      },
    ];
    const page: SpaceQueue = {
      count: 0,
      next: null,
      previous: null,
      results: {},
      unavailableSafes: [],
    };
    mockMembersRepository.findOne.mockResolvedValue(
      memberBuilder().with('id', userId).build(),
    );
    mockSpaceSafesRepository.findBySpaceId.mockResolvedValue(safes);
    mockTransactionsService.getTransactionQueueForSafes.mockResolvedValue(page);

    const actual = await target.getTransactionQueue({
      spaceId,
      authPayload,
    });

    expect(actual).toEqual({
      ...page,
      counts: {
        total: 0,
        execute: 0,
        sign: 0,
        blocked: 0,
        waiting: 0,
        conflicting: 0,
        stale: 0,
      },
    });
    expect(mockMembersRepository.findOne).toHaveBeenCalledWith({
      user: { id: userId },
      space: { id: spaceId },
      status: 'ACTIVE',
    });
    expect(
      mockTransactionsService.getTransactionQueueForSafes,
    ).toHaveBeenCalledWith({
      spaceId,
      safes: safes.map(({ chainId, address }) => ({
        chainId,
        safeAddress: address,
      })),
    });
  });

  it("counts the whole queue against the caller's wallets and filters only the results", async () => {
    const wallet = walletBuilder().build();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const chainId = faker.string.numeric({ length: 3 });
    const label = new LabelQueuedItem(LabelItem.Queued);
    const toSign = awaitingSignatureFrom(wallet.address);
    const toWait = awaitingSignatureFrom(
      getAddress(faker.finance.ethereumAddress()),
    );
    const page: SpaceQueue = {
      count: 2,
      next: null,
      previous: null,
      results: { [safeAddress]: { [chainId]: [label, toSign, toWait] } },
      unavailableSafes: [],
    };
    mockMembersRepository.findOne.mockResolvedValue(
      memberBuilder().with('id', userId).build(),
    );
    mockSpaceSafesRepository.findBySpaceId.mockResolvedValue([
      { chainId, address: safeAddress },
    ]);
    mockWalletsRepository.findByUser.mockResolvedValue([wallet]);
    mockTransactionsService.getTransactionQueueForSafes.mockResolvedValue(page);

    const actual = await target.getTransactionQueue({
      spaceId,
      authPayload,
      filters: { statuses: ['sign'] },
    });

    expect(mockWalletsRepository.findByUser).toHaveBeenCalledWith(userId);
    expect(actual.results).toEqual({
      [safeAddress]: { [chainId]: [label, toSign] },
    });
    expect(actual.count).toBe(2);
    expect(actual.counts).toMatchObject({ total: 2, sign: 1, waiting: 1 });
  });

  it('rejects a caller who is not an active member of the Space', async () => {
    mockMembersRepository.findOne.mockResolvedValue(null);

    await expect(
      target.getTransactionQueue({
        spaceId,
        authPayload,
      }),
    ).rejects.toThrow(
      new ForbiddenException('User is not a member of this workspace'),
    );

    expect(mockSpaceSafesRepository.findBySpaceId).not.toHaveBeenCalled();
    expect(mockWalletsRepository.findByUser).not.toHaveBeenCalled();
    expect(
      mockTransactionsService.getTransactionQueueForSafes,
    ).not.toHaveBeenCalled();
  });
});
