import { Module } from '@nestjs/common';
import { ChainsService } from './chains.service';
import { ChainsController } from './chains.controller';
import { ConfigApiModule } from '../datasources/config-api/config-api.module';
import { TransactionApiModule } from '../datasources/transaction-api/transaction-api.module';

@Module({
  imports: [ConfigApiModule, TransactionApiModule],
  controllers: [ChainsController],
  providers: [ChainsService],
})
export class ChainsModule {}
