import { Module } from '@nestjs/common';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { IAccountRepository } from '@/domain/account/account.repository.interface';
import { AccountRepository } from '@/domain/account/account-repository.service';
import { EmailApiModule } from '@/datasources/email-api/email-api.module';
import { ISubscriptionRepository } from '@/domain/subscriptions/subscription.repository.interface';
import { SubscriptionRepository } from '@/domain/subscriptions/subscription.repository';

@Module({
  imports: [AccountDataSourceModule, EmailApiModule],
  providers: [
    { provide: IAccountRepository, useClass: AccountRepository },
    {
      provide: ISubscriptionRepository,
      useClass: SubscriptionRepository,
    },
  ],
  exports: [IAccountRepository],
})
export class AccountDomainModule {}
