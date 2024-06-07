import { SiweApi } from '@/datasources/siwe-api/siwe-api.service';
import { ISiweApi } from '@/domain/interfaces/siwe-api.interface';
import { Module } from '@nestjs/common';

@Module({
  providers: [{ provide: ISiweApi, useClass: SiweApi }],
  exports: [ISiweApi],
})
export class SiweApiModule {}
