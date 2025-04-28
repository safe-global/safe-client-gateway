import { Inject, Injectable } from '@nestjs/common';
import isEmpty from 'lodash/isEmpty';
import { Page } from '@/domain/entities/page.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { CreationTransaction } from '@/domain/safe/entities/creation-transaction.entity';
import { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { SafeList } from '@/domain/safe/entities/safe-list.entity';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { Transaction } from '@/domain/safe/entities/transaction.entity';
import {
  Transfer,
  TransferPageSchema,
  TransferSchema,
} from '@/domain/safe/entities/transfer.entity';
import {
  ModuleTransactionPageSchema,
  ModuleTransactionSchema,
} from '@/domain/safe/entities/module-transaction.entity';
import {
  MultisigTransactionPageSchema,
  MultisigTransactionSchema,
} from '@/domain/safe/entities/multisig-transaction.entity';
import { SafeListSchema } from '@/domain/safe/entities/schemas/safe-list.schema';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import {
  TransactionTypePageSchema,
  TransactionWithType,
} from '@/domain/safe/entities/schemas/transaction-type.schema';
import { AddConfirmationDto } from '@/domain/transactions/entities/add-confirmation.dto.entity';
import { ProposeTransactionDto } from '@/domain/transactions/entities/propose-transaction.dto.entity';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { CreationTransactionSchema } from '@/domain/safe/entities/schemas/creation-transaction.schema';
import { SafeSchema } from '@/domain/safe/entities/schemas/safe.schema';
import { z } from 'zod';
import { TransactionVerifierHelper } from '@/routes/transactions/helpers/transaction-verifier.helper';
import { IDataDecoderRepository } from '@/domain/data-decoder/v2/data-decoder.repository.interface';

@Injectable()
export class SafeRepository implements ISafeRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
    private readonly transactionVerifier: TransactionVerifierHelper,
    @Inject(IDataDecoderRepository)
    private readonly dataDecoderRepository: IDataDecoderRepository,
  ) {}

  async getSafe(args: {
    chainId: string;
    address: `0x${string}`;
  }): Promise<Safe> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const safe = await transactionService.getSafe(args.address);
    return SafeSchema.parse(safe);
  }

  async isSafe(args: {
    chainId: string;
    address: `0x${string}`;
  }): Promise<boolean> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const isSafe = await transactionService.isSafe(args.address);
    return z.boolean().parse(isSafe);
  }

  async clearIsSafe(args: {
    chainId: string;
    address: `0x${string}`;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    return transactionService.clearIsSafe(args.address);
  }

  async clearSafe(args: {
    chainId: string;
    address: `0x${string}`;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    return transactionService.clearSafe(args.address);
  }

  async isOwner(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    address: `0x${string}`;
  }): Promise<boolean> {
    const safe = await this.getSafe({
      chainId: args.chainId,
      address: args.safeAddress,
    });
    return safe.owners.includes(args.address);
  }

  async getCollectibleTransfers(args: {
    chainId: string;
    safeAddress: `0x${string}`;
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
    safeAddress: `0x${string}`;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );

    return transactionService.clearTransfers(args.safeAddress);
  }

  async getIncomingTransfers(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: `0x${string}`;
    value?: string;
    tokenAddress?: `0x${string}`;
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
    safeAddress: `0x${string}`;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );

    return transactionService.clearIncomingTransfers(args.safeAddress);
  }

  async addConfirmation(args: {
    chainId: string;
    safeTxHash: string;
    addConfirmationDto: AddConfirmationDto;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );

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

    await transactionService.postConfirmation(args);
  }

  async getModuleTransaction(args: {
    chainId: string;
    moduleTransactionId: string;
  }): Promise<ModuleTransaction> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const moduleTransaction = await transactionService
      .getModuleTransaction(args.moduleTransactionId)
      .then(ModuleTransactionSchema.parse);

    return await this.withFallbackDataDecoded({
      transaction: moduleTransaction,
      chainId: args.chainId,
      data: moduleTransaction.data,
      to: moduleTransaction.to,
    });
  }

  async getModuleTransactions(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    to?: string;
    txHash?: string;
    module?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<ModuleTransaction>> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const page = await transactionService
      .getModuleTransactions(args)
      .then(ModuleTransactionPageSchema.parse);

    page.results = await Promise.all(
      page.results.map((transaction) => {
        return this.withFallbackDataDecoded({
          transaction,
          chainId: args.chainId,
          data: transaction.data,
          to: transaction.to,
        });
      }),
    );

    return page;
  }

  async clearModuleTransactions(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );

    return transactionService.clearModuleTransactions(args.safeAddress);
  }

  async getTransactionQueue(args: {
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

  async getTransactionQueueByModified(args: {
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
    trusted?: boolean;
  }): Promise<Page<MultisigTransaction>> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const page = await transactionService
      .getMultisigTransactions({
        ...args,
        safeAddress: args.safe.address,
        executed: false,
        nonceGte: args.safe.nonce,
      })
      .then(MultisigTransactionPageSchema.parse);

    page.results = await Promise.all(
      page.results.map((transaction) => {
        return this.withFallbackDataDecoded({
          transaction,
          chainId: args.chainId,
          data: transaction.data,
          to: transaction.to,
        });
      }),
    );

    return page;
  }

  async getCreationTransaction(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<CreationTransaction> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const createTransaction = await transactionService
      .getCreationTransaction(args.safeAddress)
      .then(CreationTransactionSchema.parse);

    return await this.withFallbackDataDecoded({
      transaction: createTransaction,
      chainId: args.chainId,
      data: createTransaction.setupData,
      to: createTransaction.factoryAddress,
    });
  }

  async getCreationTransactionWithNoCache(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<CreationTransaction> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const createTransaction =
      await transactionService.getCreationTransactionWithNoCache(
        args.safeAddress,
      );
    // Note: we do not fallback to the Data Decoder here as it is a direct
    // proxy of the Transaction Service
    return CreationTransactionSchema.parse(createTransaction);
  }

  async getTransactionHistory(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transaction>> {
    return this.getAllExecutedTransactions(args);
  }

  private async getAllExecutedTransactions(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    ordering?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transaction>> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const page = await transactionService
      .getAllTransactions({
        ...args,
        executed: true,
        queued: false,
      })
      .then(TransactionTypePageSchema.parse);

    page.results = await Promise.all(
      page.results.map((transaction) => {
        if (!('to' in transaction)) {
          return transaction;
        }
        return this.withFallbackDataDecoded({
          transaction,
          chainId: args.chainId,
          data: transaction.data,
          to: transaction.to,
        });
      }),
    );

    return page;
  }

  async clearAllExecutedTransactions(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );

    return transactionService.clearAllTransactions(args.safeAddress);
  }

  async clearMultisigTransaction(args: {
    chainId: string;
    safeTransactionHash: string;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    return transactionService.clearMultisigTransaction(
      args.safeTransactionHash,
    );
  }

  async getMultiSigTransaction(args: {
    chainId: string;
    safeTransactionHash: string;
  }): Promise<MultisigTransaction> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const multiSigTransaction = await transactionService
      .getMultisigTransaction(args.safeTransactionHash)
      .then(MultisigTransactionSchema.parse);

    return await this.withFallbackDataDecoded({
      transaction: multiSigTransaction,
      chainId: args.chainId,
      data: multiSigTransaction.data,
      to: multiSigTransaction.to,
    });
  }

  async getMultiSigTransactionWithNoCache(args: {
    chainId: string;
    safeTransactionHash: string;
  }): Promise<MultisigTransaction> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const multisigTransaction = await transactionService
      .getMultisigTransactionWithNoCache(args.safeTransactionHash)
      // Note: we do not fallback to the Data Decoder here as it is a direct
      // proxy of the Transaction Service
      .then(MultisigTransactionSchema.parse);

    const safe = await this.getSafe({
      chainId: args.chainId,
      address: multisigTransaction.safe,
    });

    this.transactionVerifier.verifyApiTransaction({
      chainId: args.chainId,
      transaction: multisigTransaction,
      safe: safe,
    });

    return multisigTransaction;
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
    await transactionService.deleteTransaction(args);

    // Ensure transaction is removed from cache in case event is not received
    Promise.all([
      transactionService.clearMultisigTransaction(args.safeTxHash),
      transactionService.clearMultisigTransactions(safe),
    ]).catch(() => {
      this.loggingService.warn(
        'Failed to immediately clear deleted transaction from cache',
      );
    });
  }

  async clearMultisigTransactions(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    return transactionService.clearMultisigTransactions(args.safeAddress);
  }

  async getMultisigTransactionsWithNoCache(args: {
    chainId: string;
    safeAddress: `0x${string}`;
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
        // Note: we do not fallback to the Data Decoder here as it is a direct
        // proxy of the Transaction Service
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

    return multisigTransactions;
  }

  async getMultisigTransactions(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    executed?: boolean;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: `0x${string}`;
    value?: string;
    nonce?: string;
    nonceGte?: number;
    limit?: number;
    offset?: number;
  }): Promise<Page<MultisigTransaction>> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const page = await transactionService
      .getMultisigTransactions({
        ...args,
        ordering: '-nonce',
        trusted: true,
      })
      .then(MultisigTransactionPageSchema.parse);

    page.results = await Promise.all(
      page.results.map((transaction) => {
        return this.withFallbackDataDecoded({
          transaction,
          chainId: args.chainId,
          data: transaction.data,
          to: transaction.to,
        });
      }),
    );

    return page;
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
    safeAddress: `0x${string}`;
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
    ownerAddress: `0x${string}`;
  }): Promise<SafeList> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const safeList = await transactionService.getSafesByOwner(
      args.ownerAddress,
    );

    return SafeListSchema.parse(safeList);
  }

  // TODO: Remove with /owners/:ownerAddress/safes
  // @deprecated
  async deprecated__getAllSafesByOwner(args: {
    ownerAddress: `0x${string}`;
  }): Promise<{ [chainId: string]: Array<string> }> {
    const chains = await this.chainsRepository.getAllChains();
    const allSafeLists = await Promise.all(
      chains.map(async ({ chainId }) => {
        const safeList = await this.getSafesByOwner({
          chainId,
          ownerAddress: args.ownerAddress,
        });

        return {
          chainId,
          safeList,
        };
      }),
    );

    return allSafeLists.reduce((acc, { chainId, safeList }) => {
      return {
        ...acc,
        [chainId]: safeList.safes,
      };
    }, {});
  }

  async getAllSafesByOwner(args: {
    ownerAddress: `0x${string}`;
  }): Promise<{ [chainId: string]: Array<string> | null }> {
    const chains = await this.chainsRepository.getAllChains();
    const allSafeLists = await Promise.allSettled(
      chains.map(async ({ chainId }) => {
        const safeList = await this.getSafesByOwner({
          chainId,
          ownerAddress: args.ownerAddress,
        });

        return {
          chainId,
          safeList,
        };
      }),
    );

    const result: { [chainId: string]: Array<string> | null } = {};

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

  async getLastTransactionSortedByNonce(args: {
    chainId: string;
    safeAddress: `0x${string}`;
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

    if (isEmpty(results)) {
      return null;
    }

    const transaction = results[0];
    return await this.withFallbackDataDecoded({
      transaction,
      chainId: args.chainId,
      data: transaction.data,
      to: transaction.to,
    });
  }

  async proposeTransaction(args: {
    chainId: string;
    safeAddress: `0x${string}`;
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

    return transactionService.postMultisigTransaction({
      address: args.safeAddress,
      data: args.proposeTransactionDto,
    });
  }

  async getNonces(args: {
    chainId: string;
    safeAddress: `0x${string}`;
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
    moduleAddress: `0x${string}`;
  }): Promise<SafeList> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const safesByModule = await transactionService.getSafesByModule(
      args.moduleAddress,
    );

    return SafeListSchema.parse(safesByModule);
  }

  private async withFallbackDataDecoded<
    T extends
      | ModuleTransaction
      | MultisigTransaction
      | CreationTransaction
      | TransactionWithType,
  >(args: {
    transaction: T;
    chainId: string;
    data: `0x${string}` | null;
    to: `0x${string}`;
  }): Promise<T> {
    if (
      !('dataDecoded' in args.transaction) ||
      args.transaction.dataDecoded ||
      !args.data
    ) {
      return args.transaction;
    }

    args.transaction.dataDecoded = await this.dataDecoderRepository
      .getDecodedData({
        chainId: args.chainId,
        data: args.data,
        to: args.to,
      })
      .catch(() => null);

    return args.transaction;
  }
}
