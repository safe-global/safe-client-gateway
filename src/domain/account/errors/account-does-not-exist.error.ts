export class AccountDoesNotExistError extends Error {
  readonly signer: `0x${string}`;

  constructor(
    chainId: string,
    safeAddress: `0x${string}`,
    signer: `0x${string}`,
  ) {
    super(
      `Account for ${signer} of ${safeAddress} on chain ${chainId} does not exist.`,
    );
    this.signer = signer;
  }
}
