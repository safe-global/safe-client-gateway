import { Module } from '@nestjs/common';
import { AlertsApiModule } from '@/datasources/alerts-api/alerts-api.module';
import { AlertsRepository } from '@/domain/alerts/alerts.repository';
import { IAlertsRepository } from '@/domain/alerts/alerts.repository.interface';
import { AlertsDecodersModule } from '@/domain/alerts/alerts-decoders.module';
import { EmailApiModule } from '@/datasources/email-api/email-api.module';
import { AccountDomainModule } from '@/domain/account/account.domain.module';
import { UrlGeneratorModule } from '@/domain/alerts/urls/url-generator.module';
import { SubscriptionDomainModule } from '@/domain/subscriptions/subscription.domain.module';
import { SafeRepositoryModule } from '@/domain/safe/safe.repository.interface';
import { ChainsRepositoryModule } from '@/domain/chains/chains.repository.interface';

@Module({
  imports: [
    AccountDomainModule,
    AlertsApiModule,
    AlertsDecodersModule,
    ChainsRepositoryModule,
    EmailApiModule,
    SafeRepositoryModule,
    SubscriptionDomainModule,
    UrlGeneratorModule,
  ],
  providers: [{ provide: IAlertsRepository, useClass: AlertsRepository }],
  exports: [IAlertsRepository],
})
export class AlertsDomainModule {}
