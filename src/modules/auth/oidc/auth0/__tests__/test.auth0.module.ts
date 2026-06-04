// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { IAuth0Repository } from '@/modules/auth/oidc/auth0/domain/auth0.repository.interface';

@Module({
  providers: [
    {
      provide: IAuth0Repository,
      useValue: {
        getAuthorizationUrl: vi.fn(),
        authenticateWithAuthorizationCode: vi.fn(),
      },
    },
  ],
  exports: [IAuth0Repository],
})
export class TestAuth0Module {}
