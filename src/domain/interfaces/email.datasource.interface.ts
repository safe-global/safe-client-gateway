import { Email, EmailAddress } from '@/domain/email/entities/email.entity';

export const IEmailDataSource = Symbol('IEmailDataSource');

export interface IEmailDataSource {
  /**
   * Gets the verified emails associated with a Safe address.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address to use as filter
   */
  getVerifiedSignerEmailsBySafeAddress(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<{ email: string }[]>;

  /**
   * Gets the email associated with a signer of a Safe for a specific chain.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address to use as filter
   * @param args.signer - the owner address to which link the email address is linked to
   */
  getEmail(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): Promise<Email>;

  /**
   * Saves an email entry in the respective data source.
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
    emailAddress: EmailAddress;
    signer: string;
    code: string;
  }): Promise<void>;

  /**
   * Sets the verification code for an email entry.
   *
   * If the reset was successful, the new verification code is returned.
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
    code: string;
  }): Promise<void>;

  /**
   * Sets the verification date for an email entry.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address
   * @param args.signer - the owner address
   * @param args.sent_on - the verification-sent date
   */
  setVerificationSentDate(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
    sentOn: Date;
  }): Promise<void>;

  /**
   * Verifies the email address for a signer of a Safe.
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
