import { Delegate } from '@/domain/delegate/entities/delegate.entity';
import { Page } from '@/domain/entities/page.entity';
import { Module } from '@nestjs/common';
import { DelegateRepository } from '@/domain/delegate/delegate.repository';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';

export const IDelegateRepository = Symbol('IDelegateRepository');

export interface IDelegateRepository {
  getDelegates(args: {
    chainId: string;
    safeAddress?: string;
    delegate?: string;
    delegator?: string;
    label?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Delegate>>;

  postDelegate(args: {
    chainId: string;
    safeAddress: `0x${string}` | null;
    delegate: `0x${string}`;
    delegator: `0x${string}`;
    signature: string;
    label: string;
  }): Promise<void>;

  deleteDelegate(args: {
    chainId: string;
    delegate: string;
    delegator: string;
    signature: string;
  }): Promise<unknown>;

  deleteSafeDelegate(args: {
    chainId: string;
    delegate: string;
    safeAddress: string;
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
