import { Module } from '@nestjs/common';
import { ChainsController } from '@/routes/chains/chains.controller';
import { ChainsService } from '@/routes/chains/chains.service';

@Module({
  controllers: [ChainsController],
  providers: [ChainsService],
})
export class ChainsModule {}
