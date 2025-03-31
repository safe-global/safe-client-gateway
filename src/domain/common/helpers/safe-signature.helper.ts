import { Injectable } from '@nestjs/common';
import { getAddress, recoverAddress, hashMessage } from 'viem';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';

@Injectable()
export class SafeSignatureHelper {
  public async recoverAddress(args: {
    signature: `0x${string}`;
    hash: `0x${string}`;
  }): Promise<`0x${string}`> {
    const { r, s, v, signatureType } = this.parseSignature(args.signature);

    switch (signatureType) {
      case SignatureType.ContractSignature:
      case SignatureType.ApprovedHash: {
        return getAddress(`0x${r.slice(-40)}`);
      }
      case SignatureType.EthSign: {
        // To differentiate signature types, eth_sign signatures have v value increased by 4
        // @see https://docs.safe.global/advanced/smart-account-signatures#eth_sign-signature
        const normalizedSignature: `0x${string}` = `${r}${s.slice(2)}${(v - 4).toString(16)}`;
        return recoverAddress({
          hash: hashMessage({ raw: args.hash }),
          signature: normalizedSignature,
        });
      }
      case SignatureType.Eoa: {
        return recoverAddress(args);
      }
    }
  }

  public parseSignature(signature: `0x${string}`): {
    r: `0x${string}`;
    s: `0x${string}`;
    v: number;
    signatureType: SignatureType;
  } {
    if (signature.length < 132 || !signature.startsWith('0x')) {
      throw new Error('Invalid signature');
    }

    // We cannot parse the signature with viem due to custom v
    const r: `0x${string}` = `0x${signature.slice(2, 66)}`;
    const s: `0x${string}` = `0x${signature.slice(66, 130)}`;
    const v = parseInt(signature.slice(-2), 16);

    const signatureType = ((): SignatureType => {
      if (v === 0) {
        return SignatureType.ContractSignature;
      }
      if (v === 1) {
        return SignatureType.ApprovedHash;
      }
      if (v > 30) {
        return SignatureType.EthSign;
      }
      return SignatureType.Eoa;
    })();

    return {
      r,
      s,
      v,
      signatureType,
    };
  }

  // TODO: Take contract signatures into account
  public splitConcatenatedSignatures(
    concatenatedSignatures: `0x${string}`,
  ): Array<`0x${string}`> {
    if ((concatenatedSignatures.length - 2) % 130 !== 0) {
      throw new Error('Invalid concatenated signature');
    }

    const signatures: Array<`0x${string}`> = [];

    for (let i = 2; i < concatenatedSignatures.length; i += 130) {
      signatures.push(`0x${concatenatedSignatures.slice(i, i + 130)}`);
    }

    return signatures;
  }
}
