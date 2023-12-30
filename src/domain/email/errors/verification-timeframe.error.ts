export class ResendVerificationTimespanError extends Error {
  constructor(args: {
    chainId: string;
    safeAddress: string;
    account: string;
    timespanMs: number;
    lockWindowMs: number;
  }) {
    super(
      `Verification cannot be re-sent at this time. ${args.timespanMs} ms have elapsed out of ${args.lockWindowMs} ms for account=${args.account}, safe=${args.safeAddress}, chainId=${args.chainId}`,
    );
  }
}
