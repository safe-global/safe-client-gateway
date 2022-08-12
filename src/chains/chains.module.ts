import { Module } from '@nestjs/common';
import { ChainsService } from './chains.service';
import { ChainsController } from './chains.controller';
import { SafeConfigModule } from '../services/safe-config/safe-config.module';
import { SafeTransactionModule } from '../services/safe-transaction/safe-transaction.module';

@Module({
  imports: [SafeConfigModule, SafeTransactionModule],
  controllers: [ChainsController],
  providers: [ChainsService],
})
export class ChainsModule {}
