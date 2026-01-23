import { Module } from '@nestjs/common';
import { BalancesModule } from '@/modules/balances/balances.module';
import { ChainsModule } from '@/modules/chains/chains.module';
import { ICollectiblesRepository } from '@/modules/collectibles/domain/collectibles.repository.interface';
import { CollectiblesRepository } from '@/modules/collectibles/domain/collectibles.repository';
import { CollectiblesController } from '@/modules/collectibles/routes/collectibles.controller';
import { CollectiblesService } from '@/modules/collectibles/routes/collectibles.service';

@Module({
  imports: [BalancesModule, ChainsModule],
  providers: [
    {
      provide: ICollectiblesRepository,
      useClass: CollectiblesRepository,
    },
    CollectiblesService,
  ],
  controllers: [CollectiblesController],
  exports: [ICollectiblesRepository],
})
export class CollectiblesModule {}
