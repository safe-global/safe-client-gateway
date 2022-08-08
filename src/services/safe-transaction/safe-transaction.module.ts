import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { SafeConfigModule } from '../safe-config/safe-config.module';
import { HttpErrorHandler } from '../errors/http-error-handler';
import { SafeTransactionManager } from './safe-transaction.manager';

@Module({
  imports: [SafeConfigModule, HttpModule],
  providers: [
    { provide: 'ISafeTransactionManager', useClass: SafeTransactionManager },
    HttpErrorHandler,
  ],
  exports: ['ISafeTransactionManager'],
})
export class SafeTransactionModule {}
