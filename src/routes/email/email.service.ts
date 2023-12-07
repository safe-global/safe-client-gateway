import { Inject, Injectable } from '@nestjs/common';
import { IEmailRepository } from '@/domain/email/email.repository.interface';

@Injectable()
export class EmailService {
  constructor(
    @Inject(IEmailRepository) private readonly repository: IEmailRepository,
  ) {}

  async saveEmail(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: string;
    account: string;
  }): Promise<void> {
    return this.repository.saveEmail(args);
  }

  async resendVerification(args: {
    chainId: string;
    safeAddress: string;
    account: string;
  }): Promise<void> {
    return this.repository.resendEmailVerification({
      ...args,
      signer: args.account,
    });
  }
}
