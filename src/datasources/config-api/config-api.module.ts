import { Module } from '@nestjs/common';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { ConfigApi } from '@/datasources/config-api/config-api.service';
import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';

@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [HttpErrorFactory, { provide: IConfigApi, useClass: ConfigApi }],
  exports: [IConfigApi],
})
export class ConfigApiModule {}
