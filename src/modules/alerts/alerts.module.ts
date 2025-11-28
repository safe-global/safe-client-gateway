import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IAlertsApi } from '@/domain/interfaces/alerts-api.interface';
import { TenderlyApi } from '@/modules/alerts/datasources/tenderly-api.service';
import { DelayModifierDecoder } from '@/modules/alerts/domain/contracts/decoders/delay-modifier-decoder.helper';
import { MultiSendDecoder } from '@/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { SafeDecoder } from '@/modules/contracts/domain/decoders/safe-decoder.helper';
import { AlertsRepository } from '@/modules/alerts/domain/alerts.repository';
import { IAlertsRepository } from '@/modules/alerts/domain/alerts.repository.interface';
import { EmailModule } from '@/modules/email/email.module';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';
import { ChainsModule } from '@/modules/chains/chains.module';
import { AlertsController } from '@/modules/alerts/routes/alerts.controller';
import { AlertsService } from '@/modules/alerts/routes/alerts.service';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { NestConfigurationService } from '@/config/nest.configuration.service';
import { ConfigFactory } from '@nestjs/config/dist/interfaces/config-factory.interface';
import alertsConfiguration from '@/modules/alerts/routes/configuration/alerts.configuration';
import alertsApiConfiguration from '@/modules/alerts/datasources/configuration/alerts-api.configuration';

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

export const ALERTS_CONFIGURATION_MODULE =
  AlertsConfigurationModule.register(alertsConfiguration);

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

@Module({
  imports: [
    ALERTS_API_CONFIGURATION_MODULE,
    ALERTS_CONFIGURATION_MODULE,
    ChainsModule,
    EmailModule,
    SafeRepositoryModule,
  ],
  controllers: [AlertsController],
  providers: [
    HttpErrorFactory,
    { provide: IAlertsApi, useClass: TenderlyApi },
    DelayModifierDecoder,
    MultiSendDecoder,
    SafeDecoder,
    { provide: IAlertsRepository, useClass: AlertsRepository },
    AlertsService,
  ],
  exports: [
    IAlertsApi,
    DelayModifierDecoder,
    MultiSendDecoder,
    SafeDecoder,
    IAlertsRepository,
  ],
})
export class AlertsModule {}
