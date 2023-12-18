export class EmailAddressDoesNotExistError extends Error {
  constructor(chainId: string, safeAddress: string, account: string) {
    super(
      `Email address for account ${account} of ${safeAddress} on chain ${chainId} does not exist.`,
    );
  }
}
