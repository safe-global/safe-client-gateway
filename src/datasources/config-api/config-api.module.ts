// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';
import { ConfigApi } from '@/datasources/config-api/config-api.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';

@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [HttpErrorFactory, { provide: IConfigApi, useClass: ConfigApi }],
  exports: [IConfigApi],
})
export class ConfigApiModule {}
