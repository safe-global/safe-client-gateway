// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { BillingApi } from '@/datasources/billing-api/billing-api.service';
import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IBillingApi } from '@/domain/interfaces/billing-api.interface';

@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [HttpErrorFactory, { provide: IBillingApi, useClass: BillingApi }],
  exports: [IBillingApi],
})
export class BillingApiModule {}
