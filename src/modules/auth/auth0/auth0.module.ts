// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { JwtModule } from '@/datasources/jwt/jwt.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IAuth0Api } from '@/modules/auth/auth0/datasources/auth0-api.interface';
import { Auth0Api } from '@/modules/auth/auth0/datasources/auth0-api.service';
import { Auth0TokenVerifier } from '@/modules/auth/auth0/domain/auth0-token.verifier';
import { IAuth0Repository } from '@/modules/auth/auth0/domain/auth0.repository.interface';
import { Auth0Repository } from '@/modules/auth/auth0/domain/auth0.repository';

@Module({
  imports: [NetworkModule, JwtModule],
  providers: [
    HttpErrorFactory,
    {
      provide: IAuth0Api,
      useClass: Auth0Api,
    },
    Auth0TokenVerifier,
    {
      provide: IAuth0Repository,
      useClass: Auth0Repository,
    },
  ],
  exports: [IAuth0Repository],
})
export class Auth0Module {}
