export class EmailUpdateMatchesError extends Error {
  constructor(args: { chainId: string; safeAddress: string; account: string }) {
    super(
      `The provided email address matches that set for the Safe owner. chainId=${args.chainId}, safeAddress=${args.safeAddress}, account=${args.account}`,
    );
  }
}
