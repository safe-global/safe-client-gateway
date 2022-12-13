import { Inject, Injectable } from '@nestjs/common';
import { SafeRepository } from '../../domain/safe/safe.repository';
import { ISafeRepository } from '../../domain/safe/safe.repository.interface';
import { Page } from '../common/entities/page.entity';
import {
  cursorUrlFromLimitAndOffset,
  PaginationData,
} from '../common/pagination/pagination.data';
import { IncomingTransfer } from './entities/incoming-transfer.entity';
import { MultisigTransaction } from './entities/multisig-transaction.entity';
import { MultisigTransactionMapper } from './mappers/multisig-transaction.mapper';
import { IncomingTransferMapper } from './mappers/transaction.mapper';

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(ISafeRepository) private readonly safeRepository: SafeRepository,
    private readonly multisigTransactionMapper: MultisigTransactionMapper,
    private readonly incomingTransferMapper: IncomingTransferMapper,
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
        transaction:
          await this.multisigTransactionMapper.mapToTransactionSummary(
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

  async getIncomingTransfers(
    chainId: string,
    routeUrl: Readonly<URL>,
    safeAddress: string,
    executionDateGte?: string,
    executionDateLte?: string,
    to?: string,
    value?: string,
    tokenAddress?: string,
    paginationData?: PaginationData,
  ): Promise<Partial<Page<IncomingTransfer>>> {
    const transfers = await this.safeRepository.getIncomingTransfers(
      chainId,
      safeAddress,
      executionDateGte,
      executionDateLte,
      to,
      value,
      tokenAddress,
      paginationData?.limit,
      paginationData?.offset,
    );

    const safeInfo = await this.safeRepository.getSafe(chainId, safeAddress);
    const results = await Promise.all(
      transfers.results.map(async (transfer) => ({
        type: 'TRANSACTION',
        transaction: await this.incomingTransferMapper.mapToTransactionSummary(
          chainId,
          transfer,
          safeInfo,
        ),
        conflictType: 'None',
      })),
    );

    const nextURL = cursorUrlFromLimitAndOffset(routeUrl, transfers.next);
    const previousURL = cursorUrlFromLimitAndOffset(
      routeUrl,
      transfers.previous,
    );

    return {
      next: nextURL?.toString(),
      previous: previousURL?.toString(),
      results,
    };
  }
}
