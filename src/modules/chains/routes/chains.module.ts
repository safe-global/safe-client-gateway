import { Module } from '@nestjs/common';
import { ChainsController } from '@/modules/chains/routes/chains.controller';
import { ChainsService } from '@/modules/chains/routes/chains.service';
import { BackboneRepositoryModule } from '@/modules/backbone/domain/backbone.repository.interface';
import { ChainsRepositoryModule } from '@/modules/chains/domain/chains.repository.interface';

@Module({
  imports: [BackboneRepositoryModule, ChainsRepositoryModule],
  controllers: [ChainsController],
  providers: [ChainsService],
})
export class ChainsModule {}
