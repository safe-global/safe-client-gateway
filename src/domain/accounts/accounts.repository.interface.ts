import { AccountsDatasourceModule } from '@/datasources/accounts/accounts.datasource.module';
import { AccountsRepository } from '@/domain/accounts/accounts.repository';
import { Account } from '@/domain/accounts/entities/account.entity';
import { AuthPayloadDto } from '@/domain/auth/entities/auth-payload.entity';
import { Module } from '@nestjs/common';

export const IAccountsRepository = Symbol('IAccountsRepository');

export interface IAccountsRepository {
  createAccount(args: {
    auth: AuthPayloadDto;
    address: `0x${string}`;
  }): Promise<Account>;

  deleteAccount(args: {
    auth: AuthPayloadDto;
    address: `0x${string}`;
  }): Promise<void>;
}

@Module({
  imports: [AccountsDatasourceModule],
  providers: [
    {
      provide: IAccountsRepository,
      useClass: AccountsRepository,
    },
  ],
  exports: [IAccountsRepository],
})
export class AccountsRepositoryModule {}
