export class EmailAddressDoesNotExistError extends Error {
  constructor(chainId: string, safeAddress: string, signer: string) {
    super(
      `Email address for signer ${signer} of ${safeAddress} on chain ${chainId} does not exist.`,
    );
  }
}
