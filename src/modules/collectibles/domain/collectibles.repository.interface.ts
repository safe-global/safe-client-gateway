import { Collectible } from '@/modules/collectibles/domain/entities/collectible.entity';
import { Page } from '@/domain/entities/page.entity';
import { Module } from '@nestjs/common';
import { CollectiblesRepository } from '@/modules/collectibles/domain/collectibles.repository';
import { BalancesApiModule } from '@/modules/balances/datasources/balances-api.module';
import { Chain } from '@/modules/chains/domain/entities/chain.entity';
import type { Address } from 'viem';

export const ICollectiblesRepository = Symbol('ICollectiblesRepository');

export interface ICollectiblesRepository {
  getCollectibles(args: {
    chain: Chain;
    safeAddress: Address;
    limit?: number;
    offset?: number;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Page<Collectible>>;

  clearCollectibles(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void>;
}

@Module({
  imports: [BalancesApiModule],
  providers: [
    {
      provide: ICollectiblesRepository,
      useClass: CollectiblesRepository,
    },
  ],
  exports: [ICollectiblesRepository],
})
export class CollectiblesRepositoryModule {}
