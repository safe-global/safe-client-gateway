import { Global, Module } from '@nestjs/common';
import { ConfigApi } from './config-api.service';
import { CacheFirstDataSourceModule } from '../cache/cache.first.data.source.module';
import { IConfigApi } from '../../domain/interfaces/config-api.interface';
import { ValidationErrorFactory } from '../../domain/errors/validation-error-factory';
import { JsonSchemaService } from '../../common/schemas/json-schema.service';

@Global()
@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [
    { provide: IConfigApi, useClass: ConfigApi },
    ValidationErrorFactory,
    JsonSchemaService,
  ],
  exports: [IConfigApi],
})
export class ConfigApiModule {}
