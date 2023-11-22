export const IEmailRepository = Symbol('IEmailRepository');

export interface IEmailRepository {
  saveEmail(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: string;
    account: string;
  }): Promise<void>;
}
