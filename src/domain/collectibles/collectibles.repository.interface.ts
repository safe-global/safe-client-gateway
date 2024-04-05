import { Collectible } from '@/domain/collectibles/entities/collectible.entity';
import { Page } from '@/domain/entities/page.entity';
import { Module } from '@nestjs/common';
import { CollectiblesRepository } from '@/domain/collectibles/collectibles.repository';
import { BalancesApiModule } from '@/datasources/balances-api/balances-api.module';

export const ICollectiblesRepository = Symbol('ICollectiblesRepository');

export interface ICollectiblesRepository {
  getCollectibles(args: {
    chainId: string;
    safeAddress: string;
    limit?: number;
    offset?: number;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Page<Collectible>>;

  clearCollectibles(args: {
    chainId: string;
    safeAddress: string;
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
