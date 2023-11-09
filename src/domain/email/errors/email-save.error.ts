export class EmailSaveError extends Error {
  constructor(chainId: string, safeAddress: string, signer: string) {
    super(
      `Error while saving provided email was not saved. chainId=${chainId}, safeAddress=${safeAddress}, signer=${signer}`,
    );
  }
}
