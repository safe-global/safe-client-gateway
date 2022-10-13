import { Inject, Injectable } from '@nestjs/common';
import { Safe } from './entities/safe.entity';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { ISafeRepository } from './safe.repository.interface';
import { SafeValidator } from './safe.validator';
import { Delegate } from './entities/delegate.entity';
import { Page } from '../entities/page.entity';
import { DelegateValidator } from './delegate.validator';

@Injectable()
export class SafeRepository implements ISafeRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    private readonly safeValidator: SafeValidator,
    private readonly delegateValidator: DelegateValidator,
  ) {}

  async getSafe(chainId: string, address: string): Promise<Safe> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    const safe: Safe = await transactionService.getSafe(address);
    return this.safeValidator.validate(safe);
  }

  async getDelegates(
    chainId: string,
    safeAddress?: string,
    delegate?: string,
    delegator?: string,
    label?: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<Delegate>> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    const page = await transactionService.getDelegates(
      safeAddress,
      delegate,
      delegator,
      label,
      limit,
      offset,
    );

    page?.results.map((result) => this.delegateValidator.validate(result));
    return page;
  }
}
