import { secp256k1 } from '@noble/curves/secp256k1';
import { getAddress, hexToNumber, isHex, toHex, verifyMessage } from 'viem';
import { ISignaturesRepository } from '@/domain/signatures/signatures.repository.interface';
import { SignatureType } from '@/domain/signatures/entities/signatures.entity';

export class SignaturesRepository implements ISignaturesRepository {
  /**
   * Split signature into r, s, v values as per recommendation of viem author
   * @see https://github.com/wagmi-dev/viem/discussions/458#discussioncomment-5842564
   */
  splitSignature(signature: string): { r: bigint; s: bigint; v: number } {
    const { r, s } = secp256k1.Signature.fromCompact(signature.slice(2, 130));
    const v = hexToNumber(`0x${signature.slice(130)}`);

    return { r, s, v };
  }

  getSignatureType(signature: string): SignatureType {
    const { v } = this.splitSignature(signature);

    if (v === 0) {
      return SignatureType.CONTRACT_SIGNATURE;
    }

    if (v === 1) {
      return SignatureType.APPROVED_HASH;
    }

    if (v > 30) {
      return SignatureType.ETH_SIGN;
    }

    return SignatureType.EOA;
  }

  async verifySignature(args: {
    address: string;
    message: string;
    signature: string;
  }): Promise<boolean> {
    const address = getAddress(args.address);
    const signature = isHex(args.signature)
      ? args.signature
      : toHex(args.signature);

    const signatureType = this.getSignatureType(args.signature);

    // Client is required to verify an on-chain signature
    if (signatureType === SignatureType.CONTRACT_SIGNATURE) {
      return false;
    }

    try {
      return verifyMessage({
        address,
        message: args.message,
        signature,
      });
    } catch (e) {
      console.log(e);
      return false;
    }
  }
}
