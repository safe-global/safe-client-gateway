import { Module } from '@nestjs/common';
import { AlertsController } from '@/routes/alerts/alerts.controller';
import { AlertsService } from '@/routes/alerts/alerts.service';
import { AlertsDomainModule } from '@/domain/alerts/alerts.domain.module';
import { ALERTS_CONFIGURATION_MODULE } from '@/routes/alerts/configuration/alerts.configuration.module';

@Module({
  imports: [AlertsDomainModule, ALERTS_CONFIGURATION_MODULE],
  providers: [AlertsService],
  controllers: [AlertsController],
})
export class AlertsControllerModule {}
