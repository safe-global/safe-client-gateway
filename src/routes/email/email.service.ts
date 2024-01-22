import { Inject, Injectable } from '@nestjs/common';
import { IAccountRepository } from '@/domain/account/account.repository.interface';

@Injectable()
export class EmailService {
  constructor(
    @Inject(IAccountRepository) private readonly repository: IAccountRepository,
  ) {}

  async saveEmail(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: string;
    account: string;
  }): Promise<void> {
    return this.repository.saveAccount(args);
  }

  async resendVerification(args: {
    chainId: string;
    safeAddress: string;
    account: string;
  }): Promise<void> {
    return this.repository.resendEmailVerification(args);
  }

  async verifyEmailAddress(args: {
    chainId: string;
    safeAddress: string;
    account: string;
    code: string;
  }): Promise<any> {
    return this.repository.verifyEmailAddress(args);
  }

  async deleteEmail(args: {
    chainId: string;
    safeAddress: string;
    account: string;
  }): Promise<void> {
    return this.repository.deleteAccount(args);
  }

  async editEmail(args: {
    chainId: string;
    safeAddress: string;
    account: string;
    emailAddress: string;
  }): Promise<void> {
    return this.repository.editEmail(args);
  }
}
