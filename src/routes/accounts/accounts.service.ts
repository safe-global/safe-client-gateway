import { IAccountsRepository } from '@/domain/accounts/accounts.repository.interface';
import { Account as DomainAccount } from '@/domain/accounts/entities/account.entity';
import { AccountDataType as DomainAccountDataType } from '@/domain/accounts/entities/account-data-type.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { AccountDataType } from '@/routes/accounts/entities/account-data-type.entity';
import { Account } from '@/routes/accounts/entities/account.entity';
import { CreateAccountDto } from '@/routes/accounts/entities/create-account.dto.entity';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class AccountsService {
  constructor(
    @Inject(IAccountsRepository)
    private readonly accountsRepository: IAccountsRepository,
  ) {}

  async createAccount(args: {
    authPayload: AuthPayload;
    createAccountDto: CreateAccountDto;
  }): Promise<Account> {
    const domainAccount = await this.accountsRepository.createAccount({
      authPayload: args.authPayload,
      address: args.createAccountDto.address,
    });
    return this.mapAccount(domainAccount);
  }

  async getAccount(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
  }): Promise<Account> {
    const domainAccount = await this.accountsRepository.getAccount({
      authPayload: args.authPayload,
      address: args.address,
    });
    return this.mapAccount(domainAccount);
  }

  async deleteAccount(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
  }): Promise<void> {
    await this.accountsRepository.deleteAccount({
      authPayload: args.authPayload,
      address: args.address,
    });
  }

  async getDataTypes(): Promise<AccountDataType[]> {
    const domainDataTypes = await this.accountsRepository.getDataTypes();
    return domainDataTypes.map((domainDataType) =>
      this.mapDataType(domainDataType),
    );
  }

  private mapAccount(domainAccount: DomainAccount): Account {
    return new Account(
      domainAccount.id.toString(),
      domainAccount.group_id?.toString() ?? null,
      domainAccount.address,
    );
  }

  private mapDataType(domainDataType: DomainAccountDataType): AccountDataType {
    return new AccountDataType(
      domainDataType.id.toString(),
      domainDataType.name,
      domainDataType.description?.toString() ?? null,
      domainDataType.is_active,
    );
  }
}
