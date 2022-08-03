import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { SafeConfigModule } from '../safe-config/safe-config.module';
import { SafeConfigService } from '../safe-config/safe-config.service';
import { SafeTransactionManager } from './safe-transaction.manager';

@Module({
  imports: [SafeConfigModule, HttpModule],
  providers: [SafeConfigService, SafeTransactionManager],
  exports: [SafeTransactionManager],
})
export class SafeTransactionModule {}
