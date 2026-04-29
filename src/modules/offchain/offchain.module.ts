// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IOffchain } from '@/modules/offchain/offchain.interface';
import { OffchainService } from '@/modules/offchain/offchain.service';

@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [
    HttpErrorFactory,
    { provide: IOffchain, useClass: OffchainService },
  ],
  exports: [IOffchain],
})
export class OffchainModule {}
