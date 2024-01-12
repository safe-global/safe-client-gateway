import { Module } from '@nestjs/common';
import { EmailApiModule } from '@/datasources/email-api/email-api.module';
import { ISubscriptionRepository } from '@/domain/subscriptions/subscription.repository.interface';
import { SubscriptionRepository } from '@/domain/subscriptions/subscription.repository';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';

@Module({
  imports: [AccountDataSourceModule, EmailApiModule],
  providers: [
    { provide: ISubscriptionRepository, useClass: SubscriptionRepository },
  ],
  exports: [ISubscriptionRepository],
})
export class SubscriptionDomainModule {}
