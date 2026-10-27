// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '#/modules/auth/utils/assert-authenticated.utils';
import type { Space } from '#/modules/spaces/domain/entities/space.entity';
import { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';
import { assertMember } from '#/modules/spaces/domain/space-assert.utils';
import type { SpaceQueuedItemPage } from '#/modules/transactions/routes/entities/space-queued-item-page.entity';
import { TransactionsService } from '#/modules/transactions/routes/transactions.service';
import { IMembersRepository } from '#/modules/users/domain/members/members.repository.interface';
import type { PaginationData } from '#/routes/common/pagination/pagination.data';

@Injectable()
export class SpaceTransactionsService {
  public constructor(
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(ISpaceSafesRepository)
    private readonly spaceSafesRepository: ISpaceSafesRepository,
    private readonly transactionsService: TransactionsService,
  ) {}

  public async getTransactionQueue(args: {
    spaceId: Space['id'];
    authPayload: AuthPayload;
    routeUrl: Readonly<URL>;
    paginationData: PaginationData;
  }): Promise<SpaceQueuedItemPage> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertMember(this.membersRepository, args.spaceId, userId);

    const spaceSafes = await this.spaceSafesRepository.findBySpaceId(
      args.spaceId,
    );

    return await this.transactionsService.getTransactionQueueForSafes({
      safes: spaceSafes,
      routeUrl: args.routeUrl,
      paginationData: args.paginationData,
    });
  }
}
