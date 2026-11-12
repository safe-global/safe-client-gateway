// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { ForbiddenException } from '@nestjs/common';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { siweAuthPayloadDtoBuilder } from '#/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import type { IChainsRepository } from '#/modules/chains/domain/chains.repository.interface';
import { chainBuilder } from '#/modules/chains/domain/entities/__tests__/chain.builder';
import type { IAddressBookItemsRepository } from '#/modules/spaces/domain/address-books/address-book-items.repository.interface';
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

const awaitingSignatureFrom = (
  signer: string,
  nonce = faker.number.int({ min: 0, max: 1_000 }),
): TransactionQueuedItem =>
  new TransactionQueuedItem(
    new Transaction(
      faker.string.uuid(),
      Date.now(),
      TransactionStatus.AwaitingConfirmations,
      transferTransactionInfoBuilder().build(),
      new MultisigExecutionInfo(nonce, 2, 1, [new AddressInfo(signer)]),
    ),
    ConflictType.None,
  );

const mockTransactionsService = {
  getTransactionQueueForSafes: vi.fn(),
} as unknown as MockedObject<TransactionsService>;

const mockAddressBookItemsRepository = vi.mocked({
  findAllBySpaceId: vi.fn(),
} as MockedObject<IAddressBookItemsRepository>);

const mockChainsRepository = vi.mocked({
  getChain: vi.fn(),
} as MockedObject<IChainsRepository>);

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
      mockAddressBookItemsRepository,
      mockChainsRepository,
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
        safes: [],
        chains: [],
        signers: [],
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
    expect(actual.counts).toMatchObject({
      total: 2,
      sign: 1,
      waiting: 1,
      safes: [{ chainId, safeAddress, count: 1 }],
    });
  });

  describe('search', () => {
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const chainId = faker.string.numeric({ length: 3 });
    const signer = getAddress(faker.finance.ethereumAddress());
    const toSign = awaitingSignatureFrom(signer);

    beforeEach(() => {
      mockMembersRepository.findOne.mockResolvedValue(
        memberBuilder().with('id', userId).build(),
      );
      mockSpaceSafesRepository.findBySpaceId.mockResolvedValue([
        { chainId, address: safeAddress },
      ]);
      mockTransactionsService.getTransactionQueueForSafes.mockResolvedValue({
        count: 1,
        next: null,
        previous: null,
        results: { [safeAddress]: { [chainId]: [toSign] } },
        unavailableSafes: [],
      });
      mockAddressBookItemsRepository.findAllBySpaceId.mockResolvedValue([]);
      mockChainsRepository.getChain.mockResolvedValue(
        chainBuilder()
          .with('chainId', chainId)
          .with('chainName', 'Unrelated chain')
          .build(),
      );
    });

    it('matches the Space address book names of Safes and signers', async () => {
      mockAddressBookItemsRepository.findAllBySpaceId.mockResolvedValue([
        { chainIds: [chainId], address: signer, name: 'Alice' },
      ] as Awaited<
        ReturnType<IAddressBookItemsRepository['findAllBySpaceId']>
      >);

      const actual = await target.getTransactionQueue({
        spaceId,
        authPayload,
        search: 'alice',
      });

      expect(
        mockAddressBookItemsRepository.findAllBySpaceId,
      ).toHaveBeenCalledWith(spaceId);
      expect(actual.results).toEqual({
        [safeAddress]: { [chainId]: [toSign] },
      });
      expect(actual.counts.total).toBe(1);
    });

    it('matches the network names of the queued chains', async () => {
      mockChainsRepository.getChain.mockResolvedValue(
        chainBuilder()
          .with('chainId', chainId)
          .with('chainName', 'Gnosis Chain')
          .build(),
      );

      const actual = await target.getTransactionQueue({
        spaceId,
        authPayload,
        search: 'gnosis',
      });

      expect(mockChainsRepository.getChain).toHaveBeenCalledWith(chainId);
      expect(actual.results).toEqual({
        [safeAddress]: { [chainId]: [toSign] },
      });
    });

    it('still searches the rest when a chain cannot be loaded', async () => {
      mockChainsRepository.getChain.mockRejectedValue(new Error('down'));

      const actual = await target.getTransactionQueue({
        spaceId,
        authPayload,
        search: 'waiting',
      });

      expect(actual.results).toEqual({
        [safeAddress]: { [chainId]: [toSign] },
      });
    });

    it('leaves out what does not match', async () => {
      const actual = await target.getTransactionQueue({
        spaceId,
        authPayload,
        search: 'no such thing',
      });

      expect(actual.results).toEqual({});
      expect(actual.counts.total).toBe(0);
    });

    it('looks up no names without a search', async () => {
      await target.getTransactionQueue({ spaceId, authPayload });

      expect(
        mockAddressBookItemsRepository.findAllBySpaceId,
      ).not.toHaveBeenCalled();
      expect(mockChainsRepository.getChain).not.toHaveBeenCalled();
    });
  });

  describe('limit', () => {
    beforeEach(() => {
      mockMembersRepository.findOne.mockResolvedValue(
        memberBuilder().with('id', userId).build(),
      );
      mockSpaceSafesRepository.findBySpaceId.mockResolvedValue([]);
    });

    it('passes the limit on to the queue read and keeps the whole-queue count', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric({ length: 3 });
      const item = awaitingSignatureFrom(
        getAddress(faker.finance.ethereumAddress()),
      );
      const limit = faker.number.int({ min: 1, max: 100 });
      const count = faker.number.int({ min: limit + 1, max: 1_000 });
      mockTransactionsService.getTransactionQueueForSafes.mockResolvedValue({
        count,
        next: null,
        previous: null,
        results: { [safeAddress]: { [chainId]: [item] } },
        unavailableSafes: [],
      });

      const actual = await target.getTransactionQueue({
        spaceId,
        authPayload,
        limit,
      });

      expect(
        mockTransactionsService.getTransactionQueueForSafes,
      ).toHaveBeenCalledWith({ spaceId, safes: [], limit });
      expect(actual.count).toBe(count);
      expect(actual.results).toEqual({
        [safeAddress]: { [chainId]: [item] },
      });
      expect(actual.counts.total).toBe(1);
    });

    it('reads the whole queue when filtered, and keeps the first matches up to the limit', async () => {
      const signer = getAddress(faker.finance.ethereumAddress());
      mockWalletsRepository.findByUser.mockResolvedValue([
        walletBuilder().with('address', signer).build(),
      ]);
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric({ length: 3 });
      const nonce = faker.number.int({ min: 0, max: 100 });
      const matching = [nonce, nonce + 2, nonce + 3].map((n) =>
        awaitingSignatureFrom(signer, n),
      );
      const other = awaitingSignatureFrom(
        getAddress(faker.finance.ethereumAddress()),
        nonce + 1,
      );
      const count = faker.number.int({ min: 4, max: 1_000 });
      mockTransactionsService.getTransactionQueueForSafes.mockResolvedValue({
        count,
        next: null,
        previous: null,
        results: {
          [safeAddress]: {
            [chainId]: [matching[0], other, matching[1], matching[2]],
          },
        },
        unavailableSafes: [],
      });

      const actual = await target.getTransactionQueue({
        spaceId,
        authPayload,
        filters: { statuses: ['sign'] },
        limit: 2,
      });

      expect(
        mockTransactionsService.getTransactionQueueForSafes,
      ).toHaveBeenCalledWith({ spaceId, safes: [], limit: undefined });
      expect(actual.count).toBe(count);
      expect(actual.results).toEqual({
        [safeAddress]: { [chainId]: [matching[0], matching[1]] },
      });
      // The counts cover the whole queue read, not just the limited results
      expect(actual.counts.total).toBe(4);
      expect(actual.counts.sign).toBe(3);
    });
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
