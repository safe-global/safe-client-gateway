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

  async getTransactionQueue(
    chainId: string,
    routeUrl: Readonly<URL>,
    safeAddress: string,
    paginationData?: PaginationData,
  ): Promise<Page<QueuedItem>> {
    const pagination = this.getAdjustedPagination(paginationData);
    const safeInfo = await this.safeRepository.getSafe(chainId, safeAddress);
    const domainTransactions = await this.safeRepository.getTransactionQueue(
      chainId,
      safeAddress,
      pagination?.limit,
      pagination?.offset,
    );

    const transactions = await Promise.all(
      this.adjustTransactionsPage(domainTransactions).results.map(
        async (transaction) =>
          this.multisigTransactionMapper.mapTransaction(
            chainId,
            transaction,
            safeInfo,
          ),
      ),
    );

    const results = await this.queuedItemsMapper.getQueuedItems(
      transactions,
      safeInfo,
      this.getPreviousPageLastNonce(domainTransactions, paginationData),
      this.getNextPageFirstNonce(domainTransactions),
    );

    const { next, previous } = domainTransactions;
    const nextURL = cursorUrlFromLimitAndOffset(routeUrl, next);
    const previousURL = cursorUrlFromLimitAndOffset(routeUrl, previous);

    return {
      count: results.length,
      next: nextURL?.toString() ?? null,
      previous: previousURL?.toString() ?? null,
      results,
    };
  }

  /**
   * Adjusts the pagination data to return extra items in both "edges" of the current page:
   * - If no pagination data info, then return the original pagination data.
   * - If it is the first page (offset 0), then return offset: 0, limit: limit + 1.
   * - If it is not the first page, then return offset: offset - 1, limit: limit + 2.
   * @param paginationData pagination data to adjust.
   * @returns pagination data adjusted.
   */
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
    page: Page<DomainMultisigTransaction>,
  ): number | null {
    return this.hasNextPage(page) ? this.getLastTransactionNonce(page) : null;
  }

  private getPreviousPageLastNonce(
    page: Page<DomainMultisigTransaction>,
    paginationData?: PaginationData,
  ): number | null {
    return paginationData && paginationData.offset
      ? this.getFirstTransactionNonce(page)
      : null;
  }

  /**
   * If the page has next page, returns a copy of the original transactions page without its first element.
   * Otherwise the original page of transactions is returned.
   *
   * @param page page of Transactions.
   * @returns transactions array without its first element if there is next page.
   */
  private adjustTransactionsPage(
    page: Page<DomainMultisigTransaction>,
  ): Page<DomainMultisigTransaction> {
    return this.hasNextPage(page)
      ? { ...page, results: page.results.slice(0, -1) }
      : page;
  }

  /**
   * Checks the if page contains a next cursor.
   */
  private hasNextPage(page: Page<DomainMultisigTransaction>): boolean {
    return page.next !== null;
  }
  private getFirstTransactionNonce(
    page: Page<DomainMultisigTransaction>,
  ): number {
    return page.results[0].nonce;
  }

  private getLastTransactionNonce(
    page: Page<DomainMultisigTransaction>,
  ): number {
    return page.results[page.results.length - 1].nonce;
  }
}
