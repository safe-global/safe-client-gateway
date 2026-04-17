// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { BalancesModule } from '@/modules/balances/balances.module';
import { ChainsModule } from '@/modules/chains/chains.module';
import { CollectiblesRepository } from '@/modules/collectibles/domain/collectibles.repository';
import { ICollectiblesRepository } from '@/modules/collectibles/domain/collectibles.repository.interface';
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
