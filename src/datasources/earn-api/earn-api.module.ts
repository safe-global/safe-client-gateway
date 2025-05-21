import { Module } from '@nestjs/common';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { ConfigApiModule } from '@/datasources/config-api/config-api.module';
import { EarnApiManager } from '@/datasources/earn-api/earn-api.manager';
import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';

@Module({
  imports: [CacheFirstDataSourceModule, ConfigApiModule],
  providers: [EarnApiManager, HttpErrorFactory],
  exports: [EarnApiManager],
})
export class EarnApiModule {}
