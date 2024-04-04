import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import alertsConfiguration from '@/routes/alerts/configuration/alerts.configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { NestConfigurationService } from '@/config/nest.configuration.service';
import { ConfigFactory } from '@nestjs/config/dist/interfaces/config-factory.interface';

@Module({})
export class AlertsConfigurationModule {
  static register(configFactory: ConfigFactory): DynamicModule {
    return {
      module: AlertsConfigurationModule,
      imports: [ConfigModule.forFeature(configFactory)],
      providers: [
        { provide: IConfigurationService, useClass: NestConfigurationService },
      ],
      exports: [IConfigurationService],
    };
  }
}

export const alertsConfigurationModule =
  AlertsConfigurationModule.register(alertsConfiguration);
