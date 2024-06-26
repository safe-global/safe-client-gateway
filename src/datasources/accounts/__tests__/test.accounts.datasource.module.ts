import { Module } from '@nestjs/common';
import { IAccountsDatasource } from '@/domain/interfaces/accounts.datasource.interface';

const accountsDatasource = {
  getAccount: jest.fn(),
  createAccount: jest.fn(),
} as jest.MockedObjectDeep<IAccountsDatasource>;

@Module({
  providers: [
    {
      provide: IAccountsDatasource,
      useFactory: (): jest.MockedObjectDeep<IAccountsDatasource> => {
        return jest.mocked(accountsDatasource);
      },
    },
  ],
  exports: [IAccountsDatasource],
})
export class TestAccountsDataSourceModule {}
