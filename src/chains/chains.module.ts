import { Module } from '@nestjs/common';
import { ChainsService } from './chains.service';
import { ChainsController } from './chains.controller';

@Module({
  controllers: [ChainsController],
  providers: [ChainsService],
})
export class ChainsModule {}
