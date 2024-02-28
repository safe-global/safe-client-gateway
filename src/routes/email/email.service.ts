import {
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { IAccountRepository } from '@/domain/account/account.repository.interface';
import { Email } from '@/routes/email/entities/email.entity';
import { InvalidAddressError } from 'viem';

@Injectable()
export class EmailService {
  constructor(
    @Inject(IAccountRepository) private readonly repository: IAccountRepository,
  ) {}

  private _mapInvalidAddressError(e: unknown): never {
    if (e instanceof InvalidAddressError) {
      throw new UnprocessableEntityException(e.shortMessage);
    }
    throw e;
  }

  async saveEmail(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: string;
    signer: string;
  }): Promise<void> {
    return this.repository
      .createAccount(args)
      .catch((e) => this._mapInvalidAddressError(e));
  }

  async resendVerification(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): Promise<void> {
    return this.repository
      .resendEmailVerification(args)
      .catch((e) => this._mapInvalidAddressError(e));
  }

  async verifyEmailAddress(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
    code: string;
  }): Promise<void> {
    return this.repository
      .verifyEmailAddress(args)
      .catch((e) => this._mapInvalidAddressError(e));
  }

  async deleteEmail(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): Promise<void> {
    return this.repository
      .deleteAccount(args)
      .catch((e) => this._mapInvalidAddressError(e));
  }

  async editEmail(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
    emailAddress: string;
  }): Promise<void> {
    return this.repository
      .editEmail(args)
      .catch((e) => this._mapInvalidAddressError(e));
  }

  async getEmail(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): Promise<Email> {
    const account = await this.repository
      .getAccount(args)
      .catch((e) => this._mapInvalidAddressError(e));

    return new Email(account.emailAddress.value, account.isVerified);
  }
}
