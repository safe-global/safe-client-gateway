import { Inject, Injectable } from '@nestjs/common';
import { MultisigTransaction as DomainMultisigTransaction } from '../../domain/safe/entities/multisig-transaction.entity';
import { SafeRepository } from '../../domain/safe/safe.repository';
import { ISafeRepository } from '../../domain/safe/safe.repository.interface';
import { Page } from '../common/entities/page.entity';
import {
  cursorUrlFromLimitAndOffset,
  PaginationData,
} from '../common/pagination/pagination.data';
import { ConflictType } from './entities/conflict-type.entity';
import { IncomingTransfer } from './entities/incoming-transfer.entity';
import { ModuleTransaction } from './entities/module-transaction.entity';
import { MultisigTransaction } from './entities/multisig-transaction.entity';
import { QueuedItem } from './entities/queued-item.entity';
import { ModuleTransactionMapper } from './mappers/module-transactions/module-transaction.mapper';
import { MultisigTransactionMapper } from './mappers/multisig-transactions/multisig-transaction.mapper';
import { QueuedItemsMapper } from './mappers/queued-items/queued-items.mapper';
import { IncomingTransferMapper } from './mappers/transfers/transfer.mapper';

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(ISafeRepository) private readonly safeRepository: SafeRepository,
    private readonly multisigTransactionMapper: MultisigTransactionMapper,
    private readonly incomingTransferMapper: IncomingTransferMapper,
    private readonly moduleTransactionMapper: ModuleTransactionMapper,
    private readonly queuedItemsMapper: QueuedItemsMapper,
  ) {}

  async getMultisigTransactions(
    chainId: string,
    routeUrl: Readonly<URL>,
    paginationData: PaginationData,
    safeAddress: string,
    executionDateGte?: string,
    executionDateLte?: string,
    to?: string,
    value?: string,
    nonce?: string,
    executed?: boolean,
  ): Promise<Partial<Page<MultisigTransaction>>> {
    const domainTransactions =
      await this.safeRepository.getMultisigTransactions(
        chainId,
        safeAddress,
        executed,
        executionDateGte,
        executionDateLte,
        to,
        value,
        nonce,
        paginationData.limit,
        paginationData.offset,
      );

    const safeInfo = await this.safeRepository.getSafe(chainId, safeAddress);
    const results = await Promise.all(
      domainTransactions.results.map(
        async (domainTransaction) =>
          new MultisigTransaction(
            await this.multisigTransactionMapper.mapTransaction(
              chainId,
              domainTransaction,
              safeInfo,
            ),
            ConflictType.None,
          ),
      ),
    );
    const nextURL = cursorUrlFromLimitAndOffset(
      routeUrl,
      domainTransactions.next,
    );
    const previousURL = cursorUrlFromLimitAndOffset(
      routeUrl,
      domainTransactions.previous,
    );

    return {
      next: nextURL?.toString() ?? null,
      previous: previousURL?.toString() ?? null,
      results,
    };
  }

  async getModuleTransactions(
    chainId: string,
    routeUrl: Readonly<URL>,
    safeAddress: string,
    to?: string,
    module?: string,
    paginationData?: PaginationData,
  ): Promise<Page<ModuleTransaction>> {
    const domainTransactions = await this.safeRepository.getModuleTransactions(
      chainId,
      safeAddress,
      to,
      module,
      paginationData?.limit,
      paginationData?.offset,
    );

    const safeInfo = await this.safeRepository.getSafe(chainId, safeAddress);

    const results = await Promise.all(
      domainTransactions.results.map(
        async (domainTransaction) =>
          new ModuleTransaction(
            await this.moduleTransactionMapper.mapTransaction(
              chainId,
              domainTransaction,
              safeInfo,
            ),
          ),
      ),
    );
    const nextURL = cursorUrlFromLimitAndOffset(
      routeUrl,
      domainTransactions.next,
    );
    const previousURL = cursorUrlFromLimitAndOffset(
      routeUrl,
      domainTransactions.previous,
    );

    const result = <Page<ModuleTransaction>>{
      next: nextURL?.toString() ?? null,
      previous: previousURL?.toString() ?? null,
      results,
    };

    return result;
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
      transfers.results.map(
        async (transfer) =>
          new IncomingTransfer(
            await this.incomingTransferMapper.mapTransfer(
              chainId,
              transfer,
              safeInfo,
            ),
          ),
      ),
    );

    const nextURL = cursorUrlFromLimitAndOffset(routeUrl, transfers.next);
    const previousURL = cursorUrlFromLimitAndOffset(
      routeUrl,
      transfers.previous,
    );

    return {
      next: nextURL?.toString() ?? null,
      previous: previousURL?.toString() ?? null,
      results,
    };
  }

  async getQueuedTransactions(
    chainId: string,
    routeUrl: Readonly<URL>,
    safeAddress: string,
    paginationData?: PaginationData,
  ): Promise<Page<QueuedItem>> {
    const pagination = this.getAdjustedPagination(paginationData);
    const transactions = await this.safeRepository.getQueuedTransactions(
      chainId,
      safeAddress,
      pagination?.limit,
      pagination?.offset,
      // TODO: should we fetch transactions with nonce < safeInfo.nonce here?
    );
    const safeInfo = await this.safeRepository.getSafe(chainId, safeAddress);
    const previousPageLastNonce = this.getPreviousPageLastNonce(
      transactions,
      paginationData,
    );
    const nextPageFirstNonce = this.getNextPageFirstNonce(transactions);
    this.adjustTransactions(transactions);

    const mappedTransactions = await Promise.all(
      transactions.results.map(async (transaction) =>
        this.multisigTransactionMapper.mapTransaction(
          chainId,
          transaction,
          safeInfo,
        ),
      ),
    );

    const results = await this.queuedItemsMapper.getQueuedItems(
      chainId,
      mappedTransactions,
      safeInfo,
      previousPageLastNonce,
      nextPageFirstNonce,
    );

    const nextURL = cursorUrlFromLimitAndOffset(routeUrl, transactions.next);
    const previousURL = cursorUrlFromLimitAndOffset(
      routeUrl,
      transactions.previous,
    );

    return {
      count: results.length,
      next: nextURL?.toString() ?? null,
      previous: previousURL?.toString() ?? null,
      results,
    };
  }

  private getAdjustedPagination(
    paginationData?: PaginationData,
  ): PaginationData | undefined {
    if (!paginationData || !paginationData.limit || !paginationData.offset) {
      return paginationData;
    }
    if (paginationData.offset === 0) {
      return new PaginationData(
        paginationData.limit + 1,
        paginationData.offset,
      );
    } else {
      return new PaginationData(
        paginationData.limit + 2,
        paginationData.offset - 1,
      );
    }
  }

  private getNextPageFirstNonce(
    transactions: Page<DomainMultisigTransaction>,
  ): number | null {
    if (!this.isMultiPage(transactions)) {
      return null;
    }
    return transactions.results[transactions.results.length - 1].nonce ?? null;
  }

  private getPreviousPageLastNonce(
    transactions: Page<DomainMultisigTransaction>,
    paginationData?: PaginationData,
  ): number | null {
    if (!paginationData || !paginationData.offset) {
      return null;
    }
    return transactions.results[0].nonce ?? null;
  }

  private adjustTransactions(
    transactions: Page<DomainMultisigTransaction>,
  ): void {
    if (this.isMultiPage(transactions)) {
      transactions.results.pop();
    }
  }

  private isMultiPage(transactions: Page<DomainMultisigTransaction>): boolean {
    return transactions.next !== null;
  }
}
