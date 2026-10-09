// SPDX-License-Identifier: FSL-1.1-MIT

import { jest } from 'bun:test';
import { Module } from '@nestjs/common';
import { type MockedObject, mocked } from '#/__tests__/mocks';
import { IIdentityApi } from '#/domain/interfaces/identity-api.interface';

@Module({
  providers: [
    {
      provide: IIdentityApi,
      useFactory: (): MockedObject<IIdentityApi> =>
        mocked({
          checkEligibility: jest.fn(),
        }),
    },
  ],
  exports: [IIdentityApi],
})
export class TestIdentityApiModule {}
