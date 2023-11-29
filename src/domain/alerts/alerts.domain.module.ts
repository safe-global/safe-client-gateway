import { Module } from '@nestjs/common';
import { AlertsApiModule } from '@/datasources/alerts-api/alerts-api.module';
import { AlertsRepository } from '@/domain/alerts/alerts.repository';
import { IAlertsRepository } from '@/domain/alerts/alerts.repository.interface';
import { AlertsDecodersModule } from '@/domain/alerts/alerts-decoders.module';

@Module({
  imports: [AlertsApiModule, AlertsDecodersModule],
  providers: [{ provide: IAlertsRepository, useClass: AlertsRepository }],
  exports: [IAlertsRepository],
})
export class AlertsDomainModule {}
