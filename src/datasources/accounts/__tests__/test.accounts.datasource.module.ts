import { Module } from '@nestjs/common';
import { IAccountsDatasource } from '@/domain/interfaces/accounts.datasource.interface';

const accountsDatasource = {
  createAccount: jest.fn(),
  deleteAccount: jest.fn(),
  getAccount: jest.fn(),
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
