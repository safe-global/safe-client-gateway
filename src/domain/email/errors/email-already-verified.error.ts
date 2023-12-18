export class EmailAlreadyVerifiedError extends Error {
  readonly account: string;

  constructor(args: { chainId: string; safeAddress: string; account: string }) {
    super(
      `The email address is already verified. chainId=${args.chainId}, safeAddress=${args.safeAddress}, account=${args.account}`,
    );
    this.account = args.account;
  }
}
