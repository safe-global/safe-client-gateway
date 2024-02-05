import { IAccountDataSource } from '@/domain/interfaces/account.datasource.interface';
import { Inject, Injectable } from '@nestjs/common';
import codeGenerator from '@/domain/account/code-generator';
import {
  EmailAddress,
  VerificationCode,
} from '@/domain/account/entities/account.entity';
import { IAccountRepository } from '@/domain/account/account.repository.interface';
import { AccountSaveError } from '@/domain/account/errors/account-save.error';
import { ResendVerificationTimespanError } from '@/domain/account/errors/verification-timeframe.error';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { EmailAlreadyVerifiedError } from '@/domain/account/errors/email-already-verified.error';
import { InvalidVerificationCodeError } from '@/domain/account/errors/invalid-verification-code.error';
import { EmailEditMatchesError } from '@/domain/account/errors/email-edit-matches.error';
import { IEmailApi } from '@/domain/interfaces/email-api.interface';
import * as crypto from 'crypto';
import { ISubscriptionRepository } from '@/domain/subscriptions/subscription.repository.interface';
import { SubscriptionRepository } from '@/domain/subscriptions/subscription.repository';
import { AccountDoesNotExistError } from '@/datasources/account/errors/account-does-not-exist.error';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { VerificationCodeDoesNotExistError } from '@/datasources/account/errors/verification-code-does-not-exist.error';

@Injectable()
export class AccountRepository implements IAccountRepository {
  private readonly verificationCodeResendLockWindowMs: number;
  private readonly verificationCodeTtlMs: number;
  private static readonly VERIFICATION_CODE_EMAIL_SUBJECT = 'Verification code';

  constructor(
    @Inject(IAccountDataSource)
    private readonly accountDataSource: IAccountDataSource,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IEmailApi) private readonly emailApi: IEmailApi,
    @Inject(ISubscriptionRepository)
    private readonly subscriptionRepository: ISubscriptionRepository,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    this.verificationCodeResendLockWindowMs =
      this.configurationService.getOrThrow(
        'email.verificationCode.resendLockWindowMs',
      );
    this.verificationCodeTtlMs = this.configurationService.getOrThrow(
      'email.verificationCode.ttlMs',
    );
  }

  private _generateCode(): string {
    const verificationCode = codeGenerator();
    // Pads the final verification code to 6 characters
    // The generated code might have less than 6 digits so the version to be
    // validated against should account with the leading zeroes
    return verificationCode.toString().padStart(6, '0');
  }

  async createAccount(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: string;
    signer: string;
  }): Promise<void> {
    const email = new EmailAddress(args.emailAddress);
    const verificationCode = this._generateCode();

    try {
      await this.accountDataSource.createAccount({
        chainId: args.chainId,
        code: verificationCode,
        emailAddress: email,
        safeAddress: args.safeAddress,
        signer: args.signer,
        codeGenerationDate: new Date(),
        unsubscriptionToken: crypto.randomUUID(),
      });
      // New account registrations should be subscribed to the Account Recovery category
      await this.subscriptionRepository.subscribe({
        chainId: args.chainId,
        signer: args.signer,
        safeAddress: args.safeAddress,
        notificationTypeKey: SubscriptionRepository.CATEGORY_ACCOUNT_RECOVERY,
      });
      await this._sendEmailVerification({
        ...args,
        code: verificationCode,
      });
    } catch (e) {
      throw new AccountSaveError(args.chainId, args.safeAddress, args.signer);
    }
  }

  async getVerifiedEmailsBySafeAddress(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<string[]> {
    const emails =
      await this.accountDataSource.getVerifiedAccountEmailsBySafeAddress(args);
    return emails.map(({ email }) => email);
  }

  async resendEmailVerification(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): Promise<void> {
    const account = await this.accountDataSource.getAccount(args);

    // If the account was already verified, we should not send out a new
    // verification code
    if (account.isVerified) {
      throw new EmailAlreadyVerifiedError(args);
    }

    const verificationCode: VerificationCode | null =
      await this.accountDataSource
        .getAccountVerificationCode(args)
        .catch((reason) => {
          this.loggingService.warn(reason);
          return null;
        });

    // If there's a date for when the verification was sent out,
    // check if timespan is still valid.
    if (verificationCode?.sentOn) {
      const timespanMs = Date.now() - verificationCode.sentOn.getTime();
      if (timespanMs < this.verificationCodeResendLockWindowMs) {
        throw new ResendVerificationTimespanError({
          ...args,
          timespanMs,
          lockWindowMs: this.verificationCodeResendLockWindowMs,
        });
      }
    }

    if (!this._isEmailVerificationCodeValid(verificationCode)) {
      // Expired or non-existent code. Generate new one
      await this.accountDataSource.setEmailVerificationCode({
        chainId: args.chainId,
        safeAddress: args.safeAddress,
        signer: args.signer,
        code: this._generateCode(),
        codeGenerationDate: new Date(),
      });
    }

    const currentVerificationCode =
      await this.accountDataSource.getAccountVerificationCode(args);

    await this._sendEmailVerification({
      ...args,
      code: currentVerificationCode.code,
      emailAddress: account.emailAddress.value,
    });
  }

  async verifyEmailAddress(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
    code: string;
  }): Promise<void> {
    const account = await this.accountDataSource.getAccount(args);

    if (account.isVerified) {
      // account is already verified, so we don't need to perform further checks
      return;
    }

    let verificationCode: VerificationCode;
    try {
      verificationCode =
        await this.accountDataSource.getAccountVerificationCode(args);
    } catch (e) {
      // If we attempt to verify an email is done without a verification code in place,
      // Send a new code to the client's email address for verification
      this.loggingService.warn(e);
      if (e instanceof VerificationCodeDoesNotExistError) {
        await this.resendEmailVerification(args);
      }
      // throw an error to the clients informing that the email address needs to be verified with a new code
      throw new Error('Email needs to be verified again');
    }

    if (verificationCode.code !== args.code) {
      throw new InvalidVerificationCodeError(args);
    }

    if (!this._isEmailVerificationCodeValid(verificationCode)) {
      throw new InvalidVerificationCodeError(args);
    }

    // TODO: it is possible that when verifying the email address, a new code generation was triggered
    await this.accountDataSource.verifyEmail(args);
  }

  async deleteAccount(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): Promise<void> {
    try {
      const account = await this.accountDataSource.getAccount(args);
      // If there is an error deleting the email address,
      // do not delete the respective account as we still need to get the email
      // for future deletions requests
      await this.emailApi.deleteEmailAddress({
        emailAddress: account.emailAddress.value,
      });
      await this.accountDataSource.deleteAccount(args);
    } catch (error) {
      this.loggingService.warn(error);
      // If there is no account, do not throw in order not to signal its existence
      if (!(error instanceof AccountDoesNotExistError)) {
        throw error;
      }
    }
  }

  async editEmail(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: string;
    signer: string;
  }): Promise<void> {
    const account = await this.accountDataSource.getAccount(args);
    const newEmail = new EmailAddress(args.emailAddress);

    if (newEmail.value === account.emailAddress.value) {
      throw new EmailEditMatchesError(args);
    }

    const newVerificationCode = this._generateCode();

    await this.accountDataSource.updateAccountEmail({
      chainId: args.chainId,
      emailAddress: newEmail,
      safeAddress: args.safeAddress,
      signer: args.signer,
      unsubscriptionToken: crypto.randomUUID(),
    });
    await this.accountDataSource.setEmailVerificationCode({
      chainId: args.chainId,
      code: newVerificationCode,
      signer: args.signer,
      codeGenerationDate: new Date(),
      safeAddress: args.safeAddress,
    });
    // TODO if the following throws we should not throw
    await this._sendEmailVerification({
      ...args,
      code: newVerificationCode,
    });
  }

  private _isEmailVerificationCodeValid(
    verificationCode: VerificationCode | null,
  ): boolean {
    if (!verificationCode || !verificationCode.generatedOn) return false;
    const window = Date.now() - verificationCode.generatedOn.getTime();
    return window < this.verificationCodeTtlMs;
  }

  private async _sendEmailVerification(args: {
    signer: string;
    chainId: string;
    code: string;
    emailAddress: string;
    safeAddress: string;
  }): Promise<void> {
    await this.emailApi.createMessage({
      to: [args.emailAddress],
      template: this.configurationService.getOrThrow(
        'email.templates.verificationCode',
      ),
      subject: AccountRepository.VERIFICATION_CODE_EMAIL_SUBJECT,
      substitutions: { verificationCode: args.code },
    });

    // Update verification-sent date on a successful response
    await this.accountDataSource.setEmailVerificationSentDate({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
      signer: args.signer,
      sentOn: new Date(),
    });
  }
}
