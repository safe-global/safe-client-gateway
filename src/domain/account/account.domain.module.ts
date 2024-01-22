import { Module } from '@nestjs/common';
import { AccountDatasourceModule } from '@/datasources/account/account.datasource.module';
import { IAccountRepository } from '@/domain/account/account.repository.interface';
import { AccountRepository } from '@/domain/account/account-repository.service';
import { EmailApiModule } from '@/datasources/email-api/email-api.module';

@Module({
  imports: [AccountDatasourceModule, EmailApiModule],
  providers: [{ provide: IAccountRepository, useClass: AccountRepository }],
  exports: [IAccountRepository],
})
export class AccountDomainModule {}
