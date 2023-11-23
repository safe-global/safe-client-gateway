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
}
