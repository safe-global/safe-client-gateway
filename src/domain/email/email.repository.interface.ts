export const IEmailRepository = Symbol('IEmailRepository');

export interface IEmailRepository {
  saveEmail(args: {
    chainId: string;
    safe: string;
    emailAddress: string;
    account: string;
  }): Promise<void>;
}
