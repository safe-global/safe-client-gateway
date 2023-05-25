import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { head, last } from 'lodash';
import { MultisigTransaction as DomainMultisigTransaction } from '../../domain/safe/entities/multisig-transaction.entity';
import { SafeRepository } from '../../domain/safe/safe.repository';
import { ISafeRepository } from '../../domain/safe/safe.repository.interface';
import { AddConfirmationDto } from '../../domain/transactions/entities/add-confirmation.dto.entity';
import { Page } from '../common/entities/page.entity';
import {
  buildNextPageURL,
  buildPreviousPageURL,
  cursorUrlFromLimitAndOffset,
  PaginationData,
} from '../common/pagination/pagination.data';
import { ConflictType } from './entities/conflict-type.entity';
import { IncomingTransfer } from './entities/incoming-transfer.entity';
import { ModuleTransaction } from './entities/module-transaction.entity';
import { MultisigTransaction } from './entities/multisig-transaction.entity';
import { PreviewTransactionDto } from './entities/preview-transaction.dto.entity';
import { QueuedItem } from './entities/queued-item.entity';
import { TransactionItemPage } from './entities/transaction-item-page.entity';
import { TransactionPreview } from './entities/transaction-preview.entity';
import { Transaction } from './entities/transaction.entity';
import { ModuleTransactionMapper } from './mappers/module-transactions/module-transaction.mapper';
import { MultisigTransactionMapper } from './mappers/multisig-transactions/multisig-transaction.mapper';
import { QueuedItemsMapper } from './mappers/queued-items/queued-items.mapper';
import { TransactionPreviewMapper } from './mappers/transaction-preview.mapper';
import { ProposeTransactionDto } from './entities/propose-transaction.dto.entity';
import { TransactionsHistoryMapper } from './mappers/transactions-history.mapper';
import { IncomingTransferMapper } from './mappers/transfers/transfer.mapper';
import {
  MODULE_TRANSACTION_PREFIX,
  MULTISIG_TRANSACTION_PREFIX,
  TRANSACTION_ID_SEPARATOR,
  TRANSFER_PREFIX,
} from './constants';
import { ModuleTransactionDetailsMapper } from './mappers/module-transactions/module-transaction-details.mapper';
import { TransactionDetails } from './entities/transaction-details/transaction-details.entity';
import { TransferDetailsMapper } from './mappers/transfers/transfer-details.mapper';
import { MultisigTransactionDetailsMapper } from './mappers/multisig-transactions/multisig-transaction-details.mapper';

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(ISafeRepository) private readonly safeRepository: SafeRepository,
    private readonly multisigTransactionMapper: MultisigTransactionMapper,
    private readonly incomingTransferMapper: IncomingTransferMapper,
    private readonly moduleTransactionMapper: ModuleTransactionMapper,
    private readonly queuedItemsMapper: QueuedItemsMapper,
    private readonly transactionsHistoryMapper: TransactionsHistoryMapper,
    private readonly transactionPreviewMapper: TransactionPreviewMapper,
    private readonly moduleTransactionDetailsMapper: ModuleTransactionDetailsMapper,
    private readonly multisigTransactionDetailsMapper: MultisigTransactionDetailsMapper,
    private readonly transferDetailsMapper: TransferDetailsMapper,
  ) {}

  async getById(chainId: string, txId: string): Promise<TransactionDetails> {
    const [txType, safeAddress, id] = txId.split(TRANSACTION_ID_SEPARATOR);

    if (txType === MODULE_TRANSACTION_PREFIX) {
      const [tx, safe] = await Promise.all([
        this.safeRepository.getModuleTransaction(chainId, id),
        this.safeRepository.getSafe(chainId, safeAddress),
      ]);
      return this.moduleTransactionDetailsMapper.mapDetails(chainId, tx, safe);
    }
    if (txType === TRANSFER_PREFIX) {
      const [transfer, safe] = await Promise.all([
        this.safeRepository.getTransfer(chainId, id),
        this.safeRepository.getSafe(chainId, safeAddress),
      ]);
      return this.transferDetailsMapper.mapDetails(chainId, transfer, safe);
    }
    if (txType === MULTISIG_TRANSACTION_PREFIX) {
      const [tx, safe] = await Promise.all([
        this.safeRepository.getMultiSigTransaction(chainId, id),
        this.safeRepository.getSafe(chainId, safeAddress),
      ]);
      return this.multisigTransactionDetailsMapper.mapDetails(
        chainId,
        tx,
        safe,
      );
    }

    throw new BadRequestException({
      message: 'Invalid transaction type',
      code: 400,
    });
  }

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
        undefined,
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

  async addConfirmation(
    chainId: string,
    safeTxHash: string,
    addConfirmationDto: AddConfirmationDto,
  ): Promise<Transaction> {
    await this.safeRepository.addConfirmation(
      chainId,
      safeTxHash,
      addConfirmationDto,
    );
    const transaction = await this.safeRepository.getMultiSigTransaction(
      chainId,
      safeTxHash,
    );
    const safe = await this.safeRepository.getSafe(chainId, transaction.safe);

    return this.multisigTransactionMapper.mapTransaction(
      chainId,
      transaction,
      safe,
    );
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

  async previewTransaction(
    chainId: string,
    safeAddress: string,
    previewTransactionDto: PreviewTransactionDto,
  ): Promise<TransactionPreview> {
    const safe = await this.safeRepository.getSafe(chainId, safeAddress);
    return this.transactionPreviewMapper.mapTransactionPreview(
      chainId,
      safe,
      previewTransactionDto,
    );
  }

  async getTransactionQueue(
    chainId: string,
    routeUrl: Readonly<URL>,
    safeAddress: string,
    paginationData: PaginationData,
  ): Promise<Page<QueuedItem>> {
    const pagination = this.getAdjustedPaginationForQueue(paginationData);
    const safeInfo = await this.safeRepository.getSafe(chainId, safeAddress);
    const transactions = await this.safeRepository.getTransactionQueue(
      chainId,
      safeInfo,
      pagination.limit,
      pagination.offset,
    );

    const nextURL = buildNextPageURL(routeUrl, transactions.count);
    const previousURL = buildPreviousPageURL(routeUrl);
    const results = await this.queuedItemsMapper.getQueuedItems(
      this.adjustTransactionsPage(transactions),
      safeInfo,
      chainId,
      this.getPreviousPageLastNonce(transactions, paginationData),
      this.getNextPageFirstNonce(transactions),
    );

    return {
      count: results.length,
      next: nextURL?.toString() ?? null,
      previous: previousURL?.toString() ?? null,
      results,
    };
  }

  private getAdjustedPaginationForHistory(
    paginationData: PaginationData,
  ): PaginationData {
    if (paginationData.offset > 0) {
      return new PaginationData(
        paginationData.limit + 1,
        paginationData.offset - 1,
      );
    }
    return paginationData;
  }

  async getTransactionHistory(
    chainId: string,
    routeUrl: Readonly<URL>,
    safeAddress: string,
    paginationData: PaginationData,
    timezoneOffset: number,
  ): Promise<TransactionItemPage> {
    const paginationDataAdjusted =
      this.getAdjustedPaginationForHistory(paginationData);
    const domainTransactions = await this.safeRepository.getTransactionHistory(
      chainId,
      safeAddress,
      paginationDataAdjusted.limit,
      paginationDataAdjusted.offset,
    );
    const nextURL = buildNextPageURL(routeUrl, domainTransactions.count);
    const previousURL = buildPreviousPageURL(routeUrl);
    if (nextURL == null) {
      const creationTransaction =
        await this.safeRepository.getCreationTransaction(chainId, safeAddress);
      domainTransactions.results.push(creationTransaction);
    }
    const safeInfo = await this.safeRepository.getSafe(chainId, safeAddress);
    const results = await this.transactionsHistoryMapper.mapTransactionsHistory(
      chainId,
      domainTransactions.results,
      safeInfo,
      paginationData.offset,
      timezoneOffset,
    );

    return {
      count: domainTransactions.count,
      next: nextURL?.toString() ?? null,
      previous: previousURL?.toString() ?? null,
      results,
    };
  }

  async proposeTransaction(
    chainId: string,
    safeAddress: string,
    proposeTransactionDto: ProposeTransactionDto,
  ): Promise<Transaction> {
    await this.safeRepository.proposeTransaction(
      chainId,
      safeAddress,
      proposeTransactionDto,
    );

    const safe = await this.safeRepository.getSafe(chainId, safeAddress);
    const domainTransaction = await this.safeRepository.getMultiSigTransaction(
      chainId,
      proposeTransactionDto.safeTxHash,
    );

    return this.multisigTransactionMapper.mapTransaction(
      chainId,
      domainTransaction,
      safe,
    );
  }

  /**
   * Adjusts the pagination data to return extra items in both "edges" of the current page:
   * - If no pagination data info, then return the original pagination data.
   * - If it is the first page (offset 0), then return offset: 0, limit: limit + 1.
   * - If it is not the first page, then return offset: offset - 1, limit: limit + 2.
   * @param paginationData pagination data to adjust.
   * @returns pagination data adjusted.
   */
  private getAdjustedPaginationForQueue(
    paginationData: PaginationData,
  ): PaginationData {
    if (!paginationData.limit || !paginationData.offset) {
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
   * If the page has next page, returns a copy of the original transactions page without its last element.
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
  ): number | null {
    return head(page.results)?.nonce ?? null;
  }

  private getLastTransactionNonce(
    page: Page<DomainMultisigTransaction>,
  ): number | null {
    return last(page.results)?.nonce ?? null;
  }
}
