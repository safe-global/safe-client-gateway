import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IConfigurationService } from './configuration.service.interface';
import { NestConfigurationService } from './nest.configuration.service';
import configuration from './entities/configuration';

/**
 * A {@link Global} Module which provides local configuration support via {@link IConfigurationService}
 * Feature Modules don't need to import this module directly in order to inject
 * the {@link IConfigurationService}.
 *
 * This module should be included in the "root" application module
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
    }),
  ],
  providers: [{ provide: IConfigurationService, useClass: NestConfigurationService }],
  exports: [IConfigurationService],
})
export class ConfigurationModule {}
