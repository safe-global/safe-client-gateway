import { Global, Module } from '@nestjs/common';
import { ConfigApi } from './config-api.service';
import { CacheFirstDataSourceModule } from '../cache/cache.first.data.source.module';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { HttpErrorFactory } from '../errors/http-error-factory';

@Global()
@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [HttpErrorFactory, { provide: IConfigApi, useClass: ConfigApi }],
  exports: [IConfigApi],
})
export class ConfigApiModule {}
