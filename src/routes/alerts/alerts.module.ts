import { Module } from '@nestjs/common';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';
import { AlertsController } from '@/routes/alerts/alerts.controller';
import { AlertsService } from '@/routes/alerts/alerts.service';

@Module({
  providers: [JsonSchemaService, AlertsService],
  controllers: [AlertsController],
})
export class AlertsModule {}
