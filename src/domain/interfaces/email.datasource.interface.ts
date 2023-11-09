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
   * @param args.code - the generated code to be used to verify this email address
   */
  saveEmail(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: string;
    signer: string;
    code: number;
  }): Promise<EmailVerificationCode>;

  /**
   * Sets the verification code for the signer of a Safe.
   *
   * If the reset was successful, the new verification code
   * {@link EmailVerificationCode} is returned.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address
   * @param args.signer - the owner address
   * @param args.code - the generated code to be used to verify this email address
   */
  setVerificationCode(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
    code: number;
  }): Promise<EmailVerificationCode>;

  /**
   * Verifies the email address for the signer of a Safe.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address
   * @param args.signer - the owner address
   */
  verifyEmail(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): Promise<void>;
}
