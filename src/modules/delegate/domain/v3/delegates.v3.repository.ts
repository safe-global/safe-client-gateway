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
import { QueueDelegatePageSchema } from '@/modules/queue/entities/delegate.entity';
import { IQueue } from '@/modules/queue/queue.interface';

@Injectable()
export class DelegatesV3Repository implements IDelegatesV3Repository {
  private readonly queueServiceEnabled: boolean;

  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    @Inject(IQueue)
    private readonly queueService: IQueue,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
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
        // The queue allows a null label; the domain Delegate (and the
        // tx-service v2 path) require a string. Coerce to '' so both backends
        // represent "no label" identically for downstream consumers.
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
    } else {
      await this.queueService.postDelegate(args);
    }
    this._invalidateDelegatesCache(args.chainId, args.safeAddress);
  }

  async updateDelegate(args: {
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
      await transactionService.updateDelegateV2({
        safeAddress: args.safeAddress,
        delegate: args.delegate,
        delegator: args.delegator,
        signature: args.signature,
        label: args.label,
      });
    } else {
      await this.queueService.updateDelegate(args);
    }
    this._invalidateDelegatesCache(args.chainId, args.safeAddress);
  }

  async deleteDelegate(args: {
    chainId: string;
    delegate: Address;
    delegator: Address;
    safeAddress: Address | null;
    signature: string;
  }): Promise<unknown> {
    let result: unknown;
    if (!this.queueServiceEnabled) {
      const transactionService = await this.transactionApiManager.getApi(
        args.chainId,
      );
      result = await transactionService.deleteDelegateV2({
        delegate: args.delegate,
        delegator: args.delegator,
        safeAddress: args.safeAddress,
        signature: args.signature,
      });
    } else {
      result = await this.queueService.deleteDelegate(args);
    }
    this._invalidateDelegatesCache(args.chainId, args.safeAddress);
    return result;
  }

  private _invalidateDelegatesCache(
    chainId: string,
    safeAddress: Address | null,
  ): void {
    this.clearDelegates({
      chainId,
      safeAddress: safeAddress ?? undefined,
    }).catch((error) => {
      this.loggingService.warn(
        `Failed to clear delegates cache. chainId=${chainId}, safeAddress=${safeAddress}, error=${error}`,
      );
    });
  }
}
