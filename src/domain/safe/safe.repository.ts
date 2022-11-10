import { Inject, Injectable } from '@nestjs/common';
import { Safe } from './entities/safe.entity';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { ISafeRepository } from './safe.repository.interface';
import { SafeValidator } from './safe.validator';
import { Page } from '../entities/page.entity';
import { Transfer } from './entities/transfer.entity';
import { TransferValidator } from './transfer.validator';
import { MultisigTransaction } from './entities/multisig-transaction.entity';
import { MultisigTransactionValidator } from './multisig-transaction.validator';
import { TransactionType } from './entities/transaction-type.entity';
import { TransactionTypeValidator } from './transaction-type.validator';
import { ModuleTransaction } from './entities/module-transaction.entity';
import { SafeList } from './entities/safe-list.entity';
import { SafeListValidator } from './safe-list.validator';
import { ModuleTransactionValidator } from './module-transaction.validator';

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
  ) {}

  async getSafe(chainId: string, address: string): Promise<Safe> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    const safe: Safe = await transactionService.getSafe(address);
    return this.safeValidator.validate(safe);
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

  async getQueuedTransactions(
    chainId: string,
    safeAddress: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<MultisigTransaction>> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    const page: Page<MultisigTransaction> =
      await transactionService.getMultisigTransactions(
        safeAddress,
        '-modified',
        false,
        true,
        limit,
        offset,
      );

    page.results.map((multisigTransaction) =>
      this.multisigTransactionValidator.validate(multisigTransaction),
    );

    return page;
  }

  async getTransactionHistory(
    chainId: string,
    safeAddress: string,
  ): Promise<Page<TransactionType>> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    const page: Page<TransactionType> =
      await transactionService.getAllTransactions(safeAddress);

    page.results.map((transaction) =>
      this.transactionTypeValidator.validate(transaction),
    );

    return page;
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

  async getSafesByOwner(
    chainId: string,
    ownerAddress: string,
  ): Promise<SafeList> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    const safeList = transactionService.getSafesByOwner(ownerAddress);

    return this.safeListValidator.validate(safeList);
  }
}
