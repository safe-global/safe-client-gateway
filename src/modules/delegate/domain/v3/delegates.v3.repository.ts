// SPDX-License-Identifier: FSL-1.1-MIT

import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { Page } from '#/domain/entities/page.entity';
import { ITransactionApiManager } from '#/domain/interfaces/transaction-api.manager.interface';
import { ILoggingService, LoggingService } from '#/logging/logging.interface';
import { Delegate } from '#/modules/delegate/domain/entities/delegate.entity';
import { IDelegatesV3Repository } from '#/modules/delegate/domain/v3/delegates.v3.repository.interface';
import { SafeQueueDelegatePageSchema } from '#/modules/safe-queue/entities/delegate.entity';
import { clearBothCacheLayers } from '#/modules/safe-queue/helpers/clear-cache-layers.helper';
import { ISafeQueueService } from '#/modules/safe-queue/safe-queue.interface';

@Injectable()
export class DelegatesV3Repository implements IDelegatesV3Repository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    @Inject(ISafeQueueService)
    private readonly safeQueueService: ISafeQueueService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
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
    const page = await this.safeQueueService.getDelegates(args);
    const parsed = SafeQueueDelegatePageSchema.parse(page);
    return {
      ...parsed,
      results: parsed.results.map((d) => ({
        safe: d.safe,
        delegate: d.delegate,
        delegator: d.delegator,
        // The queue allows a null label; the domain Delegate (and the v2
        // endpoint, served by the tx service) require a string. Coerce to ''
        // so "no label" reads the same on both versions.
        label: d.label ?? '',
      })),
    };
  }

  /**
   * Also clears the tx-service layer: the v1 and v2 delegate endpoints still
   * read delegates from the tx service, and this is the only clear the
   * delegate webhook events trigger.
   */
  async clearDelegates(args: {
    chainId: string;
    safeAddress?: Address;
  }): Promise<void> {
    await clearBothCacheLayers(
      this.loggingService,
      this.transactionApiManager
        .getApi(args.chainId)
        .then((transactionService) => {
          return transactionService.clearDelegates(args.safeAddress);
        }),
      this.safeQueueService.clearDelegates(args),
      `delegates cache. chainId=${args.chainId}, safeAddress=${args.safeAddress}`,
    );
  }

  async postDelegate(args: {
    chainId: string;
    safeAddress: Address | null;
    delegate: Address;
    delegator: Address;
    signature: string;
    label: string;
  }): Promise<void> {
    await this.safeQueueService.postDelegate(args);
    await this.clearDelegates({
      chainId: args.chainId,
      safeAddress: args.safeAddress ?? undefined,
    });
  }

  async updateDelegate(args: {
    chainId: string;
    safeAddress: Address | null;
    delegate: Address;
    delegator: Address;
    signature: string;
    label: string;
  }): Promise<void> {
    await this.safeQueueService.updateDelegate(args);
    await this.clearDelegates({
      chainId: args.chainId,
      safeAddress: args.safeAddress ?? undefined,
    });
  }

  async deleteDelegate(args: {
    chainId: string;
    delegate: Address;
    delegator: Address;
    safeAddress: Address | null;
    signature: string;
  }): Promise<void> {
    await this.safeQueueService.deleteDelegate(args);
    await this.clearDelegates({
      chainId: args.chainId,
      safeAddress: args.safeAddress ?? undefined,
    });
  }
}
