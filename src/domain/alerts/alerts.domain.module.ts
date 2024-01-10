import { Module } from '@nestjs/common';
import { AlertsApiModule } from '@/datasources/alerts-api/alerts-api.module';
import { AlertsRepository } from '@/domain/alerts/alerts.repository';
import { IAlertsRepository } from '@/domain/alerts/alerts.repository.interface';
import { AlertsDecodersModule } from '@/domain/alerts/alerts-decoders.module';
import { EmailApiModule } from '@/datasources/email-api/email-api.module';
import { EmailDomainModule } from '@/domain/email/email.domain.module';
import { EmailTemplateModule } from '@/datasources/email-template/email-template.module';

@Module({
  imports: [
    AlertsApiModule,
    AlertsDecodersModule,
    EmailApiModule,
    EmailDomainModule,
    EmailTemplateModule,
  ],
  providers: [{ provide: IAlertsRepository, useClass: AlertsRepository }],
  exports: [IAlertsRepository],
})
export class AlertsDomainModule {}
