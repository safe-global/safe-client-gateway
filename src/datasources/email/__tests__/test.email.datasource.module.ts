import { Module } from '@nestjs/common';
import { IEmailDataSource } from '@/domain/interfaces/email.datasource.interface';

const emailDataSource = {
  getVerifiedAccountEmailsBySafeAddress: jest.fn(),
  getEmail: jest.fn(),
  saveEmail: jest.fn(),
  setVerificationCode: jest.fn(),
  setVerificationSentDate: jest.fn(),
  verifyEmail: jest.fn(),
  updateEmail: jest.fn(),
  deleteEmail: jest.fn(),
} as unknown as IEmailDataSource;

@Module({
  providers: [
    {
      provide: IEmailDataSource,
      useFactory: () => {
        return jest.mocked(emailDataSource);
      },
    },
  ],
  exports: [IEmailDataSource],
})
export class TestEmailDatasourceModule {}
