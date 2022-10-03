import { Module } from '@nestjs/common';
import { CollectiblesController } from './collectibles.controller';
import { CollectiblesService } from './collectibles.service';

@Module({
  controllers: [CollectiblesController],
  providers: [CollectiblesService],
})
export class CollectiblesModule {}
