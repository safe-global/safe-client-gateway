import { Module } from '@nestjs/common';
import { ISafeConfigService } from './safe-config.service';

export const safeConfigServiceMock: jest.Mocked<ISafeConfigService> = {
  getChains: jest.fn(),
  getChain: jest.fn(),
};

@Module({
  providers: [
    { provide: 'ISafeConfigService', useValue: safeConfigServiceMock },
  ],
  exports: [{ provide: 'ISafeConfigService', useValue: safeConfigServiceMock }],
})
export class TestSafeConfigModule {}
