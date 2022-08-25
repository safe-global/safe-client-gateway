import { Module } from '@nestjs/common';
import { ChainsService } from './chains.service';
import { ChainsController } from './chains.controller';
import { ConfigServiceModule } from '../datasources/config-service/config-service.module';
import { TransactionApiModule } from '../datasources/transaction-api/transaction-api.module';

@Module({
  imports: [ConfigServiceModule, TransactionApiModule],
  controllers: [ChainsController],
  providers: [ChainsService],
})
export class ChainsModule {}
