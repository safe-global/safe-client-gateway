// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { NetworkModule } from '@/datasources/network/network.module';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IAuth0Api } from '@/modules/auth/oidc/auth0/datasources/auth0-api.interface';
import { Auth0Api } from '@/modules/auth/oidc/auth0/datasources/auth0-api.service';
import { auth0IdTokenJwksFactory } from '@/modules/auth/oidc/auth0/domain/auth0-id-token-jwks.factory';
import { IAuth0IdTokenJwks } from '@/modules/auth/oidc/auth0/domain/auth0-id-token-jwks.interface';
import { Auth0TokenVerifier } from '@/modules/auth/oidc/auth0/domain/auth0-token.verifier';
import { IAuth0Repository } from '@/modules/auth/oidc/auth0/domain/auth0.repository.interface';
import { Auth0Repository } from '@/modules/auth/oidc/auth0/domain/auth0.repository';

@Module({
  imports: [NetworkModule],
  providers: [
    HttpErrorFactory,
    {
      provide: IAuth0Api,
      useClass: Auth0Api,
    },
    {
      provide: IAuth0IdTokenJwks,
      useFactory: auth0IdTokenJwksFactory,
      inject: [IConfigurationService],
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
