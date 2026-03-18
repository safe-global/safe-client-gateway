// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { NetworkModule } from '@/datasources/network/network.module';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IAuth0Api } from '@/modules/auth/auth0/datasources/auth0-api.interface';
import { Auth0Api } from '@/modules/auth/auth0/datasources/auth0-api.service';

@Module({
  imports: [NetworkModule],
  providers: [
    HttpErrorFactory,
    {
      provide: IAuth0Api,
      useClass: Auth0Api,
    },
  ],
  exports: [IAuth0Api],
})
export class Auth0ApiModule {}
