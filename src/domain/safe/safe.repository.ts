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

  async getSafe(chainId: string, address: string): Promise<Safe> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    const safe: Safe = await transactionService.getSafe(address);
    return this.safeValidator.validate(safe);
  }

  async clearSafe(chainId: string, address: string): Promise<void> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    return transactionService.clearSafe(address);
  }

  async getCollectibleTransfers(
    chainId: string,
    safeAddress: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<Transfer>> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);

    const page = await transactionService.getTransfers(
      safeAddress,
      undefined,
      true,
      limit,
      offset,
    );
    page.results.map((transfer) => this.transferValidator.validate(transfer));

    return page;
  }

  async clearCollectibleTransfers(
    chainId: string,
    safeAddress: string,
  ): Promise<void> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);

    return transactionService.clearTransfers(safeAddress);
  }

  async getIncomingTransfers(
    chainId: string,
    safeAddress: string,
    executionDateGte?: string,
    executionDateLte?: string,
    to?: string,
    value?: string,
    tokenAddress?: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<Transfer>> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    const page = await transactionService.getIncomingTransfers(
      safeAddress,
      executionDateGte,
      executionDateLte,
      to,
      value,
      tokenAddress,
      limit,
      offset,
    );
    page.results.map((transfer) => this.transferValidator.validate(transfer));

    return page;
  }

  async clearIncomingTransfers(
    chainId: string,
    safeAddress: string,
  ): Promise<void> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);

    return transactionService.clearIncomingTransfers(safeAddress);
  }

  async addConfirmation(
    chainId: string,
    safeTxHash: string,
    addConfirmationDto: AddConfirmationDto,
  ): Promise<void> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    return transactionService
      .postConfirmation(safeTxHash, addConfirmationDto)
      .then(() => {
        return;
      });
  }

  async getModuleTransaction(
    chainId: string,
    moduleTransactionId: string,
  ): Promise<ModuleTransaction> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    const moduleTransaction = await transactionService.getModuleTransaction(
      moduleTransactionId,
    );
    return this.moduleTransactionValidator.validate(moduleTransaction);
  }

  async getModuleTransactions(
    chainId: string,
    safeAddress: string,
    to?: string,
    module?: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<ModuleTransaction>> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    const page = await transactionService.getModuleTransactions(
      safeAddress,
      to,
      module,
      limit,
      offset,
    );
    page.results.map((moduleTransaction) =>
      this.moduleTransactionValidator.validate(moduleTransaction),
    );

    return page;
  }

  async clearModuleTransactions(
    chainId: string,
    safeAddress: string,
  ): Promise<void> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);

    return transactionService.clearModuleTransactions(safeAddress);
  }

  async getTransactionQueue(
    chainId: string,
    safe: Safe,
    limit?: number,
    offset?: number,
  ): Promise<Page<MultisigTransaction>> {
    return this._getTransactionQueue(
      chainId,
      safe,
      'nonce,submissionDate',
      limit,
      offset,
    );
  }

  async getTransactionQueueByModified(
    chainId: string,
    safe: Safe,
    limit?: number,
    offset?: number,
  ): Promise<Page<MultisigTransaction>> {
    return this._getTransactionQueue(chainId, safe, '-modified', limit, offset);
  }

  private async _getTransactionQueue(
    chainId: string,
    safe: Safe,
    ordering: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<MultisigTransaction>> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    const page: Page<MultisigTransaction> =
      await transactionService.getMultisigTransactions(
        safe.address,
        ordering,
        false,
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        safe.nonce,
        limit,
        offset,
      );

    page.results.map((multisigTransaction) =>
      this.multisigTransactionValidator.validate(multisigTransaction),
    );

    return page;
  }

  async getCreationTransaction(
    chainId: string,
    safeAddress: string,
  ): Promise<CreationTransaction> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    const createTransaction = await transactionService.getCreationTransaction(
      safeAddress,
    );
    return this.creationTransactionValidator.validate(createTransaction);
  }

  async getTransactionHistoryByExecutionDate(
    chainId: string,
    safeAddress: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<Transaction>> {
    return this.getAllExecutedTransactions(
      chainId,
      safeAddress,
      'executionDate',
      limit,
      offset,
    );
  }

  async getTransactionHistory(
    chainId: string,
    safeAddress: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<Transaction>> {
    return this.getAllExecutedTransactions(
      chainId,
      safeAddress,
      undefined,
      limit,
      offset,
    );
  }

  private async getAllExecutedTransactions(
    chainId: string,
    safeAddress: string,
    ordering?: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<Transaction>> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    const page: Page<Transaction> = await transactionService.getAllTransactions(
      safeAddress,
      ordering,
      true,
      false,
      limit,
      offset,
    );

    page.results.map((transaction) =>
      this.transactionTypeValidator.validate(transaction),
    );

    return page;
  }

  async clearAllExecutedTransactions(
    chainId: string,
    safeAddress: string,
  ): Promise<void> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);

    return transactionService.clearAllTransactions(safeAddress);
  }

  async clearMultisigTransaction(
    chainId: string,
    safeTransactionHash: string,
  ): Promise<void> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    return transactionService.clearMultisigTransaction(safeTransactionHash);
  }

  async getMultiSigTransaction(
    chainId: string,
    safeTransactionHash: string,
  ): Promise<MultisigTransaction> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    const multiSigTransaction = await transactionService.getMultisigTransaction(
      safeTransactionHash,
    );

    return this.multisigTransactionValidator.validate(multiSigTransaction);
  }

  async clearMultisigTransactions(
    chainId: string,
    safeAddress: string,
  ): Promise<void> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    return transactionService.clearMultisigTransactions(safeAddress);
  }

  async getMultisigTransactions(
    chainId: string,
    safeAddress: string,
    executed?: boolean,
    executionDateGte?: string,
    executionDateLte?: string,
    to?: string,
    value?: string,
    nonce?: string,
    nonceGte?: number,
    limit?: number,
    offset?: number,
  ): Promise<Page<MultisigTransaction>> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    const page = await transactionService.getMultisigTransactions(
      safeAddress,
      '-nonce',
      executed,
      true,
      executionDateGte,
      executionDateLte,
      to,
      value,
      nonce,
      nonceGte,
      limit,
      offset,
    );

    page.results.map((multiSigTransaction) =>
      this.multisigTransactionValidator.validate(multiSigTransaction),
    );

    return page;
  }

  async getTransfer(chainId: string, transferId: string): Promise<Transfer> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    const transfer = await transactionService.getTransfer(transferId);
    return this.transferValidator.validate(transfer);
  }

  async getSafesByOwner(
    chainId: string,
    ownerAddress: string,
  ): Promise<SafeList> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    const safeList = await transactionService.getSafesByOwner(ownerAddress);

    return this.safeListValidator.validate(safeList);
  }

  async getLastTransactionSortedByNonce(
    chainId: string,
    safeAddress: string,
  ): Promise<MultisigTransaction | null> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    const page: Page<Transaction> =
      await transactionService.getMultisigTransactions(
        safeAddress,
        '-nonce',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        1,
      );

    return isEmpty(page.results)
      ? null
      : this.multisigTransactionValidator.validate(page.results[0]);
  }

  async proposeTransaction(
    chainId: string,
    safeAddress: string,
    proposeTransactionDto: ProposeTransactionDto,
  ): Promise<unknown> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);

    return transactionService.postMultisigTransaction(
      safeAddress,
      proposeTransactionDto,
    );
  }
}
