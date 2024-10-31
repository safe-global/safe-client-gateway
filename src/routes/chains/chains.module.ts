import { Module } from '@nestjs/common';
import { ChainsController } from '@/routes/chains/chains.controller';
import { ChainsService } from '@/routes/chains/chains.service';
import { BackboneRepositoryModule } from '@/domain/backbone/backbone.repository.interface';
import { ChainsRepositoryModule } from '@/domain/chains/chains.repository.interface';

@Module({
  imports: [BackboneRepositoryModule, ChainsRepositoryModule],
  controllers: [ChainsController],
  providers: [ChainsService],
})
export class ChainsModule {}
