// SPDX-License-Identifier: FSL-1.1-MIT

import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { Page } from '@/domain/entities/page.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import { DelegatePageSchema } from '@/modules/delegate/domain/entities/schemas/delegate.schema';
import { IDelegatesV3Repository } from '@/modules/delegate/domain/v3/delegates.v3.repository.interface';
import { SafeQueueDelegatePageSchema } from '@/modules/safe-queue/entities/delegate.entity';
import { clearBothCacheLayers } from '@/modules/safe-queue/helpers/clear-cache-layers.helper';
import { ISafeQueueService } from '@/modules/safe-queue/safe-queue.interface';

@Injectable()
export class DelegatesV3Repository implements IDelegatesV3Repository {
  private readonly safeQueueEnabled: boolean;

  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    @Inject(ISafeQueueService)
    private readonly safeQueueService: ISafeQueueService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    this.safeQueueEnabled = this.configurationService.getOrThrow<boolean>(
      'features.safeQueueService',
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
    if (this.safeQueueEnabled) {
      const page = await this.safeQueueService.getDelegates(args);
      const parsed = SafeQueueDelegatePageSchema.parse(page);
      return {
        ...parsed,
        results: parsed.results.map((d) => ({
          safe: d.safe,
          delegate: d.delegate,
          delegator: d.delegator,
          // The queue allows a null label; the domain Delegate (and the
          // tx-service v2 path) require a string. Coerce to '' so both backends
          // represent "no label" identically for downstream consumers.
          label: d.label ?? '',
        })),
      };
    }
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

  async clearDelegates(args: {
    chainId: string;
    safeAddress?: Address;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    await clearBothCacheLayers(
      this.loggingService,
      transactionService.clearDelegates(args.safeAddress),
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
    if (this.safeQueueEnabled) {
      await this.safeQueueService.postDelegate(args);
      void this.clearDelegates({
        chainId: args.chainId,
        safeAddress: args.safeAddress ?? undefined,
      });
      return;
    }
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
    void this.clearDelegates({
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
    if (this.safeQueueEnabled) {
      await this.safeQueueService.updateDelegate(args);
      void this.clearDelegates({
        chainId: args.chainId,
        safeAddress: args.safeAddress ?? undefined,
      });
      return;
    }
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    await transactionService.updateDelegateV2({
      safeAddress: args.safeAddress,
      delegate: args.delegate,
      delegator: args.delegator,
      signature: args.signature,
      label: args.label,
    });
    void this.clearDelegates({
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
    if (this.safeQueueEnabled) {
      await this.safeQueueService.deleteDelegate(args);
      void this.clearDelegates({
        chainId: args.chainId,
        safeAddress: args.safeAddress ?? undefined,
      });
      return;
    }
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    await transactionService.deleteDelegateV2({
      delegate: args.delegate,
      delegator: args.delegator,
      safeAddress: args.safeAddress,
      signature: args.signature,
    });
    void this.clearDelegates({
      chainId: args.chainId,
      safeAddress: args.safeAddress ?? undefined,
    });
  }
}
