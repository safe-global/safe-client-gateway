export class EmailAlreadyVerifiedError extends Error {
  readonly signer: string;

  constructor(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    signer: `0x${string}`;
  }) {
    super(
      `The email address is already verified. chainId=${args.chainId}, safeAddress=${args.safeAddress}, signer=${args.signer}`,
    );
    this.signer = args.signer;
  }
}
