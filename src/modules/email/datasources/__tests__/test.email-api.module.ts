import { Module } from '@nestjs/common';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IEmailApi } from '@/domain/interfaces/email-api.interface';

const emailApi = {
  createMessage: jest.fn(),
  deleteEmailAddress: jest.fn(),
};

@Module({
  providers: [
    HttpErrorFactory,
    {
      provide: IEmailApi,
      useFactory: (): jest.MockedObjectDeep<IEmailApi> => {
        return jest.mocked(emailApi);
      },
    },
  ],
  exports: [IEmailApi],
})
export class TestEmailApiModule {}
