import { Module } from '@nestjs/common';
import { IBlockaidApi } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-api.interface';

const blockaidApi = {
  scanTransaction: jest.fn(),
  reportTransaction: jest.fn(),
};

@Module({
  providers: [
    {
      provide: IBlockaidApi,
      useFactory: (): jest.MockedObjectDeep<IBlockaidApi> => {
        return jest.mocked(blockaidApi);
      },
    },
  ],
  exports: [IBlockaidApi],
})
export class TestBlockaidApiModule {}
