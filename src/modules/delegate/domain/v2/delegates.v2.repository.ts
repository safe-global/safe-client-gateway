// SPDX-License-Identifier: FSL-1.1-MIT
import { IConfigurationService } from '@/config/configuration.service.interface';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { IQueue } from '@/modules/queue/queue.interface';
import { IDelegatesV2Repository } from '@/modules/delegate/domain/v2/delegates.v2.repository.interface';
import { Page } from '@/domain/entities/page.entity';
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { QueueDelegatePageSchema } from '@/modules/queue/entities/delegate.entity';
import { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import { DelegatePageSchema } from '@/modules/delegate/domain/entities/schemas/delegate.schema';

@Injectable()
export class DelegatesV2Repository implements IDelegatesV2Repository {
  private readonly queueServiceEnabled: boolean;

  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    @Inject(IQueue)
    private readonly queueService: IQueue,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.queueServiceEnabled = this.configurationService.getOrThrow<boolean>(
      'features.queueService',
    );
  }

  async getDelegates(args: {
    chainId: string;
    safeAddress?: Address;
    delegate?: Address;
    delegator?: Address;
    label?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Delegate>> {
    if (!this.queueServiceEnabled) {
      const transactionService = await this.transactionApiManager.getApi(
        args.chainId,
      );
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
    const page = await this.queueService.getDelegates(args);
    const parsed = QueueDelegatePageSchema.parse(page);
    return {
      ...parsed,
      results: parsed.results.map((d) => ({
        safe: d.safe,
        delegate: d.delegate,
        delegator: d.delegator,
        label: d.label ?? '',
      })),
    };
  }

  async clearDelegates(args: {
    chainId: string;
    safeAddress?: Address;
  }): Promise<void> {
    if (!this.queueServiceEnabled) {
      const transactionService = await this.transactionApiManager.getApi(
        args.chainId,
      );
      await transactionService.clearDelegates(args.safeAddress);
      return;
    }
    await this.queueService.clearDelegates(args);
  }

  async postDelegate(args: {
    chainId: string;
    safeAddress: Address | null;
    delegate: Address;
    delegator: Address;
    signature: string;
    label: string;
  }): Promise<void> {
    if (!this.queueServiceEnabled) {
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
      return;
    }
    await this.queueService.postDelegate(args);
  }

  async deleteDelegate(args: {
    chainId: string;
    delegate: Address;
    delegator: Address;
    safeAddress: Address | null;
    signature: string;
  }): Promise<unknown> {
    if (!this.queueServiceEnabled) {
      const transactionService = await this.transactionApiManager.getApi(
        args.chainId,
      );
      return transactionService.deleteDelegateV2({
        delegate: args.delegate,
        delegator: args.delegator,
        safeAddress: args.safeAddress,
        signature: args.signature,
      });
    }
    return this.queueService.deleteDelegate(args);
  }
}
