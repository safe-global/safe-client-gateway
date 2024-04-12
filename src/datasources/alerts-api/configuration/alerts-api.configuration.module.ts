import { DynamicModule, Module } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { ConfigFactory } from '@nestjs/config/dist/interfaces/config-factory.interface';
import { ConfigModule } from '@nestjs/config';
import { NestConfigurationService } from '@/config/nest.configuration.service';
import alertsApiConfiguration from '@/datasources/alerts-api/configuration/alerts-api.configuration';

@Module({})
export class AlertsApiConfigurationModule {
  static register(configFactory: ConfigFactory): DynamicModule {
    return {
      module: AlertsApiConfigurationModule,
      imports: [ConfigModule.forFeature(configFactory)],
      providers: [
        { provide: IConfigurationService, useClass: NestConfigurationService },
      ],
      exports: [IConfigurationService],
    };
  }
}

export const ALERTS_API_CONFIGURATION_MODULE =
  AlertsApiConfigurationModule.register(alertsApiConfiguration);
