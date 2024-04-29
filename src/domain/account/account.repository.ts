import { IAccountDataSource } from '@/domain/interfaces/account.datasource.interface';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import codeGenerator from '@/domain/account/code-generator';
import {
  Account,
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
import { AccountDoesNotExistError } from '@/domain/account/errors/account-does-not-exist.error';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { VerificationCodeDoesNotExistError } from '@/datasources/account/errors/verification-code-does-not-exist.error';
import { getAddress } from 'viem';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { IAuthRepository } from '@/domain/auth/auth.repository.interface';

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
    @Inject(IAuthRepository)
    private readonly authRepository: IAuthRepository,
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

  async getAccount(args: {
    chainId: string;
    safeAddress: string;
    signer: `0x${string}`;
    authPayload: AuthPayload | undefined;
  }): Promise<Account> {
    const safeAddress = getAddress(args.safeAddress);
    const signer = getAddress(args.signer);

    const isChain = this.authRepository.isChain({
      chainId: args.chainId,
      authPayload: args.authPayload,
    });
    const isSigner = this.authRepository.isSigner({
      signerAddress: signer,
      authPayload: args.authPayload,
    });

    if (!isChain || !isSigner) {
      throw new UnauthorizedException();
    }

    return this.accountDataSource.getAccount({
      chainId: args.chainId,
      safeAddress,
      signer,
    });
  }

  getAccounts(args: {
    chainId: string;
    safeAddress: string;
    onlyVerified: boolean;
  }): Promise<Account[]> {
    const safeAddress = getAddress(args.safeAddress);
    return this.accountDataSource.getAccounts({
      chainId: args.chainId,
      safeAddress,
      onlyVerified: args.onlyVerified,
    });
  }

  async createAccount(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: string;
    signer: `0x${string}`;
    authPayload: AuthPayload | undefined;
  }): Promise<void> {
    const email = new EmailAddress(args.emailAddress);
    const verificationCode = this._generateCode();
    const safeAddress = getAddress(args.safeAddress);
    const signer = getAddress(args.signer);

    const isChain = this.authRepository.isChain({
      chainId: args.chainId,
      authPayload: args.authPayload,
    });
    const isSigner = this.authRepository.isSigner({
      signerAddress: signer,
      authPayload: args.authPayload,
    });
    const isSafeOwner = await this.authRepository.isSafeOwner({
      safeAddress,
      authPayload: args.authPayload,
    });

    if (!isChain || !isSigner || !isSafeOwner) {
      throw new UnauthorizedException();
    }

    try {
      await this.accountDataSource.createAccount({
        chainId: args.chainId,
        code: verificationCode,
        emailAddress: email,
        safeAddress,
        signer,
        codeGenerationDate: new Date(),
        unsubscriptionToken: crypto.randomUUID(),
      });
      // New account registrations should be subscribed to the Account Recovery category
      await this.subscriptionRepository.subscribe({
        chainId: args.chainId,
        signer,
        safeAddress,
        notificationTypeKey: SubscriptionRepository.CATEGORY_ACCOUNT_RECOVERY,
      });
      this._sendEmailVerification({
        ...args,
        signer,
        safeAddress,
        code: verificationCode,
      });
    } catch (e) {
      throw new AccountSaveError(args.chainId, args.safeAddress, args.signer);
    }
  }

  async resendEmailVerification(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): Promise<void> {
    const safeAddress = getAddress(args.safeAddress);
    const signer = getAddress(args.signer);
    const account = await this.accountDataSource.getAccount({
      chainId: args.chainId,
      safeAddress,
      signer,
    });

    // If the account was already verified, we should not send out a new
    // verification code
    if (account.isVerified) {
      throw new EmailAlreadyVerifiedError(args);
    }

    const verificationCode: VerificationCode | null =
      await this.accountDataSource
        .getAccountVerificationCode({
          chainId: args.chainId,
          safeAddress,
          signer,
        })
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
        safeAddress,
        signer,
        code: this._generateCode(),
        codeGenerationDate: new Date(),
      });
    }

    const currentVerificationCode =
      await this.accountDataSource.getAccountVerificationCode({
        chainId: args.chainId,
        safeAddress,
        signer,
      });

    this._sendEmailVerification({
      chainId: args.chainId,
      safeAddress,
      signer,
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
    const safeAddress = getAddress(args.safeAddress);
    const signer = getAddress(args.signer);
    const account = await this.accountDataSource.getAccount({
      chainId: args.chainId,
      safeAddress,
      signer,
    });

    if (account.isVerified) {
      // account is already verified, so we don't need to perform further checks
      throw new EmailAlreadyVerifiedError(args);
    }

    let verificationCode: VerificationCode;
    try {
      verificationCode =
        await this.accountDataSource.getAccountVerificationCode({
          chainId: args.chainId,
          safeAddress,
          signer,
        });
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
    await this.accountDataSource.verifyEmail({
      chainId: args.chainId,
      safeAddress,
      signer,
    });
  }

  async deleteAccount(args: {
    chainId: string;
    safeAddress: string;
    signer: `0x${string}`;
    authPayload: AuthPayload | undefined;
  }): Promise<void> {
    const safeAddress = getAddress(args.safeAddress);
    const signer = getAddress(args.signer);

    const isChain = this.authRepository.isChain({
      chainId: args.chainId,
      authPayload: args.authPayload,
    });
    const isSigner = this.authRepository.isSigner({
      signerAddress: signer,
      authPayload: args.authPayload,
    });

    if (!isChain || !isSigner) {
      throw new UnauthorizedException();
    }

    try {
      const account = await this.accountDataSource.getAccount({
        chainId: args.chainId,
        safeAddress,
        signer,
      });
      // If there is an error deleting the email address,
      // do not delete the respective account as we still need to get the email
      // for future deletions requests
      await this.emailApi.deleteEmailAddress({
        emailAddress: account.emailAddress.value,
      });
      await this.accountDataSource.deleteAccount({
        chainId: args.chainId,
        safeAddress,
        signer,
      });
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
    signer: `0x${string}`;
    authPayload: AuthPayload | undefined;
  }): Promise<void> {
    const safeAddress = getAddress(args.safeAddress);
    const signer = getAddress(args.signer);

    const isChain = this.authRepository.isChain({
      chainId: args.chainId,
      authPayload: args.authPayload,
    });
    const isSigner = this.authRepository.isSigner({
      signerAddress: signer,
      authPayload: args.authPayload,
    });

    if (!isChain || !isSigner) {
      throw new UnauthorizedException();
    }

    const account = await this.accountDataSource.getAccount({
      chainId: args.chainId,
      safeAddress,
      signer,
    });
    const newEmail = new EmailAddress(args.emailAddress);

    if (newEmail.value === account.emailAddress.value) {
      throw new EmailEditMatchesError(args);
    }

    const newVerificationCode = this._generateCode();

    await this.accountDataSource.updateAccountEmail({
      chainId: args.chainId,
      emailAddress: newEmail,
      safeAddress,
      signer,
      unsubscriptionToken: crypto.randomUUID(),
    });
    await this.accountDataSource.setEmailVerificationCode({
      chainId: args.chainId,
      code: newVerificationCode,
      signer,
      codeGenerationDate: new Date(),
      safeAddress,
    });
    this._sendEmailVerification({
      chainId: args.chainId,
      safeAddress,
      signer,
      emailAddress: args.emailAddress,
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

  /**
   * Sends the verification email to the target {@link args.emailAddress}
   *
   * This function returns "immediately" so the result of this operation won't
   * be known to the caller.
   *
   * @private
   */
  private _sendEmailVerification(args: {
    signer: `0x${string}`;
    chainId: string;
    code: string;
    emailAddress: string;
    safeAddress: `0x${string}`;
  }): void {
    this.emailApi
      .createMessage({
        to: [args.emailAddress],
        template: this.configurationService.getOrThrow(
          'email.templates.verificationCode',
        ),
        subject: AccountRepository.VERIFICATION_CODE_EMAIL_SUBJECT,
        substitutions: { verificationCode: args.code },
      })
      .catch(() => {
        this.loggingService.warn(`Error sending verification email.`);
      })
      .then(() =>
        // Update verification-sent date on a successful response
        this.accountDataSource.setEmailVerificationSentDate({
          chainId: args.chainId,
          safeAddress: args.safeAddress,
          signer: args.signer,
          sentOn: new Date(),
        }),
      )
      .catch(() =>
        this.loggingService.warn(
          'Error updating email verification sent date.',
        ),
      );
  }
}
