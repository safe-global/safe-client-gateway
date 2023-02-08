export class SafeRegistration {
  chainId: string;
  safes: string[];
  signatures: string[];

  constructor(chainId: string, safes: string[], signatures: string[]) {
    this.chainId = chainId;
    this.safes = safes;
    this.signatures = signatures;
  }
}
