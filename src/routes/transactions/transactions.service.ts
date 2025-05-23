import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { MultisigTransaction as DomainMultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { SafeRepository } from '@/domain/safe/safe.repository';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { AddConfirmationDto } from '@/domain/transactions/entities/add-confirmation.dto.entity';
import { ProposeTransactionDto } from '@/domain/transactions/entities/propose-transaction.dto.entity';
import { Page } from '@/routes/common/entities/page.entity';
import {
  buildNextPageURL,
  buildPreviousPageURL,
  cursorUrlFromLimitAndOffset,
  PaginationData,
} from '@/routes/common/pagination/pagination.data';
import {
  MODULE_TRANSACTION_PREFIX,
  MULTISIG_TRANSACTION_PREFIX,
  TRANSACTION_ID_SEPARATOR,
  TRANSFER_PREFIX,
} from '@/routes/transactions/constants';
import { ConflictType } from '@/routes/transactions/entities/conflict-type.entity';
import { CreationTransaction } from '@/routes/transactions/entities/creation-transaction.entity';
import { IncomingTransfer } from '@/routes/transactions/entities/incoming-transfer.entity';
import { ModuleTransaction } from '@/routes/transactions/entities/module-transaction.entity';
import { MultisigTransaction } from '@/routes/transactions/entities/multisig-transaction.entity';
import { PreviewTransactionDto } from '@/routes/transactions/entities/preview-transaction.dto.entity';
import { QueuedItem } from '@/routes/transactions/entities/queued-item.entity';
import { TransactionDetails } from '@/routes/transactions/entities/transaction-details/transaction-details.entity';
import { TransactionItemPage } from '@/routes/transactions/entities/transaction-item-page.entity';
import { TransactionPreview } from '@/routes/transactions/entities/transaction-preview.entity';
import { ModuleTransactionDetailsMapper } from '@/routes/transactions/mappers/module-transactions/module-transaction-details.mapper';
import { ModuleTransactionMapper } from '@/routes/transactions/mappers/module-transactions/module-transaction.mapper';
import { MultisigTransactionDetailsMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-details.mapper';
import { MultisigTransactionMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction.mapper';
import { QueuedItemsMapper } from '@/routes/transactions/mappers/queued-items/queued-items.mapper';
import { TransactionPreviewMapper } from '@/routes/transactions/mappers/transaction-preview.mapper';
import { TransactionsHistoryMapper } from '@/routes/transactions/mappers/transactions-history.mapper';
import { TransferDetailsMapper } from '@/routes/transactions/mappers/transfers/transfer-details.mapper';
import { TransferMapper } from '@/routes/transactions/mappers/transfers/transfer.mapper';
import {
  getAddress,
  isAddress,
  isAddressEqual,
  parseEther,
  parseUnits,
} from 'viem';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { MultisigTransactionNoteMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-note.mapper';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { TXSMultisigTransaction } from '@/routes/transactions/entities/txs-multisig-transaction.entity';
import { TXSMultisigTransactionPage } from '@/routes/transactions/entities/txs-multisig-transaction-page.entity';
import { TXSCreationTransaction } from '@/routes/transactions/entities/txs-creation-transaction.entity';
import { ITokenRepository } from '@/domain/tokens/token.repository.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IDataDecoderRepository } from '@/domain/data-decoder/v2/data-decoder.repository.interface';

@Injectable()
export class TransactionsService {
  private readonly isFilterValueParsingEnabled: boolean;

  constructor(
    @Inject(ISafeRepository) private readonly safeRepository: SafeRepository,
    @Inject(IDataDecoderRepository)
    private readonly dataDecoderRepository: IDataDecoderRepository,
    private readonly multisigTransactionMapper: MultisigTransactionMapper,
    private readonly transferMapper: TransferMapper,
    private readonly moduleTransactionMapper: ModuleTransactionMapper,
    private readonly queuedItemsMapper: QueuedItemsMapper,
    private readonly transactionsHistoryMapper: TransactionsHistoryMapper,
    private readonly transactionPreviewMapper: TransactionPreviewMapper,
    private readonly moduleTransactionDetailsMapper: ModuleTransactionDetailsMapper,
    private readonly multisigTransactionDetailsMapper: MultisigTransactionDetailsMapper,
    private readonly multisigTransactionNoteMapper: MultisigTransactionNoteMapper,
    private readonly transferDetailsMapper: TransferDetailsMapper,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(ITokenRepository)
    private readonly tokenRepository: ITokenRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.isFilterValueParsingEnabled = this.configurationService.getOrThrow(
      'features.filterValueParsing',
    );
  }

  async getById(args: {
    chainId: string;
    txId: string;
  }): Promise<TransactionDetails> {
    const [txType, safeAddress, id] = args.txId.split(TRANSACTION_ID_SEPARATOR);

    switch (txType) {
      case MODULE_TRANSACTION_PREFIX: {
        const tx = await this.safeRepository.getModuleTransaction({
          chainId: args.chainId,
          moduleTransactionId: id,
        });
        const dataDecoded =
          await this.dataDecoderRepository.getTransactionDataDecoded({
            chainId: args.chainId,
            transaction: tx,
          });
        return this.moduleTransactionDetailsMapper.mapDetails(
          args.chainId,
          tx,
          dataDecoded,
        );
      }

      case TRANSFER_PREFIX: {
        if (!isAddress(safeAddress)) {
          throw new BadRequestException('Invalid transaction ID');
        }

        const [transfer, safe] = await Promise.all([
          this.safeRepository.getTransfer({
            chainId: args.chainId,
            transferId: id,
          }),
          this.safeRepository.getSafe({
            chainId: args.chainId,
            // We can't checksum outside of case as some IDs don't contain addresses
            address: getAddress(safeAddress),
          }),
        ]);
        return this.transferDetailsMapper.mapDetails(
          args.chainId,
          transfer,
          safe,
        );
      }

      case MULTISIG_TRANSACTION_PREFIX: {
        if (!isAddress(safeAddress)) {
          throw new BadRequestException('Invalid transaction ID');
        }

        const [tx, safe] = await Promise.all([
          this.safeRepository.getMultiSigTransaction({
            chainId: args.chainId,
            safeTransactionHash: id,
          }),
          this.safeRepository.getSafe({
            chainId: args.chainId,
            // We can't checksum outside of case as some IDs don't contain addresses
            address: getAddress(safeAddress),
          }),
        ]);

        if (!isAddressEqual(tx.safe, safe.address)) {
          throw new BadRequestException('Invalid transaction ID');
        }

        const dataDecoded =
          await this.dataDecoderRepository.getTransactionDataDecoded({
            chainId: args.chainId,
            transaction: tx,
          });

        return this.multisigTransactionDetailsMapper.mapDetails(
          args.chainId,
          tx,
          safe,
          dataDecoded,
        );
      }

      // txId is safeTxHash
      default: {
        const tx = await this.safeRepository.getMultiSigTransaction({
          chainId: args.chainId,
          safeTransactionHash: args.txId,
        });
        const [safe, dataDecoded] = await Promise.all([
          this.safeRepository.getSafe({
            chainId: args.chainId,
            address: tx.safe,
          }),
          this.dataDecoderRepository.getTransactionDataDecoded({
            chainId: args.chainId,
            transaction: tx,
          }),
        ]);
        return this.multisigTransactionDetailsMapper.mapDetails(
          args.chainId,
          tx,
          safe,
          dataDecoded,
        );
      }
    }
  }

  async getDomainMultisigTransactionBySafeTxHash(args: {
    chainId: string;
    safeTxHash: string;
  }): Promise<TXSMultisigTransaction> {
    const tx = await this.safeRepository.getMultiSigTransactionWithNoCache({
      chainId: args.chainId,
      safeTransactionHash: args.safeTxHash,
    });
    const dataDecoded =
      await this.dataDecoderRepository.getTransactionDataDecoded({
        chainId: args.chainId,
        transaction: tx,
      });
    return new TXSMultisigTransaction({ ...tx, dataDecoded });
  }

  async getMultisigTransactions(args: {
    chainId: string;
    routeUrl: Readonly<URL>;
    paginationData: PaginationData;
    safeAddress: `0x${string}`;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: `0x${string}`;
    value?: string;
    nonce?: string;
    executed?: boolean;
  }): Promise<Partial<Page<MultisigTransaction>>> {
    const domainTransactions =
      await this.safeRepository.getMultisigTransactions({
        ...args,
        ...(this.isFilterValueParsingEnabled &&
          args.value && {
            value: await this.parseTokenValue({
              ...args,
              value: args.value,
            }),
          }),
        limit: args.paginationData.limit,
        offset: args.paginationData.offset,
      });

    const safeInfo = await this.safeRepository.getSafe({
      chainId: args.chainId,
      address: args.safeAddress,
    });
    await this.multisigTransactionMapper.prefetchAddressInfos({
      chainId: args.chainId,
      transactions: domainTransactions.results,
    });

    const dataDecoded = await Promise.all(
      domainTransactions.results.map((domainTransaction) => {
        return this.dataDecoderRepository.getTransactionDataDecoded({
          chainId: args.chainId,
          transaction: domainTransaction,
        });
      }),
    );
    const mappedTransactions = await Promise.all(
      domainTransactions.results.map((domainTransaction, index) => {
        return this.multisigTransactionMapper.mapTransaction(
          args.chainId,
          domainTransaction,
          safeInfo,
          dataDecoded[index],
        );
      }),
    );

    const results = mappedTransactions.map((mappedTransaction) => {
      return new MultisigTransaction(mappedTransaction, ConflictType.None);
    });
    const nextURL = cursorUrlFromLimitAndOffset(
      args.routeUrl,
      domainTransactions.next,
    );
    const previousURL = cursorUrlFromLimitAndOffset(
      args.routeUrl,
      domainTransactions.previous,
    );

    return {
      next: nextURL?.toString() ?? null,
      previous: previousURL?.toString() ?? null,
      results,
    };
  }

  async getDomainMultisigTransactions(args: {
    safeAddress: `0x${string}`;
    chainId: string;
    // Transaction Service parameters
    failed?: boolean;
    modified__lt?: string;
    modified__gt?: string;
    modified__lte?: string;
    modified__gte?: string;
    nonce__lt?: number;
    nonce__gt?: number;
    nonce__lte?: number;
    nonce__gte?: number;
    nonce?: number;
    safe_tx_hash?: string;
    to?: string;
    value__lt?: number;
    value__gt?: number;
    value?: number;
    executed?: boolean;
    has_confirmations?: boolean;
    trusted?: boolean;
    execution_date__gte?: string;
    execution_date__lte?: string;
    submission_date__gte?: string;
    submission_date__lte?: string;
    transaction_hash?: string;
    ordering?: string;
    limit?: number;
    offset?: number;
  }): Promise<TXSMultisigTransactionPage> {
    return await this.safeRepository.getMultisigTransactionsWithNoCache(args);
  }

  async deleteTransaction(args: {
    chainId: string;
    safeTxHash: string;
    signature: string;
  }): Promise<void> {
    return await this.safeRepository.deleteTransaction(args);
  }

  async addConfirmation(args: {
    chainId: string;
    safeTxHash: string;
    addConfirmationDto: AddConfirmationDto;
  }): Promise<TransactionDetails> {
    await this.safeRepository.addConfirmation(args);
    const transaction = await this.safeRepository.getMultiSigTransaction({
      chainId: args.chainId,
      safeTransactionHash: args.safeTxHash,
    });
    const [safe, dataDecoded] = await Promise.all([
      this.safeRepository.getSafe({
        chainId: args.chainId,
        address: transaction.safe,
      }),
      this.dataDecoderRepository.getTransactionDataDecoded({
        chainId: args.chainId,
        transaction,
      }),
    ]);

    return this.multisigTransactionDetailsMapper.mapDetails(
      args.chainId,
      transaction,
      safe,
      dataDecoded,
    );
  }

  async getModuleTransactions(args: {
    chainId: string;
    routeUrl: Readonly<URL>;
    safeAddress: `0x${string}`;
    to?: string;
    module?: string;
    txHash?: string;
    paginationData?: PaginationData;
  }): Promise<Page<ModuleTransaction>> {
    const domainTransactions = await this.safeRepository.getModuleTransactions({
      ...args,
      limit: args.paginationData?.limit,
      offset: args.paginationData?.offset,
    });

    const results = await Promise.all(
      domainTransactions.results.map(async (domainTransaction) => {
        const dataDecoded =
          await this.dataDecoderRepository.getTransactionDataDecoded({
            chainId: args.chainId,
            transaction: domainTransaction,
          });
        return new ModuleTransaction(
          await this.moduleTransactionMapper.mapTransaction(
            args.chainId,
            domainTransaction,
            dataDecoded,
          ),
        );
      }),
    );
    const nextURL = cursorUrlFromLimitAndOffset(
      args.routeUrl,
      domainTransactions.next,
    );
    const previousURL = cursorUrlFromLimitAndOffset(
      args.routeUrl,
      domainTransactions.previous,
    );

    return {
      count: domainTransactions.count,
      next: nextURL?.toString() ?? null,
      previous: previousURL?.toString() ?? null,
      results,
    };
  }

  async getIncomingTransfers(args: {
    chainId: string;
    routeUrl: Readonly<URL>;
    safeAddress: `0x${string}`;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: `0x${string}`;
    value?: string;
    tokenAddress?: `0x${string}`;
    paginationData?: PaginationData;
    onlyTrusted: boolean;
  }): Promise<Partial<Page<IncomingTransfer>>> {
    const transfers = await this.safeRepository.getIncomingTransfers({
      ...args,
      ...(this.isFilterValueParsingEnabled &&
        args.value && {
          value: await this.parseTokenValue({
            ...args,
            value: args.value,
          }),
        }),
      limit: args.paginationData?.limit,
      offset: args.paginationData?.offset,
    });

    const safeInfo = await this.safeRepository.getSafe({
      chainId: args.chainId,
      address: args.safeAddress,
    });
    const results = (
      await this.transferMapper.mapTransfers({
        chainId: args.chainId,
        transfers: transfers.results,
        safe: safeInfo,
        onlyTrusted: args.onlyTrusted,
      })
    ).map((incomingTransfer) => new IncomingTransfer(incomingTransfer));

    const nextURL = cursorUrlFromLimitAndOffset(args.routeUrl, transfers.next);
    const previousURL = cursorUrlFromLimitAndOffset(
      args.routeUrl,
      transfers.previous,
    );

    return {
      next: nextURL?.toString() ?? null,
      previous: previousURL?.toString() ?? null,
      results,
    };
  }

  async previewTransaction(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    previewTransactionDto: PreviewTransactionDto;
  }): Promise<TransactionPreview> {
    const safe = await this.safeRepository.getSafe({
      chainId: args.chainId,
      address: args.safeAddress,
    });
    return this.transactionPreviewMapper.mapTransactionPreview(
      args.chainId,
      safe,
      args.previewTransactionDto,
    );
  }

  async getTransactionQueue(args: {
    chainId: string;
    routeUrl: Readonly<URL>;
    safeAddress: `0x${string}`;
    paginationData: PaginationData;
    trusted?: boolean;
  }): Promise<Page<QueuedItem>> {
    const pagination = this.getAdjustedPaginationForQueue(args.paginationData);
    const safeInfo = await this.safeRepository.getSafe({
      chainId: args.chainId,
      address: args.safeAddress,
    });
    const transactions = await this.safeRepository.getTransactionQueue({
      chainId: args.chainId,
      safe: safeInfo,
      limit: pagination.limit,
      offset: pagination.offset,
      trusted: args.trusted,
    });

    const nextURL = buildNextPageURL(args.routeUrl, transactions.count);
    const previousURL = buildPreviousPageURL(args.routeUrl);
    const results = await this.queuedItemsMapper.getQueuedItems(
      this.adjustTransactionsPage(transactions),
      safeInfo,
      args.chainId,
      this.getPreviousPageLastNonce(transactions, args.paginationData),
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

  async getTransactionHistory(args: {
    chainId: string;
    routeUrl: Readonly<URL>;
    safeAddress: `0x${string}`;
    paginationData: PaginationData;
    timezoneOffsetMs: number;
    onlyTrusted: boolean;
    showImitations: boolean;
    timezone?: string;
  }): Promise<TransactionItemPage> {
    const paginationDataAdjusted = this.getAdjustedPaginationForHistory(
      args.paginationData,
    );
    const domainTransactions = await this.safeRepository.getTransactionHistory({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
      limit: paginationDataAdjusted.limit,
      offset: paginationDataAdjusted.offset,
    });
    const nextURL = buildNextPageURL(args.routeUrl, domainTransactions.count);
    const previousURL = buildPreviousPageURL(args.routeUrl);
    if (nextURL == null) {
      // If creation is not indexed, we shouldn't block the entire history
      try {
        const creationTransaction =
          await this.safeRepository.getCreationTransaction({
            chainId: args.chainId,
            safeAddress: args.safeAddress,
          });
        domainTransactions.results.push(creationTransaction);
      } catch (error) {
        this.loggingService.warn(error);
      }
    }
    const safeInfo = await this.safeRepository.getSafe({
      chainId: args.chainId,
      address: args.safeAddress,
    });
    const results = await this.transactionsHistoryMapper.mapTransactionsHistory(
      args.chainId,
      domainTransactions.results,
      safeInfo,
      args.paginationData.offset,
      args.timezoneOffsetMs,
      args.onlyTrusted,
      args.showImitations,
      args.timezone,
    );

    return {
      count: domainTransactions.count,
      next: nextURL?.toString() ?? null,
      previous: previousURL?.toString() ?? null,
      results,
    };
  }

  async proposeTransaction(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    proposeTransactionDto: ProposeTransactionDto;
  }): Promise<TransactionDetails> {
    this.logProposeTx(args);
    args.proposeTransactionDto.origin = this.verifyOrigin(
      args.proposeTransactionDto,
    );
    await this.safeRepository.proposeTransaction(args);

    const domainTransaction = await this.safeRepository.getMultiSigTransaction({
      chainId: args.chainId,
      safeTransactionHash: args.proposeTransactionDto.safeTxHash,
    });
    const [safe, dataDecoded] = await Promise.all([
      this.safeRepository.getSafe({
        chainId: args.chainId,
        address: args.safeAddress,
      }),
      this.dataDecoderRepository.getTransactionDataDecoded({
        chainId: args.chainId,
        transaction: domainTransaction,
      }),
    ]);

    return this.multisigTransactionDetailsMapper.mapDetails(
      args.chainId,
      domainTransaction,
      safe,
      dataDecoded,
    );
  }

  async getCreationTransaction(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<CreationTransaction> {
    const tx = await this.safeRepository.getCreationTransaction(args);
    const dataDecoded =
      await this.dataDecoderRepository.getTransactionDataDecoded({
        chainId: args.chainId,
        transaction: tx,
      });
    return {
      ...tx,
      dataDecoded,
    };
  }

  async getDomainCreationTransaction(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<TXSCreationTransaction> {
    const tx = await this.safeRepository.getCreationTransaction(args);
    return new TXSCreationTransaction(tx);
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

  private async parseTokenValue(args: {
    chainId: string;
    value: string;
    tokenAddress?: `0x${string}`;
  }): Promise<string> {
    if (!args.tokenAddress) {
      return parseEther(args.value).toString();
    }
    const token = await this.tokenRepository.getToken({
      chainId: args.chainId,
      address: args.tokenAddress,
    });
    return parseUnits(args.value, token.decimals).toString();
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
    return page.results[0]?.nonce ?? null;
  }

  private getLastTransactionNonce(
    page: Page<DomainMultisigTransaction>,
  ): number | null {
    return page.results.at(-1)?.nonce ?? null;
  }

  private verifyOrigin(transaction: ProposeTransactionDto): string | null {
    if (transaction.origin) {
      try {
        const note = this.multisigTransactionNoteMapper.mapTxNote(transaction);

        const origin = JSON.parse(transaction.origin);
        origin.note = note;

        return JSON.stringify(origin);
      } catch {
        // If the origin is not a valid JSON, we return null
      }
    }

    return null;
  }

  private logProposeTx(
    args: Parameters<TransactionsService['proposeTransaction']>[0],
  ): void {
    this.loggingService.info({
      transaction: args.proposeTransactionDto,
      safeAddress: args.safeAddress,
      chainId: args.chainId,
      type: LogType.TransactionPropose,
    });
  }
}
