// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';
import { ConfigApiModule } from '@/datasources/config-api/config-api.module';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { EarnApiManager } from '@/modules/earn/datasources/earn-api.manager';
import { EarnRepository } from '@/modules/earn/domain/earn.repository';

@Module({
  imports: [CacheFirstDataSourceModule, ConfigApiModule],
  providers: [EarnApiManager, HttpErrorFactory, EarnRepository],
  exports: [EarnApiManager, EarnRepository],
})
export class EarnModule {}
