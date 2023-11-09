export class SignerNotOwnerError extends Error {
  constructor(chainId: string, safeAddress: string, signer: string) {
    super(
      `Signer ${signer} is not an owner of the safe ${safeAddress} on chain ${chainId}.`,
    );
  }
}
