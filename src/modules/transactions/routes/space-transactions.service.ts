// SPDX-License-Identifier: FSL-1.1-MIT
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { HttpExceptionNoLog } from '#/domain/common/errors/http-exception-no-log.error';
import type { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '#/modules/auth/utils/assert-authenticated.utils';
import { IChainsRepository } from '#/modules/chains/domain/chains.repository.interface';
import { IAddressBookItemsRepository } from '#/modules/spaces/domain/address-books/address-book-items.repository.interface';
import type { Space } from '#/modules/spaces/domain/entities/space.entity';
import { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';
import { assertMember } from '#/modules/spaces/domain/space-assert.utils';
import type { SpaceQueuedItemPage } from '#/modules/transactions/routes/entities/space-queued-item-page.entity';
import {
  filterSpaceQueue,
  getSpaceQueueCounts,
  type SpaceQueueFilters,
  type SpaceQueueSearch,
} from '#/modules/transactions/routes/helpers/space-queue.helper';
import { TransactionsService } from '#/modules/transactions/routes/transactions.service';
import { IMembersRepository } from '#/modules/users/domain/members/members.repository.interface';
import { IWalletsRepository } from '#/modules/wallets/domain/wallets.repository.interface';

const isDefined = (value: unknown): boolean => value !== undefined;

@Injectable()
export class SpaceTransactionsService {
  public constructor(
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(ISpaceSafesRepository)
    private readonly spaceSafesRepository: ISpaceSafesRepository,
    @Inject(IWalletsRepository)
    private readonly walletsRepository: IWalletsRepository,
    private readonly transactionsService: TransactionsService,
    @Inject(IAddressBookItemsRepository)
    private readonly addressBookItemsRepository: IAddressBookItemsRepository,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
  ) {}

  public async getTransactionQueue(args: {
    spaceId: Space['id'];
    authPayload: AuthPayload;
    filters?: Omit<SpaceQueueFilters, 'search'>;
    /** Trimmed and lowercased */
    search?: string;
    /** Read only the first transactions, by nonce across every Safe */
    limit?: number;
  }): Promise<SpaceQueuedItemPage> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertMember(this.membersRepository, args.spaceId, userId);

    // The filters and counts run on the queue read: on a limited read, they
    // would miss the transactions left unread.
    if (
      args.limit !== undefined &&
      (args.search || Object.values(args.filters ?? {}).some(isDefined))
    ) {
      throw new HttpExceptionNoLog(
        'limit cannot be combined with a filter or a search',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const [spaceSafes, wallets] = await Promise.all([
      this.spaceSafesRepository.findBySpaceId(args.spaceId),
      this.walletsRepository.findByUser(userId),
    ]);

    const queue = await this.transactionsService.getTransactionQueueForSafes({
      spaceId: args.spaceId,
      safes: spaceSafes.map(({ chainId, address }) => ({
        chainId,
        safeAddress: address,
      })),
      limit: args.limit,
    });

    // "sign" is the caller's own: a wallet linked to the authenticated user
    const signers = wallets.map(({ address }) => address);
    const now = Date.now();
    const filters: SpaceQueueFilters = {
      ...args.filters,
      search: args.search
        ? await this.getSearch({
            spaceId: args.spaceId,
            query: args.search,
            chainIds: Object.values(queue.results).flatMap(Object.keys),
          })
        : undefined,
    };

    return {
      ...queue,
      ...filterSpaceQueue({
        results: queue.results,
        unavailableSafes: queue.unavailableSafes,
        filters,
        signers,
        now,
      }),
      counts: getSpaceQueueCounts({
        results: queue.results,
        filters,
        signers,
        now,
      }),
    };
  }

  private async getSearch(args: {
    spaceId: Space['id'];
    query: string;
    chainIds: Array<string>;
  }): Promise<SpaceQueueSearch> {
    const [addressBookItems, chains] = await Promise.all([
      this.addressBookItemsRepository.findAllBySpaceId(args.spaceId),
      Promise.allSettled(
        [...new Set(args.chainIds)].map((chainId) =>
          this.chainsRepository.getChain(chainId),
        ),
      ),
    ]);

    const names = new Map<string, Array<string>>();
    for (const { address, name } of addressBookItems) {
      const key = address.toLowerCase();
      names.set(key, [...(names.get(key) ?? []), name]);
    }
    // A chain that cannot be loaded is only left out of the network names
    const chainNames = new Map(
      chains.flatMap((result) =>
        result.status === 'fulfilled'
          ? [[result.value.chainId, result.value.chainName] as const]
          : [],
      ),
    );

    return { query: args.query, names, chainNames };
  }
}
