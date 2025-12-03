import { IBlockaidApi } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-api.interface';
import { Module } from '@nestjs/common';

const blockaidApi = {
  scanTransaction: jest.fn(),
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
