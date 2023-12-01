import { IEmailDataSource } from '@/domain/interfaces/email.datasource.interface';
import { Inject, Injectable } from '@nestjs/common';
import codeGenerator from '@/domain/email/code-generator';
import { EmailAddress } from '@/domain/email/entities/email.entity';
import { IEmailRepository } from '@/domain/email/email.repository.interface';
import { EmailSaveError } from '@/domain/email/errors/email-save.error';

@Injectable()
export class EmailRepository implements IEmailRepository {
  constructor(
    @Inject(IEmailDataSource)
    private readonly emailDataSource: IEmailDataSource,
  ) {}

  async saveEmail(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: string;
    account: string;
  }): Promise<void> {
    const email = new EmailAddress(args.emailAddress);
    const verificationCode = codeGenerator();

    // Pads the final verification code to 6 characters
    // The generated code might have less than 6 digits so the version to be
    // validated against should account with the leading zeroes
    const paddedVerificationCode = verificationCode.toString().padStart(6, '0');

    try {
      await this.emailDataSource.saveEmail({
        chainId: args.chainId,
        code: paddedVerificationCode,
        emailAddress: email,
        safeAddress: args.safeAddress,
        signer: args.account,
        codeGenerationDate: new Date(),
      });

      // TODO if successful, send the generated code (result.verification)
    } catch (e) {
      throw new EmailSaveError(args.chainId, args.safeAddress, args.account);
    }
  }

  async getVerifiedEmailsBySafeAddress(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<string[]> {
    const emails =
      await this.emailDataSource.getVerifiedSignerEmailsBySafeAddress(args);
    return emails.map(({ email }) => email);
  }
}
