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

@Injectable()
export class SafeRepository implements ISafeRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    private readonly safeValidator: SafeValidator,
    private readonly transferValidator: TransferValidator,
    private readonly multisigTransactionValidator: MultisigTransactionValidator,
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
}
