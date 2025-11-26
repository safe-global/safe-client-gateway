import { Module } from '@nestjs/common';
import { ConfigApiModule } from '@/datasources/config-api/config-api.module';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';
import { BackboneModule } from '@/modules/backbone/backbone.module';
import { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import { ChainsRepository } from '@/modules/chains/domain/chains.repository';
import { ChainsController } from '@/modules/chains/routes/chains.controller';
import { ChainsService } from '@/modules/chains/routes/chains.service';

@Module({
  imports: [ConfigApiModule, TransactionApiManagerModule, BackboneModule],
  providers: [
    {
      provide: IChainsRepository,
      useClass: ChainsRepository,
    },
    ChainsService,
  ],
  controllers: [ChainsController],
  exports: [IChainsRepository],
})
export class ChainsModule {}
