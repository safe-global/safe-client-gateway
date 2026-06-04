// SPDX-License-Identifier: FSL-1.1-MIT

import { Module } from '@nestjs/common';
import type { MockedObject } from 'vitest';
import { IIdentityApi } from '@/domain/interfaces/identity-api.interface';

@Module({
  providers: [
    {
      provide: IIdentityApi,
      useFactory: (): MockedObject<IIdentityApi> =>
        vi.mocked({
          checkEligibility: vi.fn(),
        }),
    },
  ],
  exports: [IIdentityApi],
})
export class TestIdentityApiModule {}
