import { Global, Module } from '@nestjs/common';
import { ConfigApi } from './config-api.service';
import { CacheFirstDataSourceModule } from '../cache/cache.first.data.source.module';
import { IConfigApi } from '../../domain/interfaces/config-api.interface';
import { ValidationErrorFactory } from '../errors/validation-error-factory';
import { JsonSchemaService } from '../../common/schemas/json-schema.service';
import { IConfigurationService } from '../../common/config/configuration.service.interface';

const baseUrlFactory = {
  provide: 'CONFIG_API_BASE_URL',
  useFactory: (configurationService: IConfigurationService) => {
    return configurationService.getOrThrow<string>('safeConfig.baseUri');
  },
  inject: [IConfigurationService],
};

@Global()
@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [
    baseUrlFactory,
    { provide: IConfigApi, useClass: ConfigApi },
    ValidationErrorFactory,
    JsonSchemaService,
  ],
  exports: [IConfigApi],
})
export class ConfigApiModule {}
