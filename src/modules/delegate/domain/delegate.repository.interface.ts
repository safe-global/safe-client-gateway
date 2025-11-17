import { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import { Page } from '@/domain/entities/page.entity';
import { Module } from '@nestjs/common';
import { DelegateRepository } from '@/modules/delegate/domain/delegate.repository';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';
import type { Address } from 'viem';

export const IDelegateRepository = Symbol('IDelegateRepository');

export interface IDelegateRepository {
  getDelegates(args: {
    chainId: string;
    safeAddress?: Address;
    delegate?: Address;
    delegator?: Address;
    label?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Delegate>>;

  postDelegate(args: {
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
    signature: string;
  }): Promise<unknown>;

  deleteSafeDelegate(args: {
    chainId: string;
    delegate: Address;
    safeAddress: Address;
    signature: string;
  }): Promise<unknown>;
}

@Module({
  imports: [TransactionApiManagerModule],
  providers: [
    {
      provide: IDelegateRepository,
      useClass: DelegateRepository,
    },
  ],
  exports: [IDelegateRepository],
})
export class DelegateRepositoryModule {}
