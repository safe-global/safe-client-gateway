export class InvalidVerificationCodeError extends Error {
  constructor(args: { chainId: string; safeAddress: string; account: string }) {
    super(
      `The verification code is invalid. chainId=${args.chainId}, safeAddress=${args.safeAddress}, account=${args.account} `,
    );
  }
}
