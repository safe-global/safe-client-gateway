import { Delegate } from '@/domain/delegate/entities/delegate.entity';
import { DelegatesV2Repository } from '@/domain/delegate/v2/delegates.v2.repository';
import { Page } from '@/domain/entities/page.entity';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';
import { Module } from '@nestjs/common';

export const IDelegatesV2Repository = Symbol('IDelegatesV2Repository');

export interface IDelegatesV2Repository {
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
    delegate: `0x${string}`;
    delegator: `0x${string}`;
    safeAddress: `0x${string}` | null;
    signature: string;
  }): Promise<unknown>;
}

@Module({
  imports: [TransactionApiManagerModule],
  providers: [
    {
      provide: IDelegatesV2Repository,
      useClass: DelegatesV2Repository,
    },
  ],
  exports: [IDelegatesV2Repository],
})
export class DelegatesV2RepositoryModule {}
