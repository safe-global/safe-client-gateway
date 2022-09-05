import { Module } from '@nestjs/common';
import { ConfigApi } from './config-api.service';
import { CacheFirstDataSourceModule } from '../cache/cache.first.data.source.module';
import { ValidationErrorFactory } from '../errors/validation-error-factory';
import { JsonSchemaService } from '../../common/schema/json-schema.service';

@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [ConfigApi, ValidationErrorFactory, JsonSchemaService],
  exports: [ConfigApi],
})
export class ConfigApiModule {}
