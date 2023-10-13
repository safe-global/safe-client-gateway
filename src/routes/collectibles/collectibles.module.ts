import { Module } from '@nestjs/common';
import { CollectiblesController } from '@/routes/collectibles/collectibles.controller';
import { CollectiblesService } from '@/routes/collectibles/collectibles.service';

@Module({
  controllers: [CollectiblesController],
  providers: [CollectiblesService],
})
export class CollectiblesModule {}
