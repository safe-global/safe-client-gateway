export const IEmailRepository = Symbol('IEmailRepository');

export interface IEmailRepository {
  saveEmail(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: string;
    signer: string;
  }): Promise<void>;
}
