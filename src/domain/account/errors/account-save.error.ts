export class AccountSaveError extends Error {
  constructor(chainId: string, safeAddress: string, account: string) {
    super(
      `Error while saving provided email was not saved. chainId=${chainId}, safeAddress=${safeAddress}, account=${account}`,
    );
  }
}
