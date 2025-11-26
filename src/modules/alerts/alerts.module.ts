import { Module } from '@nestjs/common';
import { AlertsApiModule } from '@/modules/alerts/datasources/alerts-api.module';
import { AlertsApiConfigurationModule } from '@/modules/alerts/datasources/configuration/alerts-api.configuration.module';
import { AlertsDecodersModule } from '@/modules/alerts/domain/alerts-decoders.module';
import { AlertsDomainModule } from '@/modules/alerts/domain/alerts.domain.module';
import { AlertsControllerModule } from '@/modules/alerts/routes/alerts.controller.module';
import { ALERTS_CONFIGURATION_MODULE } from '@/modules/alerts/routes/configuration/alerts.configuration.module';

@Module({
  imports: [
    AlertsApiModule,
    AlertsApiConfigurationModule,
    AlertsDecodersModule,
    AlertsDomainModule,
    AlertsControllerModule,
    ALERTS_CONFIGURATION_MODULE,
  ],
})
export class AlertsModule {}
