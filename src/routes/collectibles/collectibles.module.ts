import { Module } from '@nestjs/common';
import { CollectiblesController } from '@/routes/collectibles/collectibles.controller';
import { CollectiblesService } from '@/routes/collectibles/collectibles.service';
import { CollectiblesRepositoryModule } from '@/domain/collectibles/collectibles.repository.interface';

@Module({
  imports: [CollectiblesRepositoryModule],
  controllers: [CollectiblesController],
  providers: [CollectiblesService],
})
export class CollectiblesModule {}
