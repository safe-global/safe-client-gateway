// SPDX-License-Identifier: FSL-1.1-MIT

import { Module } from '@nestjs/common';
import type { MockedObject } from 'vitest';
import { IEmailService } from '@/modules/email/ses/domain/interfaces/email-service.interface';

const emailService = {
  send: vi.fn(),
};

@Module({
  providers: [
    {
      provide: IEmailService,
      useFactory: (): MockedObject<IEmailService> => {
        return vi.mocked(emailService);
      },
    },
  ],
  exports: [IEmailService],
})
export class TestSesEmailModule {}
