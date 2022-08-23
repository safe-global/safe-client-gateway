import { Module } from '@nestjs/common';
import { ConfigApi } from './config-api.service';
import { CacheFirstDataSourceModule } from '../cache/cacheFirstDataSourceModule';

@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [ConfigApi],
  exports: [ConfigApi],
})
export class ConfigApiModule {}
