// SPDX-License-Identifier: FSL-1.1-MIT
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import type { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '#/modules/auth/utils/assert-authenticated.utils';
import type { Space } from '#/modules/spaces/domain/entities/space.entity';
import { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';
import { assertMember } from '#/modules/spaces/domain/space-assert.utils';
import type { ProposeTransactionDto } from '#/modules/transactions/domain/entities/propose-transaction.dto.entity';
import type { QueuedItem } from '#/modules/transactions/routes/entities/queued-item.entity';
import type { TransactionDetails } from '#/modules/transactions/routes/entities/transaction-details/transaction-details.entity';
import { TransactionsService } from '#/modules/transactions/routes/transactions.service';
import { IMembersRepository } from '#/modules/users/domain/members/members.repository.interface';
import type { Page } from '#/routes/common/entities/page.entity';
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
    chainId: string;
    routeUrl: Readonly<URL>;
    safeAddress: Address;
    paginationData: PaginationData;
    authPayload: AuthPayload;
  }): Promise<Page<QueuedItem>> {
    await this.assertSafeOfMemberSpace(args);
    return this.transactionsService.getTransactionQueue(args);
  }

  public async proposeTransaction(args: {
    spaceId: Space['id'];
    chainId: string;
    safeAddress: Address;
    proposeTransactionDto: ProposeTransactionDto;
    authPayload: AuthPayload;
  }): Promise<TransactionDetails> {
    await this.assertSafeOfMemberSpace(args);
    return this.transactionsService.proposeTransaction(args);
  }

  private async assertSafeOfMemberSpace(args: {
    spaceId: Space['id'];
    chainId: string;
    safeAddress: Address;
    authPayload: AuthPayload;
  }): Promise<void> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertMember(this.membersRepository, args.spaceId, userId);

    const isSafeInSpace = await this.spaceSafesRepository.existsInSpace({
      spaceId: args.spaceId,
      chainId: args.chainId,
      address: args.safeAddress,
    });
    if (!isSafeInSpace) {
      throw new ForbiddenException('Safe is not registered to this Workspace.');
    }
  }
}
