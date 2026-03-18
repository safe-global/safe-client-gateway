// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { JwtModule } from '@/datasources/jwt/jwt.module';
import { Auth0ApiModule } from '@/modules/auth/auth0/datasources/auth0-api.module';
import { Auth0TokenVerifier } from '@/modules/auth/auth0/domain/auth0-token.verifier';
import { IAuth0Repository } from '@/modules/auth/auth0/domain/auth0.repository.interface';
import { Auth0Repository } from '@/modules/auth/auth0/domain/auth0.repository';

@Module({
  imports: [Auth0ApiModule, JwtModule],
  providers: [
    Auth0TokenVerifier,
    {
      provide: IAuth0Repository,
      useClass: Auth0Repository,
    },
  ],
  exports: [IAuth0Repository],
})
export class Auth0Module {}
