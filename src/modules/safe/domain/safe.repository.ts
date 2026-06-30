// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import isEmpty from 'lodash/isEmpty';
import type { Address } from 'viem';
import { z } from 'zod';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { SAFE_TRANSACTION_SERVICE_MAX_LIMIT } from '@/domain/common/constants';
import { Page } from '@/domain/entities/page.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import {
  type QueueMultisigTransactionEntity,
  QueueMultisigTransactionListSchema,
  QueueMultisigTransactionPageSchema,
  QueueMultisigTransactionSchema,
} from '@/modules/queue/entities/multisig-transaction.entity';
import { buildOrigin } from '@/modules/queue/helpers/origin.helper';
import { mapQueueToMultisigTransaction } from '@/modules/queue/mappers/transaction.mapper';
import { IQueueService } from '@/modules/queue/queue.interface';
import { CreationTransaction } from '@/modules/safe/domain/entities/creation-transaction.entity';
import {
  ModuleTransaction,
  ModuleTransactionPageSchema,
  ModuleTransactionSchema,
} from '@/modules/safe/domain/entities/module-transaction.entity';
import {
  MultisigTransaction,
  MultisigTransactionPageSchema,
  MultisigTransactionSchema,
} from '@/modules/safe/domain/entities/multisig-transaction.entity';
import { Safe } from '@/modules/safe/domain/entities/safe.entity';
import { SafeList } from '@/modules/safe/domain/entities/safe-list.entity';
import { SafesByChainId } from '@/modules/safe/domain/entities/safes-by-chain-id.entity';
import { CreationTransactionSchema } from '@/modules/safe/domain/entities/schemas/creation-transaction.schema';
import {
  SafePageV2Schema,
  SafeSchema,
} from '@/modules/safe/domain/entities/schemas/safe.schema';
import { SafeListSchema } from '@/modules/safe/domain/entities/schemas/safe-list.schema';
import { TransactionTypePageSchema } from '@/modules/safe/domain/entities/schemas/transaction-type.schema';
import {
  isMultisigTransaction,
  Transaction,
} from '@/modules/safe/domain/entities/transaction.entity';
import {
  Transfer,
  TransferPageSchema,
  TransferSchema,
} from '@/modules/safe/domain/entities/transfer.entity';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import { ProposeTransactionDto } from '@/modules/transactions/domain/entities/propose-transaction.dto.entity';
import { TransactionVerifierHelper } from '@/modules/transactions/routes/helpers/transaction-verifier.helper';
import { PaginationData } from '@/routes/common/pagination/pagination.data';

@Injectable()
export class SafeRepository implements ISafeRepository {
  private readonly maxSequentialPages: number;
  private readonly queueServiceEnabled: boolean;

  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
    private readonly transactionVerifier: TransactionVerifierHelper,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IQueueService)
    private readonly queueService: IQueueService,
  ) {
    this.maxSequentialPages = this.configurationService.getOrThrow<number>(
      'safeConfig.safes.maxSequentialPages',
    );
    this.queueServiceEnabled = this.configurationService.getOrThrow<boolean>(
      'features.queueService',
    );
  }

  async getSafe(args: { chainId: string; address: Address }): Promise<Safe> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const safe = await transactionService.getSafe(args.address);
    return SafeSchema.parse(safe);
  }

  async isSafe(args: { chainId: string; address: Address }): Promise<boolean> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const isSafe = await transactionService.isSafe(args.address);
    return z.boolean().parse(isSafe);
  }

  async clearIsSafe(args: {
    chainId: string;
    address: Address;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    return transactionService.clearIsSafe(args.address);
  }

  async clearSafe(args: { chainId: string; address: Address }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    return transactionService.clearSafe(args.address);
  }

  async isOwner(args: {
    chainId: string;
    safeAddress: Address;
    address: Address;
  }): Promise<boolean> {
    const safe = await this.getSafe({
      chainId: args.chainId,
      address: args.safeAddress,
    });
    return safe.owners.includes(args.address);
  }

  async getCollectibleTransfers(args: {
    chainId: string;
    safeAddress: Address;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transfer>> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );

    const page = await transactionService.getTransfers({
      ...args,
      onlyErc721: true,
    });
    return TransferPageSchema.parse(page);
  }

  async clearTransfers(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );

    return transactionService.clearTransfers(args.safeAddress);
  }

  async getIncomingTransfers(args: {
    chainId: string;
    safeAddress: Address;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: Address;
    value?: string;
    tokenAddress?: Address;
    txHash?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transfer>> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const page = await transactionService.getIncomingTransfers(args);
    return TransferPageSchema.parse(page);
  }

  async clearIncomingTransfers(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );

    return transactionService.clearIncomingTransfers(args.safeAddress);
  }

  async addConfirmation(args: {
    chainId: string;
    safeTxHash: string;
    addConfirmationDto: { signature: Address };
  }): Promise<void> {
    const transaction = await this.getMultiSigTransaction({
      chainId: args.chainId,
      safeTransactionHash: args.safeTxHash,
    });

    const safe = await this.getSafe({
      chainId: args.chainId,
      address: transaction.safe,
    });

    this.transactionVerifier.verifyConfirmation({
      chainId: args.chainId,
      safe,
      transaction,
      signature: args.addConfirmationDto.signature,
    });

    if (this.queueServiceEnabled) {
      await this.queueService.postConfirmation({
        chainId: args.chainId,
        safeTxHash: args.safeTxHash,
        signature: args.addConfirmationDto.signature,
      });
    } else {
      const transactionService = await this.transactionApiManager.getApi(
        args.chainId,
      );
      await transactionService.postConfirmation(args);
    }
  }

  async getModuleTransaction(args: {
    chainId: string;
    moduleTransactionId: string;
  }): Promise<ModuleTransaction> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const moduleTransaction = await transactionService.getModuleTransaction(
      args.moduleTransactionId,
    );
    return ModuleTransactionSchema.parse(moduleTransaction);
  }

  async getModuleTransactions(args: {
    chainId: string;
    safeAddress: Address;
    to?: string;
    txHash?: string;
    module?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<ModuleTransaction>> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const page = await transactionService.getModuleTransactions(args);
    return ModuleTransactionPageSchema.parse(page);
  }

  async clearModuleTransactions(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );

    return transactionService.clearModuleTransactions(args.safeAddress);
  }

  getTransactionQueue(args: {
    chainId: string;
    safe: Safe;
    limit?: number;
    offset?: number;
    trusted?: boolean;
  }): Promise<Page<MultisigTransaction>> {
    return this._getTransactionQueue({
      ...args,
      ordering: 'nonce,submissionDate',
    });
  }

  getTransactionQueueByModified(args: {
    chainId: string;
    safe: Safe;
    limit?: number;
    offset?: number;
  }): Promise<Page<MultisigTransaction>> {
    return this._getTransactionQueue({
      ...args,
      ordering: '-modified',
    });
  }

  private async _getTransactionQueue(args: {
    chainId: string;
    safe: Safe;
    ordering: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<MultisigTransaction>> {
    if (!this.queueServiceEnabled) {
      const transactionService = await this.transactionApiManager.getApi(
        args.chainId,
      );
      const page = await transactionService.getMultisigTransactions({
        ...args,
        safeAddress: args.safe.address,
        executed: false,
        nonceGte: args.safe.nonce,
      });
      return MultisigTransactionPageSchema.parse(page);
    }
    // The queue service can only order the queue by nonce, so we translate the
    // tx-service ordering into a nonce direction explicitly. A leading '-'
    // denotes descending. NOTE: getTransactionQueueByModified asks for
    // '-modified' ordering, which the queue cannot honour — it degrades to
    // descending nonce. Callers relying on true modified-date ordering (e.g.
    // the queued-transaction cache tag) get a best-effort nonce-desc result.
    const nonceOrder = args.ordering.startsWith('-') ? 'desc' : 'asc';
    const page = await this.queueService.getTransactionQueue({
      chainId: args.chainId,
      safeAddress: args.safe.address,
      nonceOrder,
      limit: args.limit,
      offset: args.offset,
    });
    const parsed = QueueMultisigTransactionPageSchema.parse(page);
    return {
      count: parsed.count,
      next: parsed.next,
      previous: parsed.previous,
      results: parsed.results.map((tx) =>
        mapQueueToMultisigTransaction(tx, args.safe),
      ),
    };
  }

  async getCreationTransaction(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<CreationTransaction> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const createTransaction = await transactionService.getCreationTransaction(
      args.safeAddress,
    );
    return CreationTransactionSchema.parse(createTransaction);
  }

  async getCreationTransactionWithNoCache(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<CreationTransaction> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const createTransaction =
      await transactionService.getCreationTransactionWithNoCache(
        args.safeAddress,
      );
    return CreationTransactionSchema.parse(createTransaction);
  }

  getTransactionHistory(args: {
    chainId: string;
    safeAddress: Address;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transaction>> {
    return this.getAllExecutedTransactions(args);
  }

  private async getAllExecutedTransactions(args: {
    chainId: string;
    safeAddress: Address;
    ordering?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transaction>> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const rawPage = await transactionService.getAllTransactions({
      ...args,
      executed: true,
      queued: false,
    });
    const page: Page<Transaction> = TransactionTypePageSchema.parse(rawPage);
    await this.bindQueueOrigins(page.results, args.chainId);
    return page;
  }

  private async fetchQueueMultisigByHash(
    chainId: string,
    safeTxHashes: Array<string>,
  ): Promise<Map<string, QueueMultisigTransactionEntity>> {
    const byHash = new Map<string, QueueMultisigTransactionEntity>();
    if (safeTxHashes.length === 0) return byHash;
    try {
      const raw = await this.queueService.getMultisigTransactionsBatch({
        chainId,
        safeTxHashes,
      });
      const transactions = QueueMultisigTransactionListSchema.parse(raw);
      for (const queue of transactions) byHash.set(queue.safeTxHash, queue);
      const missing = safeTxHashes.filter((hash) => !byHash.has(hash));
      if (missing.length > 0) {
        this.loggingService.warn(
          `Queue service omitted ${missing.length} hash(es) from batch response. chainId=${chainId}, missing=${missing.join(',')}`,
        );
      }
    } catch (error) {
      this.loggingService.warn(
        `Failed to fetch origins from queue service. chainId=${chainId}, hashes=${safeTxHashes.length}, error=${error}`,
      );
    }
    return byHash;
  }

  private isQueueOriginAuthoritative(
    queue: { chainId: string; safe: Address; safeTxHash: string },
    expected: { chainId: string; safe: Address },
  ): boolean {
    if (queue.chainId !== expected.chainId || queue.safe !== expected.safe) {
      this.loggingService.warn(
        `Queue origin reconciliation rejected. safeTxHash=${queue.safeTxHash}, expectedChainId=${expected.chainId}, queueChainId=${queue.chainId}, expectedSafe=${expected.safe}, queueSafe=${queue.safe}`,
      );
      return false;
    }
    return true;
  }

  /**
   * Overlays the queue's origin metadata onto a tx-service transaction.
   *
   * Only overlays when the queue carries an actual origin identity (a name or
   * url). Two cases must NOT touch the existing tx-service origin:
   * - a not-yet-backfilled queue entry (all of name/url/notes null) would
   *   otherwise wipe the origin to null;
   * - a notes-only entry (name and url both null) would otherwise blank out
   *   the tx-service name/url, keeping only the note.
   * When name/url are present the queue is authoritative, so its note is
   * layered on via buildOrigin.
   */
  private overlayQueueOrigin(
    tx: MultisigTransaction,
    queue: {
      originName: string | null;
      originUrl: string | null;
      notes: string | null;
    },
  ): void {
    if (!(queue.originName || queue.originUrl)) return;
    tx.origin = buildOrigin(queue.originName, queue.originUrl, queue.notes);
  }

  private async bindQueueOrigins(
    txs: ReadonlyArray<Transaction>,
    chainId: string,
  ): Promise<void> {
    if (!this.queueServiceEnabled) return;
    const multisigs = txs.filter(isMultisigTransaction);
    if (multisigs.length === 0) return;
    const byHash = await this.fetchQueueMultisigByHash(
      chainId,
      multisigs.map((tx) => tx.safeTxHash),
    );
    for (const tx of multisigs) {
      const queue = byHash.get(tx.safeTxHash);
      if (queue === undefined) continue;
      if (!this.isQueueOriginAuthoritative(queue, { chainId, safe: tx.safe })) {
        continue;
      }
      this.overlayQueueOrigin(tx, queue);
    }
  }

  async clearAllExecutedTransactions(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    // The tx-service and queue caches are independent layers, so a failure in
    // one must not skip invalidating the other. Run both, then surface a
    // generic failure if either rejected so the webhook retries the whole
    // invalidation.
    const results = await Promise.allSettled([
      transactionService.clearAllTransactions(args.safeAddress),
      ...(this.queueServiceEnabled
        ? [
            this.queueService.clearAllTransactions({
              chainId: args.chainId,
              safeAddress: args.safeAddress,
            }),
          ]
        : []),
    ]);
    const errors = results
      .filter((r) => r.status === 'rejected')
      .map((r) => r.reason);
    if (errors.length > 0) {
      this.loggingService.debug(
        `Failed to clear all executed transactions from one or more caches. errors=${errors}`,
      );
      throw new Error('Failed to clear all executed transactions');
    }
  }

  async clearMultisigTransaction(args: {
    chainId: string;
    safeTransactionHash: string;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    // The tx-service and queue caches are independent layers, so a failure in
    // one must not skip invalidating the other. Run both, then surface a
    // generic failure if either rejected so the webhook retries the whole
    // invalidation.
    const results = await Promise.allSettled([
      transactionService.clearMultisigTransaction(args.safeTransactionHash),
      ...(this.queueServiceEnabled
        ? [
            this.queueService.clearMultisigTransaction({
              chainId: args.chainId,
              safeTxHash: args.safeTransactionHash,
            }),
          ]
        : []),
    ]);
    const errors = results
      .filter((r) => r.status === 'rejected')
      .map((r) => r.reason);
    if (errors.length > 0) {
      this.loggingService.debug(
        `Failed to clear multisig transaction from one or more caches. errors=${errors}`,
      );
      throw new Error('Failed to clear multisig transaction');
    }
  }

  async getMultiSigTransaction(args: {
    chainId: string;
    safeTransactionHash: string;
  }): Promise<MultisigTransaction> {
    return await this.resolveMultisigTransaction(args, { noCache: false });
  }

  private async fetchTxServiceMultisig(
    args: { chainId: string; safeTransactionHash: string },
    opts: { noCache: boolean },
  ): Promise<MultisigTransaction> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const raw = opts.noCache
      ? await transactionService.getMultisigTransactionWithNoCache(
          args.safeTransactionHash,
        )
      : await transactionService.getMultisigTransaction(
          args.safeTransactionHash,
        );
    return MultisigTransactionSchema.parse(raw);
  }

  private async resolveMultisigTransaction(
    args: { chainId: string; safeTransactionHash: string },
    opts: { noCache: boolean },
  ): Promise<MultisigTransaction> {
    if (!this.queueServiceEnabled) {
      return this.fetchTxServiceMultisig(args, opts);
    }

    let queue: QueueMultisigTransactionEntity;
    try {
      const raw = await this.queueService.getMultisigTransaction({
        chainId: args.chainId,
        safeTxHash: args.safeTransactionHash,
      });
      queue = QueueMultisigTransactionSchema.parse(raw);
    } catch (error) {
      this.loggingService.warn(
        `Failed to fetch transaction from queue service. chainId=${args.chainId}, safeTxHash=${args.safeTransactionHash}, error=${error}`,
      );
      return this.fetchTxServiceMultisig(args, opts);
    }

    if (queue.txHash !== null) {
      // Executed: the tx service is the source of truth. Overlay the origin
      // from the queue entity we already fetched (no second queue call).
      const tx = await this.fetchTxServiceMultisig(args, opts);
      if (
        this.isQueueOriginAuthoritative(queue, {
          chainId: args.chainId,
          safe: tx.safe,
        })
      ) {
        this.overlayQueueOrigin(tx, queue);
      }
      return tx;
    }

    // Not executed: the queue service is the source of truth.
    const safe = await this.getSafe({
      chainId: args.chainId,
      address: queue.safe,
    });
    return mapQueueToMultisigTransaction(queue, safe);
  }

  async getMultiSigTransactionWithNoCache(args: {
    chainId: string;
    safeTransactionHash: string;
  }): Promise<MultisigTransaction> {
    const tx = await this.resolveMultisigTransaction(args, { noCache: true });

    const safe = await this.getSafe({
      chainId: args.chainId,
      address: tx.safe,
    });

    this.transactionVerifier.verifyApiTransaction({
      chainId: args.chainId,
      transaction: tx,
      safe: safe,
    });

    return tx;
  }

  async deleteTransaction(args: {
    chainId: string;
    safeTxHash: string;
    signature: string;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const transaction = await transactionService.getMultisigTransaction(
      args.safeTxHash,
    );
    const { safe } = MultisigTransactionSchema.parse(transaction);

    if (this.queueServiceEnabled) {
      await this.queueService.deleteTransaction(args);
    } else {
      await transactionService.deleteTransaction(args);
    }

    // Ensure transaction is removed from cache in case event is not received
    const cacheClears: Array<Promise<void>> = [
      transactionService.clearMultisigTransaction(args.safeTxHash),
      transactionService.clearMultisigTransactions(safe),
    ];
    if (this.queueServiceEnabled) {
      cacheClears.push(
        this.queueService.clearMultisigTransaction({
          chainId: args.chainId,
          safeTxHash: args.safeTxHash,
        }),
        this.queueService.clearAllTransactions({
          chainId: args.chainId,
          safeAddress: safe,
        }),
      );
    }
    Promise.all(cacheClears).catch((error) => {
      this.loggingService.warn(
        `Failed to immediately clear deleted transaction from cache. chainId=${args.chainId}, safeTxHash=${args.safeTxHash}, error=${error}`,
      );
    });
  }

  async clearMultisigTransactions(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    // The tx-service and queue caches are independent layers, so a failure in
    // one must not skip invalidating the other. Run both, then surface a
    // generic failure if either rejected so the webhook retries the whole
    // invalidation.
    const results = await Promise.allSettled([
      transactionService.clearMultisigTransactions(args.safeAddress),
      ...(this.queueServiceEnabled
        ? [
            this.queueService.clearAllTransactions({
              chainId: args.chainId,
              safeAddress: args.safeAddress,
            }),
          ]
        : []),
    ]);
    const errors = results
      .filter((r) => r.status === 'rejected')
      .map((r) => r.reason);
    if (errors.length > 0) {
      this.loggingService.debug(
        `Failed to clear multisig transactions from one or more caches. errors=${errors}`,
      );
      throw new Error('Failed to clear multisig transactions');
    }
  }

  async getMultisigTransactionsWithNoCache(args: {
    chainId: string;
    safeAddress: Address;
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
  }): Promise<Page<MultisigTransaction>> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const [multisigTransactions, safe] = await Promise.all([
      transactionService
        .getMultisigTransactionsWithNoCache(args)
        .then(MultisigTransactionPageSchema.parse),
      this.getSafe({ chainId: args.chainId, address: args.safeAddress }),
    ]);

    for (const transaction of multisigTransactions.results) {
      this.transactionVerifier.verifyApiTransaction({
        chainId: args.chainId,
        transaction,
        safe,
      });
    }

    await this.bindQueueOrigins(multisigTransactions.results, args.chainId);
    return multisigTransactions;
  }

  async getMultisigTransactions(args: {
    chainId: string;
    safeAddress: Address;
    executed?: boolean;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: Address;
    value?: string;
    nonce?: string;
    nonceGte?: number;
    limit?: number;
    offset?: number;
  }): Promise<Page<MultisigTransaction>> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const page = await transactionService.getMultisigTransactions({
      ...args,
      ordering: '-nonce',
      trusted: true,
    });
    const parsed = MultisigTransactionPageSchema.parse(page);
    await this.bindQueueOrigins(parsed.results, args.chainId);
    return parsed;
  }

  async getTransfer(args: {
    chainId: string;
    transferId: string;
  }): Promise<Transfer> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const transfer = await transactionService.getTransfer(args.transferId);
    return TransferSchema.parse(transfer);
  }

  async getTransfers(args: {
    chainId: string;
    safeAddress: Address;
    limit?: number | undefined;
  }): Promise<Page<Transfer>> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const page = await transactionService.getTransfers(args);
    return TransferPageSchema.parse(page);
  }

  async getSafesByOwner(args: {
    chainId: string;
    ownerAddress: Address;
  }): Promise<SafeList> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const safeList = await transactionService.getSafesByOwner(
      args.ownerAddress,
    );

    return SafeListSchema.parse(safeList);
  }

  async getSafesByOwnerV2(args: {
    chainId: string;
    ownerAddress: Address;
  }): Promise<SafeList> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );

    const allAddresses: Array<Address> = [];
    let offset = 0;
    let next: string | null = null;

    try {
      for (let i = 0; i < this.maxSequentialPages; i++) {
        const page = await transactionService.getSafesByOwnerV2({
          ownerAddress: args.ownerAddress,
          limit: SAFE_TRANSACTION_SERVICE_MAX_LIMIT,
          offset,
        });

        const { next: nextUrl, results } = SafePageV2Schema.parse(page);
        next = nextUrl;

        allAddresses.push(...results.map((safe) => safe.address));

        if (!next) {
          break;
        }

        const paginationData = PaginationData.fromLimitAndOffset(new URL(next));
        offset = paginationData.offset;
      }
    } catch (error) {
      if (error instanceof DataSourceError && error.code === 404) {
        return SafeListSchema.parse({ safes: [] });
      }
      // Re-throw other errors
      throw error;
    }

    if (next) {
      this.loggingService.error(
        `Max sequential pages reached for getSafesByOwnerV2. chainId=${args.chainId}, ownerAddress=${args.ownerAddress}`,
      );
    }

    return SafeListSchema.parse({ safes: allAddresses });
  }

  private async getAllSafesByOwnerForChains(
    getSafesByOwnerForChain: (chainId: string) => Promise<SafeList>,
  ): Promise<SafesByChainId> {
    const chains = await this.chainsRepository.getAllChains();
    const allSafeLists = await Promise.allSettled(
      chains.map(async ({ chainId }) => {
        const safeList = await getSafesByOwnerForChain(chainId);

        return {
          chainId,
          safeList,
        };
      }),
    );

    const result: SafesByChainId = {};

    for (const [index, allSafeList] of allSafeLists.entries()) {
      const chainId = chains[index].chainId;

      if (allSafeList.status === 'fulfilled') {
        result[chainId] = allSafeList.value.safeList.safes;
      } else {
        result[chainId] = null;
        this.loggingService.warn(
          `Failed to fetch Safe owners. chainId=${chainId}`,
        );
      }
    }

    return result;
  }

  getAllSafesByOwner(args: { ownerAddress: Address }): Promise<SafesByChainId> {
    return this.getAllSafesByOwnerForChains((chainId) =>
      this.getSafesByOwner({
        chainId,
        ownerAddress: args.ownerAddress,
      }),
    );
  }

  getAllSafesByOwnerV2(args: {
    ownerAddress: Address;
  }): Promise<SafesByChainId> {
    return this.getAllSafesByOwnerForChains((chainId) =>
      this.getSafesByOwnerV2({
        chainId,
        ownerAddress: args.ownerAddress,
      }),
    );
  }

  async getLastTransactionSortedByNonce(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<MultisigTransaction | null> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const page = await transactionService.getMultisigTransactions({
      ...args,
      ordering: '-nonce',
      trusted: true,
      limit: 1,
    });
    const { results } = MultisigTransactionPageSchema.parse(page);

    return isEmpty(results) ? null : results[0];
  }

  async proposeTransaction(args: {
    chainId: string;
    safeAddress: Address;
    proposeTransactionDto: ProposeTransactionDto;
  }): Promise<unknown> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const [safe, transaction] = await Promise.all([
      this.getSafe({
        chainId: args.chainId,
        address: args.safeAddress,
      }),
      transactionService
        .getMultisigTransactionWithNoCache(
          args.proposeTransactionDto.safeTxHash,
        )
        .then(MultisigTransactionSchema.parse)
        .catch(() => null),
    ]);

    await this.transactionVerifier.verifyProposal({
      chainId: args.chainId,
      safe,
      proposal: args.proposeTransactionDto,
      transaction,
    });

    if (this.queueServiceEnabled) {
      return await this.queueService.proposeTransaction({
        chainId: args.chainId,
        safeAddress: args.safeAddress,
        proposeTransactionDto: args.proposeTransactionDto,
      });
    }
    return transactionService.postMultisigTransaction({
      address: args.safeAddress,
      data: args.proposeTransactionDto,
    });
  }

  async getNonces(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<{ currentNonce: number; recommendedNonce: number }> {
    const safe = await this.getSafe({
      chainId: args.chainId,
      address: args.safeAddress,
    });

    const lastTransaction = await this.getLastTransactionSortedByNonce({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
    });

    const recommendedNonce = lastTransaction
      ? Math.max(safe.nonce, lastTransaction.nonce + 1)
      : safe.nonce;

    return {
      currentNonce: safe.nonce,
      recommendedNonce: recommendedNonce,
    };
  }

  async getSafesByModule(args: {
    chainId: string;
    moduleAddress: Address;
  }): Promise<SafeList> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const safesByModule = await transactionService.getSafesByModule(
      args.moduleAddress,
    );

    return SafeListSchema.parse(safesByModule);
  }
}
