import { Module } from '@nestjs/common';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IAlertsApi } from '@/domain/interfaces/alerts-api.interface';
import { TenderlyApi } from '@/datasources/alerts-api/tenderly-api.service';
import { alertsApiConfigurationModule } from '@/datasources/alerts-api/configuration/alerts-api.configuration.module';

@Module({
  imports: [alertsApiConfigurationModule],
  providers: [HttpErrorFactory, { provide: IAlertsApi, useClass: TenderlyApi }],
  exports: [IAlertsApi],
})
export class AlertsApiModule {}
