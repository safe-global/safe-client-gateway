import { Collectible } from '@/domain/collectibles/entities/collectible.entity';
import { Page } from '@/domain/entities/page.entity';
import { Module } from '@nestjs/common';
import { CollectiblesRepository } from '@/domain/collectibles/collectibles.repository';
import { BalancesApiModule } from '@/datasources/balances-api/balances-api.module';
import { Chain } from '@/domain/chains/entities/chain.entity';

export const ICollectiblesRepository = Symbol('ICollectiblesRepository');

export interface ICollectiblesRepository {
  getCollectibles(args: {
    chain: Chain;
    safeAddress: `0x${string}`;
    limit?: number;
    offset?: number;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Page<Collectible>>;

  clearCollectibles(args: {
    chainId: string;
    safeAddress: `0x${string}`;
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
