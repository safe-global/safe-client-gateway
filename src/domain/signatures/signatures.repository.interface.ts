export const ISignaturesRepository = Symbol('ISignaturesRepository');

export interface ISignaturesRepository {
  verifySignature(args: {
    address: string;
    message: string;
    signature: string;
  }): Promise<boolean>;
}
