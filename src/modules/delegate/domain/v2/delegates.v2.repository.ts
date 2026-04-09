// SPDX-License-Identifier: FSL-1.1-MIT
import { IQueueServiceApi } from '@/datasources/queue-service-api/queue-service-api.interface';
import { QueueServiceRoutingHelper } from '@/datasources/queue-service-api/queue-service-routing.helper';
import { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import { DelegatePageSchema } from '@/modules/delegate/domain/entities/schemas/delegate.schema';
import { IDelegatesV2Repository } from '@/modules/delegate/domain/v2/delegates.v2.repository.interface';
import { Page } from '@/domain/entities/page.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';

@Injectable()
export class DelegatesV2Repository implements IDelegatesV2Repository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    @Inject(IQueueServiceApi)
    private readonly queueServiceApi: IQueueServiceApi,
    private readonly routingHelper: QueueServiceRoutingHelper,
  ) {}

  async getDelegates(args: {
    chainId: string;
    safeAddress?: Address;
    delegate?: Address;
    delegator?: Address;
    label?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Delegate>> {
    const page = await this.routingHelper.route({
      whenEnabled: () =>
        this.queueServiceApi.getDelegates({
          chainId: Number(args.chainId),
          safe: args.safeAddress,
          delegate: args.delegate,
          delegator: args.delegator,
          limit: args.limit,
          offset: args.offset,
        }),
      whenDisabled: async () => {
        const transactionService = await this.transactionApiManager.getApi(
          args.chainId,
        );
        return transactionService.getDelegatesV2({
          safeAddress: args.safeAddress,
          delegate: args.delegate,
          delegator: args.delegator,
          label: args.label,
          limit: args.limit,
          offset: args.offset,
        });
      },
    });

    return DelegatePageSchema.parse(page);
  }

  async clearDelegates(args: {
    chainId: string;
    safeAddress?: Address;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    await transactionService.clearDelegates(args.safeAddress);
  }

  async postDelegate(args: {
    chainId: string;
    safeAddress: Address | null;
    delegate: Address;
    delegator: Address;
    signature: string;
    label: string;
  }): Promise<void> {
    await this.routingHelper.route({
      whenEnabled: () =>
        this.queueServiceApi.postDelegate({
          delegate: args.delegate,
          delegator: args.delegator,
          signature: args.signature,
          chainId: Number(args.chainId),
          safe: args.safeAddress ?? undefined,
          label: args.label,
        }),
      whenDisabled: async () => {
        const transactionService = await this.transactionApiManager.getApi(
          args.chainId,
        );
        await transactionService.postDelegateV2({
          safeAddress: args.safeAddress,
          delegate: args.delegate,
          delegator: args.delegator,
          signature: args.signature,
          label: args.label,
        });
      },
    });
  }

  async deleteDelegate(args: {
    chainId: string;
    delegate: Address;
    delegator: Address;
    safeAddress: Address | null;
    signature: string;
  }): Promise<unknown> {
    return this.routingHelper.route({
      whenEnabled: () =>
        this.queueServiceApi.deleteDelegate({
          delegate: args.delegate,
          delegator: args.delegator,
          signature: args.signature,
          chainId: Number(args.chainId),
          safe: args.safeAddress ?? undefined,
        }),
      whenDisabled: async () => {
        const transactionService = await this.transactionApiManager.getApi(
          args.chainId,
        );
        return transactionService.deleteDelegateV2({
          delegate: args.delegate,
          delegator: args.delegator,
          safeAddress: args.safeAddress,
          signature: args.signature,
        });
      },
    });
  }
}
