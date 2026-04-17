// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { ISiweApi } from '@/domain/interfaces/siwe-api.interface';
import { SiweApi } from '@/modules/siwe/datasources/siwe-api.service';
import { SiweRepository } from '@/modules/siwe/domain/siwe.repository';
import { ISiweRepository } from '@/modules/siwe/domain/siwe.repository.interface';

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
