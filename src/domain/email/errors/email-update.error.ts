export class EmailUpdateError extends Error {
  constructor(args: { chainId: string; safeAddress: string; account: string }) {
    super(
      `Error while updating email of provided Safe owner. chainId=${args.chainId}, safeAddress=${args.safeAddress}, account=${args.account}`,
    );
  }
}
