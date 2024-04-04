import { Module } from '@nestjs/common';
import { AlertsController } from '@/routes/alerts/alerts.controller';
import { AlertsService } from '@/routes/alerts/alerts.service';
import { AlertsDomainModule } from '@/domain/alerts/alerts.domain.module';
import { alertsConfigurationModule } from '@/routes/alerts/configuration/alerts.configuration.module';

@Module({
  imports: [AlertsDomainModule, alertsConfigurationModule],
  providers: [AlertsService],
  controllers: [AlertsController],
})
export class AlertsControllerModule {}
