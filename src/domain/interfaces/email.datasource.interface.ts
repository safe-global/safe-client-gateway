import { EmailVerificationCode } from '@/domain/email/entities/email-verification-code.entity';

export const IEmailDataSource = Symbol('IEmailDataSource');

export interface IEmailDataSource {
  /**
   * Saves an email address in the respective data source.
   *
   * If the email is saved successfully, a verification code
   * {@link EmailVerificationCode} is returned
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address to which we should store the email address
   * @param args.emailAddress - the email address to store
   * @param args.signer - the owner address to which we should link the email address to
   */
  saveEmail(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: string;
    signer: string;
  }): Promise<EmailVerificationCode>;

  /**
   * Resets the verification code for the signer of a Safe.
   *
   * If the reset was successful, the new verification code
   * {@link EmailVerificationCode} is returned.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address to which we should store the email address
   * @param args.signer - the owner address to which we should link the email address to
   */
  resetVerificationCode(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): Promise<EmailVerificationCode>;

  /**
   * Verifies the email address for the signer of a Safe.
   * The code has an expiration time tied to it.
   * It is configurable via the 'email.verificationExpireTimeInSeconds' key.
   *
   * If the code is not valid, a {@link InvalidVerificationCodeError} is thrown.
   * If the code expired, a {@link ExpiredVerificationCodeError} is thrown.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address to which we should store the email address
   * @param args.signer - the owner address to which we should link the email address to
   * @param args.code - the code that was sent to verify the user
   */
  verifyEmail(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
    code: string;
  }): Promise<void>;
}
