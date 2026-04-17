// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { FeeServiceApi } from '@/datasources/fee-service-api/fee-service-api.service';
import { IFeeServiceApi } from '@/domain/interfaces/fee-service-api.interface';

@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [
    HttpErrorFactory,
    { provide: IFeeServiceApi, useClass: FeeServiceApi },
  ],
  exports: [IFeeServiceApi],
})
export class FeeServiceApiModule {}
