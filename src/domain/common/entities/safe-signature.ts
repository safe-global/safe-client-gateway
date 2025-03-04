import { secp256k1 } from '@noble/curves/secp256k1';
import { memoize } from 'lodash';
import {
  checksumAddress,
  encodeAbiParameters,
  hashMessage,
  hexToBigInt,
  parseAbiParameters,
} from 'viem';
import { publicKeyToAddress } from 'viem/utils';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';

export class SafeSignature {
  public signature: `0x${string}`;
  public hash: `0x${string}`;

  constructor(args: { signature: `0x${string}`; hash: `0x${string}` }) {
    if (args.signature.length !== 132) {
      throw new Error('Invalid signature length');
    }

    this.signature = args.signature;
    this.hash = args.hash;
  }

  get r(): `0x${string}` {
    return `0x${this.signature.slice(2, 66)}`;
  }

  get s(): `0x${string}` {
    return `0x${this.signature.slice(66, 130)}`;
  }

  get v(): number {
    return parseInt(this.signature.slice(-2), 16);
  }

  get signatureType(): SignatureType {
    if (this.v === 0) {
      return SignatureType.ContractSignature;
    }
    if (this.v === 1) {
      return SignatureType.ApprovedHash;
    }
    if (this.v > 30) {
      return SignatureType.EthSign;
    }
    return SignatureType.Eoa;
  }

  get owner(): `0x${string}` {
    return this._owner();
  }

  private _owner = memoize(
    () => {
      try {
        switch (this.signatureType) {
          case SignatureType.ContractSignature:
          case SignatureType.ApprovedHash: {
            return uint256ToAddress(this.r);
          }
          case SignatureType.EthSign: {
            const normalizedSignature: `0x${string}` = `${this.r}${this.s.slice(2)}${(this.v - 4).toString(16)}`;
            return recoverAddress({
              hash: hashMessage({ raw: this.hash }),
              signature: normalizedSignature,
            });
          }
          case SignatureType.Eoa: {
            return recoverAddress({
              hash: this.hash,
              signature: this.signature,
            });
          }
        }
      } catch {
        throw new Error('Could not recover address');
      }
    },
    () => {
      return this.signature + this.hash;
    },
  );
}

function uint256ToAddress(value: `0x${string}`): `0x${string}` {
  const encoded = encodeAbiParameters(parseAbiParameters('uint256'), [
    hexToBigInt(value),
  ]);
  return checksumAddress(`0x${encoded.slice(-40)}`);
}

function recoverAddress(args: {
  hash: `0x${string}`;
  signature: `0x${string}`;
}): `0x${string}` {
  const publicKey = recoverPublicKey(args);
  return publicKeyToAddress(publicKey);
}

function recoverPublicKey(args: {
  hash: `0x${string}`;
  signature: `0x${string}`;
}): `0x${string}` {
  const recoveryBit = toRecoveryBit(args.signature);
  const signature = secp256k1.Signature.fromCompact(
    args.signature.substring(2, 130),
  ).addRecoveryBit(recoveryBit);

  const publicKey = signature
    .recoverPublicKey(args.hash.substring(2))
    .toHex(false);

  return `0x${publicKey}`;
}

function toRecoveryBit(signature: `0x${string}`): number {
  const v = parseInt(signature.slice(-2), 16);
  if (v === 0 || v === 1) {
    return v;
  }
  if (v === 27 || v === 28) {
    return v - 27;
  }
  throw new Error('Invalid v value');
}
