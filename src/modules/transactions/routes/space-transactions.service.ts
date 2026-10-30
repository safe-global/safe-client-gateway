// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '#/modules/auth/utils/assert-authenticated.utils';
import type { Space } from '#/modules/spaces/domain/entities/space.entity';
import { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';
import { assertMember } from '#/modules/spaces/domain/space-assert.utils';
import type { SpaceQueuedItemPage } from '#/modules/transactions/routes/entities/space-queued-item-page.entity';
import {
  filterSpaceQueue,
  getSpaceQueueCounts,
  type SpaceQueueFilters,
} from '#/modules/transactions/routes/helpers/space-queue.helper';
import { TransactionsService } from '#/modules/transactions/routes/transactions.service';
import { IMembersRepository } from '#/modules/users/domain/members/members.repository.interface';
import { IWalletsRepository } from '#/modules/wallets/domain/wallets.repository.interface';

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
  ) {}

  public async getTransactionQueue(args: {
    spaceId: Space['id'];
    authPayload: AuthPayload;
    filters?: SpaceQueueFilters;
  }): Promise<SpaceQueuedItemPage> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertMember(this.membersRepository, args.spaceId, userId);

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
    });

    // "sign" is the caller's own: a wallet linked to the authenticated user
    const signers = wallets.map(({ address }) => address);
    const now = Date.now();

    return {
      ...queue,
      ...filterSpaceQueue({
        results: queue.results,
        unavailableSafes: queue.unavailableSafes,
        filters: args.filters ?? {},
        signers,
        now,
      }),
      counts: getSpaceQueueCounts({ results: queue.results, signers, now }),
    };
  }
}
