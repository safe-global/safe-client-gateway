import { IEmailDataSource } from '@/domain/interfaces/email.datasource.interface';
import { Inject } from '@nestjs/common';
import codeGenerator from '@/domain/email/code-generator';
import { Email } from '@/domain/email/entities/email.entity';
import { IEmailRepository } from '@/domain/email/email.repository.interface';
import { EmailSaveError } from '@/domain/email/errors/email-save.error';

export class EmailRepository implements IEmailRepository {
  constructor(
    @Inject(IEmailDataSource)
    private readonly emailDataSource: IEmailDataSource,
  ) {}

  async saveEmail(args: {
    chainId: string;
    safe: string;
    emailAddress: string;
    account: string;
  }): Promise<void> {
    const email = new Email(args.emailAddress);
    const verificationCode = codeGenerator();

    // Pads the final verification code to 6 characters
    // The generated code might have less than 6 digits so the version to be
    // validated against should account with the leading zeroes
    const paddedVerificationCode = verificationCode.toString().padStart(6, '0');

    try {
      await this.emailDataSource.saveEmail({
        chainId: args.chainId,
        code: paddedVerificationCode,
        emailAddress: email.value,
        safeAddress: args.safe,
        signer: args.account,
      });

      // TODO if successful, send the generated code (result.verification)
    } catch (e) {
      throw new EmailSaveError(args.chainId, args.safe, args.account);
    }
  }
}
