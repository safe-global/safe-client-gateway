// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '#/config/configuration.service.interface';
import type { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '#/modules/auth/utils/assert-authenticated.utils';
import type { Space } from '#/modules/spaces/domain/entities/space.entity';
import { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';
import { assertMember } from '#/modules/spaces/domain/space-assert.utils';
import type { SpaceQueueLimits } from '#/modules/transactions/routes/entities/space-queue-limits.dto.entity';
import type { SpaceTransactionQueue } from '#/modules/transactions/routes/entities/space-transaction-queue.entity';
import { TransactionsService } from '#/modules/transactions/routes/transactions.service';
import { IMembersRepository } from '#/modules/users/domain/members/members.repository.interface';

@Injectable()
export class SpaceTransactionsService {
  private readonly pageSize: number;

  public constructor(
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(ISpaceSafesRepository)
    private readonly spaceSafesRepository: ISpaceSafesRepository,
    private readonly transactionsService: TransactionsService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.pageSize = this.configurationService.getOrThrow<number>(
      'spaces.transactionQueue.pageSize',
    );
  }

  public async getTransactionQueue(args: {
    spaceId: Space['id'];
    authPayload: AuthPayload;
    routeUrl: Readonly<URL>;
    limits: SpaceQueueLimits;
  }): Promise<SpaceTransactionQueue> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertMember(this.membersRepository, args.spaceId, userId);

    const spaceSafes = await this.spaceSafesRepository.findBySpaceId(
      args.spaceId,
    );

    return await this.transactionsService.getTransactionQueueForSafes({
      spaceId: args.spaceId,
      safes: spaceSafes,
      routeUrl: args.routeUrl,
      pageSize: this.pageSize,
      limits: args.limits,
    });
  }
}
