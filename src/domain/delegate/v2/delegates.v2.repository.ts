import { Delegate } from '@/domain/delegate/entities/delegate.entity';
import { DelegatePageSchema } from '@/domain/delegate/entities/schemas/delegate.schema';
import { IDelegatesV2Repository } from '@/domain/delegate/v2/delegates.v2.repository.interface';
import { Page } from '@/domain/entities/page.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class DelegatesV2Repository implements IDelegatesV2Repository {
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
    const page = await transactionService.getDelegatesV2({
      safeAddress: args.safeAddress,
      delegate: args.delegate,
      delegator: args.delegator,
      label: args.label,
      limit: args.limit,
      offset: args.offset,
    });

    return DelegatePageSchema.parse(page);
  }
}
