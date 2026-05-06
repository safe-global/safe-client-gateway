// SPDX-License-Identifier: FSL-1.1-MIT

import { Module } from '@nestjs/common';
import { IEmailService } from '@/modules/email/ses/domain/interfaces/email-service.interface';

const emailService = {
  send: jest.fn(),
};

@Module({
  providers: [
    {
      provide: IEmailService,
      useFactory: (): jest.MockedObjectDeep<IEmailService> => {
        return jest.mocked(emailService);
      },
    },
  ],
  exports: [IEmailService],
})
export class TestSesEmailModule {}
