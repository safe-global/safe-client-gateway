import { ICounterfactualSafesDatasource } from '@/domain/interfaces/counterfactual-safes.datasource.interface';
import { Module } from '@nestjs/common';

const counterfactualSafesDatasource = {
  createCounterfactualSafe: jest.fn(),
  getCounterfactualSafe: jest.fn(),
  getCounterfactualSafesForAddress: jest.fn(),
  deleteCounterfactualSafe: jest.fn(),
  deleteCounterfactualSafesForAccount: jest.fn(),
} as jest.MockedObjectDeep<ICounterfactualSafesDatasource>;

@Module({
  providers: [
    {
      provide: ICounterfactualSafesDatasource,
      useFactory: (): jest.MockedObjectDeep<ICounterfactualSafesDatasource> => {
        return jest.mocked(counterfactualSafesDatasource);
      },
    },
  ],
  exports: [ICounterfactualSafesDatasource],
})
export class TestCounterfactualSafesDataSourceModule {}
