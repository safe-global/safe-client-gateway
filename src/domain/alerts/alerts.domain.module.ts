import { Module } from '@nestjs/common';
import { AlertsApiModule } from '@/datasources/alerts-api/alerts-api.module';
import { AlertsRepository } from '@/domain/alerts/alerts.repository';
import { IAlertsRepository } from '@/domain/alerts/alerts.repository.interface';
import { DelayModifierDecoder } from '@/domain/alerts/contracts/delay-modifier-decoder.helper';
import { SafeDecoder } from '@/domain/alerts/contracts/safe-decoder.helper';
import { MultiSendDecoder } from '@/domain/alerts/contracts/multi-send-decoder.helper';
import { EmailDomainModule } from '@/domain/email/email.domain.module';
import { EmailApiModule } from '@/datasources/email-api/email-api.module';

@Module({
  imports: [AlertsApiModule, EmailApiModule, EmailDomainModule],
  providers: [
    { provide: IAlertsRepository, useClass: AlertsRepository },
    DelayModifierDecoder,
    MultiSendDecoder,
    SafeDecoder,
  ],
  exports: [IAlertsRepository],
})
export class AlertsDomainModule {}
