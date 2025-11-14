import { Module } from '@nestjs/common';
import { AlertsApiModule } from '@/modules/alerts/datasources/alerts-api.module';
import { AlertsRepository } from '@/modules/alerts/domain/alerts.repository';
import { IAlertsRepository } from '@/modules/alerts/domain/alerts.repository.interface';
import { AlertsDecodersModule } from '@/modules/alerts/domain/alerts-decoders.module';
import { EmailApiModule } from '@/modules/email/datasources/email-api.module';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';
import { ChainsRepositoryModule } from '@/modules/chains/domain/chains.repository.interface';

@Module({
  imports: [
    AlertsApiModule,
    AlertsDecodersModule,
    ChainsRepositoryModule,
    EmailApiModule,
    SafeRepositoryModule,
  ],
  providers: [{ provide: IAlertsRepository, useClass: AlertsRepository }],
  exports: [IAlertsRepository],
})
export class AlertsDomainModule {}
