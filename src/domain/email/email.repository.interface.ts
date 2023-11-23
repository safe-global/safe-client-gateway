export const IEmailRepository = Symbol('IEmailRepository');

export interface IEmailRepository {
  /**
   * Gets the verified emails associated with a Safe address.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address to use as filter
   */
  getVerifiedEmailsBySafeAddress(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<string[]>;

  /**
   * Saves an email entry.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address to which we should store the email address
   * @param args.emailAddress - the email address to store
   * @param args.account - the owner address to which we should link the email address to
   */
  saveEmail(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: string;
    account: string;
  }): Promise<void>;

  /**
   * Resends the email verification code for an email registration
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address to which we should store the email address
   * @param args.signer - the owner address to which we should link the email address to
   *
   * @throws {EmailAlreadyVerifiedError} - if the email is already verified
   * @throws {ResendVerificationTimespanError} -
   * if trying to trigger a resend within email.verificationCode.resendLockWindowMs
   * @throws {InvalidVerificationCodeError} - if a verification code was not set
   */
  resendEmailVerification(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): Promise<void>;
}
