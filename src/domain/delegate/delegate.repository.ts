import { Inject, Injectable } from '@nestjs/common';
import { IDelegateRepository } from '@/domain/delegate/delegate.repository.interface';
import { Delegate } from '@/domain/delegate/entities/delegate.entity';
import { Page } from '@/domain/entities/page.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { DelegateSchema } from '@/domain/delegate/entities/schemas/delegate.schema';

@Injectable()
export class DelegateRepository implements IDelegateRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
  ) {}

  async getDelegates(args: {
    chainId: string;
    safeAddress?: string;
    delegate?: string;
    delegator?: string;
    label?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Delegate>> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    const page = await transactionService.getDelegates({
      safeAddress: args.safeAddress,
      delegate: args.delegate,
      delegator: args.delegator,
      label: args.label,
      limit: args.limit,
      offset: args.offset,
    });

    page?.results.map((result) => DelegateSchema.parse(result));
    return page;
  }

  async postDelegate(args: {
    chainId: string;
    safeAddress?: string;
    delegate?: string;
    delegator?: string;
    signature?: string;
    label?: string;
  }): Promise<void> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    await transactionService.postDelegate({
      safeAddress: args.safeAddress,
      delegate: args.delegate,
      delegator: args.delegator,
      signature: args.signature,
      label: args.label,
    });
  }

  async deleteDelegate(args: {
    chainId: string;
    delegate: string;
    delegator: string;
    signature: string;
  }): Promise<unknown> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    return transactionService.deleteDelegate({
      delegate: args.delegate,
      delegator: args.delegator,
      signature: args.signature,
    });
  }

  async deleteSafeDelegate(args: {
    chainId: string;
    delegate: string;
    safeAddress: string;
    signature: string;
  }): Promise<unknown> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    return transactionService.deleteSafeDelegate({
      delegate: args.delegate,
      safeAddress: args.safeAddress,
      signature: args.signature,
    });
  }
}
