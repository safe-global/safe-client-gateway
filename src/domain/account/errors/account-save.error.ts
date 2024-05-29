export class AccountSaveError extends Error {
  constructor(
    chainId: string,
    safeAddress: `0x${string}`,
    signer: `0x${string}`,
  ) {
    super(
      `Error while creating account. Account was not created. chainId=${chainId}, safeAddress=${safeAddress}, signer=${signer}`,
    );
  }
}
