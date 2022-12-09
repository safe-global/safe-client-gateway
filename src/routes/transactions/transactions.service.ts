import { Inject, Injectable } from '@nestjs/common';
import { SafeRepository } from '../../domain/safe/safe.repository';
import { ISafeRepository } from '../../domain/safe/safe.repository.interface';
import { Page } from '../common/entities/page.entity';
import {
  cursorUrlFromLimitAndOffset,
  PaginationData,
} from '../common/pagination/pagination.data';
import { MultisigTransaction } from './entities/multisig-transaction.entity';
import { MultisigTransactionMapper } from './mappers/multisig-transaction.mapper';

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(ISafeRepository) private readonly safeRepository: SafeRepository,
    private readonly mapper: MultisigTransactionMapper,
  ) {}

  async getMultisigTransactions(
    chainId: string,
    routeUrl: Readonly<URL>,
    safeAddress: string,
    executionDateGte?: string,
    executionDateLte?: string,
    to?: string,
    value?: string,
    nonce?: string,
    executed?: boolean,
    paginationData?: PaginationData,
  ): Promise<Partial<Page<MultisigTransaction>>> {
    const transactions = await this.safeRepository.getMultisigTransactions(
      chainId,
      safeAddress,
      executed,
      executionDateGte,
      executionDateLte,
      to,
      value,
      nonce,
      paginationData?.limit,
      paginationData?.offset,
    );

    const safeInfo = await this.safeRepository.getSafe(chainId, safeAddress);
    const results = await Promise.all(
      transactions.results.map(async (multiSigTransaction) => ({
        type: 'TRANSACTION',
        transaction: await this.mapper.mapToTransactionSummary(
          chainId,
          multiSigTransaction,
          safeInfo,
        ),
        conflictType: 'None',
      })),
    );
    const nextURL = cursorUrlFromLimitAndOffset(routeUrl, transactions.next);
    const previousURL = cursorUrlFromLimitAndOffset(
      routeUrl,
      transactions.previous,
    );

    return {
      next: nextURL?.toString(),
      previous: previousURL?.toString(),
      results,
    };
  }
}
