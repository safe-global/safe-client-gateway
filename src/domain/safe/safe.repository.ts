import { Inject, Injectable } from '@nestjs/common';
import { isEmpty } from 'lodash';
import { Safe } from './entities/safe.entity';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { ISafeRepository } from './safe.repository.interface';
import { SafeValidator } from './safe.validator';
import { Page } from '../entities/page.entity';
import { Transfer } from './entities/transfer.entity';
import { TransferValidator } from './transfer.validator';
import { MultisigTransaction } from './entities/multisig-transaction.entity';
import { MultisigTransactionValidator } from './multisig-transaction.validator';
import { Transaction } from './entities/transaction.entity';
import { TransactionTypeValidator } from './transaction-type.validator';
import { ModuleTransaction } from './entities/module-transaction.entity';
import { SafeList } from './entities/safe-list.entity';
import { SafeListValidator } from './safe-list.validator';
import { ModuleTransactionValidator } from './module-transaction.validator';
import { CreationTransaction } from './entities/creation-transaction.entity';
import { CreationTransactionValidator } from './creation-transaction.validator';
import { ProposeTransactionDto } from '../transactions/entities/propose-transaction.dto.entity';
import { AddConfirmationDto } from '../transactions/entities/add-confirmation.dto.entity';

@Injectable()
export class SafeRepository implements ISafeRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    private readonly multisigTransactionValidator: MultisigTransactionValidator,
    private readonly safeListValidator: SafeListValidator,
    private readonly safeValidator: SafeValidator,
    private readonly transactionTypeValidator: TransactionTypeValidator,
    private readonly transferValidator: TransferValidator,
    private readonly moduleTransactionValidator: ModuleTransactionValidator,
    private readonly creationTransactionValidator: CreationTransactionValidator,
  ) {}

  async getSafe(args: { chainId: string; address: string }): Promise<Safe> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    const safe: Safe = await transactionService.getSafe(args.address);
    return this.safeValidator.validate(safe);
  }

  async clearSafe(args: { chainId: string; address: string }): Promise<void> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    return transactionService.clearSafe(args.address);
  }

  async getCollectibleTransfers(args: {
    chainId: string;
    safeAddress: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transfer>> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);

    const page = await transactionService.getTransfers({
      ...args,
      onlyErc721: true,
    });
    return this.transferValidator.validatePage(page);
  }

  async clearCollectibleTransfers(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);

    return transactionService.clearTransfers(args.safeAddress);
  }

  async getIncomingTransfers(args: {
    chainId: string;
    safeAddress: string;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: string;
    value?: string;
    tokenAddress?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transfer>> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    const page = await transactionService.getIncomingTransfers(args);
    return this.transferValidator.validatePage(page);
  }

  async clearIncomingTransfers(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);

    return transactionService.clearIncomingTransfers(args.safeAddress);
  }

  async addConfirmation(args: {
    chainId: string;
    safeTxHash: string;
    addConfirmationDto: AddConfirmationDto;
  }): Promise<void> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    return transactionService.postConfirmation(args).then(() => {
      return;
    });
  }

  async getModuleTransaction(args: {
    chainId: string;
    moduleTransactionId: string;
  }): Promise<ModuleTransaction> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    const moduleTransaction = await transactionService.getModuleTransaction(
      args.moduleTransactionId,
    );
    return this.moduleTransactionValidator.validate(moduleTransaction);
  }

  async getModuleTransactions(args: {
    chainId: string;
    safeAddress: string;
    to?: string;
    module?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<ModuleTransaction>> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    const page = await transactionService.getModuleTransactions(args);
    return this.moduleTransactionValidator.validatePage(page);
  }

  async clearModuleTransactions(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);

    return transactionService.clearModuleTransactions(args.safeAddress);
  }

  async getTransactionQueue(args: {
    chainId: string;
    safe: Safe;
    limit?: number;
    offset?: number;
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
  }): Promise<Page<MultisigTransaction>> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    const page: Page<MultisigTransaction> =
      await transactionService.getMultisigTransactions({
        ...args,
        safeAddress: args.safe.address,
        executed: false,
        trusted: true,
        nonceGte: args.safe.nonce,
      });
    return this.multisigTransactionValidator.validatePage(page);
  }

  async getCreationTransaction(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<CreationTransaction> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    const createTransaction = await transactionService.getCreationTransaction(
      args.safeAddress,
    );
    return this.creationTransactionValidator.validate(createTransaction);
  }

  async getTransactionHistoryByExecutionDate(args: {
    chainId: string;
    safeAddress: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transaction>> {
    return this.getAllExecutedTransactions({
      ...args,
      ordering: 'executionDate',
    });
  }

  async getTransactionHistory(args: {
    chainId: string;
    safeAddress: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transaction>> {
    return this.getAllExecutedTransactions(args);
  }

  private async getAllExecutedTransactions(args: {
    chainId: string;
    safeAddress: string;
    ordering?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transaction>> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    const page: Page<Transaction> = await transactionService.getAllTransactions(
      {
        ...args,
        executed: true,
        queued: false,
      },
    );
    return this.transactionTypeValidator.validatePage(page);
  }

  async clearAllExecutedTransactions(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);

    return transactionService.clearAllTransactions(args.safeAddress);
  }

  async clearMultisigTransaction(args: {
    chainId: string;
    safeTransactionHash: string;
  }): Promise<void> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    return transactionService.clearMultisigTransaction(
      args.safeTransactionHash,
    );
  }

  async getMultiSigTransaction(args: {
    chainId: string;
    safeTransactionHash: string;
  }): Promise<MultisigTransaction> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    const multiSigTransaction = await transactionService.getMultisigTransaction(
      args.safeTransactionHash,
    );

    return this.multisigTransactionValidator.validate(multiSigTransaction);
  }

  async clearMultisigTransactions(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    return transactionService.clearMultisigTransactions(args.safeAddress);
  }

  async getMultisigTransactions(args: {
    chainId: string;
    safeAddress: string;
    executed?: boolean;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: string;
    value?: string;
    nonce?: string;
    nonceGte?: number;
    limit?: number;
    offset?: number;
  }): Promise<Page<MultisigTransaction>> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    const page = await transactionService.getMultisigTransactions({
      ...args,
      ordering: '-nonce',
      trusted: true,
    });
    return this.multisigTransactionValidator.validatePage(page);
  }

  async getTransfer(args: {
    chainId: string;
    transferId: string;
  }): Promise<Transfer> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    const transfer = await transactionService.getTransfer(args.transferId);
    return this.transferValidator.validate(transfer);
  }

  async getSafesByOwner(args: {
    chainId: string;
    ownerAddress: string;
  }): Promise<SafeList> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    const safeList = await transactionService.getSafesByOwner(
      args.ownerAddress,
    );

    return this.safeListValidator.validate(safeList);
  }

  async getLastTransactionSortedByNonce(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<MultisigTransaction | null> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    const page: Page<Transaction> =
      await transactionService.getMultisigTransactions({
        ...args,
        ordering: '-nonce',
        trusted: true,
        limit: 1,
      });

    return isEmpty(page.results)
      ? null
      : this.multisigTransactionValidator.validate(page.results[0]);
  }

  async proposeTransaction(args: {
    chainId: string;
    safeAddress: string;
    proposeTransactionDto: ProposeTransactionDto;
  }): Promise<unknown> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);

    return transactionService.postMultisigTransaction({
      address: args.safeAddress,
      data: args.proposeTransactionDto,
    });
  }
}
