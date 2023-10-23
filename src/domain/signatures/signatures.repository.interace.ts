import { SignatureType } from '@/domain/signatures/entities/signatures.entity';

export const ISignaturesRepository = Symbol('ISignaturesRepository');

export interface ISignaturesRepository {
  splitSignature(signature: string): {
    r: bigint;
    s: bigint;
    v: number;
  };

  getSignatureType(signature: string): SignatureType;

  verifySignature(args: {
    chainId: string;
    address: string;
    message: string;
    signature: string;
  }): Promise<boolean>;
}
