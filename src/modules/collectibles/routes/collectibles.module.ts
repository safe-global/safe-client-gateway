import { Module } from '@nestjs/common';
import { CollectiblesController } from '@/modules/collectibles/routes/collectibles.controller';
import { CollectiblesService } from '@/modules/collectibles/routes/collectibles.service';
import { CollectiblesRepositoryModule } from '@/modules/collectibles/domain/collectibles.repository.interface';
import { ChainsRepositoryModule } from '@/modules/chains/domain/chains.repository.interface';

@Module({
  imports: [ChainsRepositoryModule, CollectiblesRepositoryModule],
  controllers: [CollectiblesController],
  providers: [CollectiblesService],
})
export class CollectiblesModule {}
