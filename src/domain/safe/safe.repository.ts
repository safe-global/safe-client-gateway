import { Inject, Injectable } from '@nestjs/common';
import { Safe } from './entities/safe.entity';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { ISafeRepository } from './safe.repository.interface';
import { SafeValidator } from './safe.validator';
import { Page } from '../entities/page.entity';
import { Transfer } from './entities/transfer.entity';
import { TransferValidator } from './transfer.validator';

@Injectable()
export class SafeRepository implements ISafeRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    private readonly safeValidator: SafeValidator,
    private readonly transferValidator: TransferValidator,
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
}
