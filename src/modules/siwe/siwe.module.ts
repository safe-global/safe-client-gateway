import { Module } from '@nestjs/common';
import { ISiweApi } from '@/domain/interfaces/siwe-api.interface';
import { SiweApi } from '@/modules/siwe/datasources/siwe-api.service';
import { ISiweRepository } from '@/modules/siwe/domain/siwe.repository.interface';
import { SiweRepository } from '@/modules/siwe/domain/siwe.repository';

@Module({
  providers: [
    { provide: ISiweApi, useClass: SiweApi },
    {
      provide: ISiweRepository,
      useClass: SiweRepository,
    },
  ],
  exports: [ISiweApi, ISiweRepository],
})
export class SiweModule {}
