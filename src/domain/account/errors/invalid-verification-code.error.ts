export class InvalidVerificationCodeError extends Error {
  constructor(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    signer: `0x${string}`;
  }) {
    super(
      `The verification code is invalid. chainId=${args.chainId}, safeAddress=${args.safeAddress}, signer=${args.signer} `,
    );
  }
}
