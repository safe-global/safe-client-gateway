// SPDX-License-Identifier: FSL-1.1-MIT

import { Module } from '@nestjs/common';
import type { MockedObject } from 'vitest';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IEmailApi } from '@/domain/interfaces/email-api.interface';

const emailApi = {
  createMessage: vi.fn(),
  deleteEmailAddress: vi.fn(),
};

@Module({
  providers: [
    HttpErrorFactory,
    {
      provide: IEmailApi,
      useFactory: (): MockedObject<IEmailApi> => {
        return vi.mocked(emailApi);
      },
    },
  ],
  exports: [IEmailApi],
})
export class TestEmailApiModule {}
