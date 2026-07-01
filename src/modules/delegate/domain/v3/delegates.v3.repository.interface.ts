// SPDX-License-Identifier: FSL-1.1-MIT

import { Module } from '@nestjs/common';
import type { Address } from 'viem';
import { Page } from '@/domain/entities/page.entity';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';
import { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import { DelegatesV3Repository } from '@/modules/delegate/domain/v3/delegates.v3.repository';
import { QueueServiceModule } from '@/modules/queue/queue.module';

export const IDelegatesV3Repository = Symbol('IDelegatesV3Repository');

export interface IDelegatesV3Repository {
  getDelegates(args: {
    chainId: string;
    safeAddress?: string;
    delegate?: string;
    delegator?: string;
    label?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Delegate>>;

  clearDelegates(args: {
    chainId: string;
    safeAddress?: string;
  }): Promise<void>;

  postDelegate(args: {
    chainId: string;
    safeAddress: Address | null;
    delegate: Address;
    delegator: Address;
    signature: string;
    label: string;
  }): Promise<void>;

  updateDelegate(args: {
    chainId: string;
    safeAddress: Address | null;
    delegate: Address;
    delegator: Address;
    signature: string;
    label: string;
  }): Promise<void>;

  deleteDelegate(args: {
    chainId: string;
    delegate: Address;
    delegator: Address;
    safeAddress: Address | null;
    signature: string;
  }): Promise<unknown>;
}

@Module({
  imports: [TransactionApiManagerModule, QueueServiceModule],
  providers: [
    {
      provide: IDelegatesV3Repository,
      useClass: DelegatesV3Repository,
    },
  ],
  exports: [IDelegatesV3Repository],
})
export class DelegatesV3RepositoryModule {}
