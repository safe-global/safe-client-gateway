export class VerificationCodeDoesNotExistError extends Error {
  readonly signer: string;

  constructor(chainId: string, safeAddress: string, signer: string) {
    super(
      `Verification code for account of ${signer} of ${safeAddress} on chain ${chainId} does not exist.`,
    );
    this.signer = signer;
  }
}
