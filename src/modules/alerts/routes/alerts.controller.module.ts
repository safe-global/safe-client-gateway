import { Module } from '@nestjs/common';
import { AlertsController } from '@/modules/alerts/routes/alerts.controller';
import { AlertsService } from '@/modules/alerts/routes/alerts.service';
import { AlertsDomainModule } from '@/modules/alerts/domain/alerts.domain.module';
import { ALERTS_CONFIGURATION_MODULE } from '@/modules/alerts/routes/configuration/alerts.configuration.module';

@Module({
  imports: [AlertsDomainModule, ALERTS_CONFIGURATION_MODULE],
  providers: [AlertsService],
  controllers: [AlertsController],
})
export class AlertsControllerModule {}
