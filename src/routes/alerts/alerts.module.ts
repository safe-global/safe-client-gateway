import { Module } from '@nestjs/common';
import { AlertsController } from '@/routes/alerts/alerts.controller';
import { AlertsService } from '@/routes/alerts/alerts.service';

@Module({
  providers: [AlertsService],
  controllers: [AlertsController],
})
export class AlertsModule {}
