import { Module } from '@nestjs/common';
import { AlertsApiModule } from '@/modules/alerts/datasources/alerts-api.module';
import { AlertsRepository } from '@/modules/alerts/domain/alerts.repository';
import { IAlertsRepository } from '@/modules/alerts/domain/alerts.repository.interface';
import { AlertsDecodersModule } from '@/modules/alerts/domain/alerts-decoders.module';
import { EmailModule } from '@/modules/email/email.module';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';
import { ChainsModule } from '@/modules/chains/chains.module';

@Module({
  imports: [
    AlertsApiModule,
    AlertsDecodersModule,
    ChainsModule,
    EmailModule,
    SafeRepositoryModule,
  ],
  providers: [{ provide: IAlertsRepository, useClass: AlertsRepository }],
  exports: [IAlertsRepository],
})
export class AlertsDomainModule {}
