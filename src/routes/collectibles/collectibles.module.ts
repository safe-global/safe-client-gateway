import { Module } from '@nestjs/common';
import { CollectiblesController } from '@/routes/collectibles/collectibles.controller';
import { CollectiblesService } from '@/routes/collectibles/collectibles.service';
import { CollectiblesRepositoryModule } from '@/domain/collectibles/collectibles.repository.interface';
import { ChainsRepositoryModule } from '@/domain/chains/chains.repository.interface';

@Module({
  imports: [ChainsRepositoryModule, CollectiblesRepositoryModule],
  controllers: [CollectiblesController],
  providers: [CollectiblesService],
})
export class CollectiblesModule {}
