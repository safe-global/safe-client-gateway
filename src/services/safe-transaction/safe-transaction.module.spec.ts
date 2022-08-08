import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { SafeConfigModule } from '../safe-config/safe-config.module';
import { safeConfigServiceMock } from '../safe-config/safe-config.module.spec';
import { ISafeTransactionManager } from './safe-transaction.manager.interface';
import { ISafeTransactionService } from './safe-transaction.service';

export const safeTransactionServiceMock: jest.Mocked<ISafeTransactionService> =
  {
    getBalances: jest.fn(),
  };

export const safeTransactionManagerMock: jest.Mocked<ISafeTransactionManager> =
  {
    getTransactionService: jest.fn(),
  };

@Module({
  imports: [SafeConfigModule, HttpModule],
  providers: [
    { provide: 'ISafeConfigService', useValue: safeConfigServiceMock },
    {
      provide: 'ISafeTransactionManager',
      useValue: safeTransactionManagerMock,
    },
  ],
  exports: ['ISafeTransactionManager'],
})
export class TestSafeTransactionModule {}
