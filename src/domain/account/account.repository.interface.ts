export const IAccountRepository = Symbol('IAccountRepository');

export interface IAccountRepository {
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
   * Saves an account entry.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address to which we should store the email address
   * @param args.emailAddress - the email address to store
   * @param args.account - the owner address to which we should link the email address to
   */
  saveAccount(args: {
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
   * @param args.account - the owner address to which we should link the email address to
   *
   * @throws {EmailAlreadyVerifiedError} - if the email is already verified
   * @throws {ResendVerificationTimespanError} -
   * if trying to trigger a resend within email.verificationCode.resendLockWindowMs
   * @throws {InvalidVerificationCodeError} - if a verification code was not set
   */
  resendEmailVerification(args: {
    chainId: string;
    safeAddress: string;
    account: string;
  }): Promise<void>;

  /**
   * Verifies an email address with the provided code.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address to which we should store the email address
   * @param args.account - the owner address to which we should link the email address to
   * @param args.code - the user-provided code to validate the email verification
   *
   * @throws {InvalidVerificationCodeError} - if the verification code does not match the expected one
   * @throws {InvalidVerificationCodeError} - if the verification code expired
   */
  verifyEmailAddress(args: {
    chainId: string;
    safeAddress: string;
    account: string;
    code: string;
  }): Promise<any>;

  /**
   * Deletes an account.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address to which we should remove the email address from
   * @param args.account - the owner address to which we should remove the email address from
   */
  deleteAccount(args: {
    chainId: string;
    safeAddress: string;
    account: string;
  }): Promise<void>;

  /**
   * Edits an email entry.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address to which we should store the email address
   * @param args.emailAddress - the email address to store
   * @param args.account - the owner address to which we should link the email address to
   *
   * @throws {EditTimespanError} - if trying to edit again within email.verificationCode.resendLockWindowMs
   * @throws {EmailEditMatchesError} - if trying to apply edit with same email address as current one
   */
  editEmail(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: string;
    account: string;
  }): Promise<void>;
}
