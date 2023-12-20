import { IEmailDataSource } from '@/domain/interfaces/email.datasource.interface';
import { Inject, Injectable } from '@nestjs/common';
import codeGenerator from '@/domain/email/code-generator';
import { Email, EmailAddress } from '@/domain/email/entities/email.entity';
import { IEmailRepository } from '@/domain/email/email.repository.interface';
import { EmailSaveError } from '@/domain/email/errors/email-save.error';
import { ResendVerificationTimespanError } from '@/domain/email/errors/verification-timeframe.error';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { EmailAlreadyVerifiedError } from '@/domain/email/errors/email-already-verified.error';
import { InvalidVerificationCodeError } from '@/domain/email/errors/invalid-verification-code.error';

@Injectable()
export class EmailRepository implements IEmailRepository {
  private readonly verificationCodeResendLockWindowMs: number;
  private readonly verificationCodeTtlMs: number;

  constructor(
    @Inject(IEmailDataSource)
    private readonly emailDataSource: IEmailDataSource,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.verificationCodeResendLockWindowMs =
      this.configurationService.getOrThrow(
        'email.verificationCode.resendLockWindowMs',
      );
    this.verificationCodeTtlMs = this.configurationService.getOrThrow(
      'email.verificationCode.ttlMs',
    );
  }

  private _generateCode() {
    const verificationCode = codeGenerator();
    // Pads the final verification code to 6 characters
    // The generated code might have less than 6 digits so the version to be
    // validated against should account with the leading zeroes
    return verificationCode.toString().padStart(6, '0');
  }

  async saveEmail(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: string;
    account: string;
  }): Promise<void> {
    const email = new EmailAddress(args.emailAddress);
    const verificationCode = this._generateCode();

    try {
      await this.emailDataSource.saveEmail({
        chainId: args.chainId,
        code: verificationCode,
        emailAddress: email,
        safeAddress: args.safeAddress,
        account: args.account,
        codeGenerationDate: new Date(),
      });
      await this._sendEmailVerification({
        ...args,
        code: verificationCode,
      });
    } catch (e) {
      throw new EmailSaveError(args.chainId, args.safeAddress, args.account);
    }
  }

  async getVerifiedEmailsBySafeAddress(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<string[]> {
    const emails =
      await this.emailDataSource.getVerifiedAccountEmailsBySafeAddress(args);
    return emails.map(({ email }) => email);
  }

  async resendEmailVerification(args: {
    chainId: string;
    safeAddress: string;
    account: string;
  }): Promise<void> {
    let email = await this.emailDataSource.getEmail(args);

    // If the email was already verified, we should not send out a new
    // verification code
    if (email.isVerified) {
      throw new EmailAlreadyVerifiedError(args);
    }

    // If there's a date for when the verification was sent out,
    // check if timespan is still valid.
    if (email.verificationSentOn) {
      const timespanMs = Date.now() - email.verificationSentOn.getTime();
      if (timespanMs < this.verificationCodeResendLockWindowMs) {
        throw new ResendVerificationTimespanError({
          ...args,
          timespanMs,
          lockWindowMs: this.verificationCodeResendLockWindowMs,
        });
      }
    }

    if (!this._isEmailVerificationCodeValid(email)) {
      // Expired code. Generate new one
      await this.emailDataSource.setVerificationCode({
        chainId: args.chainId,
        safeAddress: args.safeAddress,
        account: args.account,
        code: this._generateCode(),
        codeGenerationDate: new Date(),
      });
    }

    email = await this.emailDataSource.getEmail(args);
    if (!email.verificationCode) {
      throw new InvalidVerificationCodeError(args);
    }

    await this._sendEmailVerification({
      ...args,
      code: email.verificationCode,
    });
  }

  async verifyEmailAddress(args: {
    chainId: string;
    safeAddress: string;
    account: string;
    code: string;
  }): Promise<void> {
    const email = await this.emailDataSource.getEmail(args);

    if (email.verificationCode !== args.code) {
      throw new InvalidVerificationCodeError(args);
    }

    if (!this._isEmailVerificationCodeValid(email)) {
      throw new InvalidVerificationCodeError(args);
    }

    // TODO: it is possible that when verifying the email address, a new code generation was triggered
    return this.emailDataSource.verifyEmail(args);
  }

  async deleteEmail(args: {
    chainId: string;
    safeAddress: string;
    account: string;
  }): Promise<void> {
    return this.emailDataSource.deleteEmail(args);
  }

  private _isEmailVerificationCodeValid(email: Email) {
    if (!email.verificationGeneratedOn) return false;
    const window = Date.now() - email.verificationGeneratedOn.getTime();
    return window < this.verificationCodeTtlMs;
  }

  private async _sendEmailVerification(args: {
    chainId: string;
    safeAddress: string;
    account: string;
    code: string;
  }) {
    // TODO send email via provider
    // Update verification-sent date on a successful response
    await this.emailDataSource.setVerificationSentDate({
      ...args,
      sentOn: new Date(),
    });
  }
}
