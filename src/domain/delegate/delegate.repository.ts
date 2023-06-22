import { Inject, Injectable } from '@nestjs/common';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { IDelegateRepository } from './delegate.repository.interface';
import { Delegate } from './entities/delegate.entity';
import { Page } from '../entities/page.entity';
import { DelegateValidator } from './delegate.validator';

@Injectable()
export class DelegateRepository implements IDelegateRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    private readonly delegateValidator: DelegateValidator,
  ) {}

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

  async postDelegate(
    chainId: string,
    safeAddress?: string,
    delegate?: string,
    delegator?: string,
    signature?: string,
    label?: string,
  ): Promise<void> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    await transactionService.postDelegate(
      safeAddress,
      delegate,
      delegator,
      signature,
      label,
    );
  }

  async deleteDelegate(
    chainId: string,
    delegate: string,
    delegator: string,
    signature: string,
  ): Promise<unknown> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    const result = await transactionService.deleteDelegate(
      delegate,
      delegator,
      signature,
    );
    return result;
  }

  async deleteSafeDelegate(
    chainId: string,
    delegate: string,
    safeAddress: string,
    signature: string,
  ): Promise<void> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    await transactionService.deleteSafeDelegate(
      delegate,
      safeAddress,
      signature,
    );
  }
}
