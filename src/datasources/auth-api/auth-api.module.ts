import { SiweApi } from '@/datasources/auth-api/siwe-api.service';
import { IAuthApi } from '@/domain/interfaces/auth-api.interface';
import { Module } from '@nestjs/common';

@Module({
  providers: [{ provide: IAuthApi, useClass: SiweApi }],
  exports: [IAuthApi],
})
export class AuthApiModule {}
