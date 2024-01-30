import { Module } from '@nestjs/common';
import { IAccountDataSource } from '@/domain/interfaces/account.datasource.interface';

const accountDataSource = {
  getVerifiedAccountEmailsBySafeAddress: jest.fn(),
  getAccount: jest.fn(),
  createAccount: jest.fn(),
  setEmailVerificationCode: jest.fn(),
  setEmailVerificationSentDate: jest.fn(),
  verifyEmail: jest.fn(),
  deleteAccount: jest.fn(),
  updateAccountEmail: jest.fn(),
  getSubscriptions: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  unsubscribeAll: jest.fn(),
} as jest.MockedObjectDeep<IAccountDataSource>;

@Module({
  providers: [
    {
      provide: IAccountDataSource,
      useFactory: (): jest.MockedObjectDeep<IAccountDataSource> => {
        return jest.mocked(accountDataSource);
      },
    },
  ],
  exports: [IAccountDataSource],
})
export class TestAccountDataSourceModule {}
