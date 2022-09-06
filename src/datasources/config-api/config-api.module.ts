import { Global, Module } from '@nestjs/common';
import { ConfigApi } from './config-api.service';
import { CacheFirstDataSourceModule } from '../cache/cache.first.data.source.module';
import { IConfigApi } from '../../domain/config-api.interface';

@Global()
@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [{ provide: IConfigApi, useClass: ConfigApi }],
  exports: [IConfigApi],
})
export class ConfigApiModule {}
