// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { SafeBillingServiceApi } from '@/datasources/safe-billing-service-api/safe-billing-service-api.service';
import { ISafeBillingServiceApi } from '@/domain/interfaces/safe-billing-service-api.interface';

@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [
    HttpErrorFactory,
    { provide: ISafeBillingServiceApi, useClass: SafeBillingServiceApi },
  ],
  exports: [ISafeBillingServiceApi],
})
export class SafeBillingServiceApiModule {}
