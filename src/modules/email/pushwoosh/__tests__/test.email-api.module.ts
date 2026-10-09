// SPDX-License-Identifier: FSL-1.1-MIT

import { jest } from 'bun:test';
import { Module } from '@nestjs/common';
import type { MockedObject } from '#/__tests__/mocks';
import { HttpErrorFactory } from '#/datasources/errors/http-error-factory';
import { IEmailApi } from '#/domain/interfaces/email-api.interface';

const emailApi = {
  createMessage: jest.fn(),
  deleteEmailAddress: jest.fn(),
};

@Module({
  providers: [
    HttpErrorFactory,
    {
      provide: IEmailApi,
      useFactory: (): MockedObject<IEmailApi> => {
        return emailApi as MockedObject<IEmailApi>;
      },
    },
  ],
  exports: [IEmailApi],
})
export class TestEmailApiModule {}
