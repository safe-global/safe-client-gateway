import { IEmailDataSource } from '@/domain/interfaces/email.datasource.interface';
import { Inject } from '@nestjs/common';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import codeGenerator from '@/domain/email/code-generator';
import { Email } from '@/domain/email/entities/email.entity';
import { IEmailRepository } from '@/domain/email/email.repository.interface';
import { SignerNotOwnerError } from '@/domain/email/errors/signer-not-owner.error';
import { EmailSaveError } from '@/domain/email/errors/email-save.error';

export class EmailRepository implements IEmailRepository {
  constructor(
    @Inject(IEmailDataSource)
    private readonly emailDataSource: IEmailDataSource,
    @Inject(ISafeRepository) private readonly safeRepository: ISafeRepository,
  ) {}

  async saveEmail(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: string;
    signer: string;
  }): Promise<void> {
    const email = new Email(args.emailAddress);

    const safe = await this.safeRepository.getSafe({
      chainId: args.chainId,
      address: args.safeAddress,
    });

    if (!safe.owners.includes(args.signer)) {
      // Signer needs to be an owner of the safe
      throw new SignerNotOwnerError(
        args.chainId,
        args.safeAddress,
        args.signer,
      );
    }

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
        safeAddress: args.safeAddress,
        signer: args.signer,
      });
    } catch (e) {
      throw new EmailSaveError(args.chainId, args.safeAddress, args.signer);
    }
  }
}
